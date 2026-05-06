# 0005 — Paraglide JS for i18n, English-only Catalog Day One

- **Status:** Accepted
- **Date:** 2026-05-06
- **Deciders:** Mei, Yuki
- **Tags:** i18n, dx

## Context

The previous project hardcoded Indonesian strings throughout components. Adding English required a full sweep. We want every user-facing string to flow through an i18n layer from the start, even when only one locale is shipped.

## Options considered

### Option A — `svelte-i18n`
Pros: mature; familiar API.
Cons: runtime catalog loading; bundle penalty for unused strings; less aligned with SvelteKit's compile-time philosophy.

### Option B — `@inlang/paraglide-js`
Pros: compile-time, tree-shakable; one TS function per message; integrates with SvelteKit; locale switching via cookie + URL strategy.
Cons: messages are JSON files, not the most editor-friendly for non-engineers (mitigable with VS Code extension).

### Option C — No i18n, hardcode English, defer
Pros: zero work today.
Cons: pays the full migration tax later — exactly the trap we are climbing out of.

## Decision

**Option B**. Paraglide compiles `messages/en.json` (and future locale files) into typed message functions. Every user-facing string in components or routes imports from `$messages` (or whatever Paraglide's compile target alias is). The locale resolver sits in `core/i18n/` and reads a `locale` cookie with `en` default.

Day-one catalog: English only. Adding `id` (or any other) is a matter of dropping `messages/id.json` and translating — no refactor.

## Consequences

Easier:
- adding a new locale
- string audits (lint rule: no string literals as JSX/Svelte text children of user-facing components)
- screenshot-diff testing across locales

Harder:
- every new string needs a key first
- non-engineers editing copy need a TMS or a Paraglide editor extension

Revisit if:
- Paraglide stops being maintained.
- We add translation memory or a TMS pipeline (Crowdin/Lokalise) that prefers a different format.

## Compliance

- Rule: `.claude/rules/i18n.md`
