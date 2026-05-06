# 0001 — Svelte 5 Runes with Context-DI for Stateful Services

- **Status:** Accepted
- **Date:** 2026-05-06
- **Deciders:** Kaito, Haruki
- **Tags:** state, architecture

## Context

Svelte 5 runes (`$state`, `$derived`, `$effect`) make class-based stores ergonomic. The previous project (`flowcount`) exposed every store as a module-level singleton (`export const authStore = new AuthStore()`). That choice produced three problems:

1. Tests cannot replace the store — every import resolves to the same instance.
2. SSR cannot scope state per request — singletons leak across requests when SSR is on.
3. Hot module reload state survives reloads inconsistently.

We need a pattern that keeps Svelte 5's ergonomics while removing the singleton.

## Options considered

### Option A — Module-singleton stores
Pros: simplest imports; works in client-only apps.
Cons: untestable; unsafe with SSR; HMR-leaky; couples consumers to instance lifetime.

### Option B — Context-DI factories
Pros: per-tree instance; trivial to mock in tests; safe for SSR (instance lives for the duration of one render); explicit ownership at the layout level.
Cons: requires `setContext` in a layout and `getContext` at consumers; one extra step per store.

### Option C — Global writable + setter functions (vanilla store style)
Pros: familiar.
Cons: discards the runes ergonomics; same singleton problems.

## Decision

We adopt **Option B**. Every stateful service in `core/` and every domain UI store ships a `create<Name>()` factory plus a typed `get<Name>()` reader. A layout (root, `(app)`, or domain layout) calls the factory once and `setContext`s the result.

## Consequences

Easier:
- testing (`createAuth({ … overrides })` in unit tests)
- SSR (each request creates its own instance)
- multi-instance scenarios (tabs, isolated mini-apps)

Harder:
- imports become two-step (`import { getAuth } from '$core/auth'` then call `getAuth()`)
- forgetting to `setContext` produces a clear runtime error — must surface this with a friendly message

Revisit if:
- Svelte 6 introduces a first-class DI primitive that obviates `setContext`.
- We measure the per-render allocation cost as material at scale (unlikely).

## Compliance

- Rule: `.claude/rules/state-management.md`
- Obsidian wiki: [[Context-DI for Runes Stores]], [[Module Singleton Store Anti-Pattern]], [[Svelte 5 Reactive Collection Pitfall]] (frontend domain)
- Architecture: `docs/architecture/overview.md` (State section)
