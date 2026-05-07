# Folder Layout

This file is the canonical map. If a layout change is proposed, update this file in the same PR.

```
${PROJECT_NAME}/
├── CLAUDE.md                       project entry for any agent
├── docs/                           archive (charter, roadmap, architecture, decisions, wiki, guides)
├── .claude/
│   ├── CLAUDE.md                   wiki pointer
│   ├── agents/                     personas + specialists
│   ├── rules/                      always-applied behavioral rules
│   └── settings.local.json
├── messages/                       Paraglide JS message catalogs (en.json, …)
├── openapi/                        upstream OpenAPI spec snapshot (Phase 4+)
├── scripts/                        codegen, scaffolding, release helpers
├── static/                         publicly served assets
├── src/
│   ├── app.d.ts                    App.Locals, App.PageData, App.Error
│   ├── app.html                    shell HTML
│   ├── hooks.server.ts             auth, session, CSP, reqID, handleError
│   ├── hooks.client.ts             client error reporter, locale init
│   ├── lib/
│   │   ├── core/                   framework primitives, no domain logic
│   │   │   ├── api/                endpoint registry, core-fetch, error, envelope
│   │   │   ├── auth/               session context, role helpers
│   │   │   ├── realtime/           SSE/WS client, channel constants, reconnect
│   │   │   ├── query/              svelte-query setup + defineQuery/Mutation
│   │   │   ├── config/             zod-validated env loader (public/private split)
│   │   │   ├── logger/             pino + client wrapper
│   │   │   ├── i18n/               Paraglide setup, locale resolver
│   │   │   ├── result/             Result<T,E>, ApiError
│   │   │   └── types/              cross-cutting brand types
│   │   ├── shared/                 cross-domain UI + utils
│   │   │   ├── primitives/         shadcn-svelte forked components (Button, Input, …)
│   │   │   ├── composites/         paginator, data-table, filter-bar, empty/error states
│   │   │   ├── hooks/              is-mobile, click-outside, etc.
│   │   │   └── utils/              cn, date, debounce, parseSearchParams
│   │   ├── domains/                bounded contexts mirroring backend modules
│   │   │   └── _template/          copy-pasteable starter
│   │   │       ├── schema.ts       zod (often re-export from generated)
│   │   │       ├── service.ts      typed service (apiGet/Post/...)
│   │   │       ├── queries.ts      svelte-query keys + defineQuery/Mutation
│   │   │       ├── store.svelte.ts context factory for UI state
│   │   │       └── components/
│   │   ├── server/                 server-only modules (never bundled to client)
│   │   │   ├── session.ts          cookie session reader/writer
│   │   │   ├── headers.ts          CSP, HSTS, etc.
│   │   │   └── bff/                upstream proxies (cookie → bearer)
│   │   └── generated/              openapi-typescript output, do not edit
│   └── routes/
│       ├── +layout.svelte          theme/Toaster bootstrap
│       ├── +layout.server.ts       session, locale, role hydration
│       ├── +error.svelte           global error boundary
│       ├── (auth)/                 public auth pages (login, reset, …)
│       │   └── login/+page.{svelte,server.ts}
│       ├── (app)/                  protected app shell
│       │   ├── +layout.server.ts   guard: redirect if no session
│       │   ├── +layout.svelte      sidebar/header shell
│       │   └── …features
│       └── api/                    BFF endpoints
│           └── upstream/[...]/     proxy with bearer injection
├── tests/                          e2e Playwright specs
├── eslint.config.js
├── prettier config
├── lefthook.yml
├── playwright.config.ts
├── vitest.config.ts
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## Aliases

Configured in `svelte.config.js`:

| Alias | Path |
|---|---|
| `$lib` | `src/lib` |
| `$core` | `src/lib/core` |
| `$shared` | `src/lib/shared` |
| `$domains` | `src/lib/domains` |
| `$server` | `src/lib/server` |
| `$generated` | `src/lib/generated` |
| `$routes` | `src/routes` |
| `$messages` | `messages` |

`$server` and `$generated` are import-allowlisted — see `architecture/layer-rules.md`.

## File naming

- Svelte components: `kebab-case.svelte`
- TS modules: `kebab-case.ts`
- Files containing runes: must end in `.svelte.ts` or live inside a `.svelte` component.
- Server-only TS: must end in `.server.ts` **or** live under `src/lib/server/**`.
- Tests: co-located `*.test.ts` for units (Vitest); `e2e/**.e2e.ts` for Playwright. The `.e2e.ts` extension keeps Bun's built-in `bun test` runner from grabbing Playwright specs (it globs `*.{test,spec}.{ts,tsx,js,jsx}` and has no exclude config).

## Forbidden

- `src/lib/utils.ts` mega-file. Split per concern under `src/lib/shared/utils/`.
- Components living outside `shared/primitives`, `shared/composites`, or a domain folder.
- Stores under `src/lib/stores/`. Stores live with their domain.
- "miscellaneous" or "common" folders. Name what is in it.
