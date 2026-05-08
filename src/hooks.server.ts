/**
 * Server hooks.
 *
 * Stack (in execution order):
 *   1. requestIdHandle    — generate per-request id, attach to locals, echo header.
 *   2. authHandle         — populate locals.session from `sid` cookie.
 *   3. paraglideHandle    — locale resolution + AsyncLocalStorage for messages.
 *   4. securityHandle     — apply CSP and other security headers (last so it sees the final response).
 *
 * Conformance:
 *   - rule .claude/rules/observability.md  (request id minted here, echoed downstream)
 *   - rule .claude/rules/security.md       (CSP, Referrer-Policy, X-Content-Type-Options, …)
 *   - rule .claude/rules/auth-and-session.md (session resolved server-side, never client-readable token)
 *   - rule .claude/rules/i18n.md           (locale comes from cookie, defaults to `en`)
 *   - ADR 0003                             (cookie session, transparent refresh, coalesced per-session)
 */
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { paraglideMiddleware } from '$lib/generated/paraglide/server.js';
import { serverLogger } from '$core/logger/pino.server';
import {
	sessionStore,
	toLocals,
	clearAuthCookies,
	transparentRefresh,
	isNearExpiry
} from '$core/auth/index';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Generate a per-request id and propagate it via `locals.requestId` and the
 * outbound `x-request-id` response header. Honors an inbound id when one is
 * provided by an upstream proxy.
 */
const requestIdHandle: Handle = async ({ event, resolve }) => {
	const inbound = event.request.headers.get(REQUEST_ID_HEADER);
	const requestId = inbound && inbound.length <= 128 ? inbound : crypto.randomUUID();
	event.locals.requestId = requestId;

	const response = await resolve(event);
	response.headers.set(REQUEST_ID_HEADER, requestId);
	return response;
};

/**
 * Read the `sid` cookie and populate `event.locals.session`.
 *
 * Pipeline:
 *   1. No sid cookie → session = null.
 *   2. sid present, no record in store → clear cookies, session = null.
 *   3. Record found, near expiry → transparent refresh via coalescer.
 *      - Refresh 401 → destroy session, clear cookies, session = null.
 *      - Refresh success → update locals with new record.
 *   4. Populate locals.session with { user, role, accessToken, expiresAt }.
 *
 * Conformance: rule auth-and-session.md, ADR 0003.
 */
const authHandle: Handle = async ({ event, resolve }) => {
	const sid = event.cookies.get('sid');

	if (!sid) {
		event.locals.session = null;
		return resolve(event);
	}

	let record = await sessionStore.get(sid);

	if (!record) {
		// Stale or tampered sid — clear the orphaned cookies
		clearAuthCookies(event.cookies);
		event.locals.session = null;
		serverLogger.debug(
			{ requestId: event.locals.requestId },
			'authHandle: sid present but no session record, cleared cookies'
		);
		return resolve(event);
	}

	if (isNearExpiry(record)) {
		try {
			record = await transparentRefresh(sid, record);
		} catch {
			// Refresh failed (expired or upstream error) — invalidate session
			await sessionStore.delete(sid);
			clearAuthCookies(event.cookies);
			event.locals.session = null;
			serverLogger.warn(
				{ requestId: event.locals.requestId },
				'authHandle: token refresh failed, session invalidated'
			);
			return resolve(event);
		}
	}

	event.locals.session = toLocals(record);
	return resolve(event);
};

/**
 * Bridge Paraglide's request-scoped locale + AsyncLocalStorage into the
 * SvelteKit hook chain.
 */
const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		event.locals.locale = locale;
		return resolve(event);
	});

/**
 * Apply security headers. Strict CSP per rule security.md.
 *
 * `style-src` includes `'unsafe-inline'` because Tailwind v4 + SvelteKit
 * inject critical CSS inline during SSR. Everything else is `'self'`.
 */
const securityHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	const csp = [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self' data:",
		"connect-src 'self'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"object-src 'none'"
	].join('; ');

	response.headers.set('Content-Security-Policy', csp);
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (!dev) {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains; preload'
		);
	}
	return response;
};

export const handle = sequence(requestIdHandle, authHandle, paraglideHandle, securityHandle);

/**
 * Server-side error hook. Logs the full error with request id and returns a
 * sanitized payload that `+error.svelte` can render.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.locals.requestId;
	const err =
		error instanceof Error
			? { name: error.name, message: error.message, stack: error.stack }
			: { value: String(error) };
	serverLogger.error(
		{ requestId, status, route: event.url.pathname, err },
		'unhandled server error'
	);
	return {
		message: status >= 500 ? 'Internal error' : message,
		code: status >= 500 ? 'INTERNAL' : 'CLIENT_ERROR',
		requestId
	};
};
