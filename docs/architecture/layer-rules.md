# Layer Rules

Layers exist to keep change blast-radius small. Crossing a layer in the wrong direction is a code-review block.

## The layers (top → bottom)

```
routes/                       ← orchestrate, never own logic
  └── domains/<name>/         ← bounded context: schema + service + queries + ui state
        └── shared/           ← cross-domain UI + utils
              └── core/       ← framework primitives, no product knowledge
                    └── generated/   ← read-only codegen
```

A higher layer may import from a lower layer. **A lower layer may never import from a higher one.**

## Allowed imports

| From → | `core` | `shared` | `domains/<X>` | `domains/<Y>` | `server` | `routes` | `generated` |
|---|---|---|---|---|---|---|---|
| `core` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `shared` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `domains/<X>` | ✓ | ✓ | ✓ (self) | ✗ | ✗ | ✗ | ✓ |
| `server` | ✓ | ✓ (utils only) | ✗ | ✗ | ✓ | ✗ | ✓ |
| `routes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `generated` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

`domains/<X>` may not import `domains/<Y>`. If two domains need to share, the shared piece moves to `shared/` or `core/`.

## Server-only enforcement

- `src/lib/server/**` and any `*.server.ts` may import private env (`$env/dynamic/private`, `$env/static/private`).
- Anything else **must not** import private env. This is enforced by SvelteKit at build time, but reviewers should still flag it early.

## Client-only enforcement

- `core/realtime` and anything that touches `EventSource`, `WebSocket`, or `localStorage` must not be imported in `*.server.ts` or `+*.server.ts`.
- These modules guard with `if (typeof window === 'undefined') throw …` in their constructors.

## Generated code

- Anything under `src/lib/generated/**` is **regenerated** by `bun run codegen`. Edits are reverted.
- If the codegen output is wrong, fix the generator template in `scripts/codegen/`, not the output.

## Domain isolation

A domain folder is a self-contained slice:

```
domains/<name>/
├── schema.ts          public types and zod parsers
├── service.ts         the only place api calls happen for this domain
├── queries.ts         svelte-query keys + defineQuery/Mutation
├── store.svelte.ts    UI state factory (context-scoped)
└── components/        domain-specific components
```

A route that wants to consume a domain imports from `$domains/<name>`. It does not reach into `domains/<name>/components/foo.svelte` directly — components are exported via `domains/<name>/index.ts`.

## When you need to break a rule

1. Ask: is the thing I want to share actually domain-agnostic? If yes, promote it to `shared/` or `core/`.
2. If two domains genuinely depend on each other (rare), reconsider the boundary — they may be one domain.
3. If still stuck, write an ADR explaining the deviation. The deviation goes in the ADR, not in tribal memory.
