/**
 * CSRF double-submit validation.
 *
 * On unsafe methods (POST, PUT, PATCH, DELETE), the client must send the
 * value of its `csrf` cookie in the `x-csrf` request header. The server
 * compares the two — since a cross-origin attacker cannot read the cookie
 * value, the header cannot be forged.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (x-csrf header required on unsafe)
 *   - rule .claude/rules/security.md (CSRF double-submit on unsafe methods)
 */
import { error, type RequestEvent } from '@sveltejs/kit';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Validate the CSRF double-submit for the incoming request.
 *
 * Throws a 403 error (via SvelteKit's `error()`) if:
 *   - the method is unsafe and the `csrf` cookie is absent
 *   - the `x-csrf` header does not match the `csrf` cookie value
 *
 * Safe methods (GET, HEAD, OPTIONS) are passed through without validation.
 *
 * @param event - The SvelteKit `RequestEvent` (from a handle or +server.ts)
 * @param exempt - If true, skip validation even for unsafe methods. Use only
 *   for endpoints where CSRF is explicitly not needed (e.g. the initial login
 *   POST, which has no session yet and therefore no `csrf` cookie to compare).
 */
export function validateCsrf(event: RequestEvent, exempt = false): void {
	const method = event.request.method.toUpperCase();
	if (!UNSAFE_METHODS.has(method)) return;
	if (exempt) return;

	const cookieToken = event.cookies.get('csrf');
	const headerToken = event.request.headers.get('x-csrf');

	if (!cookieToken || !headerToken) {
		throw error(403, { message: 'CSRF validation failed: missing token', code: 'CSRF_MISSING' });
	}

	if (cookieToken !== headerToken) {
		throw error(403, { message: 'CSRF validation failed: token mismatch', code: 'CSRF_MISMATCH' });
	}
}
