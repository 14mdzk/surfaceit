---
alwaysApply: true
description: >
  Svelte 5 runes + context-DI for stateful services in ${PROJECT_NAME}.
  Module-singleton stateful stores are forbidden. Reactive collections use
  svelte/reactivity. Server state belongs in svelte-query, not in stores.
---

# State Management Rule

## Source of truth

- ADR: `docs/decisions/0001-svelte5-context-di.md`
- Obsidian wiki: [[Context-DI for Runes Stores]], [[Module Singleton Store Anti-Pattern]], [[Svelte 5 Reactive Collection Pitfall]] (frontend domain)

## DO

- **DO** expose stateful services as a `create<Name>()` factory + `get<Name>()` reader pair using `setContext` / `getContext`.
- **DO** use a module-local `Symbol(...)` as the context key.
- **DO** instantiate a service exactly once, in the **lowest layout** that still owns its lifetime (root, `(app)/`, or a feature layout).
- **DO** use `SvelteMap` / `SvelteSet` from `svelte/reactivity` for any reactive collection.
- **DO** keep server state in svelte-query (`core/query`). UI-only state goes in domain stores.
- **DO** throw a helpful error from `get<Name>()` when called outside an initialized context.

## DON'T

- **DON'T** `export const xxxStore = new XxxStore()`. Stateful module singletons are forbidden.
- **DON'T** use vanilla `Map` / `Set` inside `$state(...)`. Prefer `SvelteMap` / `SvelteSet`.
- **DON'T** introduce an `updateCounter = $state(0)` field. If you find yourself writing one, switch to `SvelteMap` / `SvelteSet`. See [[Svelte 5 Reactive Collection Pitfall]].
- **DON'T** mutate nested objects inside a `SvelteMap` value and expect reactivity. Either reassign the entry (`map.set(k, { ...v, n: v.n + 1 })`) or wrap the nested value in `$state(...)`.
- **DON'T** put server data (fetched from the API) into a runes store. svelte-query owns that.
- **DON'T** use string context keys. Symbols only.

## Pattern

```ts
// $core/<service>/index.ts
import { getContext, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

const KEY = Symbol('<service>')

export class Service {
  user = $state<User | null>(null)
  cache = new SvelteMap<string, Item>()
  constructor(private deps: ServiceDeps) {}
}

export function createService(deps: ServiceDeps) {
  const svc = new Service(deps)
  setContext(KEY, svc)
  return svc
}

export function getService(): Service {
  const svc = getContext<Service | undefined>(KEY)
  if (!svc) throw new Error('Service not initialized; call createService() in a parent layout')
  return svc
}
```

## Tests

A factory is trivial to test:

```ts
const svc = createService(fakeDeps)
svc.someMethod(...)
expect(svc.user).toEqual(...)
```

No module mocking. No `vi.mock`. No global state.

## Quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Reactive update missing on Map mutation | Vanilla `Map` in `$state` | Switch to `SvelteMap` |
| `updateCounter++` in a getter | Reactivity hack | Replace collection with `SvelteMap` / `SvelteSet`, delete counter |
| State shared across SSR requests | Module singleton | Convert to factory + context |
| `goto('/login')` flash on first paint | Module-singleton auth + `ssr=false` | Convert to context-DI; turn SSR back on; resolve session in `hooks.server.ts` |
| Domain A breaks when Domain B refactors | Cross-domain import | Promote shared piece to `shared/`/`core/` or merge domains |
