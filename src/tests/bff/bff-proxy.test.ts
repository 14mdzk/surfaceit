/**
 * Unit tests for the BFF proxy's `buildProxyRequest` pure function.
 *
 * Tests the header stripping, auth injection, and request-id forwarding
 * logic in isolation — no SvelteKit routing involved.
 */
import { describe, it, expect } from 'vitest';
import { buildProxyRequest } from '$server/bff-proxy.js';

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
