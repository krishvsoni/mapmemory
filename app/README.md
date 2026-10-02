# mapmemory dashboard

Admin dashboard for the mapmemory API — tenant onboarding, memory spaces, an
ingest/retrieve console, API key management, usage tracking, and two sign-in
paths (developer self-serve via Kinde, and enterprise SSO against a tenant's
own identity provider).

## Architecture

- **No `useEffect`, anywhere.** Data fetching happens in Server Components
  (`app/**/page.tsx`) and Server Actions (`app/**/actions.ts`) — both run
  outside the component render/mount lifecycle, so there's no fetch-after-render
  waterfall to manage. The one genuinely interactive screen (the space
  workbench: ingest text, run a retrieval query, see results without a full
  page reload) uses a Zustand store (`workbench.store.ts`) whose actions call
  Server Actions directly and update state from the response — no effect
  needed to synchronize anything.
- **No secrets on the frontend.** The session (an API key or, for enterprise
  SSO, a raw OIDC ID token — the backend's auth middleware accepts either on
  the same routes) lives in an `httpOnly`, `sameSite=lax` cookie set
  server-side (`lib/session.ts`) — never sent to client-side JavaScript, never
  in `localStorage`/`sessionStorage`. The backend URL is a server-only env var
  (`MAPMEMORY_API_URL`, no `NEXT_PUBLIC_` prefix), so it never ships in the
  client bundle. Every Kinde credential (client ID, client secret, issuer) also
  lives only in the backend's env — the frontend's `.env.local` holds nothing
  but `MAPMEMORY_API_URL`/`MAPMEMORY_DASHBOARD_URL`. An explicit proxy
  (`app/api/proxy/[...path]/route.ts`) is also available for any future
  client-side fetch that can't go through a Server Component/Action — it
  attaches the session server-side and blocks internal/webhook paths, so the
  real backend origin never appears in the browser's network tab even then.
- **SOC**: `lib/` holds the backend client, types, and session handling;
  `components/` holds generic presentational pieces reused across pages;
  each route's interactive bits (forms, the workbench) are colocated with
  that route rather than scattered into a shared state tree.

## Two sign-in paths

- **Developer (Kinde)** — the entire OAuth flow runs in the backend, not this
  app. `/login` → "Sign in with Kinde" is a plain link to `/login/developer`
  (`app/login/developer/route.ts`), a thin server redirect to the backend's
  `GET /v1/auth/kinde/login`. The backend owns discovery, PKCE, and the Kinde
  client secret; on callback it auto-provisions an isolated tenant for that
  Kinde user (revoking any previous session key, so repeated logins don't
  accumulate stale keys) and redirects back to `/login/developer/complete`
  with a short-lived, single-use opaque exchange code — never the API key
  itself — in the query string. That page trades the code for the real
  session by POSTing to the backend's `/v1/auth/kinde/exchange` and sets the
  session cookie. A stable key for CI/scripts is still available separately
  via `/api-keys`.
- **Enterprise (SSO)** — `/login/enterprise` asks for a Tenant ID, looks it up
  via the backend's public `/v1/sso/discover/:tenantId`, then runs a real
  OAuth2/OIDC authorization-code + PKCE flow (`openid-client`, `lib/enterprise-sso.ts`)
  against *that tenant's own* identity provider as a public client (the
  tenant's configured `audience` is used as the client_id; no client secret is
  stored per customer — their IdP client must support PKCE-only auth). The
  resulting ID token is dropped straight into the session cookie: the
  backend already accepts a raw OIDC JWT as a bearer token and verifies it
  itself, so no new backend verification path was needed for this flow.
  HTTPS is enforced for the issuer in production; non-production allows plain
  HTTP so a local IdP (e.g. Keycloak on localhost) can be tested.

## Setup

```bash
cp .env.local.example .env.local
npm install
npm run dev     # :3000, requires the mapmemory API running (see ../README.md)
```

Kinde app credentials go in the *backend's* `.env` (`KINDE_ISSUER_URL`,
`KINDE_CLIENT_ID`, `KINDE_CLIENT_SECRET`, `KINDE_CALLBACK_URL`) — this app
never sees them.

## Pages

- `/login` — Kinde sign-in, enterprise SSO, or (advanced) manual tenant
  creation / pasting an existing API key.
- `/login/enterprise` — enterprise SSO entry point (Tenant ID → redirect to
  that tenant's IdP).
- `/spaces` — list and create memory spaces.
- `/spaces/:id` — ingest observations, run retrieval queries, trigger a
  reflection pass, and see recent episodes and central entities for that space.
- `/api-keys` — issue role-scoped (`admin`/`member`/`readonly`), optionally
  space-scoped API keys; revoke existing ones.
- `/usage` — current plan and consumption against its limits.

## Known limitations

- SSO *configuration* (an admin registering their IdP), team member
  management, audit log, and billing all have working backend APIs (see
  `../README.md`) but no dashboard screens yet — the highest-value admin
  surfaces (spaces, keys, usage, the ingest/retrieve console, and now both
  sign-in paths) were built first. An admin configures SSO via the API
  directly (`POST /v1/sso/config`) today.
- No real-time job status push — the workbench's "refresh status" on an
  ingestion job is a manual poll, not a subscription.
- The enterprise SSO session is only as long-lived as the ID token the IdP
  issues (commonly ~1 hour) — there's no refresh-token handling yet, so a
  long dashboard session will eventually need to re-authenticate.
- Live end-to-end verification of the enterprise flow's token exchange step
  needs a real external IdP (or a fuller local mock than the discovery-only
  one used during development) — the discovery + PKCE authorization-URL
  construction was verified against a real local OIDC discovery document;
  the final code-for-token exchange was not.
