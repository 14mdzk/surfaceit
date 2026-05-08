/**
 * Session store — server-side token storage keyed by opaque sid.
 *
 * The browser holds only the `sid` cookie; access + refresh tokens never
 * leave the server process (see ADR 0003, rule auth-and-session.md).
 *
 * Architecture: module-level singleton is acceptable here because:
 *   - this file is `*.server.ts` — never bundled to the client
 *   - the store is a server-process singleton, not a per-request singleton;
 *     state-management.md forbids per-request singletons, not process globals
 *   - in production, swap the in-memory map for a Redis adapter via the
 *     SessionStore interface without touching consumers
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (tokens server-side, sid opaque)
 *   - rule .claude/rules/security.md (tokens never reach browser)
 *   - rule .claude/rules/observability.md (no tokens in logs)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The public user shape exposed to load functions and layout guards. */
export interface SessionUser {
	id: string;
	email: string;
}

/**
 * Full server-side session record. Only `user` and `role` may leave the
 * server process. `accessToken`, `refreshToken`, `expiresAt` are server-only.
 */
export interface SessionRecord {
	sid: string;
	user: SessionUser;
	role: string;
	accessToken: string;
	refreshToken: string;
	/** Unix timestamp in milliseconds when the access token expires. */
	expiresAt: number;
}

/** Subset safe to surface to SvelteKit load functions via `event.locals`. */
export interface SessionLocals {
	user: SessionUser;
	role: string;
	/** Server-internal — BFF injects this as Bearer; never returned to browser. */
	accessToken: string;
	expiresAt: number;
}

// ---------------------------------------------------------------------------
// SessionStore interface
// ---------------------------------------------------------------------------

/**
 * Backing store for sessions. Swap the in-memory implementation for a
 * Redis-backed adapter in production without changing callers.
 */
export interface SessionStore {
	get(sid: string): Promise<SessionRecord | null>;
	set(sid: string, record: SessionRecord): Promise<void>;
	delete(sid: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (dev / test)
// ---------------------------------------------------------------------------

class InMemorySessionStore implements SessionStore {
	private readonly map = new Map<string, SessionRecord>();

	async get(sid: string): Promise<SessionRecord | null> {
		return this.map.get(sid) ?? null;
	}

	async set(sid: string, record: SessionRecord): Promise<void> {
		this.map.set(sid, record);
	}

	async delete(sid: string): Promise<void> {
		this.map.delete(sid);
	}
}

// ---------------------------------------------------------------------------
// Process singleton
// ---------------------------------------------------------------------------

/**
 * Process-level session store. Server-only (never imported from client code).
 * Replace with a Redis-backed implementation in production by reassigning
 * this export before the first request.
 *
 * Not a per-request singleton — state-management.md's prohibition targets
 * per-request or per-component singletons that escape their scope. This store
 * is intentionally shared across all requests in the server process.
 */
export const sessionStore: SessionStore = new InMemorySessionStore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random session id.
 * Uses crypto.randomUUID() — Node 14.17+/browser native, no extra deps.
 */
export function generateSid(): string {
	return crypto.randomUUID();
}

/**
 * Create a new session record, store it, and return the sid.
 * Called by the login action after upstream returns tokens.
 */
export async function createSession(params: {
	user: SessionUser;
	role: string;
	accessToken: string;
	refreshToken: string;
	expiresIn: number; // seconds
}): Promise<string> {
	const sid = generateSid();
	const record: SessionRecord = {
		sid,
		user: params.user,
		role: params.role,
		accessToken: params.accessToken,
		refreshToken: params.refreshToken,
		expiresAt: Date.now() + params.expiresIn * 1000
	};
	await sessionStore.set(sid, record);
	return sid;
}

/**
 * Destroy a session by sid. Best-effort — does not throw if sid not found.
 */
export async function destroySession(sid: string): Promise<void> {
	await sessionStore.delete(sid);
}

/**
 * Extract the locals-safe subset from a full session record.
 * The `refreshToken` is intentionally omitted — it never leaves this module.
 */
export function toLocals(record: SessionRecord): SessionLocals {
	return {
		user: record.user,
		role: record.role,
		accessToken: record.accessToken,
		expiresAt: record.expiresAt
	};
}
