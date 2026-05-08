/**
 * Unit tests for CSRF double-submit validation.
 *
 * Uses minimal RequestEvent stubs — no SvelteKit routing needed.
 */
import { describe, it, expect } from 'vitest';
import { validateCsrf } from './csrf.server.js';
import type { RequestEvent } from '@sveltejs/kit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CookieStore = Record<string, string>;

function makeEvent(
	method: string,
	cookies: CookieStore = {},
	headers: Record<string, string> = {}
): RequestEvent {
	return {
		request: new Request('http://localhost/test', {
			method,
			headers
		}),
		cookies: {
			get: (name: string) => cookies[name] ?? undefined,
			getAll: () => [],
			set: () => {},
			delete: () => {},
			serialize: () => ''
		}
	} as unknown as RequestEvent;
}

// ---------------------------------------------------------------------------
// Safe methods — always pass
// ---------------------------------------------------------------------------

describe('validateCsrf — safe methods', () => {
	for (const method of ['GET', 'HEAD', 'OPTIONS']) {
		it(`does not throw on ${method}`, () => {
			const event = makeEvent(method);
			expect(() => validateCsrf(event)).not.toThrow();
		});
	}
});

// ---------------------------------------------------------------------------
// Unsafe methods — pass when tokens match
// ---------------------------------------------------------------------------

describe('validateCsrf — valid double-submit', () => {
	for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
		it(`passes ${method} when cookie and header match`, () => {
			const event = makeEvent(method, { csrf: 'tok123' }, { 'x-csrf': 'tok123' });
			expect(() => validateCsrf(event)).not.toThrow();
		});
	}
});

// ---------------------------------------------------------------------------
// Unsafe methods — fail when tokens missing or mismatched
// ---------------------------------------------------------------------------

describe('validateCsrf — missing token', () => {
	it('throws 403 when csrf cookie is absent', () => {
		const event = makeEvent('POST', {}, { 'x-csrf': 'tok123' });
		expect(() => validateCsrf(event)).toThrow();
	});

	it('throws 403 when x-csrf header is absent', () => {
		const event = makeEvent('POST', { csrf: 'tok123' });
		expect(() => validateCsrf(event)).toThrow();
	});

	it('throws 403 when both cookie and header are absent', () => {
		const event = makeEvent('POST');
		expect(() => validateCsrf(event)).toThrow();
	});
});

describe('validateCsrf — mismatch', () => {
	it('throws 403 when cookie and header differ', () => {
		const event = makeEvent('POST', { csrf: 'tok-a' }, { 'x-csrf': 'tok-b' });
		expect(() => validateCsrf(event)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Exempt flag
// ---------------------------------------------------------------------------

describe('validateCsrf — exempt', () => {
	it('passes unsafe method when exempt=true even without tokens', () => {
		const event = makeEvent('POST');
		expect(() => validateCsrf(event, true)).not.toThrow();
	});

	it('passes unsafe method when exempt=true even with mismatched tokens', () => {
		const event = makeEvent('POST', { csrf: 'a' }, { 'x-csrf': 'b' });
		expect(() => validateCsrf(event, true)).not.toThrow();
	});
});
