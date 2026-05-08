/**
 * Unit tests for the transparent refresh coalescer.
 *
 * Uses an MSW intercept for the upstream /auth/refresh endpoint.
 * The server mock is configured at module-level defaults; individual tests
 * override with server.use().
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../tests/msw.js';
import { transparentRefresh, isNearExpiry } from './refresh.server.js';
import { sessionStore, destroySession, type SessionRecord } from './session.server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
	return {
		sid: `test-sid-${Math.random()}`,
		user: { id: 'u1', email: 'test@example.com' },
		role: 'user',
		accessToken: 'old-at',
		refreshToken: 'old-rt',
		expiresAt: Date.now() + 30_000, // near expiry
		...overrides
	};
}

// ---------------------------------------------------------------------------
// isNearExpiry
// ---------------------------------------------------------------------------

describe('isNearExpiry', () => {
	it('returns true when token expires in < 60s', () => {
		const record = makeRecord({ expiresAt: Date.now() + 30_000 });
		expect(isNearExpiry(record)).toBe(true);
	});

	it('returns true when token is already expired', () => {
		const record = makeRecord({ expiresAt: Date.now() - 1000 });
		expect(isNearExpiry(record)).toBe(true);
	});

	it('returns false when token has > 60s remaining', () => {
		const record = makeRecord({ expiresAt: Date.now() + 120_000 });
		expect(isNearExpiry(record)).toBe(false);
	});

	it('returns false at exactly 60s', () => {
		const record = makeRecord({ expiresAt: Date.now() + 60_000 });
		expect(isNearExpiry(record)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// transparentRefresh — success
// ---------------------------------------------------------------------------

describe('transparentRefresh — success', () => {
	// Override MSW to intercept the upstream refresh endpoint.
	// The refresh module uses serverConfig.UPSTREAM_API_URL which resolves
	// from env. In test, we intercept the expected URL pattern.
	beforeEach(() => {
		server.use(
			http.post(
				// MSW uses path matching; match any host's /auth/refresh
				/\/auth\/refresh$/,
				() =>
					HttpResponse.json({
						success: true,
						data: {
							accessToken: 'new-at',
							refreshToken: 'new-rt',
							expiresIn: 3600,
							user: { id: 'u1', email: 'test@example.com' },
							role: 'user'
						}
					})
			)
		);
	});

	it('returns an updated record with new tokens', async () => {
		const record = makeRecord();
		try {
			const updated = await transparentRefresh(record.sid, record);
			expect(updated.accessToken).toBe('new-at');
			expect(updated.refreshToken).toBe('new-rt');
			expect(updated.expiresAt).toBeGreaterThan(Date.now() + 3500_000);
		} finally {
			await destroySession(record.sid);
		}
	});

	it('persists the updated record in the session store', async () => {
		const record = makeRecord();
		// Store it first
		await sessionStore.set(record.sid, record);
		try {
			await transparentRefresh(record.sid, record);
			const stored = await sessionStore.get(record.sid);
			expect(stored?.accessToken).toBe('new-at');
		} finally {
			await destroySession(record.sid);
		}
	});

	it('coalesces concurrent refreshes to a single upstream call', async () => {
		let callCount = 0;
		server.use(
			http.post(/\/auth\/refresh$/, () => {
				callCount++;
				return HttpResponse.json({
					success: true,
					data: {
						accessToken: 'coalesced-at',
						refreshToken: 'coalesced-rt',
						expiresIn: 3600,
						user: { id: 'u1', email: 'test@example.com' },
						role: 'user'
					}
				});
			})
		);

		const record = makeRecord();
		// Fire 5 concurrent refreshes for the same sid
		const results = await Promise.all([
			transparentRefresh(record.sid, record),
			transparentRefresh(record.sid, record),
			transparentRefresh(record.sid, record),
			transparentRefresh(record.sid, record),
			transparentRefresh(record.sid, record)
		]);

		// All return the same updated record
		expect(results[0].accessToken).toBe('coalesced-at');
		expect(results[4].accessToken).toBe('coalesced-at');
		// Upstream was called exactly once
		expect(callCount).toBe(1);

		await destroySession(record.sid);
	});
});

// ---------------------------------------------------------------------------
// transparentRefresh — failure
// ---------------------------------------------------------------------------

describe('transparentRefresh — failure', () => {
	it('throws when upstream returns 401', async () => {
		server.use(http.post(/\/auth\/refresh$/, () => new HttpResponse(null, { status: 401 })));

		const record = makeRecord();
		await expect(transparentRefresh(record.sid, record)).rejects.toThrow('REFRESH_EXPIRED');
	});

	it('clears the in-flight entry after rejection so the next call retries', async () => {
		let callCount = 0;
		server.use(
			http.post(/\/auth\/refresh$/, () => {
				callCount++;
				return new HttpResponse(null, { status: 401 });
			})
		);

		const record = makeRecord();
		// First call — fails
		await expect(transparentRefresh(record.sid, record)).rejects.toThrow();
		// Second call — must reach upstream again (not reuse the rejected promise)
		await expect(transparentRefresh(record.sid, record)).rejects.toThrow();
		expect(callCount).toBe(2);
	});

	it('throws on upstream 500 error', async () => {
		server.use(http.post(/\/auth\/refresh$/, () => new HttpResponse(null, { status: 500 })));

		const record = makeRecord();
		await expect(transparentRefresh(record.sid, record)).rejects.toThrow();
	});
});
