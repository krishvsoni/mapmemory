# mapmemory

Multi-tenant graph memory backend for LLM agents. Ingested text is distilled into
a semantic fact graph plus a layered episodic memory, and both are queried
together to assemble retrieval context.

A dashboard for this API (tenant onboarding, spaces, an ingest/retrieve
console, API keys, usage) lives in `app/` — see `app/README.md`.

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

### Graph algorithms

- **Connected-components reflection clustering** — reflection no longer
  batches the oldest N raw episodes by timestamp. It builds the
  episode↔entity bipartite graph for a space and finds connected components
  (union-find, `modules/memory/reflection/episode-clustering.ts`); the
  largest topic-coherent cluster is summarized, not an arbitrary time slice.
- **Centrality (PageRank)** over each space's active fact graph
  (`modules/graph/centrality.ts`, power-iteration with dangling-node mass
  redistribution) surfaces which entities matter most. Exposed at
  `GET /v1/spaces/:id/entities/central`, cached in Redis and invalidated
  whenever consolidation changes the edge set, and used as a small ranking
  boost in beam-search traversal so retrieval mildly favors well-connected
  entities over isolated ones.
- **Shortest path (BFS)** between two entities —
  `GET /v1/spaces/:id/path?from=&to=` (`modules/graph/pathfinding.service.ts`)
  — a genuine multi-hop "how is X connected to Y" query, not just RAG context
  assembly.

### Episodic memory

Beyond recency and fact-overlap, every episode carries an **importance**
score (1-10, rated by the LLM at ingestion) and an **access-count**
reinforcement signal (memories that keep getting retrieved decay slower).
Retrieval ranks episodes with a weighted composite of fact-overlap relevance,
direct query-to-episode embedding similarity, importance, recency decay, and
reinforcement (`modules/memory/retrieval/episodic-scoring.ts`, weights in
`EPISODIC_SCORE_WEIGHTS`). The query-similarity term mirrors the one genuinely
validated piece of prior art here — reverse-engineered graph-memory research
additively combines fact-overlap relevance with raw query/episode embedding
similarity for episodic ranking; this uses the same idea with normalized
cosine similarity instead of an unnormalized dot product.

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
- **Global LLM concurrency semaphore** (`modules/llm/global-concurrency.ts`)
  — `WORKER_CONCURRENCY` only caps concurrency *within* one process; this caps
  it *across every process sharing Redis* (`LLM_GLOBAL_MAX_CONCURRENT`), so
  scaling out worker replicas can't blow past your actual OpenRouter rate
  limit and trigger cluster-wide 429s. Implemented as a Redis sorted set
  (score = acquire time) with an atomic Lua acquire script — a crashed
  holder's slot self-expires via lease age rather than needing explicit
  cleanup. (The first cut used separate `ZCARD`/`ZADD` calls, which let
  concurrent callers all read the same stale count — caught by the test in
  `src/integration/llm-concurrency.integration.test.ts`, which actually fires
  25 concurrent calls against the real semaphore rather than asserting on
  the logic by inspection.)
- **Per-tenant rate limiting** (Redis-backed) on all authenticated routes.
- **Bounded input size** — ingest text is capped at 8,000 characters and
  retrieval queries at 2,000 (`INPUT_LIMITS` in `config/constants.ts`); an
  episode-count quota alone doesn't bound cost if a single request can carry
  unlimited text into the LLM call.
- Two-tier embedding cache (in-process LRU → shared Redis) across API and
  worker replicas.
- Superseded edges are hard-deleted only after a retention window
  (`npm run db:prune`), bounding storage growth without losing recent history.
- **Read/write split (CQRS-lite)** — set `DATABASE_READ_URL` to route
  read-heavy traversal, centrality, and retrieval queries to a replica; writes
  (ingestion, reinforcement) always go to the primary. Falls back to the
  primary for everything when unset — zero config required.

### Enterprise governance

- **RBAC + scoped API keys** — every key has a role (`admin` full access,
  `member` can ingest/retrieve, `readonly` retrieve-only) and an optional
  `scopedSpaceId` that confines it to one memory space, enforced in
  `modules/auth/authorize.middleware.ts`. Tenant-wide routes (space listing,
  key management, audit log, usage) reject scoped keys outright.
- **Audit log** — an append-only `audit_log` table records every
  tenant/space/key/ingestion/reflection event with the acting key id,
  timestamp, and metadata (`modules/audit`). Exposed at `GET /v1/audit-log`
  (admin only). Recording is best-effort and never blocks the action it logs.
- **Usage quotas** — `plan` on a tenant (`free`/`pro`/`enterprise`) maps to
  real enforced limits (`PLAN_LIMITS` in `config/constants.ts`): max memory
  spaces (checked against Postgres at creation time) and max episodes
  ingested per month (a Redis counter, atomic increment-then-check, same
  pattern as the rate limiter). `GET /v1/usage` reports current consumption
  against the limit.

### Single sign-on and team members

Two authentication paths work on the exact same routes: a plain `mm_...` API
key (for developers/automation), or a bearer JWT issued by the tenant's own
identity provider (for a human team logging in via their company's Keycloak,
Okta, Auth0, or any standard OIDC provider — the auth middleware tells the two
apart by prefix, `modules/auth/auth.middleware.ts`).

