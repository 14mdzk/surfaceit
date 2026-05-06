# Architecture Overview

`${PROJECT_NAME}` is a **server-first SvelteKit application** that consumes a hexagonal-style backend through a typed API client and an SSE/WS realtime channel. Authentication is **session-cookie based** and resolved on the server. Stateful client services are **context-scoped**, never module singletons. Reactive collections use **`svelte/reactivity`**, not vanilla `Map`/`Set` plus reactivity hacks.

## Layered model

```
┌────────────────────────────────────────────────────────────────────────┐
│ src/routes/                                                            │
│   (auth)/  (app)/  api/  +error.svelte                                 │
│   page.server.ts → calls services → renders +page.svelte               │
└──────────────┬───────────────────────────────────────────┬─────────────┘
               │                                           │
               ▼                                           ▼
┌──────────────────────────┐               ┌──────────────────────────────┐
│ src/lib/domains/<name>/  │               │ src/lib/server/              │
│   schema.ts              │               │   session, csrf, headers     │
│   service.ts             │               │   bff/* upstream proxies     │
│   queries.ts             │               └──────────────────────────────┘
│   store.svelte.ts        │
│   components/            │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/lib/core/                                                        │
│   api/  auth/  realtime/  query/  config/  logger/  i18n/  result/   │
└──────────────┬───────────────────────────────────────────┬───────────┘
               │                                           │
               ▼                                           ▼
┌──────────────────────────┐               ┌──────────────────────────────┐
│ src/lib/shared/          │               │ src/lib/generated/           │
│   primitives/  composites│               │   openapi → ts (no edits)    │
│   hooks/  utils/         │               └──────────────────────────────┘
└──────────────────────────┘
```

## Data flow (request → render)

1. Browser hits a protected route under `(app)`.
2. `hooks.server.ts` resolves the session from the cookie (`sid`), populates `event.locals.session`, refreshes the upstream access token if expired, sets a request id on `event.locals.reqId`, and applies CSP / security headers.
3. The route's `+page.server.ts` `load` calls a domain service, which calls the typed `core/api` client. The api client targets either a BFF endpoint (`/api/...`) or the upstream directly when in the same trust domain.
4. Server-rendered HTML is sent. The page hydrates with the same data; svelte-query promotes the server fetch into its cache so the client does not re-fetch immediately.
5. The page may open an SSE connection through `core/realtime`. The connection routes through a BFF endpoint that injects the bearer; the browser never sees a token.

## Trust boundaries

| Boundary | Crosses | What is allowed |
|---|---|---|
| Browser → SvelteKit server | HTTP / SSE | Cookies (`sid`, `csrf`), public env, no upstream tokens |
| SvelteKit server → upstream | HTTP / SSE | Bearer token (server-held), tenant headers |
| Server-only modules | `*.server.ts`, `src/lib/server/**` | May read private env, secrets, sign cookies |
| Client modules | everywhere else | May read **only** `PUBLIC_*` env |

## Real-time

- One SSE client per *page* (or per *feature*) instantiated from a context factory in a layout.
- Channels are named constants. Consumers subscribe via handler maps merged into the client.
- Reactive state lives in domain stores, not in the SSE client. The client's only job is parse + dispatch.
- Reconnect with exponential backoff capped at 30 s; circuit opens after N failures and surfaces a banner.

## State

- **Server state** (data fetched from the API): owned by svelte-query in `core/query`. Cache key derived from the endpoint registry.
- **UI state** (filters, modals, selection): owned by domain stores via context factories.
- **Session state** (user, role, locale): owned by `core/auth`, hydrated server-side, exposed via context.
- **Module-singleton state is forbidden** for anything stateful. Pure constants and functions are fine.

## Errors

- All HTTP errors funnel through `ApiError` from `core/api/error.ts`.
- The api client classifies: network, auth, validation, conflict, server. The classifier feeds error toasts and svelte-query retry decisions.
- `+error.svelte` renders shell-level failures. `handleError` hook in both `hooks.server.ts` and `hooks.client.ts` ships errors to the logger.

## Realtime + Query interaction

- SSE events do not write to svelte-query directly. They publish to a domain *invalidator* that calls `queryClient.invalidateQueries(...)` or surgically updates the cache via `setQueryData`. This keeps the cache as the single source of truth for server data.

## i18n

- All user-facing strings live in `messages/` (Paraglide). Components import compiled message functions, never literals.
- Locale comes from cookie (`locale`), defaulting to `en`. Switching emits a server-side response that updates the cookie and reloads.

## Forbidden patterns

(See the **frontend** domain of the Obsidian wiki for the long-form rationale: [[Module Singleton Store Anti-Pattern]], [[Svelte 5 Reactive Collection Pitfall]], [[SvelteKit SSR Cookie Session BFF]], [[Endpoint Registry Pattern]].)

- Module-singleton stateful stores.
- `localStorage`-stored refresh tokens.
- `ssr = false` on protected routes.
- Hand-rolled `fetch` outside `core/api`.
- Vanilla `Map`/`Set` with `updateCounter` reactivity hacks. Use `SvelteMap` / `SvelteSet`.
- Backend-shape leakage in URL builders ("backend splits on commas").
- Inline user-facing strings.
