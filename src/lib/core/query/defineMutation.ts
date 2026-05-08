/**
 * `defineMutation` — typed mutation factory bound to the endpoint registry.
 *
 * Wraps TanStack Svelte Query's `createMutation` so domain code never imports
 * TanStack directly. The `mutationFn` calls `api()` through `core/api`,
 * satisfying the no-hand-rolled-fetch rule.
 *
 * Conformance:
 *   - rule .claude/rules/api-contract.md     (all upstream calls via api())
 *   - rule .claude/rules/observability.md    (requestId threaded through api())
 *   - rule .claude/rules/architecture.md     (core layer, no upward imports)
 *
 * ## Testing strategy
 *
 * `buildMutationOptions` is a pure function that returns the TanStack options
 * object. Test the `mutationFn` path directly by calling
 * `buildMutationOptions(...).mutationFn(variables, context)` without needing a
 * component.
 *
 * `defineMutation` itself wraps `createMutation` and requires component
 * lifecycle; cover that path in integration tests when the first component
 * harness lands (Wave-3).
 * TODO(yuki): cover defineMutation's reactive wrapper in a jsdom component test
 * once the first domain lands and the jsdom Vitest environment is set up.
 */
import { createMutation } from '@tanstack/svelte-query';
import { api, type ApiError, type BodyOf, type EndpointKey, type ResponseOf } from '$core/api';
import type { CreateMutationOptions } from '@tanstack/svelte-query';

// ---------------------------------------------------------------------------
// Variables type
// ---------------------------------------------------------------------------

/**
 * The variables object passed to the mutation trigger.
 * Pairs the request body with an optional caller-provided request id.
 */
export interface MutationVariables<TBody> {
	body: TBody;
	/**
	 * Caller-provided request id forwarded to `api()` as `opts.requestId`.
	 * Propagates the server-originated `x-request-id` through client-side
	 * mutations (see rule observability.md).
	 */
	requestId?: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Subset of TanStack's `CreateMutationOptions` that `defineMutation` accepts.
 * The full set is available by passing options directly via `buildMutationOptions`.
 */
export type DefineMutationOptions<TData, TBody> = Pick<
	CreateMutationOptions<TData, ApiError, MutationVariables<TBody>>,
	'onSuccess' | 'onError' | 'onSettled' | 'onMutate'
>;

// ---------------------------------------------------------------------------
// Pure options builder (testable without component lifecycle)
// ---------------------------------------------------------------------------

/**
 * Build a TanStack mutation options object for a registered endpoint.
 *
 * The returned object's `mutationFn` can be called directly in unit tests:
 * ```ts
 * const opts = buildMutationOptions('auth.login')
 * const result = await opts.mutationFn({ body: { email, password } }, context)
 * ```
 */
export function buildMutationOptions<K extends EndpointKey>(
	key: K,
	opts?: DefineMutationOptions<ResponseOf<K>, BodyOf<K>>
): CreateMutationOptions<ResponseOf<K>, ApiError, MutationVariables<BodyOf<K>>> {
	return {
		mutationFn: ({ body, requestId }: MutationVariables<BodyOf<K>>) =>
			api(key, undefined as never, body, {
				requestId,
				// On the client, globalThis.fetch is available. Mutations always
				// originate client-side; the BFF handles auth server-side.
				baseUrl: ''
			}),
		onSuccess: opts?.onSuccess,
		onError: opts?.onError,
		onSettled: opts?.onSettled,
		onMutate: opts?.onMutate
	};
}

// ---------------------------------------------------------------------------
// Component-lifecycle wrapper
// ---------------------------------------------------------------------------

/**
 * Create a reactive mutation for a registered endpoint.
 *
 * Must be called inside a Svelte component (requires component lifecycle for
 * `createMutation`'s reactive subscription).
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { defineMutation, getQueryClient } from '$core/query'
 *
 *   const qc = getQueryClient()
 *   const loginMutation = defineMutation('auth.login', {
 *     onSuccess: () => qc.invalidateQueries({ queryKey: ['auth'] })
 *   })
 * </script>
 *
 * <button onclick={() => $loginMutation.mutate({ body: { email, password } })}>
 *   Sign in
 * </button>
 * ```
 */
export function defineMutation<K extends EndpointKey>(
	key: K,
	opts?: DefineMutationOptions<ResponseOf<K>, BodyOf<K>>
) {
	return createMutation(() => buildMutationOptions(key, opts));
}
