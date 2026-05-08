/**
 * Protected layout guard.
 *
 * Redirects to /login when there is no session. Returns only the public
 * subset of the session ({ user, role }) — never the accessToken or any
 * other server-internal field.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (server-side redirect, no ssr=false)
 *   - rule .claude/rules/security.md (accessToken never returned to browser)
 *   - ADR 0003 (session resolved in hooks.server.ts, guard here in layout)
 */
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.session) {
		redirect(303, '/login');
	}

	// Return ONLY the user-facing subset. accessToken is server-internal —
	// it must never appear in PageData or the __data.json response.
	return {
		user: locals.session.user,
		role: locals.session.role
	};
};
