---
alwaysApply: true
description: >
  Dependency policy for ${PROJECT_NAME}: prefer-platform, prove-the-need,
  pin direct, audit transitively. New deps require a one-line rationale and a
  spot in the bundle budget.
---

# Dependency Policy Rule

## DO

- **DO** prefer the platform, then the framework, then a small library, then a large library — in that order.
- **DO** prove the need before adding a dependency: "we need X; the platform doesn't ship it; we wrote a small wrapper, here is the cost." If we can implement it in < 50 lines without losing safety, we probably should.
- **DO** pin direct dependencies in `package.json` to a specific minor (`^1.2.3`). Let the lockfile pin transitive.
- **DO** record a one-line rationale in `docs/decisions/dependencies.md` for any non-trivial dep added.
- **DO** check the bundle impact of a client-imported dep. The client bundle has a budget; deps that blow it require an ADR.
- **DO** keep deps current. Stale deps are security debt. Run `bun outdated` weekly; bump in batches.
- **DO** prefer ESM-only, side-effect-free modules. They tree-shake.

## DON'T

- **DON'T** add a dep to "save 30 lines." If those 30 lines are obvious, write them.
- **DON'T** add a dep that does many things when you need one. (e.g. add a date helper, not a full date library, when you need one helper.)
- **DON'T** add CommonJS-only or side-effect-laden deps to the client bundle.
- **DON'T** introduce a competing dep when an existing one already covers the use case.
- **DON'T** ignore `bun audit` warnings. `high` and `critical` block merge. `moderate` and `low` get triaged in a weekly batch.

## Vetting checklist

For any new dep:

1. **What problem does it solve that we cannot solve in < 50 LOC?**
2. **Is it actively maintained?** (last release < 12 months, open issues responded to)
3. **License?** (MIT, Apache-2.0, BSD, ISC OK; copyleft requires legal review)
4. **Bundle size?** (client deps: check via `bundlephobia` or `bun build --analyze`)
5. **Security history?** (known CVEs, advisory feed)
6. **Is there a smaller alternative?**

A dep that fails any of 1, 2, 3 is rejected. Failing 4–6 is a discussion.

## License allowlist

- MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, CC0-1.0
- Anything else: ADR.

## Bundle budget (initial)

- Reference shell route, gzipped: ≤ 180 KB
- Per-domain page route, additional gzipped: ≤ 60 KB

CI checks via a size-limit-equivalent in Phase 5.

## Common requests, common answers

| Request | Default answer |
|---|---|
| Add lodash | No. Pick the specific helper as `lodash-es/<fn>`, or write it. |
| Add moment / dayjs | Use `date-fns` (already in scope) or `Intl`/`Temporal`. |
| Add a state-management library | No. Svelte 5 runes + svelte-query cover it. |
| Add a CSS-in-JS lib | No. Tailwind + tokens. |
| Add a UI kit | No. We have shadcn-fork primitives. |
| Add a form library | Defer until we hit a real form-complexity wall. SvelteKit form actions cover most cases. |

## Quick reference

| Action | Command |
|---|---|
| Add a dep (with rationale) | edit `package.json`, run `bun install`, update `docs/decisions/dependencies.md` |
| Audit | `bun audit` |
| Check outdated | `bun outdated` |
| Inspect bundle | `bun run build --analyze` (or rollup-plugin-visualizer) |
