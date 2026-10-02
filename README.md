# mapmemory

Multi-tenant graph memory backend for LLM agents. Ingested text is distilled into
a semantic fact graph plus an episodic provenance layer, and both are queried
together to assemble retrieval context.

## Architecture

- **Semantic graph** — entities as nodes, relations as directed labeled edges.
  Each edge carries an embedding and can be superseded by a newer edge when a
  later observation updates or contradicts it (soft delete via
  `superseded_by_edge_id`, never destructive). Superseded edges are hard-deleted
  only after a retention window (`npm run db:prune`), bounding storage growth
  without losing recent history.
- **Episodic graph** — one row per ingested observation, linked to every
  semantic edge it produced. Gives provenance and supports an overlap + recency
  scoring formula independent of the semantic graph.
- **Entity resolution** — within a single ingestion batch, mentions are
  clustered by embedding similarity (`modules/graph/entity-resolver.ts`,
  union-find) before touching the database, so "the rusty key" and "rusty key"
  mentioned in the same observation collapse to one node instead of fragmenting
  the graph.
- **Ingestion loop** (`modules/memory/consolidation`) — triplet extraction →
  entity clustering → contradiction resolution (bounded to the most relevant
  existing facts, not the full fact set touching an entity) → one atomic
  database transaction for node/edge upsert, episode creation, and edge
  linking. Runs off a BullMQ queue so ingestion scales independently of the
  API, and a job retry can't leave a half-written episode behind.
- **Retrieval loop** (`modules/memory/retrieval`) — embedding-seeded beam
  search over the semantic graph (`modules/graph/traversal.service.ts`)
  combined with an episodic relevance score that blends fact-overlap,
  log(episode size), and an exponential recency decay so old episodes don't
  permanently outrank fresh ones.
- **Multi-tenancy** — every memory space belongs to a tenant; API key auth
  resolves the tenant per request, all graph/episode queries are scoped by
  `space_id`, and a Redis-backed per-tenant rate limit protects shared LLM
  cost from a single noisy tenant.

## Stack

TypeScript, Fastify, PostgreSQL + pgvector (storage, HNSW vector search),
BullMQ + Redis (ingestion queue, rate limiting, shared embedding cache), Zod
(validation), Vitest.

## Setup

```bash
cp .env.example .env   # fill in OPENROUTER_API_KEY and the two secrets
docker compose up -d   # postgres (pgvector) + redis
npm install
npm run db:migrate
npm run dev             # API on :4000
npm run worker          # separate process, consumes the ingestion queue
```

## API

All routes except `POST /v1/tenants` require `Authorization: Bearer <api key>`.

- `POST /v1/tenants` — provision a tenant, returns its API key (shown once).
- `POST /v1/spaces` / `GET /v1/spaces` — manage memory spaces for the tenant.
- `POST /v1/spaces/:spaceId/episodes` — ingest an observation; returns a job id.
- `GET /v1/jobs/:jobId` — poll ingestion job status.
- `POST /v1/spaces/:spaceId/retrieve` — query the graph, returns ranked facts
  and the episodes that grounded them.
- `GET /v1/spaces/:spaceId/nodes/:nodeId/facts` — active facts about one entity.
- `GET /v1/spaces/:spaceId/episodes` — recent raw episodes.

## Operations

- `npm run db:prune` — hard-deletes superseded edges past the retention window
  (`RETENTION_DEFAULTS.supersededEdgeRetentionDays`, default 30). Run on a
  schedule (cron/CI) in production.
- The OpenRouter provider retries 429/5xx/network errors with exponential
  backoff (`modules/llm/retry.ts`); non-retryable failures surface immediately.
- Embeddings are cached two levels deep: an in-process LRU, then Redis
  (shared across API and worker replicas) before falling back to the provider.

## Known limitations

- The read of existing facts used to build the contradiction-resolution prompt
  happens just before, not inside, the write transaction — under concurrent
  ingestion into the same space there's a narrow window where two ingests
  could both supersede the same fact. Acceptable for current scale; would need
  an advisory lock per space to close entirely.
- `EMBEDDING_DIMENSIONS` defaults to 1536; if you change it, update the
  `vector(1536)` columns in `src/db/sql/0000_init.sql` to match.
- Migrations are plain SQL files applied in order by `npm run db:migrate`
  (`src/db/sql/*.sql`) — no separate codegen step (drizzle-kit's bundler
  doesn't resolve this project's NodeNext-style relative imports).
