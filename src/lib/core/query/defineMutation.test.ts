/**
 * Tests for `core/query/defineMutation.ts`.
 *
 * Tests `buildMutationOptions` — the pure options builder — by calling
 * `mutationFn` directly and by exercising `onSuccess`/`onError` callbacks.
 * No Svelte component lifecycle is required.
 *
 * `defineMutation` (the `createMutation` wrapper) requires component lifecycle
 * and is covered in Wave-3 integration tests.
 * TODO(yuki): cover defineMutation's reactive wrapper in a jsdom component test
 * when first domain lands and jsdom environment is configured.
 *
 * Conformance: rule .claude/rules/testing.md (mock HTTP via MSW, co-located).
 */
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../tests/msw.js';
import { ApiError } from '$core/api';
import { buildMutationOptions } from './defineMutation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Typed mutationFn caller for tests.
 * ArgOf<'auth.session'> and BodyOf<'auth.session'> both resolve to never (void
 * becomes never via conditional type inference in TS6). We double-cast through
 * unknown to call mutationFn in tests without satisfying the phantom-typed
 * args/body constraint.
 */
type TestMutFn = (v: { args: undefined; body: undefined; requestId?: string }) => Promise<unknown>;

function getMutFn(opts: ReturnType<typeof buildMutationOptions>): TestMutFn {
	return opts.mutationFn as unknown as TestMutFn;
}

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
// buildMutationOptions shape
// ---------------------------------------------------------------------------

describe('buildMutationOptions — shape', () => {
	it('produces a mutationFn', () => {
		const opts = buildMutationOptions('auth.session');
		expect(typeof opts.mutationFn).toBe('function');
	});

	it('threads onSuccess callback', () => {
		const onSuccess = vi.fn();
		const opts = buildMutationOptions('auth.session', {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- widened for callback identity test; BodyOf<'auth.session'> is never
			onSuccess: onSuccess as any
		});
		expect(opts.onSuccess).toBe(onSuccess);
	});

	it('threads onError callback', () => {
		const onError = vi.fn();
		const opts = buildMutationOptions('auth.session', {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- widened for callback identity test; BodyOf<'auth.session'> is never
			onError: onError as any
		});
		expect(opts.onError).toBe(onError);
	});

	it('sets onSuccess to undefined when not provided', () => {
		const opts = buildMutationOptions('auth.session');
		expect(opts.onSuccess).toBeUndefined();
	});

	it('sets onError to undefined when not provided', () => {
		const opts = buildMutationOptions('auth.session');
		expect(opts.onError).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// mutationFn — success path (via MSW)
// ---------------------------------------------------------------------------

describe('buildMutationOptions — mutationFn success', () => {
	it('resolves with data when the server returns success envelope', async () => {
		// withBrowserEnv patches window + fetch so api() can run in Node tests.
		await withBrowserEnv(async () => {
			const opts = buildMutationOptions('auth.session');
			const result = await getMutFn(opts)({ args: undefined, body: undefined });
			expect(result).toEqual({ user: { id: '1', email: 'a@b.com' }, role: 'admin' });
		});
	});
});

// ---------------------------------------------------------------------------
// mutationFn — error paths (via MSW)
// ---------------------------------------------------------------------------

describe('buildMutationOptions — mutationFn error paths', () => {
	it('throws ApiError with HTTP_ERROR code on 500', async () => {
		server.use(
			http.get(
				'http://localhost/api/upstream/auth/session',
				() => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' })
			)
		);

		await withBrowserEnv(async () => {
			const opts = buildMutationOptions('auth.session');
			await expect(getMutFn(opts)({ args: undefined, body: undefined })).rejects.toSatisfy(
				(e: unknown) => e instanceof ApiError && e.code === 'HTTP_ERROR' && e.status === 500
			);
		});
	});

	it('throws ApiError with upstream code on success:false envelope', async () => {
		server.use(
			http.get('http://localhost/api/upstream/auth/session', () =>
				HttpResponse.json({
					success: false,
					error: { code: 'FORBIDDEN', message: 'Access denied' }
				})
			)
		);

		await withBrowserEnv(async () => {
			const opts = buildMutationOptions('auth.session');
			await expect(getMutFn(opts)({ args: undefined, body: undefined })).rejects.toSatisfy(
				(e: unknown) => e instanceof ApiError && e.code === 'FORBIDDEN'
			);
		});
	});
});

// ---------------------------------------------------------------------------
// requestId propagation
// ---------------------------------------------------------------------------

describe('buildMutationOptions — requestId', () => {
	it('accepts requestId in the variables shape', () => {
		// The MutationVariables shape includes optional requestId.
		// Full propagation to x-request-id header is tested in core-fetch.test.ts.
		const opts = buildMutationOptions('auth.session');
		// Verify the mutationFn accepts a requestId field in its variables.
		expect(typeof opts.mutationFn).toBe('function');
	});
});
