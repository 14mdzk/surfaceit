# surfaceit

A long-lived SvelteKit + TypeScript frontend boilerplate for products that talk
to hexagonal-style backends (the first concrete consumer is `goscratch`).
Every fork inherits a working SSR auth surface, a typed API client, a real-time
pipeline, an i18n harness, a testing stack, and a documented design discipline —
so the next product never starts from zero. This repo is the **substrate**, not
a product. See [`docs/charter.md`](docs/charter.md) for the full intent and
non-goals.

> `surfaceit` is the working name. The charter parametrizes it as
> `${PROJECT_NAME}` so a fork can rename in one pass. Do not rename in source
> until forking.

## Quickstart

Requires [Bun](https://bun.sh) ≥ 1.1.

```sh
bun install            # install deps + run prepare (svelte-kit sync, paraglide compile, lefthook)
bun run dev            # dev server on http://localhost:5173
bun run check          # typecheck (svelte-check) + paraglide compile
bun run lint           # prettier --check + eslint
bun run test           # Vitest (unit) — see docs/guides/run-tests.md
bun run test:e2e       # Playwright (e2e) — auto-builds and previews on :4173
bun run build          # production build via @sveltejs/adapter-node
```

> **`bun run test` is Vitest.** It is **not** the same as `bun test` (Bun's
> built-in runner, which we do not use). See
> [`docs/guides/run-tests.md`](docs/guides/run-tests.md) for the runner
> separation rule.

## Layout

The canonical map of the repo lives in
[`docs/architecture/folder-layout.md`](docs/architecture/folder-layout.md).
The layer model — what may import what — lives in
[`docs/architecture/layer-rules.md`](docs/architecture/layer-rules.md).

Aliases (`$core`, `$shared`, `$domains`, `$server`, `$generated`, `$routes`,
`$messages`) are wired in `svelte.config.js`. Use them; never reach into a
sibling domain by relative path.

## How to read the docs

Read in this order. Each layer answers a different question.

1. **[`docs/charter.md`](docs/charter.md)** — what we are building, why, and
   what we are explicitly **not** building.
2. **[`docs/roadmap.md`](docs/roadmap.md)** — phased delivery plan. Maps every
   feature to a phase.
3. **[`docs/architecture/overview.md`](docs/architecture/overview.md)** — the
   shape of the system: layers, trust boundaries, data flow, error model.
4. **[`docs/decisions/`](docs/decisions/)** — Architecture Decision Records.
   Read 0001–0006 before proposing an alternative; they explain why each
   constraint exists.
5. **[`docs/guides/`](docs/guides/)** — recipes for common tasks (add a
   domain, add a route, run tests).
6. **[`.claude/rules/`](.claude/rules/)** — non-negotiable rules every
   contributor and agent follows. Cite the rule in your PR when you touch a
   constrained surface.

Living patterns and anti-patterns that apply beyond this repo are catalogued
as concept pages in the personal Obsidian wiki — see
[`docs/README.md`](docs/README.md) for the access protocol.

## Status

Phase progress tracks
[`docs/roadmap.md`](docs/roadmap.md). Reference Phase 1 features as shipped;
Phase 2 features land per-PR and are documented in the changelog only when
merged.

| Phase | Theme                                                                                                               | Status                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 0     | Foundation — docs, rules, ADRs 0001–0006                                                                            | done                                             |
| 1     | Skeleton wiring — SvelteKit shell, hooks pipeline, Vitest, Playwright, CI                                           | done (see `CHANGELOG.md` `[Unreleased] Phase 1`) |
| 2     | Core primitives — `core/api`, `core/auth`, `core/realtime`, `core/query`, `core/config`, `core/logger`, `core/i18n` | in flight                                        |
| 3     | Reusable shells — primitives, composites, `_template` domain, BFF proxy, login flow                                 | pending                                          |
| 4     | Codegen + DX — `openapi-typescript` wired, scaffolding scripts, guides filled out                                   | pending                                          |
| 5     | Hardening — Lighthouse a11y ≥ 95, header integration tests, perf budget in CI                                       | pending                                          |

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) for the agent-dispatch model and the anti-drift
contract every PR must satisfy. The PR template
([`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md))
encodes the [Definition of Done](.claude/rules/definition-of-done.md).

## License

TBD per [`docs/charter.md`](docs/charter.md). Treat as private until decided.
