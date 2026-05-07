# ${PROJECT_NAME}

Resilient, scalable SvelteKit + TypeScript frontend boilerplate. Designed to be the long-lived starting point for product UIs that talk to hexagonal-style backends (e.g. `goscratch`).

> `${PROJECT_NAME}` is a placeholder used across docs, agents, and rules. Replace at fork time, or keep parametrized for reuse.

## Source of truth

| What | Where |
|---|---|
| Project intent and scope | `docs/charter.md` |
| Phased plan | `docs/roadmap.md` |
| Architecture, folder layout, layer rules | `docs/architecture/` |
| Architecture Decision Records | `docs/decisions/` |
| Best practices, findings, anti-patterns | Obsidian wiki — see `.claude/CLAUDE.md` for the access protocol |
| Operational guides (add domain, add route…) | `docs/guides/` |
| Always-applied behavioral rules | `.claude/rules/` |
| Persona team and specialist agents | `.claude/agents/` |

## Reading order for any agent

1. `.claude/agents/team.md` — team protocols, hierarchy, communication
2. `.claude/agents/<your-name>.md` — your persona, ownership, deferrals
3. `.claude/rules/*.md` — non-negotiable rules
4. `docs/charter.md` — what we are building and why
5. `docs/architecture/overview.md` — the shape of the system
6. Obsidian wiki — query relevant concept pages via the protocol in `.claude/CLAUDE.md` (start with `wiki/hot.md`, then `wiki/index.md`, then domain `wiki/concepts/`). Concept pages relevant here live under the **frontend** domain, e.g. [[Svelte 5 Reactive Collection Pitfall]], [[Module Singleton Store Anti-Pattern]], [[Context-DI for Runes Stores]], [[SvelteKit SSR Cookie Session BFF]], [[Endpoint Registry Pattern]], [[OpenAPI Codegen for SvelteKit]], [[Domain Folder Per Backend Module]], [[Hybrid shadcn Fork Strategy]].

Never act before reading the rules that govern your task. The rules override default behavior; user instructions override the rules.

## Anti-drift contract

Every PR must:
- pass `bun run check && bun run lint && bun run test && bun run build` (Phase 1 scripts). Note: `bun run test` (Vitest) is not the same as `bun test` (Bun's built-in runner — not used here).
- cite the rule(s) it satisfies if it touches a constrained surface (auth, state, api, styling, i18n).
- include or update the relevant doc page when behavior changes.
- be the product of a **dispatched agent** (persona or specialist) — see `.claude/rules/agent-dispatch.md`. The main thread orchestrates and reviews; it does not implement in place when delegation is the right call.
- have **every task in scope marked complete** before the PR is opened. No follow-up PR exists whose only purpose is to flip a task to `completed`.

If you cannot find a rule that covers your situation, do not invent one in code. Open a discussion (or write an ADR draft) and pause.

## Specialist agents

In addition to the persona team, this repo ships utility specialists under `.claude/agents/` (`code-reviewer`, `test-automator`, `api-designer`, `sql-pro`, `docker-expert`, `documentation-engineer`). Personas dispatch them for craft-specific work — see `team.md` "Specialist Roster".

## License

TBD. Treat as private until decided.
