import { test, expect } from '@playwright/test';
import { resetApp, loadSampleData, createItem } from './helpers';

test.describe('Milestones', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('view milestones on an item from sample data', async ({ page }) => {
    await loadSampleData(page);
    // Click the canvas node (h3 is unique to canvas nodes, avoids nav pane)
    await page.locator('h3').filter({ hasText: 'Platform Modernization' }).click();
    await expect(page.getByText('Milestones')).toBeVisible();
    await expect(page.getByText('Architecture approved')).toBeVisible();
    await expect(page.getByText('MVP deployed')).toBeVisible();
  });

  test('add a milestone to an item', async ({ page }) => {
    await createItem(page, 'Milestone Test Item');
    await page.locator('h3').filter({ hasText: 'Milestone Test Item' }).click();
    const sidebar = page.locator('aside');
    await sidebar.getByPlaceholder('Add milestone...').fill('My New Milestone');
    await sidebar.locator('button[type="submit"]').click();
    await expect(page.getByText('My New Milestone')).toBeVisible();
  });

  test('toggle milestone completion', async ({ page }) => {
    await loadSampleData(page);
    await page.locator('h3').filter({ hasText: 'Platform Modernization' }).click();
    // "Architecture approved" is completed (index 0), "MVP deployed" is not (index 1)
    const mvpCheckbox = page.locator('aside').getByRole('checkbox').nth(1);
    await mvpCheckbox.click();
    await expect(mvpCheckbox).toBeChecked();
  });

  test('remove a milestone', async ({ page }) => {
    await loadSampleData(page);
    await page.locator('h3').filter({ hasText: 'Platform Modernization' }).click();
    // Hover the <li> group parent to reveal the ✕ button
    const milestoneItem = page.locator('aside li').filter({ hasText: 'MVP deployed' });
    await milestoneItem.hover();
    await milestoneItem.locator('button').click();
    await expect(page.getByText('MVP deployed')).not.toBeVisible();
    await expect(page.getByText('Architecture approved')).toBeVisible();
  });

  test('milestone progress bar shows correct ratio', async ({ page }) => {
    await loadSampleData(page);
    await page.locator('h3').filter({ hasText: 'Platform Modernization' }).click();
    await expect(page.getByText('(1/2)')).toBeVisible();
  });
});
