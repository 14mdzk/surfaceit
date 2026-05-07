<!--
Read .claude/rules/code-review.md, .claude/rules/definition-of-done.md, and
.claude/rules/agent-dispatch.md before opening this PR. This template enforces
those rules. Replace each <…> placeholder; delete sections that genuinely do
not apply with a one-line note explaining why.
-->

## Why

<!--
Explain the motivation in 1–3 sentences. The diff shows *what* changed; this
section answers *why*. Link the charter goal, roadmap phase, or issue that
motivated the change.
-->

## What

<!--
Bullet list of the user-visible or developer-visible behavior changes. Keep
it scannable. Implementation details belong in the diff or in code comments.
-->

-

## Rules cited

<!--
List every rule under .claude/rules/ that this PR satisfies (or that it
deliberately exempts itself from with rationale). PRs that touch a constrained
surface MUST cite the rule. See .claude/rules/code-review.md.
-->

- `.claude/rules/<file>.md` — <how this PR satisfies it>

## ADR

<!--
- "Not needed" if the PR does not take an architectural decision.
- "New ADR: docs/decisions/NNNN-<slug>.md" if the PR introduces or supersedes one.
- "Refines docs/decisions/NNNN-<slug>.md" if it amends an existing one.
-->

- [ ] No ADR needed
- [ ] ADR added or updated: `docs/decisions/<file>.md`

## Tests

<!--
Per .claude/rules/testing.md, tests ship in the same PR as the change. Tick
every box that applies; explain any unticked box.
-->

- [ ] Unit tests added or updated (`bun run test`)
- [ ] e2e spec added or updated if a critical flow was touched (`bun run test:e2e`)
- [ ] Negative path covered (errors, validation failures, edge cases)

## Docs

<!--
A behavior change without a doc update is incomplete. See definition-of-done.md.
-->

- [ ] `docs/architecture/*` updated if structure changed
- [ ] `docs/guides/*` updated if a workflow changed
- [ ] `CHANGELOG.md` `[Unreleased]` updated if user- or developer-visible
- [ ] Obsidian wiki concept page added or updated if a reusable lesson emerged
- [ ] `messages/en.json` updated if a new user-facing string was introduced

## Verification

<!--
Run all of these locally before requesting review. Paste a short note if any
gate is intentionally skipped (e.g. e2e is non-blocking until Phase 5).
-->

- [ ] `bun run check` — typecheck green
- [ ] `bun run lint` — prettier + eslint green
- [ ] `bun run test` — Vitest green
- [ ] `bun run test:e2e` — Playwright green (or N/A with reason)
- [ ] `bun run build` — production build green

## Tasks

<!--
.claude/rules/agent-dispatch.md: every task in this PR's scope is `completed`
or `cancelled` BEFORE the PR opens. No follow-up PR exists whose only purpose
is to flip a task to `completed`. Paste or link the task list.
-->

- [ ] Every task in scope is marked `completed` or `cancelled` (with reason)

## Reviewer dispatch

<!--
Per .claude/rules/agent-dispatch.md, the persona owning this PR dispatched any
specialist review needed (code-reviewer, test-automator, api-designer,
documentation-engineer, docker-expert, sql-pro). Note who reviewed and why.
-->

- Persona owner: <Yuki | Sora | Ren | Mei>
- Specialist(s) dispatched: <none | code-reviewer | test-automator | …>

## Risk and follow-ups

<!--
Anything a reviewer should look hardest at. TODOs you knowingly shipped, with
owners (`TODO(name): …` per code-review.md). Backwards-compat shims are NOT
allowed for code that has not shipped yet (definition-of-done.md).
-->

-

<!--
Reviewer reminders:
- Layer hygiene (architecture.md): no upward, no cross-domain imports.
- State (state-management.md): no module-singleton stateful stores.
- API (api-contract.md): no hand-rolled fetch outside core/api.
- Auth/Sec (auth-and-session.md, security.md): no token in localStorage.
- i18n (i18n.md): no hardcoded user-facing strings.
- LGTM without reading the diff is a process bug.
-->
