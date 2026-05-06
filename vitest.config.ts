import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * Vitest config.
 *
 * Conformance: .claude/rules/testing.md.
 *
 * Phase 1 ships unit tests only; the SvelteKit Vite plugin gives us alias
 * resolution ($core, $lib, …) so tests import the same way production code
 * does. A jsdom project will be added in Phase 2 when the first component
 * test lands.
 */
export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		globals: false
	}
});
