import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Clerk Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    // Without Clerk token, user should be redirected to sign-in
    await page.goto('/');
    // Clerk's RedirectToSignIn should redirect to /sign-in
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('authenticated user with org sees the app', async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto('/');

    // Should see the main app header (not sign-in page)
    await expect(page.getByText('Roadmapper')).toBeVisible({ timeout: 10000 });

    // UserButton renders as a button with the user's avatar
    await expect(page.locator('.cl-userButtonTrigger')).toBeVisible({ timeout: 10000 });
  });

  test('sign-in page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-in');

    // Clerk's SignIn component should render
    await expect(page.locator('.cl-signIn-root')).toBeVisible({ timeout: 10000 });
  });

  test('sign-up page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-up');

    // Clerk's SignUp component should render
    await expect(page.locator('.cl-signUp-root')).toBeVisible({ timeout: 10000 });
  });

  test('API request without auth returns 401', async ({ request }) => {
    // Direct API call without Clerk token should be rejected
    const response = await request.get('/api/items');
    expect(response.status()).toBe(401);
  });

  test('API request with invalid token returns 401', async ({ request }) => {
    const response = await request.get('/api/items', {
      headers: {
        'Authorization': 'Bearer invalid-token-xyz',
      },
    });
    // Clerk middleware should reject invalid tokens
    expect([401, 403]).toContain(response.status());
  });
});
