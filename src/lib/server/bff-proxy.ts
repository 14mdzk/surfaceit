/**
 * BFF proxy helpers.
 *
 * Extracted from `routes/api/upstream/[...path]/+server.ts` so they can be
 * unit-tested without SvelteKit routing, and so the route file only exports
 * the HTTP method handlers that SvelteKit allows.
 *
 * Conformance:
 *   - rule .claude/rules/auth-and-session.md (Bearer injected server-side)
 *   - rule .claude/rules/security.md (header stripping)
 *   - rule .claude/rules/observability.md (x-request-id propagated)
 */

/**
 * Headers to forward from the browser request to upstream.
 * Anything not in this set is dropped to prevent header injection and
 * to avoid forwarding session cookies to the upstream (rule security.md).
 */
const ALLOWED_REQUEST_HEADERS = new Set([
	'accept',
	'content-type',
	'content-length',
	'accept-language',
	'accept-encoding'
]);

/**
 * Build the upstream Request, stripping browser-sensitive headers and
 * injecting the server-side Bearer token and request id.
 */
export function buildProxyRequest(params: {
	upstreamUrl: string;
	originalRequest: Request;
	accessToken: string | null;
	requestId: string;
	signal: AbortSignal;
}): Request {
	const { upstreamUrl, originalRequest, accessToken, requestId, signal } = params;

	const headers = new Headers();

	// Forward only the allow-listed subset; strip cookie, host, origin, x-csrf, etc.
	for (const [key, value] of originalRequest.headers.entries()) {
		if (ALLOWED_REQUEST_HEADERS.has(key.toLowerCase())) {
			headers.set(key, value);
		}
	}

	// Inject server-side Bearer token
	if (accessToken) {
		headers.set('Authorization', `Bearer ${accessToken}`);
	}

	// Forward request id for log correlation across services (rule observability.md)
	headers.set('x-request-id', requestId);

	return new Request(upstreamUrl, {
		method: originalRequest.method,
		headers,
		body:
			originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD'
				? originalRequest.body
				: null,
		// @ts-expect-error — duplex is required for streaming POST/PUT bodies in Node 18+
		duplex: 'half',
		signal
	});
}

/**
 * Strip headers from the upstream response that must not reach the browser.
 * `set-cookie` is stripped because tokens are held server-side only.
 */
export function buildProxyResponse(upstreamResponse: Response): Response {
	const headers = new Headers(upstreamResponse.headers);
	headers.delete('set-cookie');

	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers
	});
}
