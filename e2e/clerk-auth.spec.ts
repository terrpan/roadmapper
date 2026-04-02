import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

const TEST_EMAIL = process.env.E2E_CLERK_USER_EMAIL;

test.describe('Clerk Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10000 });
  });

  test('sign-in page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('.cl-signIn-root')).toBeVisible({ timeout: 10000 });
  });

  test('sign-up page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.locator('.cl-signUp-root')).toBeVisible({ timeout: 10000 });
  });

  test('signed-in user is not redirected to sign-in', async ({ page }) => {
    test.skip(!TEST_EMAIL, 'E2E_CLERK_USER_EMAIL not set');

    await page.goto('/sign-in');
    await clerk.signIn({ page, emailAddress: TEST_EMAIL! });

    // After sign-in, navigate to app. The user should be authenticated.
    // With "require organization" enabled in Clerk, they may land on:
    //   - /sign-in/tasks/choose-organization (org selection task)
    //   - / with "Welcome to Roadmapper" (OrgRequired)
    //   - / with the full app (active org exists)
    // In all cases, the bare sign-in form should NOT be present.
    await page.goto('/');

    // Wait for Clerk to finish loading
    await expect(page.getByText('Loading...')).toBeHidden({ timeout: 15000 });

    // Verify user is NOT on the unauthenticated sign-in page
    const signInForm = page.locator('.cl-signIn-root .cl-signIn-start');
    await expect(signInForm).toBeHidden({ timeout: 5000 });
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
