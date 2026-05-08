/**
 * Login page server: handles the form action, creates a session, sets cookies.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (HttpOnly sid, readable csrf, tokens server-side)
 *   - rule .claude/rules/security.md (Zod parse of untrusted form body, rate-limit via BFF)
 *   - rule .claude/rules/observability.md (requestId on every error path)
 *   - rule .claude/rules/i18n.md (no raw error strings to browser)
 *   - ADR 0003 (cookie session login flow)
 *   - ADR 0008 (direct upstream exception documented below)
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { serverConfig } from '$core/config/index.server';
import { serverLogger } from '$core/logger/pino.server';
import { createSession, setSidCookie, setCsrfCookie, enforceAuthRateLimit } from '$core/auth/index';

// ---------------------------------------------------------------------------
// Input schema — Zod parse at trust boundary (rule security.md, api-contract.md)
// ---------------------------------------------------------------------------

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1)
});

// ---------------------------------------------------------------------------
// Load — redirect if already authenticated
// ---------------------------------------------------------------------------

export const load: PageServerLoad = ({ locals }) => {
	if (locals.session) {
		redirect(303, '/');
	}
	return {};
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, locals } = event;
		const requestId = locals.requestId;

		// Rate-limit login attempts per IP
		enforceAuthRateLimit(event);

		// Parse and validate the form body
		const formData = Object.fromEntries(await request.formData());
		const parsed = loginSchema.safeParse(formData);
		if (!parsed.success) {
			return fail(422, {
				error: 'auth_login_invalid_credentials' as const,
				requestId
			});
		}

		const { email, password } = parsed.data;

		// Direct upstream call: auth lifecycle only (no Bearer to inject pre-login,
		// or server-side revocation). All other upstream calls go through api()
		// per .claude/rules/api-contract.md. See ADR 0003 + ADR 0008 (pending).
		let upstreamResponse: Response;
		try {
			upstreamResponse = await fetch(`${serverConfig.UPSTREAM_API_URL}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
		} catch (cause) {
			serverLogger.error({ requestId, err: String(cause) }, 'login: network error to upstream');
			return fail(502, { error: 'auth_login_error_generic' as const, requestId });
		}

		if (upstreamResponse.status === 429) {
			return fail(429, { error: 'auth_login_rate_limited' as const, requestId });
		}

		if (upstreamResponse.status === 401 || upstreamResponse.status === 400) {
			return fail(401, { error: 'auth_login_invalid_credentials' as const, requestId });
		}

		if (!upstreamResponse.ok) {
			serverLogger.error({ requestId, status: upstreamResponse.status }, 'login: upstream error');
			return fail(502, { error: 'auth_login_error_generic' as const, requestId });
		}

		let body: unknown;
		try {
			body = await upstreamResponse.json();
		} catch {
			serverLogger.error({ requestId }, 'login: upstream returned non-JSON');
			return fail(502, { error: 'auth_login_error_generic' as const, requestId });
		}

		// Validate response envelope
		if (
			typeof body !== 'object' ||
			body === null ||
			!('success' in body) ||
			!(body as { success: unknown }).success ||
			!('data' in body)
		) {
			serverLogger.error({ requestId }, 'login: unexpected upstream envelope');
			return fail(502, { error: 'auth_login_error_generic' as const, requestId });
		}

		const data = (body as { data: Record<string, unknown> }).data;

		if (
			typeof data.accessToken !== 'string' ||
			typeof data.refreshToken !== 'string' ||
			typeof data.expiresIn !== 'number' ||
			typeof data.user !== 'object' ||
			data.user === null ||
			typeof (data.user as Record<string, unknown>).id !== 'string' ||
			typeof (data.user as Record<string, unknown>).email !== 'string' ||
			typeof data.role !== 'string'
		) {
			serverLogger.error({ requestId }, 'login: upstream data shape invalid');
			return fail(502, { error: 'auth_login_error_generic' as const, requestId });
		}

		const user = data.user as { id: string; email: string };

		const sid = await createSession({
			user,
			role: data.role as string,
			accessToken: data.accessToken as string,
			refreshToken: data.refreshToken as string,
			expiresIn: data.expiresIn as number
		});

		setSidCookie(cookies, sid);
		setCsrfCookie(cookies, crypto.randomUUID());

		serverLogger.info({ requestId, userId: user.id }, 'login: session created');

		redirect(303, '/');
	}
};
