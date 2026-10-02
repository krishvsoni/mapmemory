# mapmemory

Multi-tenant graph memory backend for LLM agents. Ingested text is distilled into
a semantic fact graph plus a layered episodic memory, and both are queried
together to assemble retrieval context.

## Architecture

### Graph creation

- **Entity typing** — every extracted entity is tagged (person/location/item/
  organization/event/concept/other). Entity-merge clustering only ever unions
  same-type entities, so a person and a place with similar embeddings never
  collapse into one node.
- **Relation canonicalization** — relation strings are resolved against a
  per-space vocabulary (`relation_vocabulary`, embedding-indexed) so paraphrases
  ("has", "owns", "possesses") converge on one canonical relation instead of
  fragmenting the graph (`modules/graph/relation-resolver.ts`).
- **Corroboration over duplication** — restating an already-active fact
  increments its `corroboration_count` instead of inserting a duplicate edge
  (`GraphService.upsertOrCorroborateEdge`). Genuine updates still go through
  contradiction resolution and supersede the old edge.
- **Fact history** — `GET /v1/spaces/:id/edges/:edgeId/history` walks the
  supersede chain, exposing what used to be true and when it changed.

### Episodic memory

Beyond recency and fact-overlap, every episode carries an **importance**
score (1-10, rated by the LLM at ingestion) and an **access-count**
reinforcement signal (memories that keep getting retrieved decay slower).
Retrieval ranks episodes with a weighted composite of relevance, importance,
recency decay, and reinforcement (`modules/memory/retrieval/episodic-scoring.ts`,
weights in `EPISODIC_SCORE_WEIGHTS`).

A background **reflection** job periodically clusters unreflected raw
episodes per space and asks the LLM to synthesize a higher-level insight,
stored as its own `kind: 'reflection'` episode linked back to its sources
(`episode_sources`). This builds a memory hierarchy — compact reflections
retrievable in place of dozens of raw entries — the way a sleep-consolidation
pass would. Trigger manually with `POST /v1/spaces/:id/reflect`, or run
`npm run worker:reflect` for the periodic sweep.

### Ingestion loop

Triplet extraction (with model cascading: escalate to a stronger model only
if the cheap one extracts nothing) → entity clustering → relation
canonicalization → contradiction resolution (capped to the most relevant
existing facts, not a hub entity's entire fact set) → one atomic database
transaction for node/edge upsert, episode creation, and edge linking,
serialized per memory space with a Redis lock
(`modules/distributed/space-lock.ts`) so concurrent ingests into the same
space can't race each other's entity resolution or contradiction checks.

### Retrieval loop

Embedding-seeded beam search over the semantic graph
(`modules/graph/traversal.service.ts`) combined with the composite episodic
score above. Retrieval also reinforces whichever episodes it returns.

### Distributed systems / multi-tenant SaaS

- Per-space Redis lock around the consolidation write (above).
- **Idempotency keys** — an `Idempotency-Key` header on ingestion dedupes
  retries from the caller's side; a second request with the same key gets the
  original job id back instead of double-ingesting.
- **Fair per-tenant scheduling** — ingestion jobs are enqueued with a BullMQ
  priority derived from each tenant's recent request volume
  (`modules/distributed/fair-priority.ts`), so one busy tenant can't starve
  another's queue.
- **Circuit breaker** around the LLM provider (`modules/llm/circuit-breaker.ts`)
  — after repeated failures it fails fast for a cooldown window instead of
  letting a provider outage back up the whole ingestion queue.
- **Per-tenant rate limiting** (Redis-backed) on all authenticated routes.
- Two-tier embedding cache (in-process LRU → shared Redis) across API and
  worker replicas.
- Superseded edges are hard-deleted only after a retention window
  (`npm run db:prune`), bounding storage growth without losing recent history.

## Stack

TypeScript, Fastify, PostgreSQL + pgvector (storage, HNSW vector search),
BullMQ + Redis (ingestion queue, reflection sweep, locks, rate limiting,
idempotency, fair scheduling, embedding cache), Zod, Vitest.

## Setup

```bash
cp .env.example .env   # fill in OPENROUTER_API_KEY and the two secrets
docker compose up -d   # postgres (pgvector) + redis
npm install
npm run db:migrate
npm run dev              # API on :4000
npm run worker           # ingestion queue consumer
npm run worker:reflect   # periodic reflection sweep
```

## API

All routes except `POST /v1/tenants` require `Authorization: Bearer <api key>`.

- `POST /v1/tenants` — provision a tenant, returns its API key (shown once).
- `POST /v1/spaces` / `GET /v1/spaces` — manage memory spaces for the tenant.
- `POST /v1/spaces/:spaceId/episodes` — ingest an observation; returns a job
  id. Optional `Idempotency-Key` header dedupes retries.
- `GET /v1/jobs/:jobId` — poll ingestion job status.
- `POST /v1/spaces/:spaceId/reflect` — manually trigger a reflection pass.
- `POST /v1/spaces/:spaceId/retrieve` — query the graph, returns ranked facts
  and the episodes (raw or reflection) that grounded them.
- `GET /v1/spaces/:spaceId/nodes/:nodeId/facts` — active facts about one entity.
- `GET /v1/spaces/:spaceId/edges/:edgeId/history` — the supersede chain for one fact.
- `GET /v1/spaces/:spaceId/episodes?kind=raw|reflection` — recent episodes.

## Operations

- `npm run db:prune` — hard-deletes superseded edges past the retention window
  (`RETENTION_DEFAULTS.supersededEdgeRetentionDays`, default 30). Run on a
  schedule in production.
- `WORKER_CONCURRENCY` tunes how many ingestion jobs run in parallel per
  worker process; tune against your OpenRouter rate limit.
- `OPENROUTER_ESCALATION_CHAT_MODEL` is optional; leave unset to disable
  model cascading entirely.

## Known limitations

- The per-space lock serializes consolidation writes within a space but is a
  single-Redis-instance lock, not a quorum-based Redlock — acceptable at
  current scale, would need hardening for multi-region Redis.
- `EMBEDDING_DIMENSIONS` defaults to 1536; if you change it, update the
  `vector(1536)` columns in `src/db/sql/0000_init.sql` and `0002_memory_v2.sql`
  to match.
- Migrations are plain SQL files applied in order by `npm run db:migrate`
  (`src/db/sql/*.sql`) — no separate codegen step (drizzle-kit's bundler
  doesn't resolve this project's NodeNext-style relative imports).
