/**
 * Unit tests for the session store module.
 *
 * Tests use the public API: createSession / destroySession / sessionStore /
 * generateSid / toLocals. The in-memory implementation is the process-level
 * singleton; tests clean up after themselves via destroySession.
 */
import { describe, it, expect } from 'vitest';
import {
	createSession,
	destroySession,
	toLocals,
	generateSid,
	sessionStore
} from './session.server.js';
import type { SessionRecord } from './session.server.js';

const baseParams = () => ({
	user: { id: 'u1', email: 'test@example.com' },
	role: 'user',
	accessToken: 'at',
	refreshToken: 'rt',
	expiresIn: 3600
});

describe('session store', () => {
	it('createSession stores a record and returns a sid', async () => {
		const sid = await createSession(baseParams());
		try {
			expect(typeof sid).toBe('string');
			expect(sid.length).toBeGreaterThan(8);

			const stored = await sessionStore.get(sid);
			expect(stored).not.toBeNull();
			expect(stored!.user.email).toBe('test@example.com');
			expect(stored!.accessToken).toBe('at');
		} finally {
			await destroySession(sid);
		}
	});

	it('createSession sets expiresAt ~3600s in the future', async () => {
		const before = Date.now();
		const sid = await createSession(baseParams());
		const after = Date.now();
		try {
			const stored = await sessionStore.get(sid);
			expect(stored!.expiresAt).toBeGreaterThanOrEqual(before + 3600_000);
			expect(stored!.expiresAt).toBeLessThanOrEqual(after + 3600_000 + 100);
		} finally {
			await destroySession(sid);
		}
	});

	it('destroySession removes the record', async () => {
		const sid = await createSession(baseParams());
		await destroySession(sid);
		const stored = await sessionStore.get(sid);
		expect(stored).toBeNull();
	});

	it('destroySession is idempotent — no throw for unknown sid', async () => {
		await expect(destroySession('unknown-sid')).resolves.toBeUndefined();
	});

	it('sessionStore.get returns null for unknown sid', async () => {
		const result = await sessionStore.get('nonexistent-sid');
		expect(result).toBeNull();
	});

	it('generateSid produces unique values', () => {
		const a = generateSid();
		const b = generateSid();
		expect(a).not.toBe(b);
	});

	it('two createSession calls produce different sids', async () => {
		const sid1 = await createSession(baseParams());
		const sid2 = await createSession(baseParams());
		try {
			expect(sid1).not.toBe(sid2);
		} finally {
			await destroySession(sid1);
			await destroySession(sid2);
		}
	});
});

describe('toLocals', () => {
	it('omits refreshToken from locals', () => {
		const record: SessionRecord = {
			sid: 's1',
			user: { id: 'u1', email: 'a@b.com' },
			role: 'admin',
			accessToken: 'at123',
			refreshToken: 'rt_secret',
			expiresAt: Date.now() + 3600_000
		};
		const locals = toLocals(record);
		expect(locals).not.toHaveProperty('refreshToken');
		expect(locals.accessToken).toBe('at123');
		expect(locals.user.email).toBe('a@b.com');
	});

	it('omits sid from locals', () => {
		const record: SessionRecord = {
			sid: 's1',
			user: { id: 'u1', email: 'a@b.com' },
			role: 'user',
			accessToken: 'at123',
			refreshToken: 'rt_secret',
			expiresAt: Date.now() + 3600_000
		};
		const locals = toLocals(record);
		expect(locals).not.toHaveProperty('sid');
	});

	it('includes user, role, accessToken, expiresAt', () => {
		const record: SessionRecord = {
			sid: 's1',
			user: { id: 'u1', email: 'a@b.com' },
			role: 'user',
			accessToken: 'at123',
			refreshToken: 'rt_secret',
			expiresAt: 9999999
		};
		const locals = toLocals(record);
		expect(locals.user).toEqual({ id: 'u1', email: 'a@b.com' });
		expect(locals.role).toBe('user');
		expect(locals.accessToken).toBe('at123');
		expect(locals.expiresAt).toBe(9999999);
	});
});
