/**
 * Minimal Node HTTP stub server for the upstream backend.
 *
 * Used by global-setup.ts to start a fake upstream before Playwright launches
 * the SvelteKit preview server. Speaks the envelope format that core-fetch and
 * the auth modules expect: { success: true, data: … } / { success: false, error: … }.
 *
 * Conformance: rule .claude/rules/testing.md (e2e with stub upstream).
 */
import * as http from 'node:http';

export const STUB_PORT = 3099;

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void;

const routes = new Map<string, Handler>();

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function json(res: http.ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(payload)
	});
	res.end(payload);
}

function success(res: http.ServerResponse, data: unknown): void {
	json(res, 200, { success: true, data });
}

function failure(res: http.ServerResponse, status: number, code: string, message: string): void {
	json(res, status, { success: false, error: { code, message } });
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

// POST /auth/login
routes.set('POST:/auth/login', (req, res, body) => {
	let parsed: { email?: string; password?: string };
	try {
		parsed = JSON.parse(body);
	} catch {
		return failure(res, 400, 'INVALID_JSON', 'Invalid JSON body');
	}

	if (parsed.email === 'alice@example.com' && parsed.password === 'correct-password') {
		return success(res, {
			accessToken: 'stub-access-token',
			refreshToken: 'stub-refresh-token',
			expiresIn: 3600,
			user: { id: 'user-1', email: 'alice@example.com' },
			role: 'user'
		});
	}

	return failure(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
});

// POST /auth/logout
routes.set('POST:/auth/logout', (_req, res) => {
	success(res, null);
});

// POST /auth/refresh
routes.set('POST:/auth/refresh', (_req, res, body) => {
	let parsed: { refreshToken?: string };
	try {
		parsed = JSON.parse(body);
	} catch {
		return failure(res, 400, 'INVALID_JSON', 'Invalid JSON body');
	}

	if (parsed.refreshToken === 'stub-refresh-token') {
		return success(res, {
			accessToken: 'stub-access-token-refreshed',
			refreshToken: 'stub-refresh-token-refreshed',
			expiresIn: 3600,
			user: { id: 'user-1', email: 'alice@example.com' },
			role: 'user'
		});
	}

	json(res, 401, null);
});

// GET /auth/session
routes.set('GET:/auth/session', (_req, res) => {
	success(res, {
		user: { id: 'user-1', email: 'alice@example.com' },
		role: 'user'
	});
});

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createStubServer(): http.Server {
	const server = http.createServer((req, res) => {
		const method = req.method ?? 'GET';
		const url = req.url ?? '/';
		const key = `${method}:${url}`;

		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			const handler = routes.get(key);
			if (handler) {
				handler(req, res, body);
			} else {
				json(res, 404, {
					success: false,
					error: { code: 'NOT_FOUND', message: `${key} not found` }
				});
			}
		});
	});

	return server;
}
