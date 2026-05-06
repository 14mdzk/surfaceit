---
alwaysApply: true
description: >
  Folder layout and layer dependency rules for ${PROJECT_NAME}. Crossing a
  layer in the wrong direction blocks the PR.
---

# Architecture Rule

## Source of truth

`docs/architecture/folder-layout.md` and `docs/architecture/layer-rules.md`. Read both before adding files.

## DO

- **DO** place new code in the right layer:
  - framework primitives → `src/lib/core/`
  - cross-domain UI / utils → `src/lib/shared/`
  - bounded-context code → `src/lib/domains/<name>/`
  - server-only modules → `src/lib/server/` or `*.server.ts`
  - generated code → `src/lib/generated/` (do not hand-edit)
- **DO** export domain code through `domains/<name>/index.ts`. Routes import the index, not deep paths.
- **DO** use the configured aliases (`$lib`, `$core`, `$shared`, `$domains`, `$server`, `$generated`, `$routes`, `$messages`).

## DON'T

- **DON'T** import upward. `core` cannot import `shared`. `shared` cannot import `domains`. `domains/<X>` cannot import `domains/<Y>`.
- **DON'T** create a `src/lib/utils.ts` mega-file or a `common/` / `misc/` folder.
- **DON'T** put stores under `src/lib/stores/`. Stores live with their domain (`domains/<name>/store.svelte.ts`).
- **DON'T** edit `src/lib/generated/**`. Fix the generator template under `scripts/codegen/` instead.

## Domain isolation

A domain folder is one slice:

```
domains/<name>/
├── schema.ts      types, Zod parsers (often re-export from $generated)
├── service.ts     the only api caller for this domain
├── queries.ts     svelte-query keys + defineQuery / defineMutation
├── store.svelte.ts UI state factory (context-scoped)
├── index.ts       public exports
└── components/
```

If two domains genuinely need to share, the shared piece moves to `shared/` or `core/`. If they cannot be untangled, they were one domain — merge them and write an ADR explaining the merge.

## Quick reference

| File you are adding | Goes in |
|---|---|
| Reusable primitive (Button, Input) | `src/lib/shared/primitives/` |
| Reusable composite (DataTable, Paginator) | `src/lib/shared/composites/` |
| API caller for a domain | `src/lib/domains/<name>/service.ts` |
| Auth, realtime, query, logger primitives | `src/lib/core/<area>/` |
| Server-only proxy / session / headers | `src/lib/server/` |
| Cookie session reader, CSP headers | `src/lib/server/` (must be server-only) |
| Domain-specific page | `src/routes/(app)/<feature>/+page.svelte` |
