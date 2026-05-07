# Roadmap — ${PROJECT_NAME}

Phased delivery. Each phase ends with a tagged commit and an updated `CHANGELOG.md` (introduced in Phase 1).

## Phase 0 — Foundation (no production code)

Goal: turn the empty SvelteKit skeleton into a documented, governed repo.

- [ ] Root `CLAUDE.md`
- [ ] `docs/` archive (charter, roadmap, architecture, decisions, wiki, guides)
- [ ] `.claude/rules/` (15 always-apply rules)
- [ ] `.claude/agents/` adapted personas + specialist roster
- [ ] `.claude/CLAUDE.md` minor index
- [ ] First ADRs (0001–0005) accepted

Exit criteria: a fresh agent can read the docs and act safely without inventing conventions.

## Phase 1 — Skeleton wiring

Goal: project boots, builds, tests run green on an empty shell.

- [x] Add deps: Tailwind v4, Zod, `@tanstack/svelte-query`, Paraglide JS, pino, `openapi-typescript`, msw, vitest, `@playwright/test`, `@sveltejs/adapter-node`.
- [x] Folder skeleton under `src/lib/{core,shared,domains,server,generated}` and `src/routes/{(auth),(app),api}`.
- [x] SSR enabled. `hooks.server.ts` with auth + CSP + request-id + `handleError`.
- [x] Global `+error.svelte`.
- [x] ESLint flat config, Prettier, lefthook pre-commit.
- [x] CI: `bun install`, `check`, `lint`, `test`, `build`.

Exit criteria: `bun run dev` shows an empty layout with i18n locale switch wired; `bun run test` (Vitest) green. **Met** — see CHANGELOG `[Unreleased] Phase 1`.

## Phase 2 — Core primitives

Goal: every primitive a domain will need is in `src/lib/core/`.

- `core/api` — endpoint registry v2 (request *and* response types), `core-fetch`, `ApiError`, refresh in BFF.
- `core/auth` — context-scoped session, cookie-session helpers, refresh rotation server-side.
- `core/realtime` — `SSEClient` adapted to `SvelteMap` and context-DI.
- `core/query` — svelte-query client + `defineQuery` / `defineMutation` tied to endpoint registry.
- `core/config` — Zod-validated env loader (public/private split).
- `core/logger` — pino server, leveled console client.
- `core/i18n` — Paraglide setup with English catalog only.

Exit criteria: a stub domain can authenticate, fetch, mutate, and receive an SSE event using only `core/*`.

## Phase 3 — Reusable shells

Goal: a developer copies one folder and gets a feature.

- `shared/primitives` — shadcn-svelte init, hand-forked, renamed `components/ui` → `components/primitives`.
- `shared/composites` — paginator, data-table (TanStack), filter-bar, error-state, empty-state.
- `domains/_template` — copy-pasteable domain pattern (schema, service, queries, store factory, components).
- `routes/(auth)/login` — working SSR login flow.
- `routes/(app)` — session-guarded shell with sidebar, header, locale switch.
- `routes/api` — BFF proxy (cookie → bearer).

Exit criteria: copying `_template` to `domains/example` and adding a route gives a working CRUD page in under an hour.

## Phase 4 — Codegen + DX

Goal: backend contract changes flow into the frontend automatically.

- Wire `openapi-typescript` against `goscratch` OpenAPI; placeholder spec until then.
- Generator scripts: `bun run new:domain <name>`, `bun run new:route <path>`.
- ADR pipeline: PR template that prompts "does this need an ADR?".
- README quickstart, architecture diagram (Mermaid), screenshots.
- `docs/guides/*` filled out.

Exit criteria: a backend rename triggers a typed compile error in the frontend within one `bun run codegen` cycle.

## Phase 5 — Hardening

Goal: the boilerplate is forkable for production.

- Lighthouse a11y ≥ 95.
- CSP / HSTS / Referrer-Policy / Permissions-Policy headers verified by integration test.
- Sentry-style error pipeline plug point.
- Rate-limit-aware fetch retry policy.
- Observability sample (request ID through hooks → BFF → upstream → logger).
- Performance budget enforced in CI (bundle size guard).

Exit criteria: forking the repo and renaming `${PROJECT_NAME}` produces a deployable shell.

## Out of scope until later

- SSR streaming
- Multi-tenant tenant resolver
- Feature flags
- A11y testing automation beyond Lighthouse
- Visual regression suite
