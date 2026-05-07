---
alwaysApply: true
description: >
  Workflow discipline for ${PROJECT_NAME}: every task is executed by a
  dispatched agent (persona or specialist), and every task is marked
  complete before its PR is opened.
---

# Agent Dispatch and Task Completion Rule

## Subagent vs agent team

Two delegation mechanisms. Different shapes. The lead picks one per task.

| | Subagent (`Agent(...)`) | Agent team |
|---|---|---|
| Lifetime | One turn, fire-and-forget | Persistent across many turns |
| Communication | Result returns to lead only | Teammates message each other + lead |
| Task list | Lead owns | Shared, all members claim/update |
| Best for | One self-contained task | 3–5 independent slices needing peer feedback |
| Token cost | Low (one summary back) | High (each teammate is a full session) |

Use a subagent when the **result** is what matters and the worker doesn't need to talk to anyone. Use an agent team when slices need to **converge** — adversarial review, parallel implementation, debate-style debugging.

The full spawn-mode decision table — which surfaces require plan-approval, which work shapes map to canonical team layouts (Day-One Audit, Phase 2 Core) — lives in `.claude/agents/team.md` § "Agent Team Orchestration". Read that before spawning anything beyond a single subagent.

## Director-not-executor (lead binding)

The lead session does not execute production work in place. The lead's mutating tools (`Edit`, `Write`, code-mutating `Bash`) on `src/**`, `docs/**`, `.claude/agents/**`, `.claude/rules/**` are reserved for **bootstrapping the orchestration itself** (settings, agent frontmatter, this rule). Everything else is dispatched.

Triggers that mean "stop, dispatch":

- About to `Edit` a file under `src/`
- About to run `git commit`, `bun run build`, `bun install`, or any mutation
- About to write a chunk of TypeScript "to save a round-trip"
- About to review code by reading it line-by-line yourself

In each case: scope the work, write the brief, dispatch the persona, review the output.

## DO

- **DO** dispatch a persona (Kaito, Haruki, Yuki, Sora, Ren, Mei) to own each task. The dispatcher (typically the Product Owner or Haruki) writes a self-contained brief: goal, context, files in scope, files out of scope, exit criteria.
- **DO** dispatch a specialist (`code-reviewer`, `test-automator`, `api-designer`, `documentation-engineer`, `docker-expert`, `sql-pro`) when the task benefits from a focused craft pass. Specialists are dispatched **by** a persona, not by the Product Owner directly.
- **DO** mark every task as **complete the moment it is finished**, before opening the PR. The PR opens against an already-complete task list.
- **DO** keep task tracking in whatever the active list is (TodoWrite, GitHub Issues, project board) — but only one source of truth at a time.
- **DO** include the completed task list (or a link to it) in the PR description.

## DON'T

- **DON'T** execute a task in the main thread when a persona or specialist would do better. The main thread orchestrates and reviews; it does not implement features in place when delegation is the right call.
- **DON'T** open a PR with tasks still in `in_progress` or `pending`. Either finish them, split them out into a follow-up, or close them with a stated reason.
- **DON'T** open a follow-up PR whose only change is "mark task X as complete." That is a process bug; mark the task complete in the PR that *did* the work.
- **DON'T** dispatch a specialist when a persona would suffice. Specialists are not free; they cost context and should be reserved for craft-specific value (security review, test design, contract sanity, doc audit).
- **DON'T** dispatch multiple agents on overlapping files without explicit conflict-prevention scope. See `CLAUDE.md` parent project rules on parallel agent workflows.

## Dispatch protocol

1. **Scope the task.** One concern, clear deliverable, named owner.
2. **Pick the agent.** Persona for product/architectural calls; specialist for craft execution under a persona's accountability.
3. **Write the brief.** Goal, context, in-scope files, out-of-scope files, exit criteria, target rules to satisfy.
4. **Run the agent.** Worktree-isolated for parallel work; in-thread for serial.
5. **Review the output.** The dispatcher (persona) verifies, not just trusts the agent's summary.
6. **Mark the task complete** before the PR opens.
7. **Open the PR.** Description cites the rules satisfied and links the completed task list.

## When the main thread executes directly

A few cases where direct execution is correct:

- Trivial typo fix or rename in one file (still: prefer `caveman:cavecrew-builder` if available).
- One-line config update.
- Reading code or git state to plan dispatch (this is research, not execution).

When in doubt, dispatch.

## Task lifecycle states

| State | Meaning | Allowed transitions |
|---|---|---|
| `pending` | Identified, not started | → `in_progress`, → `cancelled` |
| `in_progress` | Active work | → `completed`, → `blocked` |
| `blocked` | Cannot proceed; reason recorded | → `in_progress`, → `cancelled` |
| `completed` | Done; verified by the dispatcher | (terminal) |
| `cancelled` | No longer needed; reason recorded | (terminal) |

A PR may open only when every task it covers is `completed` or `cancelled`. Any `in_progress` or `blocked` task in the PR's scope blocks the merge.

## Quick reference

| Situation | Action |
|---|---|
| Adding a feature | Dispatch the right persona; mark task complete; open PR |
| Pre-merge review | Dispatch `code-reviewer` (and others as needed); persona accountable for response |
| Tests missing | Dispatch `test-automator`; persona reviews and integrates |
| Spec/API drift | Dispatch `api-designer` or `documentation-engineer` |
| Found unrelated work needed | New task, new PR; do not bundle |
