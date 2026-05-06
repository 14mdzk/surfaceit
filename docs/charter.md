# Charter — ${PROJECT_NAME}

## What this is

A SvelteKit + TypeScript frontend boilerplate engineered as a **long-lived starting point**, not a single product. Every product fork inherits a working auth surface, a typed API client, a real-time pipeline, an i18n harness, a testing stack, and a documented design discipline.

The first concrete consumer is the `goscratch` backend (hexagonal Go). The boilerplate is **backend-shape-agnostic** — anything that exposes an OpenAPI spec and JSON envelopes should plug in.

## Why this exists

Built from the lessons of `flowcount/frontend`, where ad-hoc choices accreted into:

- module-singleton stores that block testing and SSR scoping
- a god-object dashboard store with reactivity hacks
- client-only auth with refresh tokens in `localStorage`
- hand-written Zod schemas drifting from backend contracts
- inline Indonesian copy with no i18n path
- zero tests, zero CI, two parallel auth surfaces (one unused)

`${PROJECT_NAME}` exists so the next product never starts from there. The cost of getting the foundation right once is paid back the first time we fork.

## Goals

1. **SSR-first** auth and data flow. No blank flashes, no localStorage bearer tokens.
2. **Codegen-first** API contracts. Hand-written schemas only when codegen genuinely cannot express the shape.
3. **Context-DI everywhere.** No module singletons for stateful services.
4. **Reactive collections done right.** `SvelteMap` / `SvelteSet` over manual `updateCounter++` hacks.
5. **Domain isolation.** One folder per backend module — schema, service, queries, store factory, components — no cross-domain imports.
6. **i18n on day one.** English-only catalog, but every string flows through the i18n layer.
7. **Tests are a default, not a stretch goal.** Vitest + Playwright + MSW wired before the first feature ships.
8. **Docs are part of the contract.** A change without a doc update is incomplete.

## Non-goals

- A design system marketplace. We ship our tokens; downstream products fork them.
- A drop-in admin panel generator. We ship patterns, not screens.
- Backend code. The boilerplate consumes APIs; it does not implement them.
- Mobile-native. We are responsive web. Add Capacitor or Tauri later if needed.
- A microfrontend shell. Monorepo split or microfrontends are explicit later decisions, not assumed.

## Success criteria

`${PROJECT_NAME}` succeeds when:

1. A new product fork can authenticate, list a paginated resource, mutate it, and stream a real-time update **without writing infrastructure code** — only domain code.
2. A new engineer can read `docs/architecture/overview.md` plus one domain folder and ship a feature within a day.
3. A green CI run guarantees: typecheck, lint, unit tests, e2e smoke, build, security headers verified.
4. No singleton stateful service exists in `src/lib/core/**`.
5. No hand-rolled fetch calls exist outside `src/lib/core/api/**`.
6. No user-facing English string lives outside the i18n catalog.
7. Lighthouse a11y ≥ 95 on the reference shell.
8. Bundle: initial JS for the reference shell route ≤ 180 KB gzipped.

## Out of scope (for now)

- Multi-tenant routing
- Feature-flag service integration (interface-only stub may exist)
- Analytics/telemetry pipeline beyond log forwarding
- Service worker / offline mode

## Glossary

- **Domain** — a bounded slice that mirrors a backend module, e.g. `domains/user`, `domains/billing`.
- **Core** — framework primitives with zero domain knowledge: api, auth, realtime, query, i18n, logger, config.
- **Shared** — cross-domain UI and utilities: primitives, composites, hooks, helpers.
- **Server-only** — code under `src/lib/server/**` or `*.server.ts` that must never bundle into the client.
- **BFF endpoint** — a route under `src/routes/api/**` that the frontend calls; it proxies to the upstream backend with the cookie-session translated to a bearer token.
