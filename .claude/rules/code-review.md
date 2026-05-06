---
alwaysApply: true
description: >
  Code review baseline for ${PROJECT_NAME}. PRs that violate these are blocked
  unless an ADR explains the deviation.
---

# Code Review Rule

## DO

- **DO** ensure typecheck, lint, unit tests, e2e, codegen check, and build are green before requesting review.
- **DO** keep PRs focused. One concern per PR. Stack PRs if a single concern needs more than ~400 changed lines.
- **DO** include the **why** in the PR description, not just the **what**. The diff shows what.
- **DO** cite the rule(s) the PR satisfies if it touches a constrained surface (auth, state, api, styling, i18n, security).
- **DO** update or add a doc page if behavior changes. A behavior change without a doc update is incomplete.
- **DO** include or update tests in the same PR as the feature or fix.
- **DO** mark `// TODO(name): …` with an owner if you ship a known follow-up.

## DON'T

- **DON'T** merge with TODOs that have no owner.
- **DON'T** introduce `any`, `as any`, or non-null `!` without an inline rationale comment.
- **DON'T** add `// eslint-disable-next-line` without a one-line reason. Lint rules exist for a reason; if the rule is wrong, change the rule.
- **DON'T** approve a PR you have not actually read. "LGTM" without thought is a process bug.
- **DON'T** merge a PR that adds a new dependency without satisfying `dependency-policy.md`.
- **DON'T** merge a PR that uses backwards-compatibility shims for code that has not shipped yet.

## What every reviewer checks

1. **Layer hygiene** — no upward imports, no cross-domain imports.
2. **State** — no module-singleton stateful stores, no `updateCounter` hacks, `SvelteMap`/`SvelteSet` where appropriate.
3. **API** — no hand-rolled `fetch`, no response-type casts at call sites, codegen up to date.
4. **Auth/Sec** — no token in `localStorage`, headers in place, CSRF on unsafe methods.
5. **i18n** — no hardcoded user-facing strings.
6. **Tests** — covers the change; no flaky retries; no implementation-detail tests.
7. **Docs** — ADR if a decision was taken, rule update if a constraint changed, guide update if a workflow changed.
8. **Diff size** — split if too large.

## What every reviewer ignores (unless it changes meaning)

- Formatting nits (Prettier handles them).
- Naming bikeshed when the proposed name is acceptable.
- Personal style preferences without a rule behind them.

## Specialist agents

When review needs depth in a craft area, dispatch a specialist:

| Concern | Dispatch |
|---|---|
| Code quality, security smell, complexity | `code-reviewer` |
| Tests missing or weak | `test-automator` |
| API contract / endpoint design | `api-designer` |
| Container / deployment | `docker-expert` |
| Documentation drift | `documentation-engineer` |
| SQL or data layer (when present) | `sql-pro` |

The persona who owns the PR (Yuki / Sora / Ren / Mei) decides when to dispatch and reads the specialist output.

## Quick reference

| Reviewer feedback | Format |
|---|---|
| Blocking issue | `BLOCKING:` prefix, cite the rule |
| Suggestion | `nit:` or `suggestion:` prefix |
| Question | end with a question mark; assume good faith |
| Praise | optional, but reinforces good patterns |