- An admin configures their IdP once via `POST /v1/sso/config` (issuer,
  audience/client id, optional explicit JWKS URI — otherwise discovered from
  the issuer's `/.well-known/openid-configuration`).
- Any subsequent request with `Authorization: Bearer <OIDC JWT>` is verified
  against that config (`modules/auth/oidc`, using `jose` for JWKS fetch +
  signature/issuer/audience verification). A **member** record is created on
  first login (`members` table) with the config's `defaultRole`, and reused
  (with `last_login_at` touched) on every subsequent login — no separate
  provisioning step per teammate.
- Multiple tenants can share one IdP issuer (e.g. one shared Keycloak
  instance): the lookup matches on issuer *and* verifies the token's audience
  against each candidate tenant's configured client id, so tenants stay
  isolated even when the issuer URL is identical.
- `GET /v1/members`, `PATCH /v1/members/:id` (role), `DELETE /v1/members/:id`
  manage the roster (admin only).

### Billing

Stripe-backed subscriptions, inactive until `STRIPE_SECRET_KEY` is set
(`modules/billing`). `POST /v1/billing/checkout-session` creates a Checkout
Session for the `pro`/`enterprise` plan; `POST /v1/billing/portal-session`
gives an existing customer self-service subscription management. A public
`POST /v1/webhooks/stripe` (signature-verified, outside the authenticated
route group) keeps `tenants.plan` in sync with Stripe on
`checkout.session.completed` and `customer.subscription.updated|deleted`.

## Stack

TypeScript, Fastify, PostgreSQL + pgvector (storage, HNSW vector search),
BullMQ + Redis (ingestion queue, reflection sweep, locks, rate limiting,
idempotency, fair scheduling, embedding cache), `jose` (OIDC/JWT verification),
Stripe (billing), Zod, Vitest.

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
- `GET /v1/spaces/:spaceId/entities/central?limit=` — top entities by PageRank centrality.
- `GET /v1/spaces/:spaceId/path?from=&to=` — shortest path (BFS) between two entities.
- `GET /v1/spaces/:spaceId/episodes?kind=raw|reflection` — recent episodes.
- `POST /v1/api-keys` / `GET /v1/api-keys` / `DELETE /v1/api-keys/:id` — issue,
  list, or revoke scoped API keys (admin only).
- `GET /v1/audit-log?limit=&eventType=` — tenant audit trail (admin only).
- `GET /v1/usage` — current plan, space count, and monthly episode count
  against their limits (admin only).
- `POST /v1/sso/config` / `GET /v1/sso/config` / `DELETE /v1/sso/config` —
  configure, inspect, or disable the tenant's OIDC identity provider (admin only).
- `GET /v1/members` / `PATCH /v1/members/:id` / `DELETE /v1/members/:id` —
  manage human team members provisioned via SSO login (admin only).
- `POST /v1/billing/checkout-session` / `POST /v1/billing/portal-session` —
  Stripe subscription management (admin only, requires `STRIPE_SECRET_KEY`).
- `POST /v1/webhooks/stripe` — public, Stripe-signature-verified webhook.

## Testing

`npm test` runs pure unit tests plus, when Postgres/Redis are reachable
(`DATABASE_URL`/`REDIS_URL`), three integration suites under `src/integration/`:

- `memory-loop.integration.test.ts` — the full ingest → corroborate →
  supersede → retrieve → reflect loop, using a deterministic scripted LLM stub
  (no API key needed). Exists because the only way a prior Postgres-specific
  bug (`sql\`col = ANY(${array})\`` silently mis-binding) was ever caught was
  by manually curling a live server — it's now a permanent regression guard.
- `oidc-auth.integration.test.ts` — a real generated RSA keypair, a real HTTP
  JWKS endpoint (ephemeral local server), and real `jose` signature
  verification: valid login, member reuse on second login, wrong audience,
  untrusted issuer, expired token, and disabled-SSO all exercised for real.
- `billing-webhook.integration.test.ts` — real Stripe HMAC signature
  generation/verification and real plan upgrade/downgrade logic, using
  Stripe's own `generateTestHeaderString` test helper. No live Stripe account
  needed, since signature verification and the subscription-updated/deleted
  handlers are pure local logic; only `checkout.session.completed` (which
  calls the real Stripe API to look up a subscription) isn't covered here.

All three skip themselves cleanly if their prerequisites (database, or
`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_ID_PRO`) aren't set.

## Operations

- `npm run db:prune` — hard-deletes superseded edges past the retention window
  (`RETENTION_DEFAULTS.supersededEdgeRetentionDays`, default 30). Run on a
  schedule in production.
- `WORKER_CONCURRENCY` tunes how many ingestion jobs run in parallel per
  worker process; `LLM_GLOBAL_MAX_CONCURRENT` tunes the hard cap across *all*
  processes combined — set the latter to match your actual OpenRouter rate
  limit tier, independent of how many replicas you run.
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
- Monthly episode quota enforcement is a soft limit: it's atomic per-request
  (Redis `INCR`-then-check, same as the rate limiter) but a tenant can still
  land a few requests over the line under heavy concurrent bursts right at
  the boundary. Fine for cost protection; not a hard billing guarantee.
- Audit log and usage endpoints are tenant-scoped reads only — no export job,
  retention policy, or SIEM/webhook push yet. A `/metrics` (Prometheus) endpoint
  and outbound webhooks for domain events (fact created/superseded, reflection
  created) are the natural next additions for enterprise observability and
  integration, not yet built.
- SSO members get tenant-wide role-based access on first login; there's no
  per-space membership scoping for human users yet (API keys support
  `scopedSpaceId`, members don't) — add if a customer needs per-team-member
  space isolation.
- `checkout.session.completed` calls the real Stripe API to retrieve the
  subscription and isn't covered by the test suite (would need a real Stripe
  test-mode account or a mocking layer); the signature verification and
  subscription-updated/deleted paths it shares are fully tested.
