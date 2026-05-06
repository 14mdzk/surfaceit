/**
 * Phase 1 smoke spec.
 *
 * Loads `/` and asserts the locale switch is rendered. Deeper flows
 * (login, list, mutate, logout) arrive with their owning phases.
 */
import { test, expect } from '@playwright/test';

test('home page renders the locale switch', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('locale-switch')).toBeVisible();
});
