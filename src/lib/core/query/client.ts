/**
 * QueryClient factory + context-DI reader.
 *
 * Conformance:
 *   - rule .claude/rules/state-management.md  (factory + getter, Symbol key, no singleton)
 *   - ADR docs/decisions/0001-svelte5-context-di.md
 *
 * Usage:
 *   In the root `+layout.svelte`:
 *     createQueryClient()
 *
 *   In any component or domain store:
 *     const qc = getQueryClient()
 *
 * The `buildQueryClient` export is the pure, context-free constructor used in
 * unit tests where `setContext` is not available.
 */
import { QueryClient } from '@tanstack/svelte-query';
import { getContext, setContext } from 'svelte';
import { ApiError } from '$core/api';

const KEY = Symbol('queryClient');

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

/**
 * Whether TanStack Query should retry a failed query.
 *
 * Rules:
 *   - Never retry `ApiError` instances — they represent definitive API
 *     responses (4xx, 5xx, envelope errors). Retrying them is wasteful and
 *     misleading to the user.
 *   - Retry genuine network blips (non-ApiError errors) up to twice.
 *     `core-fetch` wraps fetch rejections in `ApiError` with code
 *     `NETWORK_ERROR`, so those ARE retried. Only truly unexpected errors
 *     (e.g. bugs that throw a raw Error) are caught by the `else` branch.
 *
 * Exported for unit testing — the policy is pure logic and does not need
 * component lifecycle.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError) {
		// Never retry definitive API responses.
		return false;
	}
	// Retry unexpected non-ApiError errors at most twice.
	return failureCount < 2;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface QueryClientOptions {
	/** Default stale time for queries (ms). Defaults to 30 000. */
	staleTime?: number;
}

// ---------------------------------------------------------------------------
// Pure builder (testable without component lifecycle)
// ---------------------------------------------------------------------------

/**
 * Create a configured `QueryClient` without touching Svelte context.
 * Use this in unit tests. In application code, prefer `createQueryClient`.
 */
export function buildQueryClient(opts?: QueryClientOptions): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: opts?.staleTime ?? 30_000,
				retry: shouldRetry
			}
		}
	});
}

// ---------------------------------------------------------------------------
// Context-DI factory + getter
// ---------------------------------------------------------------------------

/**
 * Instantiate a `QueryClient`, store it in Svelte context, and return it.
 * Call **once** from the layout that owns the client's lifetime (typically
 * the root `+layout.svelte`).
 *
 * @throws Never — but the returned client must still be passed to
 *   `<QueryClientProvider>` so TanStack's own context is also wired.
 */
export function createQueryClient(opts?: QueryClientOptions): QueryClient {
	const client = buildQueryClient(opts);
	setContext(KEY, client);
	return client;
}

/**
 * Retrieve the `QueryClient` from Svelte context.
 * Must be called inside a component or store that has `createQueryClient`
 * in an ancestor layout.
 *
 * @throws {Error} when called outside an initialized context.
 */
export function getQueryClient(): QueryClient {
	const client = getContext<QueryClient | undefined>(KEY);
	if (!client) {
		throw new Error(
			'QueryClient not initialized. Call createQueryClient() in a parent +layout.svelte before calling getQueryClient().'
		);
	}
	return client;
}
