/**
 * Unit tests for the endpoint registry.
 *
 * Verifies path builder output and exercises the type-level smoke (compile
 * time). No HTTP calls are made here.
 *
 * Conformance: rule .claude/rules/testing.md (unit-test pure logic).
 */
import { describe, it, expect } from 'vitest';
import {
	Endpoints,
	defineEndpoint,
	type ArgOf,
	type BodyOf,
	type ResponseOf
} from './endpoints.js';

describe('Endpoints registry', () => {
	describe('auth.session', () => {
		it('path builder returns the correct BFF path', () => {
			const path = Endpoints['auth.session'].path(undefined as void);
			expect(path).toBe('/api/upstream/auth/session');
		});

		it('has GET method', () => {
			expect(Endpoints['auth.session'].method).toBe('GET');
		});
	});
});

describe('defineEndpoint', () => {
	it('returns the definition unchanged at runtime', () => {
		const def = defineEndpoint<{ id: string }, void, { name: string }>({
			method: 'GET',
			path: ({ id }) => `/items/${id}`
		});

		expect(def.method).toBe('GET');
		expect(def.path({ id: 'abc' })).toBe('/items/abc');
	});

	it('does not expose _phantom at runtime', () => {
		const def = defineEndpoint({ method: 'GET', path: () => '/test' });
		// _phantom is intentionally not present at runtime
		expect('_phantom' in def).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Type-level smoke tests
// ---------------------------------------------------------------------------
// These imports confirm the conditional type helpers compile correctly.
// If any of these assignments fails to type-check, the build gate catches it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AuthSessionArgs = ArgOf<'auth.session'>; // void
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AuthSessionBody = BodyOf<'auth.session'>; // void
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AuthSessionResponse = ResponseOf<'auth.session'>; // SessionData shape
