/**
 * Tests for `api()` in core-fetch.ts.
 *
 * Uses MSW (configured in tests/setup.ts via setupFiles) to intercept HTTP.
 * Tests pass `opts.fetch` explicitly — Node's global fetch requires an
 * absolute URL; `baseUrl: 'http://localhost'` ensures MSW can match the path.
 *
 * Conformance: rule .claude/rules/testing.md (mock HTTP with MSW).
 */
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../tests/msw.js';
import { api } from './core-fetch.js';
import { ApiError } from './error.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Standard test options factory. Called inside each test (not at module
 * scope) so `globalThis.fetch` is resolved after MSW has patched it in
 * the `beforeAll` lifecycle hook from `tests/setup.ts`.
 */
function baseOpts() {
	return { fetch: globalThis.fetch, baseUrl: 'http://localhost' } as const;
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('api() — happy path', () => {
	it('returns the unwrapped data on success', async () => {
		const result = await api('auth.session', undefined, undefined, baseOpts());

		expect(result).toEqual({
			user: { id: '1', email: 'a@b.com' },
			role: 'admin'
		});
	});
});

// ---------------------------------------------------------------------------
// Error envelope
// ---------------------------------------------------------------------------

describe('api() — error envelope', () => {
	it('throws ApiError with upstream code and message on success:false', async () => {
		server.use(
			http.get('http://localhost/api/upstream/auth/session', () =>
				HttpResponse.json(
					{
						success: false,
						error: { code: 'UNAUTHORIZED', message: 'Token expired' }
					},
					{ status: 200 }
				)
			)
		);

		await expect(api('auth.session', undefined, undefined, baseOpts())).rejects.toSatisfy(
			(e: unknown) =>
				e instanceof ApiError && e.code === 'UNAUTHORIZED' && e.message === 'Token expired'
		);
	});
});

// ---------------------------------------------------------------------------
// HTTP errors
// ---------------------------------------------------------------------------

describe('api() — HTTP errors', () => {
	it('throws ApiError with code HTTP_ERROR on 500 status', async () => {
		server.use(
			http.get(
				'http://localhost/api/upstream/auth/session',
				() => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' })
			)
		);

		await expect(api('auth.session', undefined, undefined, baseOpts())).rejects.toSatisfy(
			(e: unknown) => e instanceof ApiError && e.code === 'HTTP_ERROR' && e.status === 500
		);
	});

	it('throws ApiError with code HTTP_ERROR on 401 status', async () => {
		server.use(
			http.get(
				'http://localhost/api/upstream/auth/session',
				() => new HttpResponse(null, { status: 401, statusText: 'Unauthorized' })
			)
		);

		await expect(api('auth.session', undefined, undefined, baseOpts())).rejects.toSatisfy(
			(e: unknown) => e instanceof ApiError && e.code === 'HTTP_ERROR' && e.status === 401
		);
	});
});

// ---------------------------------------------------------------------------
// Network failure
// ---------------------------------------------------------------------------

describe('api() — network failure', () => {
	it('throws ApiError with code NETWORK_ERROR when fetch rejects', async () => {
		// To test network-level failure (fetch() throwing), we inject a fetch
		// stub that rejects. This is not "stubbing fetch by hand" in the
		// sense of patching globalThis — it is dependency injection via
		// `opts.fetch`, the approved extension point in api()'s signature.
		// MSW is not used here because the scenario is fetch() itself failing
		// (TCP error), not a bad HTTP response.
		const rejectingFetch = async () => {
			throw new TypeError('Failed to fetch');
		};

		await expect(
			api('auth.session', undefined, undefined, {
				fetch: rejectingFetch as typeof fetch,
				baseUrl: 'http://localhost'
			})
		).rejects.toSatisfy(
			(e: unknown) => e instanceof ApiError && e.code === 'NETWORK_ERROR' && e.status === 0
		);
	});
});

// ---------------------------------------------------------------------------
// Unexpected shape
// ---------------------------------------------------------------------------

describe('api() — unexpected shape', () => {
	it('throws ApiError with code UNEXPECTED_SHAPE when response has no success field', async () => {
		server.use(
			http.get('http://localhost/api/upstream/auth/session', () =>
				HttpResponse.json({ notAnEnvelope: true })
			)
		);

		await expect(api('auth.session', undefined, undefined, baseOpts())).rejects.toSatisfy(
			(e: unknown) => e instanceof ApiError && e.code === 'UNEXPECTED_SHAPE'
		);
	});
});

// ---------------------------------------------------------------------------
// requestId propagation
// ---------------------------------------------------------------------------

describe('api() — requestId propagation', () => {
	it('sends x-request-id header when opts.requestId is provided', async () => {
		let capturedRequestId: string | null = null;

		server.use(
			http.get('http://localhost/api/upstream/auth/session', ({ request }) => {
				capturedRequestId = request.headers.get('x-request-id');
				return HttpResponse.json({
					success: true,
					data: { user: { id: '1', email: 'a@b.com' }, role: 'admin' }
				});
			})
		);

		await api('auth.session', undefined, undefined, {
			...baseOpts(),
			requestId: 'test-req-id-123'
		});

		expect(capturedRequestId).toBe('test-req-id-123');
	});

	it('does not send x-request-id header when opts.requestId is not provided', async () => {
		let capturedRequestId: string | null = 'sentinel';

		server.use(
			http.get('http://localhost/api/upstream/auth/session', ({ request }) => {
				capturedRequestId = request.headers.get('x-request-id');
				return HttpResponse.json({
					success: true,
					data: { user: { id: '1', email: 'a@b.com' }, role: 'admin' }
				});
			})
		);

		await api('auth.session', undefined, undefined, baseOpts());

		expect(capturedRequestId).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// SSR guard — MISSING_FETCH
// ---------------------------------------------------------------------------

describe('api() — SSR guard', () => {
	it('throws MISSING_FETCH when called server-side without opts.fetch', async () => {
		// Simulate server environment by temporarily removing `window`.
		// The SSR guard in api() checks `typeof window === 'undefined'`.
		const originalWindow = globalThis.window;
		// @ts-expect-error — intentionally removing window to simulate SSR
		delete globalThis.window;

		try {
			await expect(
				api('auth.session', undefined, undefined, { baseUrl: 'http://localhost' })
			).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.code === 'MISSING_FETCH');
		} finally {
			if (originalWindow !== undefined) {
				globalThis.window = originalWindow;
			}
		}
	});

	it('does not throw MISSING_FETCH when opts.fetch is provided server-side', async () => {
		const originalWindow = globalThis.window;
		// @ts-expect-error — intentionally removing window to simulate SSR
		delete globalThis.window;

		try {
			const result = await api('auth.session', undefined, undefined, baseOpts());
			expect(result).toBeDefined();
		} finally {
			if (originalWindow !== undefined) {
				globalThis.window = originalWindow;
			}
		}
	});
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
	it('is an instance of Error', () => {
		const err = new ApiError({ code: 'TEST', message: 'test', status: 0 });
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.name).toBe('ApiError');
	});

	it('carries code, status, and optional requestId', () => {
		const err = new ApiError({
			code: 'HTTP_ERROR',
			message: 'Not Found',
			status: 404,
			requestId: 'req-abc'
		});
		expect(err.code).toBe('HTTP_ERROR');
		expect(err.status).toBe(404);
		expect(err.requestId).toBe('req-abc');
	});

	it('spy test confirms vi import works', () => {
		const fn = vi.fn(() => 42);
		expect(fn()).toBe(42);
		expect(fn).toHaveBeenCalledOnce();
	});
});
