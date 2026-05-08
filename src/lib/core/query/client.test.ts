/**
 * Tests for `core/query/client.ts`.
 *
 * Tests the pure `buildQueryClient` and `shouldRetry` functions directly —
 * no Svelte component lifecycle required.
 *
 * `createQueryClient` / `getQueryClient` (the context-DI wrappers) call
 * `setContext`/`getContext` from svelte, which require component init.
 * The error path of `getQueryClient` is covered via a jsdom component test
 * once the first domain lands. The happy path is implicitly exercised by the
 * integration test (Wave-3 layout mount).
 * TODO(yuki): cover createQueryClient/getQueryClient via jsdom component test
 * when first domain lands and jsdom environment is configured.
 *
 * Conformance: rule .claude/rules/testing.md (co-located, Vitest, ≥80% coverage floor).
 */
import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { ApiError } from '$core/api';
import { buildQueryClient, shouldRetry } from './client.js';

// ---------------------------------------------------------------------------
// buildQueryClient
// ---------------------------------------------------------------------------

describe('buildQueryClient', () => {
	it('returns a QueryClient instance', () => {
		const client = buildQueryClient();
		expect(client).toBeInstanceOf(QueryClient);
	});

	it('uses the default staleTime of 30 000 ms', () => {
		const client = buildQueryClient();
		// Access the resolved default query options through the internal
		// defaults helper. The `getDefaultOptions()` method is public API.
		const defaults = client.getDefaultOptions();
		expect(defaults.queries?.staleTime).toBe(30_000);
	});

	it('accepts a custom staleTime', () => {
		const client = buildQueryClient({ staleTime: 60_000 });
		const defaults = client.getDefaultOptions();
		expect(defaults.queries?.staleTime).toBe(60_000);
	});

	it('sets the shouldRetry function as the retry policy', () => {
		const client = buildQueryClient();
		const defaults = client.getDefaultOptions();
		// The retry option is the exported shouldRetry function reference.
		expect(defaults.queries?.retry).toBe(shouldRetry);
	});
});

// ---------------------------------------------------------------------------
// shouldRetry
// ---------------------------------------------------------------------------

describe('shouldRetry', () => {
	it('returns false for ApiError regardless of failureCount', () => {
		const err = new ApiError({ code: 'HTTP_ERROR', message: 'Server error', status: 500 });
		expect(shouldRetry(0, err)).toBe(false);
		expect(shouldRetry(1, err)).toBe(false);
		expect(shouldRetry(5, err)).toBe(false);
	});

	it('returns false for ApiError with network code', () => {
		const err = new ApiError({ code: 'NETWORK_ERROR', message: 'Network failure', status: 0 });
		// ApiError instances — even network errors — are never retried.
		// core-fetch already wraps network failures in ApiError; if we want
		// network retries in the future, that belongs in core-fetch, not here.
		expect(shouldRetry(0, err)).toBe(false);
	});

	it('returns false for ApiError with 4xx status', () => {
		const err = new ApiError({ code: 'HTTP_ERROR', message: 'Not found', status: 404 });
		expect(shouldRetry(0, err)).toBe(false);
	});

	it('returns true for non-ApiError error when failureCount < 2', () => {
		const err = new Error('Unexpected bug');
		expect(shouldRetry(0, err)).toBe(true);
		expect(shouldRetry(1, err)).toBe(true);
	});

	it('returns false for non-ApiError error when failureCount >= 2', () => {
		const err = new Error('Unexpected bug');
		expect(shouldRetry(2, err)).toBe(false);
		expect(shouldRetry(3, err)).toBe(false);
	});

	it('returns false for non-ApiError error at exactly failureCount=2 (boundary)', () => {
		const err = new TypeError('Something broke');
		expect(shouldRetry(2, err)).toBe(false);
	});

	it('handles non-Error thrown values (string, null, undefined)', () => {
		// These are unusual but possible if a queryFn throws a non-Error.
		expect(shouldRetry(0, 'string error')).toBe(true);
		expect(shouldRetry(0, null)).toBe(true);
		expect(shouldRetry(0, undefined)).toBe(true);
		// After 2 failures, stop regardless.
		expect(shouldRetry(2, null)).toBe(false);
	});
});
