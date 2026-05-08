/**
 * Playwright global setup: start the upstream stub server.
 *
 * The stub listens on STUB_PORT (3099). Playwright's webServer command
 * uses UPSTREAM_API_URL=http://localhost:3099 via env vars so the built
 * SvelteKit preview talks to the stub instead of a real backend.
 *
 * Conformance: rule .claude/rules/testing.md (e2e with stub upstream).
 */
import { createStubServer, STUB_PORT } from './upstream-stub.js';

export default async function globalSetup() {
	const server = createStubServer();

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(STUB_PORT, () => resolve());
	});

	console.log(`[upstream-stub] listening on http://localhost:${STUB_PORT}`);

	// Return teardown function
	return async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((err) => (err ? reject(err) : resolve()));
		});
		console.log('[upstream-stub] stopped');
	};
}
