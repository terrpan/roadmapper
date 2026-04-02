import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

const TEST_EMAIL = process.env.E2E_CLERK_USER_EMAIL;

test.describe('Clerk Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10000 });
  });

  test('authenticated user can sign in and access the app', async ({ page }) => {
    test.skip(!TEST_EMAIL, 'E2E_CLERK_USER_EMAIL not set');

    // Navigate to a non-protected page so Clerk loads (required before clerk.signIn)
    await page.goto('/sign-in');

    // emailAddress strategy uses backend API + ticket — more reliable than password in tests
    await clerk.signIn({ page, emailAddress: TEST_EMAIL! });

    // Navigate to the protected app
    await page.goto('/');

    // Must stay at / — proves authentication worked
    await expect(page).toHaveURL('http://localhost/', { timeout: 10000 });

    // Either the app renders (user has active org) or the "No organization selected" screen
    // shows — both confirm successful auth and tenant-aware routing
    const authenticated = page.locator('header h1, h2:has-text("No organization selected")');
    await expect(authenticated.first()).toBeVisible({ timeout: 10000 });
  });

  test('sign-in page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('.cl-signIn-root')).toBeVisible({ timeout: 10000 });
  });

  test('sign-up page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.locator('.cl-signUp-root')).toBeVisible({ timeout: 10000 });
  });

  test('API request without auth returns 401', async ({ request }) => {
    const response = await request.get('/api/items');
    expect(response.status()).toBe(401);
  });

  test('API request with invalid token returns 401', async ({ request }) => {
    const response = await request.get('/api/items', {
      headers: { 'Authorization': 'Bearer invalid-token-xyz' },
    });
    expect([401, 403]).toContain(response.status());
  });
});
