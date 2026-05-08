/**
 * BFF proxy: all upstream calls go through here.
 *
 * This endpoint is the single outbound gate for upstream requests. It:
 *   1. Builds the downstream URL from serverConfig.UPSTREAM_API_URL + path.
 *   2. Strips browser-sensitive headers (cookie, host, origin) via buildProxyRequest.
 *   3. Forwards x-request-id from locals for log correlation.
 *   4. Rate-limits auth paths against credential stuffing.
 *   5. Validates CSRF on unsafe methods (except auth/login which has no session yet).
 *   6. Injects Authorization: Bearer from the server-side session.
 *   7. Enforces a 30s timeout via AbortSignal.
 *   8. Strips Set-Cookie from the upstream response via buildProxyResponse.
 *
 * The request/response building logic lives in `src/lib/server/bff-proxy.ts`
 * so it can be unit-tested independently (SvelteKit forbids non-handler exports
 * from +server.ts files).
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (Bearer injected server-side, no tokens to browser)
 *   - rule .claude/rules/security.md (CSRF, header stripping, rate-limit on auth paths)
 *   - rule .claude/rules/observability.md (x-request-id propagated)
 *   - rule .claude/rules/api-contract.md (all upstream calls through BFF)
 */
import { error, type RequestHandler, type RequestEvent } from '@sveltejs/kit';
import { serverConfig } from '$core/config/index.server';
import { serverLogger } from '$core/logger/pino.server';
import { validateCsrf, enforceAuthRateLimit } from '$core/auth/index';
import { buildProxyRequest, buildProxyResponse } from '$server/bff-proxy';

const UPSTREAM_TIMEOUT_MS = 30_000;

/** True when the proxy path is an auth lifecycle endpoint. */
function isAuthPath(path: string): boolean {
	return path.startsWith('auth/');
}

/** True when the endpoint is the initial login (no session/csrf cookie yet). */
function isLoginPath(path: string): boolean {
	return path === 'auth/login';
}

const handler: RequestHandler = async (event) => {
	const { params, request, locals } = event;
	const path = params.path ?? '';
	const requestId = locals.requestId;

	// Rate-limit auth endpoints against credential stuffing
	if (isAuthPath(path)) {
		enforceAuthRateLimit(event as RequestEvent);
	}

	// CSRF validation on unsafe methods; login is exempt (no session/csrf cookie yet)
	validateCsrf(event as RequestEvent, isLoginPath(path));

	const upstreamUrl = `${serverConfig.UPSTREAM_API_URL}/${path}`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

	const accessToken = locals.session?.accessToken ?? null;

	const proxyRequest = buildProxyRequest({
		upstreamUrl,
		originalRequest: request,
		accessToken,
		requestId,
		signal: controller.signal
	});

	let upstreamResponse: Response;
	try {
		upstreamResponse = await fetch(proxyRequest);
	} catch (cause) {
		clearTimeout(timeout);
		if (cause instanceof Error && cause.name === 'AbortError') {
			serverLogger.error({ requestId, path }, 'bff: upstream timeout');
			throw error(504, { message: 'Upstream timeout', code: 'UPSTREAM_TIMEOUT' });
		}
		serverLogger.error({ requestId, path, err: String(cause) }, 'bff: upstream network error');
		throw error(502, { message: 'Upstream unavailable', code: 'UPSTREAM_ERROR' });
	}

	clearTimeout(timeout);

	serverLogger.debug(
		{ requestId, path, status: upstreamResponse.status },
		'bff: upstream response'
	);

	return buildProxyResponse(upstreamResponse);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
