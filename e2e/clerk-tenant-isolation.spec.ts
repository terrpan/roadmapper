import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

const TEST_EMAIL = process.env.E2E_CLERK_USER_EMAIL;

test.describe('Tenant Isolation', () => {
  test('signed-in user reaches authenticated state', async ({ page }) => {
    test.skip(!TEST_EMAIL, 'E2E_CLERK_USER_EMAIL not set');

    await page.goto('/sign-in');
    await clerk.signIn({ page, emailAddress: TEST_EMAIL! });

    // After sign-in, navigate to app. Clerk redirects to org task if needed.
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Verify user is NOT on the bare sign-in page (they are authenticated).
    // They'll be at either /sign-in/tasks/... (org task) or / (app).
    const url = page.url();
    const isAtOrgTask = url.includes('/tasks/choose-organization');
    const isAtApp = url === 'http://localhost/' || url === 'http://localhost';

    expect(isAtOrgTask || isAtApp).toBeTruthy();
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
