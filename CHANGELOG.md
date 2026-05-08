# Changelog

All notable changes to surfaceit are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once it tags a release.

## [Unreleased]

### Added

- **Phase 1 — Skeleton wiring.**
  - Adapter swap: `@sveltejs/adapter-auto` → `@sveltejs/adapter-node`.
  - Runtime deps: `zod`, `@tanstack/svelte-query`, `pino`, `@inlang/paraglide-js`.
  - Dev deps: `tailwindcss@^4`, `@tailwindcss/vite`, `openapi-typescript`,
    `msw`, `vitest`, `@vitest/ui`, `jsdom`, `@playwright/test`, `eslint`
    flat-config stack, `prettier` + svelte/tailwind plugins, `lefthook`.
  - Folder skeleton anchored with `.gitkeep`s under
    `src/lib/{core,shared,domains,server,generated}` and
    `src/routes/{(auth),(app),api}` per
    `docs/architecture/folder-layout.md`.
  - SvelteKit aliases (`$core`, `$shared`, `$domains`, `$server`,
    `$generated`, `$routes`, `$messages`) wired in `svelte.config.js`.
  - Tailwind v4: `@tailwindcss/vite` plugin + `src/app.css` (`@import 'tailwindcss';`)
    imported from the root layout.
  - Paraglide JS 2.x: `project.inlang/settings.json`, `messages/en.json`
    (English-only catalog), `paraglideVitePlugin` wired in `vite.config.ts`,
    `bun run i18n:compile` (and chained into `check` / `test` / `prepare`
    so a fresh clone produces the generated bundles before any tooling
    consumes them).
  - `src/hooks.server.ts` four-stage pipeline: request id → auth shell →
    Paraglide locale → security headers (CSP, Referrer-Policy, X-Content-Type-Options,
    Permissions-Policy, HSTS in non-dev). `handleError` logs through pino
    with the request id and returns a sanitized `App.Error`.
  - `src/app.d.ts` types for `App.Locals` (requestId, session, locale) and
    `App.Error` (message, code, requestId).
  - Root layout with locale switch, root page with `m.hello()`, accessible
    `+error.svelte` boundary that surfaces status, message, and request id.
  - `src/lib/core/i18n` (re-exports Paraglide), `src/lib/core/logger`
    (universal leveled console + `pino.server.ts` server sink with redaction),
    `src/lib/core/config` (Phase 1 placeholder).
  - ESLint flat config (`@eslint/js` → typescript-eslint → eslint-plugin-svelte
    → eslint-config-prettier) with `no-console` enforcement in `src/**`.
  - Prettier (`tabs`, `singleQuote`, `printWidth: 100`) with svelte +
    tailwind plugins; `.prettierignore` mirrors ESLint and excludes
    authoritative docs.
  - `lefthook.yml` pre-commit: prettier, eslint, `bun run check` on staged
    TS/Svelte files.
  - Vitest config with the SvelteKit Vite plugin; one smoke unit at
    `src/lib/core/config/config.test.ts`.
  - Playwright config + single smoke spec at `e2e/smoke.e2e.ts` that
    asserts the locale switch is visible. The `.e2e.ts` extension and
    `testMatch: '**/*.e2e.ts'` keep Bun's built-in test runner (`bun test`)
    from accidentally collecting Playwright specs — Bun's runner globs
    `*.{test,spec}.{ts,tsx,js,jsx}` and has no path-exclude config, so
    the project relies on the file extension to keep the two runners
    disjoint. Use `bun run test` for unit (Vitest) and `bun run test:e2e`
    for end-to-end (Playwright); `bun test` (built-in) is not used.
  - GitHub Actions: `ci.yml` (install → codegen → check → lint → test →
    build, single ubuntu-latest, bun-store cache), `e2e.yml` (pull_request
    only, `continue-on-error: true`, becomes blocking in Phase 5).
  - This `CHANGELOG.md` (`## [Unreleased]` section).

### Notes / deviations

- The brief listed `@inlang/paraglide-sveltekit` as a separate dep.
  Paraglide JS 2.x ships its SvelteKit-compatible Vite plugin
  (`paraglideVitePlugin`) inside `@inlang/paraglide-js` itself; the
  separate adapter package is no longer required. See ADR 0006.

- **Phase 2 — Wave-1 (config, cn+tokens, day-one docs).**
  - `core/config`: Zod-validated env loader (public/private split).
    `publicConfig` reads from `$env/static/public`
    (`PUBLIC_API_URL`, `PUBLIC_LOG_LEVEL`, `PUBLIC_APP_NAME`);
    `serverConfig` reads from `$env/static/private`
    (`UPSTREAM_API_URL`, `SESSION_SECRET ≥ 32`, `NODE_ENV`, `isProd`)
    and is colocated in `index.server.ts` so SvelteKit's Vite plugin
    enforces server-only at build time. `.env.example` documents the
    contract; `.env.test` ships safe placeholders so a fresh clone
    passes `bun run check` without populating `.env`.
  - `package.json` `check` / `check:watch` now pass
    `--mode test` to `svelte-kit sync` so ambient `$env/static/*`
    types resolve under a clean clone.
  - `shared/utils/cn`: `clsx` + `tailwind-merge` merger. The only
    class merger in the repo. 10 Vitest cases.
  - `app.css` design tokens: neutral and accent ramps (5 stops),
    light/dark pair, semantic aliases (`--color-bg/fg/muted/border/
surface/accent/destructive`), radius scale, three-step elevation,
    motion durations (0 ms under `prefers-reduced-motion`), easings,
    base font-size/line-height, three control heights. Tailwind v4
    `@theme` exposes them as utility classes.
  - Day-one docs: README rewrite (quickstart, layout, doc-reading
    order, phase status), three guides (`add-a-domain`, `add-a-route`,
    `run-tests`) with Phase 2 in-flight gaps blockquoted, and
    `.github/PULL_REQUEST_TEMPLATE.md` encoding `definition-of-done.md`
    - `agent-dispatch.md` (rules cited, ADR check, every task
      complete before opening, persona/specialist dispatch named).
  - Runtime deps: `clsx@^2.1.1`, `tailwind-merge@^3.5.0` — rationale
    in `docs/decisions/dependencies.md`.

  Wave-1 known deferrals (Wave-2 follow-ups):
  - `.dark` class toggle wiring + token consumption in `+layout.svelte`
    (currently still on hardcoded `bg-white text-slate-900`).
  - `core/logger` rewire to consume `publicConfig.PUBLIC_LOG_LEVEL`
    instead of only `dev` from `$app/environment`.
  - Token gaps for primitives: `--color-focus-ring`, hover/active/
    disabled aliases.

[Unreleased]: https://github.com/maulanazain/surfaceit/compare/06e1b15...HEAD
