---
alwaysApply: true
description: >
  Definition of Done for ${PROJECT_NAME}. A change is "done" when every box
  below is checked. Half-done is not done.
---

# Definition of Done

## Code

- [ ] Implements the smallest change that satisfies the requirement.
- [ ] Layer rules respected (`architecture.md`).
- [ ] No new module-singleton stateful stores (`state-management.md`).
- [ ] No new hand-rolled `fetch` (`api-contract.md`).
- [ ] No tokens reaching the browser (`auth-and-session.md`, `security.md`).
- [ ] No vanilla `Map`/`Set` in `$state` for reactive collections.
- [ ] No `any`, `as any`, or non-null `!` without an inline rationale.
- [ ] No `// eslint-disable-...` without a one-line reason.

## i18n

- [ ] All user-facing strings flow through Paraglide (`i18n.md`).

## Tests

- [ ] Unit tests cover the change, including at least one negative path.
- [ ] e2e covers the change if it touches a critical user flow (login, list, mutate, logout, locale switch).
- [ ] All gates green: typecheck, lint, unit, e2e, codegen check, build.

## Docs

- [ ] If the change altered an architectural rule → ADR added or updated.
- [ ] If the change altered a workflow → guide added or updated.
- [ ] If the change introduced a reusable concept (pattern, anti-pattern, lesson) → Obsidian wiki concept page added under the relevant `domain`.
- [ ] If the change altered a constrained surface (auth, state, api, styling, i18n, security) → corresponding rule reviewed for accuracy.

## Security & Observability

- [ ] No secrets in `PUBLIC_*` env or in committed files.
- [ ] No `console.log` of session, user, or environment objects.
- [ ] Request id propagated where new server entry points were added.
- [ ] Logger used; not raw `console.*`.

## Review

- [ ] PR description explains **why**, not just **what**.
- [ ] PR is focused on a single concern.
- [ ] Reviewer dispatch complete (Yuki / Sora / Ren / Mei + a specialist if needed).
- [ ] Approver(s) read the diff.

## Operational

- [ ] No untracked TODOs without an owner.
- [ ] No backwards-compatibility shims for code that hasn't shipped.
- [ ] No new dependency added without satisfying `dependency-policy.md`.

## Task hygiene

- [ ] The task was executed by a dispatched persona or specialist (`agent-dispatch.md`).
- [ ] **Every task in the PR's scope is marked `completed` (or `cancelled` with a stated reason) BEFORE the PR is opened.** No follow-up PR exists whose only purpose is to mark a task complete.
- [ ] The PR description links or embeds the completed task list.

If any box is unchecked, the change is not done. Hold the merge.
