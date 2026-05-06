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
  - Playwright config + single smoke spec at `e2e/smoke.spec.ts` that
    asserts the locale switch is visible.
  - GitHub Actions: `ci.yml` (install → codegen → check → lint → test →
    build, single ubuntu-latest, bun-store cache), `e2e.yml` (pull_request
    only, `continue-on-error: true`, becomes blocking in Phase 5).
  - This `CHANGELOG.md` (`## [Unreleased]` section).

### Notes / deviations

- The brief listed `@inlang/paraglide-sveltekit` as a separate dep.
  Paraglide JS 2.x ships its SvelteKit-compatible Vite plugin
  (`paraglideVitePlugin`) inside `@inlang/paraglide-js` itself; the
  separate adapter package is no longer required. See ADR 0006.

[Unreleased]: https://github.com/maulanazain/surfaceit/compare/06e1b15...HEAD
