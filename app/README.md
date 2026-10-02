# mapmemory dashboard

Admin dashboard for the mapmemory API — tenant onboarding, memory spaces, an
ingest/retrieve console, API key management, and usage tracking.

## Architecture

- **No `useEffect`, anywhere.** Data fetching happens in Server Components
  (`app/**/page.tsx`) and Server Actions (`app/**/actions.ts`) — both run
  outside the component render/mount lifecycle, so there's no fetch-after-render
  waterfall to manage. The one genuinely interactive screen (the space
  workbench: ingest text, run a retrieval query, see results without a full
  page reload) uses a Zustand store (`workbench.store.ts`) whose actions call
  Server Actions directly and update state from the response — no effect
  needed to synchronize anything.
- **No secrets on the frontend.** The tenant's API key lives in an `httpOnly`,
  `sameSite=lax` cookie set by a Server Action (`lib/session.ts`) — it is
  never sent to client-side JavaScript, never in `localStorage`/`sessionStorage`,
  and the backend URL is read from a server-only env var (`MAPMEMORY_API_URL`,
  no `NEXT_PUBLIC_` prefix) so it never ships in the client bundle either.
- **SOC**: `lib/` holds the backend client, types, and session handling;
  `components/` holds generic presentational pieces reused across pages;
  each route's interactive bits (forms, the workbench) are colocated with
  that route rather than scattered into a shared state tree.

## Setup

```bash
cp .env.local.example .env.local   # point at the running mapmemory API
npm install
npm run dev     # :3000, requires the mapmemory API running (see ../README.md)
```

## Pages

- `/login` — create a tenant (provisions an API key) or paste an existing one.
- `/spaces` — list and create memory spaces.
- `/spaces/:id` — ingest observations, run retrieval queries, trigger a
  reflection pass, and see recent episodes and central entities for that space.
- `/api-keys` — issue role-scoped (`admin`/`member`/`readonly`), optionally
  space-scoped API keys; revoke existing ones.
- `/usage` — current plan and consumption against its limits.

## Known limitations

- SSO configuration, team member management, audit log, and billing all have
  working backend APIs (see `../README.md`) but no dashboard screens yet —
  the highest-value admin surfaces (spaces, keys, usage, the ingest/retrieve
  console) were built first.
- No real-time job status push — the workbench's "refresh status" on an
  ingestion job is a manual poll, not a subscription.
