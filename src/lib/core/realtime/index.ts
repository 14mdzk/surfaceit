/**
 * Public surface of `core/realtime`.
 *
 * Consumers import from this barrel, never from deep paths:
 *   ```ts
 *   import { createRealtime, getRealtime, type SSEClient } from '$core/realtime'
 *   import { CHANNELS, type Channel } from '$core/realtime/channels'
 *   ```
 *
 * ## Per-domain invalidator pattern
 *
 * The realtime client dispatches parsed events to *invalidators* registered by
 * each domain. Invalidators call svelte-query's `invalidateQueries` or
 * `setQueryData` — the cache stays the single source of truth for server data.
 * The realtime client itself stores **no** server state.
 *
 * ### Wiring an invalidator
 *
 * Create a `realtime.ts` file in the domain folder and export an `attach<Domain>Realtime`
 * function:
 *
 * ```ts
 * // src/lib/domains/camera/realtime.ts
 * import type { SSEClient } from '$core/realtime'
 * import type { QueryClient } from '@tanstack/svelte-query'
 * import { CHANNELS } from '$core/realtime/channels'
 *
 * export function attachCameraRealtime(rt: SSEClient, qc: QueryClient): () => void {
 *   const offAdded   = rt.on('camera.added',   () => qc.invalidateQueries({ queryKey: ['camera', 'list'] }))
 *   const offRemoved = rt.on('camera.removed',  () => qc.invalidateQueries({ queryKey: ['camera', 'list'] }))
 *   const offUpdated = rt.on('camera.updated',  () => qc.invalidateQueries({ queryKey: ['camera', 'list'] }))
 *   const offHealth  = rt.on('camera.health', (e) => {
 *     // e.data is typed as CameraHealth by the Zod parser in core/realtime/parsers.ts
 *     qc.setQueryData(['camera', 'get', e.data.id], (old) => old ? { ...old, status: e.data.status } : old)
 *   })
 *   // Return a combined cleanup if the invalidator has its own lifetime
 *   return () => { offAdded(); offRemoved(); offUpdated(); offHealth() }
 * }
 * ```
 *
 * ### Calling the invalidator from a layout
 *
 * ```svelte
 * <!-- src/routes/(app)/+layout.svelte -->
 * <script lang="ts">
 *   import { createRealtime, getRealtime } from '$core/realtime'
 *   import { CHANNELS } from '$core/realtime/channels'
 *   import { createQueryClient, getQueryClient } from '$core/query'
 *   import { attachCameraRealtime } from '$domains/camera/realtime'
 *   import { onDestroy } from 'svelte'
 *
 *   const rt = createRealtime({ channels: [CHANNELS.CAMERA_EVENTS, CHANNELS.CAMERA_HEALTH] })
 *   const qc = getQueryClient()
 *   const detach = attachCameraRealtime(rt, qc)
 *   onDestroy(detach)
 *   rt.connect()
 * </script>
 * ```
 *
 * ### Key rules enforced by this pattern
 * - The realtime client stores no server data (`realtime.md`).
 * - Each domain owns its own invalidator file (`architecture.md` domain isolation).
 * - Domains read via svelte-query; the realtime path only triggers cache invalidation.
 *
 * Conformance:
 *   - rule .claude/rules/realtime.md
 *   - rule .claude/rules/architecture.md (export through index)
 */

export { SSEClient, createRealtime, getRealtime } from './client.svelte.js';
export type { RealtimeState, RealtimeDeps, RealtimeEventHandler } from './client.svelte.js';
export type { ParsedRealtimeEvent, CameraEvent, CameraHealth } from './parsers.js';
