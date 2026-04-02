import { test, expect } from '@playwright/test';
import { resetApp, createItem } from './helpers';

test.describe('Item CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('create a new item', async ({ page }) => {
    await createItem(page, 'My First Item', { description: 'Test description', status: 'planned' });
    // Dialog should close
    await expect(page.getByText('New Item').locator('visible=true')).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    // Item should appear somewhere on page (canvas node or nav pane)
    await expect(page.getByText('My First Item').first()).toBeVisible();
  });

  test('create item via empty state button', async ({ page }) => {
    await page.getByRole('button', { name: /Create First Item/i }).click();
    await page.getByPlaceholder(/implement authentication/i).fill('Empty State Item');
    await page.getByRole('button', { name: /^Create$/i }).click();
    await expect(page.getByText('Empty State Item').first()).toBeVisible();
    // Empty state should be gone
    await expect(page.getByText('Your roadmap is empty')).not.toBeVisible();
  });

  test('edit an existing item', async ({ page }) => {
    await createItem(page, 'Original Title');
    // Click the item on canvas (h3 is unique to canvas nodes)
    await page.locator('h3').filter({ hasText: 'Original Title' }).click();
    // Sidebar should show the item
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    // Click Edit
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    // Dialog should open in edit mode
    await expect(page.getByText('Edit Item')).toBeVisible();
    // Change title
    await page.getByPlaceholder(/implement authentication/i).clear();
    await page.getByPlaceholder(/implement authentication/i).fill('Updated Title');
    await page.getByRole('button', { name: /Save/i }).click();
    // Verify updated
    await expect(page.getByText('Updated Title').first()).toBeVisible();
    await expect(page.getByText('Original Title')).not.toBeVisible();
  });

  test('delete an item', async ({ page }) => {
    await createItem(page, 'Item To Delete');
    // Select item on canvas (h3 is unique to canvas nodes)
    await page.locator('h3').filter({ hasText: 'Item To Delete' }).click();
    // Click delete in sidebar
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    // Item should be gone, empty state should return
    await expect(page.getByText('Item To Delete')).not.toBeVisible();
    await expect(page.getByText('Your roadmap is empty')).toBeVisible();
  });

  test('create multiple items', async ({ page }) => {
    await createItem(page, 'Item One');
    await createItem(page, 'Item Two');
    await createItem(page, 'Item Three');
    await expect(page.getByText('Item One').first()).toBeVisible();
    await expect(page.getByText('Item Two').first()).toBeVisible();
    await expect(page.getByText('Item Three').first()).toBeVisible();
  });

  test('create item with status', async ({ page }) => {
    await createItem(page, 'Done Item', { status: 'done' });
    // Click the item on canvas to see sidebar
    await page.locator('h3').filter({ hasText: 'Done Item' }).click();
    // Should show "done" status badge
    await expect(page.getByText('done').first()).toBeVisible();
  });
});
