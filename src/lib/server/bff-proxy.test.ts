/**
 * Unit tests for the BFF proxy's `buildProxyRequest` and `buildProxyResponse`
 * pure functions.
 *
 * Tests the header stripping, auth injection, request-id forwarding, and
 * SSE anti-buffering header injection logic in isolation — no SvelteKit
 * routing involved.
 */
import { describe, it, expect } from 'vitest';
import { buildProxyRequest, buildProxyResponse } from '$server/bff-proxy.js';

const ABORT_SIGNAL = new AbortController().signal;

function makeRequest(method: string, headers: Record<string, string> = {}, body?: string): Request {
	return new Request('http://browser.example.com/api/upstream/cameras', {
		method,
		headers,
		body: method !== 'GET' && method !== 'HEAD' ? body : undefined
	});
}

describe('buildProxyRequest — header stripping', () => {
	it('strips the cookie header', () => {
		const req = makeRequest('GET', { cookie: 'sid=abc; csrf=tok' });
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('cookie')).toBeNull();
	});

	it('strips the host header', () => {
		const req = makeRequest('GET', { host: 'browser.example.com' });
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('host')).toBeNull();
	});

	it('strips the origin header', () => {
		const req = makeRequest('POST', { origin: 'https://browser.example.com' });
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('origin')).toBeNull();
	});

	it('strips x-csrf header (not in allow-list)', () => {
		const req = makeRequest('POST', { 'x-csrf': 'tok123' });
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('x-csrf')).toBeNull();
	});

	it('forwards content-type', () => {
		const req = makeRequest('POST', { 'content-type': 'application/json' });
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('content-type')).toBe('application/json');
	});

	it('forwards accept header', () => {
		const req = makeRequest('GET', { accept: 'application/json' });
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('accept')).toBe('application/json');
	});

	it('strips content-length to let fetch recompute or use chunked transfer', () => {
		// Forwarding a stale content-length can cause upstream 400s when the
		// body has been re-encoded or when duplex streaming is used (Fix 2, PR #8).
		const req = makeRequest(
			'POST',
			{ 'content-length': '42', 'content-type': 'application/json' },
			'{}'
		);
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('content-length')).toBeNull();
	});
});

describe('buildProxyRequest — auth injection', () => {
	it('sets Authorization header when accessToken is provided', () => {
		const req = makeRequest('GET');
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: 'bearer-token-xyz',
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('Authorization')).toBe('Bearer bearer-token-xyz');
	});

	it('does not set Authorization header when accessToken is null', () => {
		const req = makeRequest('GET');
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('Authorization')).toBeNull();
	});
});

describe('buildProxyRequest — request-id propagation', () => {
	it('sets x-request-id from the provided requestId', () => {
		const req = makeRequest('GET');
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras',
			originalRequest: req,
			accessToken: null,
			requestId: 'my-trace-id',
			signal: ABORT_SIGNAL
		});
		expect(proxy.headers.get('x-request-id')).toBe('my-trace-id');
	});
});

describe('buildProxyRequest — URL', () => {
	it('forwards the upstreamUrl unchanged', () => {
		const req = makeRequest('GET');
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras?search=foo',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.url).toBe('http://upstream/cameras?search=foo');
	});

	it('forwards the HTTP method', () => {
		const req = makeRequest('DELETE');
		const proxy = buildProxyRequest({
			upstreamUrl: 'http://upstream/cameras/1',
			originalRequest: req,
			accessToken: null,
			requestId: 'req-1',
			signal: ABORT_SIGNAL
		});
		expect(proxy.method).toBe('DELETE');
	});
});

// ---------------------------------------------------------------------------
// buildProxyResponse — SSE anti-buffering headers
// ---------------------------------------------------------------------------

function makeUpstreamResponse(
	contentType: string,
	extraHeaders: Record<string, string> = {}
): Response {
	const headers = new Headers({ 'content-type': contentType, ...extraHeaders });
	return new Response(null, { status: 200, headers });
}

describe('buildProxyResponse — text/event-stream anti-buffering headers', () => {
	it('adds Cache-Control: no-cache, no-transform for text/event-stream', () => {
		const upstream = makeUpstreamResponse('text/event-stream');
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('cache-control')).toBe('no-cache, no-transform');
	});

	it('adds X-Accel-Buffering: no for text/event-stream', () => {
		const upstream = makeUpstreamResponse('text/event-stream');
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('x-accel-buffering')).toBe('no');
	});

	it('adds Connection: keep-alive for text/event-stream', () => {
		const upstream = makeUpstreamResponse('text/event-stream');
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('connection')).toBe('keep-alive');
	});

	it('handles content-type with charset suffix (text/event-stream; charset=utf-8)', () => {
		const upstream = makeUpstreamResponse('text/event-stream; charset=utf-8');
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('cache-control')).toBe('no-cache, no-transform');
		expect(proxy.headers.get('x-accel-buffering')).toBe('no');
		expect(proxy.headers.get('connection')).toBe('keep-alive');
	});

	it('does NOT add anti-buffering headers for application/json', () => {
		const upstream = makeUpstreamResponse('application/json');
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('cache-control')).toBeNull();
		expect(proxy.headers.get('x-accel-buffering')).toBeNull();
		expect(proxy.headers.get('connection')).toBeNull();
	});

	it('does NOT add anti-buffering headers for text/plain', () => {
		const upstream = makeUpstreamResponse('text/plain');
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('cache-control')).toBeNull();
		expect(proxy.headers.get('x-accel-buffering')).toBeNull();
		expect(proxy.headers.get('connection')).toBeNull();
	});

	it('does NOT add anti-buffering headers when content-type is absent', () => {
		const upstream = new Response(null, { status: 200 });
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('cache-control')).toBeNull();
		expect(proxy.headers.get('x-accel-buffering')).toBeNull();
		expect(proxy.headers.get('connection')).toBeNull();
	});

	it('still strips set-cookie from SSE responses', () => {
		const upstream = makeUpstreamResponse('text/event-stream', {
			'set-cookie': 'sid=secret; HttpOnly'
		});
		const proxy = buildProxyResponse(upstream);
		expect(proxy.headers.get('set-cookie')).toBeNull();
	});
});
