/**
 * Tests for the context-DI wrappers in `core/query`:
 * `createQueryClient`, `getQueryClient`, `defineQuery`, `defineMutation`.
 *
 * These functions call `setContext`/`getContext` from Svelte, which require a
 * live component context in production. In tests we mock the `svelte` module to
 * simulate context storage with a plain `Map`, avoiding the need for jsdom or a
 * mounted component.
 *
 * `defineQuery` and `defineMutation` additionally require the TanStack
 * `QueryClientProvider` context key. We mock `@tanstack/svelte-query` so that
 * `createQuery`/`createMutation` do not call through to the real implementation
 * (which would require real component lifecycle). The mock returns a minimal
 * store-like object with a `subscribe` method.
 *
 * Using `vi.mock` is justified here because the unit under test is the
 * _behavior of our wrapper_ (stores the client, retrieves it, delegates to
 * TanStack) — not Svelte's or TanStack's internal mechanisms.
 *
 * Conformance: .claude/rules/testing.md (co-located, Vitest, ≥80% coverage floor).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';

// ---------------------------------------------------------------------------
// Mock svelte context primitives
// ---------------------------------------------------------------------------

/**
 * Fake context store scoped to this module.
 * Each test resets it via `beforeEach` to prevent cross-test contamination.
 */
const fakeContext = new Map<symbol | string, unknown>();

vi.mock('svelte', async (importOriginal) => {
	const original = await importOriginal<typeof import('svelte')>();
	return {
		...original,
		setContext: (key: symbol | string, value: unknown) => {
			fakeContext.set(key, value);
		},
		getContext: <T>(key: symbol | string): T => {
			return fakeContext.get(key) as T;
		}
	};
});

// ---------------------------------------------------------------------------
// Mock TanStack createQuery / createMutation
// (they need QueryClientProvider in real context; our tests verify our wrapper
// delegates to them, not TanStack's internal subscription logic)
// ---------------------------------------------------------------------------

/**
 * Minimal store stub returned by the mocked createQuery/createMutation.
 * Exposes the `subscribe` method that callers type-check for.
 */
const fakeStore = { subscribe: vi.fn() };

vi.mock('@tanstack/svelte-query', async (importOriginal) => {
	const original = await importOriginal<typeof import('@tanstack/svelte-query')>();
	return {
		...original,
		createQuery: vi.fn(() => fakeStore),
		createMutation: vi.fn(() => fakeStore)
	};
});

// Import after mocks are registered.
const { createQueryClient, getQueryClient } = await import('./client.js');
const { defineQuery } = await import('./defineQuery.js');
const { defineMutation } = await import('./defineMutation.js');
const { createQuery, createMutation } = await import('@tanstack/svelte-query');

beforeEach(() => {
	fakeContext.clear();
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createQueryClient
// ---------------------------------------------------------------------------

describe('createQueryClient', () => {
	it('returns a QueryClient instance', () => {
		const client = createQueryClient();
		expect(client).toBeInstanceOf(QueryClient);
	});

	it('stores the client via setContext so getQueryClient retrieves it', () => {
		const stored = createQueryClient();
		const retrieved = getQueryClient();
		expect(retrieved).toBe(stored);
	});

	it('accepts staleTime option and passes it to the QueryClient', () => {
		const client = createQueryClient({ staleTime: 60_000 });
		expect(client.getDefaultOptions().queries?.staleTime).toBe(60_000);
	});
});

// ---------------------------------------------------------------------------
// getQueryClient
// ---------------------------------------------------------------------------

describe('getQueryClient', () => {
	it('throws a helpful error when no client is in context', () => {
		// fakeContext is empty (cleared by beforeEach).
		expect(() => getQueryClient()).toThrow(/createQueryClient/);
	});

	it('error message mentions +layout.svelte', () => {
		expect(() => getQueryClient()).toThrow(/\+layout\.svelte/);
	});
});

// ---------------------------------------------------------------------------
// defineQuery (createQuery wrapper)
// ---------------------------------------------------------------------------

describe('defineQuery', () => {
	it('delegates to createQuery and returns its result', () => {
		const store = defineQuery('auth.session', undefined);
		// Our mock createQuery was called once.
		expect(createQuery).toHaveBeenCalledTimes(1);
		// The result is what createQuery returned.
		expect(store).toBe(fakeStore);
	});
});

// ---------------------------------------------------------------------------
// defineMutation (createMutation wrapper)
// ---------------------------------------------------------------------------

describe('defineMutation', () => {
	it('delegates to createMutation and returns its result', () => {
		const store = defineMutation('auth.session');
		expect(createMutation).toHaveBeenCalledTimes(1);
		expect(store).toBe(fakeStore);
	});
});
