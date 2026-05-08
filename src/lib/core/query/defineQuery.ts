/**
 * `defineQuery` — typed query factory bound to the endpoint registry.
 *
 * Wraps TanStack Svelte Query's `createQuery` so domain code never imports
 * TanStack directly. The `queryFn` calls `api()` through `core/api`, satisfying
 * the no-hand-rolled-fetch rule.
 *
 * Conformance:
 *   - rule .claude/rules/api-contract.md     (all upstream calls via api())
 *   - rule .claude/rules/observability.md    (requestId threaded through api())
 *   - rule .claude/rules/architecture.md     (core layer, no upward imports)
 *
 * ## Testing strategy
 *
 * `buildQueryOptions` is a pure function that returns the TanStack options
 * object. Test it directly via `queryClient.fetchQuery(buildQueryOptions(...))`
 * without needing a component — the queryFn path runs end-to-end through
 * MSW-intercepted HTTP.
 *
 * `defineQuery` itself is the thin component-lifecycle wrapper. It calls
 * `createQuery` which requires a Svelte component context; exercise that path
 * in integration tests when the first component harness lands (Wave-3).
 * TODO(yuki): cover defineQuery's reactive wrapper in a jsdom component test once
 * the first domain lands and the jsdom Vitest environment is set up.
 */
import { createQuery } from '@tanstack/svelte-query';
import { api, type ApiError, type ArgOf, type EndpointKey, type ResponseOf } from '$core/api';
import type { UndefinedInitialDataOptions } from '@tanstack/svelte-query';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DefineQueryOptions {
	/**
	 * When `false`, the query will not fetch. Useful for conditional queries
	 * dependent on prior data (e.g. skip until user is authenticated).
	 * Defaults to `true`.
	 */
	enabled?: boolean;
	/** Override the client's default `staleTime` for this query (ms). */
	staleTime?: number;
	/**
	 * Caller-provided request id forwarded to `api()` as `opts.requestId`.
	 * This propagates the server-originated `x-request-id` through client-side
	 * refetches (see rule observability.md).
	 *
	 * The query layer does NOT mint its own request ids.
	 */
	requestId?: string;
}

// ---------------------------------------------------------------------------
// Pure options builder (testable without component lifecycle)
// ---------------------------------------------------------------------------

/**
 * Build a TanStack Query options object for a registered endpoint.
 *
 * This function is pure (no Svelte lifecycle) and can be called in unit tests
 * via `queryClient.fetchQuery(buildQueryOptions(...))`.
 */
export function buildQueryOptions<K extends EndpointKey>(
	key: K,
	args: ArgOf<K>,
	opts?: DefineQueryOptions
): UndefinedInitialDataOptions<ResponseOf<K>, ApiError> {
	return {
		queryKey: [key, args] as const,
		queryFn: ({ signal }: { signal: AbortSignal }) =>
			api(key, args, undefined, {
				signal,
				requestId: opts?.requestId,
				// On the client, globalThis.fetch is available. The query layer
				// does not use event.fetch (that is a server-load concern); clients
				// hit the BFF via relative URL.
				baseUrl: ''
			}),
		enabled: opts?.enabled,
		staleTime: opts?.staleTime
	};
}

// ---------------------------------------------------------------------------
// Component-lifecycle wrapper
// ---------------------------------------------------------------------------

/**
 * Create a reactive query for a registered endpoint.
 *
 * Must be called inside a Svelte component (requires component lifecycle for
 * `createQuery`'s reactive subscription).
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { defineQuery } from '$core/query'
 *
 *   const session = defineQuery('auth.session', undefined)
 * </script>
 *
 * {#if $session.data}
 *   <p>{$session.data.user.email}</p>
 * {/if}
 * ```
 */
export function defineQuery<K extends EndpointKey>(
	key: K,
	args: ArgOf<K>,
	opts?: DefineQueryOptions
) {
	return createQuery(() => buildQueryOptions(key, args, opts));
}
