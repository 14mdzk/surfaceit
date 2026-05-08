/**
 * Access token refresh with per-session coalescing.
 *
 * A race condition occurs when multiple concurrent requests arrive for the
 * same session while the access token is near expiry. Without coalescing,
 * each request issues a refresh, most fail (refresh tokens are single-use),
 * and the user sees 401 storms.
 *
 * This module stores one in-flight Promise<SessionRecord> per sid. Subsequent
 * requests that arrive while a refresh is in-flight wait on the same promise
 * instead of issuing their own. The in-flight entry is removed in `finally`
 * so the next request after the refresh (successful or not) gets a fresh
 * attempt.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (coalesced refresh promise per session)
 *   - rule .claude/rules/security.md (tokens server-side, never reach browser)
 *
 * Direct upstream call: auth lifecycle only (no Bearer to inject pre-login,
 * or server-side revocation). All other upstream calls go through api()
 * per .claude/rules/api-contract.md. See ADR 0003.
 */
import { serverLogger } from '$core/logger/pino.server';
import { serverConfig } from '$core/config/index.server';
import { sessionStore, type SessionRecord } from './session.server.js';

/** Near-expiry threshold: refresh when token expires within 60 seconds. */
const NEAR_EXPIRY_MS = 60_000;

/** Map of sid → in-flight refresh promise. */
const inFlight = new Map<string, Promise<SessionRecord>>();

/**
 * Returns true if the session's access token is near expiry (< 60s remaining).
 */
export function isNearExpiry(record: SessionRecord): boolean {
	return record.expiresAt - Date.now() < NEAR_EXPIRY_MS;
}

/**
 * Transparently refresh the access token for `sid`.
 *
 * If a refresh is already in-flight for this sid, returns the existing
 * promise rather than issuing a second refresh. The in-flight entry is
 * always removed in `finally` — a failed refresh clears it so the next
 * request can retry, and a successful refresh clears it so subsequent
 * requests use the freshly stored record from the session store.
 *
 * On refresh failure (401 from upstream): throws so the caller can destroy
 * the session and clear cookies.
 *
 * @param sid - Session identifier
 * @param current - Current session record (used to extract refreshToken)
 * @returns Updated session record with new tokens
 */
export function transparentRefresh(sid: string, current: SessionRecord): Promise<SessionRecord> {
	const existing = inFlight.get(sid);
	if (existing) return existing;

	// Register the entry BEFORE chaining .finally() so the Map entry exists
	// before any rejection handler can fire — regardless of rejection timing.
	const promise = doRefresh(sid, current);
	inFlight.set(sid, promise);
	return promise.finally(() => {
		// Always clear the in-flight entry — whether the refresh succeeded or
		// failed — so the next request can start a fresh attempt.
		inFlight.delete(sid);
	});
}

async function doRefresh(sid: string, current: SessionRecord): Promise<SessionRecord> {
	// Direct upstream call: auth lifecycle only (no Bearer to inject pre-login,
	// or server-side revocation). All other upstream calls go through api()
	// per .claude/rules/api-contract.md. See ADR 0003 + ADR 0008 (pending).
	let response: Response;
	try {
		response = await fetch(`${serverConfig.UPSTREAM_API_URL}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken: current.refreshToken })
		});
	} catch (cause) {
		serverLogger.error({ sid, err: String(cause) }, 'refresh: network error');
		throw cause;
	}

	if (response.status === 401) {
		serverLogger.warn({ sid }, 'refresh: upstream returned 401, session expired');
		throw new Error('REFRESH_EXPIRED');
	}

	if (!response.ok) {
		serverLogger.error({ sid, status: response.status }, 'refresh: upstream error');
		throw new Error(`REFRESH_UPSTREAM_ERROR:${response.status}`);
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new Error('REFRESH_INVALID_JSON');
	}

	// Validate envelope shape
	if (
		typeof body !== 'object' ||
		body === null ||
		!('success' in body) ||
		!(body as { success: unknown }).success ||
		!('data' in body)
	) {
		throw new Error('REFRESH_UNEXPECTED_SHAPE');
	}

	const data = (body as { data: Record<string, unknown> }).data;

	if (
		typeof data.accessToken !== 'string' ||
		typeof data.refreshToken !== 'string' ||
		typeof data.expiresIn !== 'number'
	) {
		throw new Error('REFRESH_UNEXPECTED_SHAPE');
	}

	const updated: SessionRecord = {
		...current,
		accessToken: data.accessToken as string,
		refreshToken: data.refreshToken as string,
		expiresAt: Date.now() + (data.expiresIn as number) * 1000
	};

	await sessionStore.set(sid, updated);
	serverLogger.debug({ sid }, 'refresh: token rotated');
	return updated;
}
