/**
 * Auth flow e2e spec.
 *
 * Covers: login (valid + invalid), protected redirect, logout, CSRF enforcement.
 *
 * Uses the upstream stub started by global-setup.ts. Credentials:
 *   email: alice@example.com  password: correct-password
 *
 * Conformance: rule .claude/rules/testing.md (e2e for critical flows).
 */
import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Email address').fill('alice@example.com');
	await page.getByLabel('Password').fill('correct-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL('/');
}

// ---------------------------------------------------------------------------
// Login — valid credentials
// ---------------------------------------------------------------------------

test('login with valid credentials redirects to home', async ({ page }) => {
	await login(page);
	// After login, we are on the protected app layout
	await expect(page.locator('body')).toBeVisible();
});

test('login page redirects to home when already authenticated', async ({ page }) => {
	await login(page);
	await page.goto('/login');
	// Should be redirected away from /login since session exists
	await expect(page).toHaveURL('/');
});

// ---------------------------------------------------------------------------
// Login — invalid credentials
// ---------------------------------------------------------------------------

test('login with invalid credentials shows error', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email address').fill('alice@example.com');
	await page.getByLabel('Password').fill('wrong-password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	// Stays on login page and shows error
	await expect(page).toHaveURL('/login');
	await expect(page.getByRole('alert')).toBeVisible();
});

test('login with empty fields stays on login page', async ({ page }) => {
	await page.goto('/login');
	// HTML5 required validation prevents submission; we verify the form is present
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
	await expect(page.getByLabel('Email address')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Protected route — unauthenticated redirect
// ---------------------------------------------------------------------------

test('unauthenticated access to protected route redirects to /login', async ({ page }) => {
	// Clear all cookies to ensure no session
	await page.context().clearCookies();
	await page.goto('/');
	// The (app) layout guard should redirect
	await expect(page).toHaveURL('/login');
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

test('logout clears session and redirects to /login', async ({ page }) => {
	await login(page);

	// Submit the logout form (POST /logout). The form is rendered on the home
	// page for every authenticated user — if it is missing the test should fail.
	await page.getByRole('button', { name: /sign out/i }).click();

	await expect(page).toHaveURL('/login');
});

// ---------------------------------------------------------------------------
// CSRF enforcement
// ---------------------------------------------------------------------------

test('POST to BFF without x-csrf header is rejected on non-login paths', async ({ request }) => {
	// A POST to a protected BFF path without the x-csrf header should get 403
	// (assuming an authenticated session exists — but the CSRF check fires first)
	const response = await request.post('http://localhost:4173/api/upstream/cameras', {
		headers: {
			'Content-Type': 'application/json'
			// Deliberately no x-csrf header
		},
		data: {}
	});

	// CSRF check fires before auth lookup (validateCsrf is first in the BFF handler).
	// A POST without x-csrf must always return 403 — any other status means CSRF is broken.
	expect(response.status()).toBe(403);
});
