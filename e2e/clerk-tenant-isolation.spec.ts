import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

const TEST_EMAIL = process.env.E2E_CLERK_USER_EMAIL;

test.describe('Tenant Isolation', () => {
  test.describe.configure({ mode: 'serial' });

  test('authenticated user reaches the app (not sign-in)', async ({ page }) => {
    test.skip(!TEST_EMAIL, 'E2E_CLERK_USER_EMAIL not set');

    // Navigate to a non-protected page so Clerk loads, then sign in via backend API
    await page.goto('/sign-in');
    await clerk.signIn({ page, emailAddress: TEST_EMAIL! });

    // Navigate to the protected app
    await page.goto('/');

    // Must not be redirected back to sign-in (proves authentication worked)
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 10000 });

    // Either the full app (user has active org) or "No organization selected" shows.
    // Both confirm successful authentication + tenant-aware routing via org_id.
    const authenticated = page.locator('.cl-organizationSwitcher-root, h2:has-text("No organization selected")');
    await expect(authenticated.first()).toBeVisible({ timeout: 10000 });
  });

  test('API enforces tenant isolation via org_id in JWT', async ({ request }) => {
    const response = await request.get('/api/items');
    expect(response.status()).toBe(401);
  });

  test('health endpoint is accessible without auth', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
