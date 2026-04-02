import { test, expect } from '@playwright/test';
import { resetApp } from './helpers';

test.describe('App Load', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('shows empty state message', async ({ page }) => {
    await expect(page.getByText('Your roadmap is empty')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create First Item/i })).toBeVisible();
  });

  test('header controls are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /New Item/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Canvas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Kanban/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Gantt/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import/i })).toBeVisible();
  });

  test('navigation pane shows "All Initiatives"', async ({ page }) => {
    await expect(page.getByText('All Initiatives')).toBeVisible();
  });

  test('create first item button opens dialog', async ({ page }) => {
    await page.getByRole('button', { name: /Create First Item/i }).click();
    await expect(page.getByRole('heading', { name: 'New Item' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Implement authentication')).toBeVisible();
  });
});
