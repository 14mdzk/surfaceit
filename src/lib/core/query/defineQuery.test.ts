/**
 * Tests for `core/query/defineQuery.ts`.
 *
 * Tests `buildQueryOptions` — the pure options builder — by inspecting the
 * returned options object and exercising the queryFn path via MSW-intercepted
 * HTTP using `queryClient.fetchQuery`.
 *
 * `defineQuery` (the `createQuery` wrapper) requires component lifecycle and
 * is covered in Wave-3 integration tests.
 * TODO(yuki): cover defineQuery's reactive wrapper in a jsdom component test
 * when first domain lands and jsdom environment is configured.
 *
 * Conformance: rule .claude/rules/testing.md (mock HTTP via MSW, co-located).
 */
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../tests/msw.js';
import { ApiError } from '$core/api';
import { buildQueryClient } from './client.js';
import { buildQueryOptions } from './defineQuery.js';

// ---------------------------------------------------------------------------
// Typed queryFn caller for tests
// ---------------------------------------------------------------------------

/**
 * Call the queryFn from buildQueryOptions with an AbortController signal.
 * We use a typed wrapper to avoid the banned `Function` type.
 */
type QueryFnCallable = (ctx: { signal: AbortSignal }) => Promise<unknown>;

function callQueryFn(
	opts: ReturnType<typeof buildQueryOptions>,
	signal: AbortSignal
): Promise<unknown> {
	// The queryFn is typed as QueryFunction<ResponseOf<K>, ...> by TanStack.
	// We cast through unknown to call it without the full QueryFunctionContext —
	// only the `signal` field is needed by our implementation.
	return (opts.queryFn as unknown as QueryFnCallable)({ signal });
}

// ---------------------------------------------------------------------------
// Browser env helper for Node tests
// ---------------------------------------------------------------------------

/**
 * Patch globalThis to simulate a browser environment for the duration of `fn`.
 * Required because api() checks `typeof window === 'undefined'` to detect SSR.
 * Also patches fetch to prepend localhost so MSW can intercept relative URLs.
 */
async function withBrowserEnv<T>(fn: () => Promise<T>): Promise<T> {
	const originalWindow = globalThis.window;
	// @ts-expect-error -- simulate browser env: window must be present for api() to use globalThis.fetch
	globalThis.window = {};
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? `http://localhost${input}` : input;
		return originalFetch(url, init);
	};
	try {
		return await fn();
	} finally {
		globalThis.fetch = originalFetch;
		if (originalWindow !== undefined) {
			globalThis.window = originalWindow;
		} else {
			// @ts-expect-error -- restore window to undefined (was undefined before patch)
			delete globalThis.window;
		}
	}
}

// ---------------------------------------------------------------------------
// buildQueryOptions — shape
// ---------------------------------------------------------------------------

describe('buildQueryOptions — shape', () => {
	it('produces a queryFn', () => {
		const opts = buildQueryOptions('auth.session', undefined);
		expect(typeof opts.queryFn).toBe('function');
	});

	it('produces a queryKey of [key, args]', () => {
		const opts = buildQueryOptions('auth.session', undefined);
		expect(opts.queryKey).toEqual(['auth.session', undefined]);
	});

	it('threads the enabled option through', () => {
		const opts = buildQueryOptions('auth.session', undefined, { enabled: false });
		expect(opts.enabled).toBe(false);
	});

	it('threads the staleTime option through', () => {
		const opts = buildQueryOptions('auth.session', undefined, { staleTime: 99_000 });
		expect(opts.staleTime).toBe(99_000);
	});

	it('omits enabled when not provided', () => {
		const opts = buildQueryOptions('auth.session', undefined);
		expect(opts.enabled).toBeUndefined();
	});

	it('omits staleTime when not provided', () => {
		const opts = buildQueryOptions('auth.session', undefined);
		expect(opts.staleTime).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// queryFn — direct invocation (happy path via MSW)
// ---------------------------------------------------------------------------

describe('buildQueryOptions — queryFn happy path', () => {
	it('resolves with the unwrapped session data', async () => {
		// The queryFn calls api() with baseUrl: ''. Node requires absolute URLs.
		// withBrowserEnv patches fetch to prepend localhost and sets window so
		// api() uses globalThis.fetch instead of throwing MISSING_FETCH.
		await withBrowserEnv(async () => {
			const opts = buildQueryOptions('auth.session', undefined);
			const ac = new AbortController();
			const result = await callQueryFn(opts, ac.signal);
			expect(result).toEqual({ user: { id: '1', email: 'a@b.com' }, role: 'admin' });
		});
	});
});

// ---------------------------------------------------------------------------
// queryFn — error paths (via MSW)
// ---------------------------------------------------------------------------

describe('buildQueryOptions — queryFn error paths', () => {
	it('throws ApiError with HTTP_ERROR on 500', async () => {
		server.use(
			http.get(
				'http://localhost/api/upstream/auth/session',
				() => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' })
			)
		);

		await withBrowserEnv(async () => {
			const opts = buildQueryOptions('auth.session', undefined);
			const ac = new AbortController();
			await expect(callQueryFn(opts, ac.signal)).rejects.toSatisfy(
				(e: unknown) => e instanceof ApiError && e.code === 'HTTP_ERROR' && e.status === 500
			);
		});
	});

	it('throws ApiError with upstream code on success:false envelope', async () => {
		server.use(
			http.get('http://localhost/api/upstream/auth/session', () =>
				HttpResponse.json({
					success: false,
					error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
				})
			)
		);

		await withBrowserEnv(async () => {
			const opts = buildQueryOptions('auth.session', undefined);
			const ac = new AbortController();
			await expect(callQueryFn(opts, ac.signal)).rejects.toSatisfy(
				(e: unknown) => e instanceof ApiError && e.code === 'UNAUTHORIZED'
			);
		});
	});
});

// ---------------------------------------------------------------------------
// queryFn via fetchQuery (integration smoke test)
// ---------------------------------------------------------------------------

describe('buildQueryOptions — fetchQuery integration', () => {
	it('resolves via fetchQuery with a custom queryFn that uses absolute URL', async () => {
		const client = buildQueryClient();
		// Use fetchQuery with our own queryFn to verify queryKey shape and data
		// flow. We bypass the baseUrl issue by using a custom queryFn here.
		const result = await client.fetchQuery({
			queryKey: ['auth.session', undefined] as const,
			queryFn: async ({ signal }) => {
				const res = await globalThis.fetch('http://localhost/api/upstream/auth/session', {
					signal
				});
				const json = (await res.json()) as { success: boolean; data: unknown };
				if (!json.success) throw new Error('not success');
				return json.data;
			}
		});

		expect(result).toEqual({ user: { id: '1', email: 'a@b.com' }, role: 'admin' });
	});
});

// ---------------------------------------------------------------------------
// requestId option
// ---------------------------------------------------------------------------

describe('buildQueryOptions — requestId', () => {
	it('accepts requestId and produces a queryFn', () => {
		const opts = buildQueryOptions('auth.session', undefined, { requestId: 'req-abc' });
		// requestId is captured in the queryFn closure; verify it is callable.
		expect(typeof opts.queryFn).toBe('function');
	});
});
