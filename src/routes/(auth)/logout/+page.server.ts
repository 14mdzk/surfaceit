/**
 * Logout action. POST-only SvelteKit form action.
 *
 * Best-effort upstream revocation: calls the upstream logout endpoint with
 * the current access token, then always destroys the local session and clears
 * cookies regardless of upstream response.
 *
 * CSRF: for a traditional form POST, the CSRF token is passed as a hidden
 * `_csrf` field in the form body. This is the form-submission variant of the
 * double-submit pattern — the server reads the cookie and the body field and
 * compares them. The `x-csrf` header variant is used for fetch()-based calls
 * from `defineMutation` in core/query.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (revoke session, clear cookies)
 *   - rule .claude/rules/security.md (CSRF on unsafe method)
 *   - ADR 0003 (logout flow)
 *   - ADR 0008 (direct upstream exception for session revocation)
 */
import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { serverConfig } from '$core/config/index.server';
import { serverLogger } from '$core/logger/pino.server';
import { clearAuthCookies, destroySession } from '$core/auth/index';

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const requestId = locals.requestId;

		// CSRF validation via form body field `_csrf` (form-submit double-submit).
		// The login page seeds a `csrf` cookie; the logout form echoes it back
		// as a hidden input. An attacker on a third-party origin cannot read the
		// cookie value, so they cannot forge the `_csrf` field.
		const formData = await request.formData();
		const csrfBody = formData.get('_csrf')?.toString();
		const csrfCookie = cookies.get('csrf');

		if (!csrfBody || !csrfCookie || csrfBody !== csrfCookie) {
			serverLogger.warn({ requestId }, 'logout: CSRF validation failed');
			return fail(403, { error: 'csrf' });
		}

		const sid = cookies.get('sid');
		const session = locals.session;

		// Always clear local state first
		if (sid) {
			await destroySession(sid);
		}
		clearAuthCookies(cookies);

		// Best-effort upstream revocation. If this fails, the local session is
		// already gone; the upstream token will expire on its own schedule.
		if (session?.accessToken) {
			// Direct upstream call: auth lifecycle only (no Bearer to inject pre-login,
			// or server-side revocation). All other upstream calls go through api()
			// per .claude/rules/api-contract.md. See ADR 0003.
			try {
				await fetch(`${serverConfig.UPSTREAM_API_URL}/auth/logout`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${session.accessToken}`,
						'x-request-id': requestId
					}
				});
			} catch (cause) {
				serverLogger.warn(
					{ requestId, err: String(cause) },
					'logout: upstream revoke failed (best-effort)'
				);
			}
		}

		serverLogger.info({ requestId }, 'logout: session destroyed');

		redirect(303, '/login');
	}
};
