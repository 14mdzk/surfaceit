/**
 * Typed fetch wrapper.
 *
 * `api()` is the only place in this codebase where `fetch` is called for
 * upstream requests. It:
 *   1. Resolves the endpoint path from the registry.
 *   2. Calls `fetch` with the correct method, headers, and body.
 *   3. Unwraps the `{ success, data }` / `{ success, error }` envelope exactly
 *      once. Consumers receive `data` directly or catch an `ApiError`.
 *
 * Conformance:
 *   - rule .claude/rules/api-contract.md   (envelope unwrapped once, no hand-rolled fetch)
 *   - rule .claude/rules/observability.md  (requestId forwarded as x-request-id)
 *   - rule .claude/rules/auth-and-session.md (no tokens in the request from this layer)
 *   - rule .claude/rules/security.md       (no tokens reach the browser)
 */
import { ApiError } from './error.js';
import {
	Endpoints,
	type EndpointKey,
	type ArgOf,
	type BodyOf,
	type ResponseOf
} from './endpoints.js';

// ---------------------------------------------------------------------------
// Envelope shapes
// ---------------------------------------------------------------------------

interface SuccessEnvelope<T> {
	success: true;
	data: T;
	message?: string;
}

interface ErrorEnvelope {
	success: false;
	error: { code: string; message: string };
}

type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ApiCallOptions {
	/**
	 * A bound `fetch` to use in place of the global.  **Required when calling
	 * `api()` from a SvelteKit server load function** — pass `event.fetch` so
	 * SvelteKit can handle cookies and internal route resolution correctly.
	 *
	 * On the client the global `fetch` is used when this is omitted.
	 */
	fetch?: typeof fetch;
	/**
	 * Forwarded to the upstream as `x-request-id`. When set, the header is
	 * included on every outbound request so logs on the upstream can be
	 * correlated with the originating request (see rule observability.md).
	 */
	requestId?: string;
	/** Optional abort signal to cancel the request. */
	signal?: AbortSignal;
	/**
	 * Base URL to prepend to relative paths. Defaults to `''` (relative).
	 * Tests pass `'http://localhost'` so Node's built-in fetch can resolve the
	 * URL; production code leaves this unset and relies on the browser/server
	 * resolving relative paths against the current origin.
	 */
	baseUrl?: string;
}

/**
 * Call a registered upstream endpoint and return its typed response data.
 *
 * @throws {ApiError} on network failure, non-2xx status, unexpected payload
 *   shape, or a `success: false` envelope from the upstream.
 */
export async function api<K extends EndpointKey>(
	key: K,
	args: ArgOf<K>,
	body?: BodyOf<K>,
	opts?: ApiCallOptions
): Promise<ResponseOf<K>> {
	const def = Endpoints[key];

	// SSR guard — Node does not resolve relative URLs.  Callers using `api()`
	// from a server load function must pass `opts.fetch` (i.e. `event.fetch`).
	// We detect the server side by checking for the absence of `window`.
	const isServer = typeof window === 'undefined';
	if (isServer && !opts?.fetch) {
		throw new ApiError({
			code: 'MISSING_FETCH',
			message: 'Pass event.fetch via opts.fetch when calling api() from a server load function.',
			status: 0
		});
	}

	const fetchFn = opts?.fetch ?? fetch;

	// Build the full URL.  A `baseUrl` is only used in tests where Node needs
	// an absolute URL; in production the path is relative and resolves against
	// the current origin in both browser and SvelteKit server contexts.
	const path = (def.path as (args: ArgOf<K>) => string)(args);
	const url = opts?.baseUrl ? `${opts.baseUrl}${path}` : path;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json'
	};

	if (opts?.requestId) {
		headers['x-request-id'] = opts.requestId;
	}

	let response: Response;
	try {
		response = await fetchFn(url, {
			method: def.method,
			headers,
			body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
			signal: opts?.signal
		});
	} catch (cause) {
		throw new ApiError({
			code: 'NETWORK_ERROR',
			message: cause instanceof Error ? cause.message : 'Network request failed',
			status: 0,
			requestId: opts?.requestId
		});
	}

	// Capture request id from the response header for correlation.
	const responseRequestId = response.headers.get('x-request-id') ?? opts?.requestId;

	if (!response.ok) {
		throw new ApiError({
			code: 'HTTP_ERROR',
			message: response.statusText || `HTTP ${response.status}`,
			status: response.status,
			requestId: responseRequestId
		});
	}

	let envelope: unknown;
	try {
		envelope = await response.json();
	} catch {
		throw new ApiError({
			code: 'UNEXPECTED_SHAPE',
			message: 'Response body is not valid JSON',
			status: response.status,
			requestId: responseRequestId
		});
	}

	// Validate envelope shape.
	if (typeof envelope !== 'object' || envelope === null || !('success' in envelope)) {
		throw new ApiError({
			code: 'UNEXPECTED_SHAPE',
			message: 'Response body does not match the expected envelope shape',
			status: response.status,
			requestId: responseRequestId
		});
	}

	const typed = envelope as Envelope<ResponseOf<K>>;

	if (!typed.success) {
		const errEnv = typed as ErrorEnvelope;
		throw new ApiError({
			code: errEnv.error?.code ?? 'UNKNOWN',
			message: errEnv.error?.message ?? 'Unknown error',
			status: response.status,
			requestId: responseRequestId
		});
	}

	return (typed as SuccessEnvelope<ResponseOf<K>>).data;
}
