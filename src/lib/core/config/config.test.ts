/**
 * Phase 1 smoke test: prove the test runner boots and resolves $core aliases.
 * Phase 2 replaces this with real env-loader coverage.
 */
import { describe, it, expect } from 'vitest';
import { PROJECT_NAME } from './index.js';

describe('core/config', () => {
	it('exposes a non-empty PROJECT_NAME', () => {
		expect(PROJECT_NAME).toBeTruthy();
		expect(PROJECT_NAME.length).toBeGreaterThan(0);
	});
});
