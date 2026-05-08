import { defineConfig } from '@playwright/test';

/**
 * Playwright config.
 *
 * Conformance: .claude/rules/testing.md.
 *
 * e2e specs live under `e2e/` with `*.e2e.ts` suffix.
 *
 * The webServer command builds and previews the SvelteKit app with env vars
 * inlined. `UPSTREAM_API_URL` points at the upstream stub started by
 * `globalSetup`. `SESSION_SECRET` must be ≥ 32 chars (schema enforces this).
 *
 * Note on lint workaround: in worktree mode, ESLint may emit
 * "No tsconfigRootDir was set" warnings because multiple tsconfig candidates
 * are visible. This does not affect the test run — CI is the source of truth
 * for lint. See PR description.
 */

const STUB_UPSTREAM = 'http://localhost:3099';
const TEST_SESSION_SECRET = 'test-session-secret-at-least-32-chars-long';

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	globalSetup: './e2e/global-setup.ts',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	webServer: {
		// Inline env vars so SvelteKit's static env bakes them into the build.
		// The preview command picks up the same vars at runtime.
		command: [
			`UPSTREAM_API_URL=${STUB_UPSTREAM}`,
			`SESSION_SECRET=${TEST_SESSION_SECRET}`,
			`NODE_ENV=test`,
			'bun run build',
			'&&',
			`UPSTREAM_API_URL=${STUB_UPSTREAM}`,
			`SESSION_SECRET=${TEST_SESSION_SECRET}`,
			`NODE_ENV=test`,
			'bun run preview --port 4173'
		].join(' '),
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
