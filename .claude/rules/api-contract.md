---
alwaysApply: true
description: >
  How ${PROJECT_NAME} talks to upstream APIs: codegen-first types, typed
  endpoint registry, single api client, Zod only at trust boundaries.
---

# API Contract Rule

## Source of truth

- ADR: `docs/decisions/0004-openapi-codegen.md`
- Obsidian wiki: [[Endpoint Registry Pattern]], [[OpenAPI Codegen for SvelteKit]] (frontend domain)

## DO

- **DO** snapshot the upstream OpenAPI spec at `openapi/<service>.yaml` and commit it.
- **DO** generate TypeScript types via `bun run codegen` into `src/lib/generated/<service>.ts`. Commit the generated file.
- **DO** route all upstream calls through `core/api`'s typed endpoint registry. Each entry declares method, path builder, args type, body type, response type.
- **DO** unwrap upstream envelopes (`{ success, data, message }` / `{ success, error }`) inside `core/api/core-fetch.ts` exactly once. Consumers receive `data` directly or an `ApiError` thrown.
- **DO** add Zod parsers at trust boundaries: form submissions, URL search params, BFF inbound bodies, third-party webhooks.
- **DO** add a per-endpoint Zod parser if the field has a history of contract violations or needs stricter parsing than the spec expresses (e.g. ISO date, brand types).

## DON'T

- **DON'T** hand-roll `fetch(...)` outside `src/lib/core/api/**`.
- **DON'T** declare response types at call sites with generics or `as { data?: T }` casts. The registry carries the type.
- **DON'T** put `${PUBLIC_API_URL}/...` template strings inline in services or components.
- **DON'T** put Zod parsers on every trusted upstream response. CPU is not free; codegen is the contract.
- **DON'T** add comments to the registry that describe backend parsing internals (e.g. "backend splits on commas"). Either fix the upstream contract or hide the quirk inside the path builder.
- **DON'T** edit `src/lib/generated/**` by hand. Re-run `bun run codegen`.

## Pattern

```ts
// $core/api/endpoints.ts
import type { components, paths } from '$generated/upstream'

type Get<P extends keyof paths, M extends 'get' | 'post' | 'put' | 'patch' | 'delete'> =
  paths[P][M] extends { responses: { 200: { content: { 'application/json': infer R } } } } ? R : never

export const Endpoints = {
  'camera.list': defineEndpoint<{ search?: string; cursor?: string; limit?: number }, Get<'/cameras', 'get'>>({
    method: 'GET',
    path: (q) => `/cameras${qs(q)}`,
  }),
  // …
} as const
```

```ts
// $core/api/core-fetch.ts
export async function api<K extends EndpointKey>(
  key: K,
  args: ArgOf<K>,
  body?: BodyOf<K>
): Promise<ResponseOf<K>> { /* … */ }
```

## CI guard

```yaml
- run: bun run codegen
- run: git diff --exit-code src/lib/generated openapi
```

If the snapshot or the generated file is stale, CI fails.

## Quick reference

| Need | Where |
|---|---|
| Add an endpoint | `core/api/endpoints.ts` |
| Add a runtime parser for untrusted input | `core/api/parsers/<name>.ts` (Zod) |
| Update upstream contract | `openapi/<service>.yaml` then `bun run codegen` |
| Hide a backend quirk | inside the registry's `path` or a small wrapper, never at call sites |
