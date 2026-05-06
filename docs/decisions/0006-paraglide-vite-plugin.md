# 0006 — Paraglide JS Vite Plugin (no separate SvelteKit adapter)

- **Status:** Proposed
- **Date:** 2026-05-06
- **Deciders:** Haruki
- **Tags:** i18n, build, dx

## Context

ADR 0005 picked Paraglide JS for i18n and the original Phase 1 brief
called for adding both `@inlang/paraglide-js` and a separate
`@inlang/paraglide-sveltekit` adapter. When wiring it up I found that
Paraglide JS **2.x ships a SvelteKit-compatible Vite plugin in-package**
(`paraglideVitePlugin` exported from `@inlang/paraglide-js`). The separate
SvelteKit adapter no longer exists as a required peer; the Vite plugin
handles compilation, alias generation, and HMR on its own.

Bringing in the (no-longer-published) adapter would have either failed at
install time or pulled in a deprecated surface that drifts from the
maintainers' current docs.

## Options considered

### Option A — Add `@inlang/paraglide-sveltekit` anyway

Pros: matches the brief verbatim.
Cons: package is no longer maintained as a separate adapter; would either
fail or bind us to a stale code path.

### Option B — Use the in-package Vite plugin only (`paraglideVitePlugin`)

Pros: matches the maintainers' current canonical setup; one fewer dep;
single source of compilation behavior.
Cons: deviates from the literal text of the brief; we accept the deviation
explicitly.

### Option C — Hand-write a SvelteKit hook to call the compiler

Pros: zero new build-time integration.
Cons: re-implements what `paraglideVitePlugin` already does (HMR, alias
generation); pure churn.

## Decision

**Option B.** Wire `paraglideVitePlugin` from `@inlang/paraglide-js` in
`vite.config.ts`. The compiled output lands in
`src/lib/generated/paraglide/` and is consumed via `$core/i18n`. The
Phase 1 brief's intent — Paraglide working in SvelteKit with English-only
catalog — is fully satisfied; only the package list deviates.

## Consequences

Easier:

- One less dep to track for security advisories.
- We follow the upstream maintainers' current canonical example, so
  upgrades land cleanly.

Harder:

- Future agents reading older Phase 1 briefs will see a missing
  `@inlang/paraglide-sveltekit` and may try to re-add it. This ADR is the
  authoritative answer.

Revisit if:

- Paraglide JS publishes a new SvelteKit adapter that supersedes the
  in-package Vite plugin.

## Compliance

- Rule: `.claude/rules/i18n.md`
- Rule: `.claude/rules/dependency-policy.md` (prefer-platform / prove-the-need)
- Supersedes nothing; refines ADR 0005.
