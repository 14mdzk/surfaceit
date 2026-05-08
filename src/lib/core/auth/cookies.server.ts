/**
 * Auth cookie helpers.
 *
 * Centralizes the cookie shape so the login action, logout endpoint, and
 * authHandle all set/clear cookies with identical flags.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (HttpOnly sid, readable csrf, Secure in non-dev)
 *   - rule .claude/rules/security.md (SameSite=Lax, Secure flag, no tokens in browser)
 */
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

/** 30 days in seconds */
const AUTH_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Set the opaque session id cookie.
 * HttpOnly: browser JS cannot read this cookie.
 * SameSite=Lax: sent on top-level navigations but not cross-origin POSTs.
 */
export function setSidCookie(cookies: Cookies, sid: string): void {
	cookies.set('sid', sid, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: AUTH_MAX_AGE
	});
}

/**
 * Set the CSRF double-submit cookie.
 *
 * httpOnly: false — this cookie MUST be readable by JS so the client can
 * copy it into the `x-csrf` request header (double-submit pattern).
 * SameSite=Lax: sent on top-level navigations; CSRF protection is via the
 * double-submit check, not SameSite alone.
 */
export function setCsrfCookie(cookies: Cookies, token: string): void {
	cookies.set('csrf', token, {
		path: '/',
		httpOnly: false, // Must be JS-readable for double-submit
		sameSite: 'lax',
		secure: !dev,
		maxAge: AUTH_MAX_AGE
	});
}

/**
 * Clear both auth cookies on logout or session invalidation.
 * maxAge: 0 instructs the browser to delete immediately.
 */
export function clearAuthCookies(cookies: Cookies): void {
	cookies.set('sid', '', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 0
	});
	cookies.set('csrf', '', {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 0
	});
}
