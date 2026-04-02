import { test, expect } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';

const TEST_EMAIL = process.env.E2E_CLERK_USER_EMAIL;
const TEST_PASSWORD = process.env.E2E_CLERK_USER_PASSWORD;

test.describe('Clerk Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/');
    // AuthGuard's RedirectToSignIn should redirect to our embedded sign-in page
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10000 });
  });

  test('authenticated user with org sees the app', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_CLERK_USER_EMAIL / E2E_CLERK_USER_PASSWORD not set');

    await setupClerkTestingToken({ page });
    await page.goto('/sign-in');

    await clerk.signIn({
      page,
      signInParams: {
        strategy: 'password',
        identifier: TEST_EMAIL!,
        password: TEST_PASSWORD!,
      },
    });

    // Should land on main app after sign-in
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // App header h1 should be visible (not the Clerk sign-in heading)
    await expect(page.locator('header h1')).toBeVisible({ timeout: 10000 });

    // UserButton renders as a button with the user's avatar
    await expect(page.locator('.cl-userButtonTrigger')).toBeVisible({ timeout: 10000 });
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
