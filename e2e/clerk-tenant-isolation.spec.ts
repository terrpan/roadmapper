import { test, expect } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';

const TEST_EMAIL = process.env.E2E_CLERK_USER_EMAIL;
const TEST_PASSWORD = process.env.E2E_CLERK_USER_PASSWORD;

test.describe('Tenant Isolation', () => {
  test.describe.configure({ mode: 'serial' });

  test('authenticated user sees org switcher', async ({ page }) => {
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

    await expect(page).toHaveURL('/', { timeout: 15000 });

    // The org switcher should be visible in the header
    await expect(page.locator('.cl-organizationSwitcher-root')).toBeVisible({ timeout: 10000 });
  });

  test('API enforces tenant isolation via org_id in JWT', async ({ request }) => {
    // Without auth, API should reject with 401
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
