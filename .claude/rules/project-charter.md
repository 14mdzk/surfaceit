---
alwaysApply: true
description: >
  Anchors every contribution to the charter: ${PROJECT_NAME} is a long-lived
  SvelteKit + TypeScript boilerplate, not a single product. Read this rule
  before deciding what to build.
---

# Project Charter Rule

## Source of truth

The full charter lives at `docs/charter.md`. The roadmap lives at `docs/roadmap.md`. **This rule does not duplicate them — it enforces them.**

## DO

- **DO** read `docs/charter.md` before designing a new feature or rejecting an old one.
- **DO** treat the charter's *non-goals* as binding. If you propose a non-goal, you propose a charter amendment first.
- **DO** map every feature to a roadmap phase. If it does not fit any phase, write down which phase it should belong to and propose moving it.
- **DO** keep `${PROJECT_NAME}` parametrized. Final naming happens at fork time.

## DON'T

- **DON'T** add a feature because "we will probably need it." Wait for a charter goal that requires it.
- **DON'T** drift toward becoming a product. This is a starting point. Product-specific code lives in the *forked* repo, not here.
- **DON'T** rename `${PROJECT_NAME}` in source code or docs without a charter amendment.

## When the charter blocks you

If a real need conflicts with the charter, write an ADR proposing the amendment. Do not edit `docs/charter.md` directly without an accepted ADR.

## Quick reference

| Want to add… | First check… |
|---|---|
| A feature | Charter goals + roadmap phase |
| A non-goal item (analytics, multi-tenant, …) | Charter amendment ADR |
| A new dependency | `dependency-policy.md` + charter scope |
| A new domain | `architecture.md` + charter scope |
