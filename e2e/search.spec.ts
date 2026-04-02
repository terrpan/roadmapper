import { test, expect } from '@playwright/test';
import { resetApp, loadSampleData, switchView } from './helpers';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await loadSampleData(page);
  });

  test('open search with button click', async ({ page }) => {
    await page.locator('button').filter({ hasText: '🔍' }).click();
    await expect(page.getByPlaceholder('Search items…')).toBeVisible();
  });

  test('search filters items in kanban view', async ({ page }) => {
    await switchView(page, 'kanban');
    const board = page.locator('.overflow-x-auto');
    // Open search
    await page.locator('button').filter({ hasText: '🔍' }).click();
    await page.getByPlaceholder('Search items…').fill('Auth');
    // Should show auth-related items on the board
    await expect(board.getByText('Auth Service').first()).toBeVisible();
    await expect(board.getByText('Core Navigation & Auth').first()).toBeVisible();
    // Non-matching items should be hidden from the board (sidebar still shows them)
    await expect(board.getByText('Rate Limiting')).not.toBeVisible();
    await expect(board.getByText('Distributed Tracing')).not.toBeVisible();
  });

  test('clear search shows all items', async ({ page }) => {
    await switchView(page, 'kanban');
    const board = page.locator('.overflow-x-auto');
    await page.locator('button').filter({ hasText: '🔍' }).click();
    await page.getByPlaceholder('Search items…').fill('Auth');
    // Verify filter is active on the board
    await expect(board.getByText('Rate Limiting')).not.toBeVisible();
    // Clear search using the ✕ button
    await page.locator('button').filter({ hasText: '✕' }).click();
    // All items should return on the board
    await expect(board.getByText('Rate Limiting').first()).toBeVisible();
  });

  test('search with no results', async ({ page }) => {
    await switchView(page, 'kanban');
    const board = page.locator('.overflow-x-auto');
    await page.locator('button').filter({ hasText: '🔍' }).click();
    await page.getByPlaceholder('Search items…').fill('xyznonexistent');
    // No kanban cards should be visible on the board
    await expect(board.getByText('Platform Modernization')).not.toBeVisible();
    await expect(board.getByText('Auth Service')).not.toBeVisible();
  });

  test('keyboard shortcut opens search', async ({ page }) => {
    await page.keyboard.press('Meta+f');
    await expect(page.getByPlaceholder('Search items…')).toBeVisible();
  });
});
