# Dependency Rationale

One-line rationale per non-trivial dependency added to `package.json`. New entries appended chronologically. Required by `.claude/rules/dependency-policy.md` and `.claude/rules/definition-of-done.md`.

## Runtime dependencies

| Package | Version | Rationale |
|---|---|---|
| `clsx` | `^2.1.1` | Idiomatic conditional-className builder. ~239 B, ESM-only, single-purpose, MIT. Used by `cn()` in `src/lib/shared/utils/cn.ts`. |
| `tailwind-merge` | `^3.5.0` | Resolves conflicting Tailwind utility classes (later wins). ~5 KB, ESM-only, single-purpose, MIT. Used by `cn()` to make `clsx` output safe under Tailwind. |

## Dev dependencies

(none recorded yet — Phase 1 dev deps tracked in `CHANGELOG.md`'s Phase 1 entry.)

## Conventions

- Runtime deps that ship in the client bundle live under `dependencies` in `package.json`. Server-only deps (e.g. `pino`) likewise live under `dependencies` because the Node adapter bundles them.
- Direct deps pin a minor (`^1.2.3`); transitive pins live in `bun.lock`.
- A dep that fails any of the `dependency-policy.md` "Vetting checklist" items 1, 2, or 3 must not be added. Failing 4–6 is a discussion captured in this file.
