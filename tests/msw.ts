/**
 * MSW server instance. Exported separately from the setup lifecycle hooks so
 * test files can import it to call `server.use()` without re-triggering the
 * `beforeAll/afterEach/afterAll` hooks.
 *
 * The lifecycle hooks live in `tests/setup.ts` which is referenced in
 * `vitest.config.ts → test.setupFiles`. Importing this file directly in test
 * files is safe — no double-registration.
 *
 * Conformance: rule .claude/rules/testing.md (mock HTTP with MSW).
 */
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

/**
 * Default handler: `auth.session` happy path.
 * Override per-test with `server.use(...)` for error scenarios.
 */
export const server = setupServer(
	http.get('http://localhost/api/upstream/auth/session', () =>
		HttpResponse.json({
			success: true,
			data: { user: { id: '1', email: 'a@b.com' }, role: 'admin' }
		})
	)
);
