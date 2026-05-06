---
alwaysApply: true
description: >
  Real-time channel discipline for ${PROJECT_NAME}. SSE (and WS later) flow
  through a BFF, reconnect with bounded backoff, and never own server state.
---

# Realtime Rule

## DO

- **DO** create the realtime client through a context factory in the layout that owns its lifetime. One client per scope (page or feature), not a global.
- **DO** route the SSE/WS connection through a BFF endpoint that adds the `Authorization` header server-side. The browser must not see a token.
- **DO** declare channel names as constants in `core/realtime/channels.ts`. Refer to channels by constant, never by string literal.
- **DO** reconnect with exponential backoff capped (default base 1 s, cap 30 s, max retries 10). After max retries, surface a banner and stop.
- **DO** deserialize and validate inbound payloads at the boundary. Untrusted JSON deserves a Zod parse before it touches the store.
- **DO** dispatch parsed events to *invalidators* that touch the svelte-query cache (or update domain UI stores). The realtime client itself owns no server state.
- **DO** clean up on `onDestroy` of the layout or page. No leaked connections.

## DON'T

- **DON'T** open an `EventSource` directly to the upstream URL with a token in the query string. That logs the token in proxies and access logs.
- **DON'T** store fetched lists or counts in the realtime client. The client parses and dispatches; it does not aggregate.
- **DON'T** create the client at module scope (`export const sseClient = new SSEClient()`). See `state-management.md`.
- **DON'T** start two clients for the same channel set. If two pages need the same channels, the layout above them owns the single client.
- **DON'T** swallow parse errors. Log them and surface a toast in dev; in prod, log to the observability sink.

## Pattern

```ts
// $core/realtime/index.ts
import { getContext, setContext, onDestroy } from 'svelte'
const KEY = Symbol('realtime')

export class RealtimeClient {
  state = $state<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  private es: EventSource | null = null
  // …
}

export function createRealtime(deps: RealtimeDeps) {
  const c = new RealtimeClient(deps)
  setContext(KEY, c)
  onDestroy(() => c.disconnect())
  return c
}

export function getRealtime() { /* … */ }
```

## Cache integration

Events do not write to svelte-query directly. They publish to per-domain invalidators:

```ts
// $domains/camera/realtime.ts
export function attachCameraRealtime(rt: RealtimeClient, qc: QueryClient) {
  rt.on('camera.added', () => qc.invalidateQueries({ queryKey: ['camera', 'list'] }))
  rt.on('camera.healthcheck', (e) => qc.setQueryData(['camera', 'get', e.id], updateCamera))
}
```

The cache stays the single source of truth for server data.

## Quick reference

| Need | Where |
|---|---|
| Add a channel | `core/realtime/channels.ts` constant + per-domain invalidator |
| Open a connection | factory `createRealtime` called from a layout |
| React to an event | per-domain invalidator that calls `qc.invalidateQueries` or `qc.setQueryData` |
| Surface connection state in UI | read `getRealtime().state` from a component |
