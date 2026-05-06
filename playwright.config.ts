import { defineConfig } from '@playwright/test';

/**
 * Playwright config.
 *
 * Conformance: .claude/rules/testing.md.
 *
 * Phase 1 ships a single smoke spec under e2e/. The Playwright job runs in
 * its own CI workflow (continue-on-error in Phase 1) and becomes blocking
 * in Phase 5 per docs/roadmap.md.
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'bun run build && bun run preview --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
