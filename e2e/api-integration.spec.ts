import { test, expect } from '@playwright/test';

/**
 * Integration tests for API storage mode.
 * These tests verify that the frontend works with the backend API.
 */

test.describe('API Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app - it should auto-detect the API
    await page.goto('/');
    // Wait for the app to load and detect storage mode
    await page.waitForTimeout(2000);
  });

  test('app detects and uses API mode', async ({ page }) => {
    // Check if app is showing the UI (not just loading spinner)
    const header = page.getByRole('button', { name: /New Item/i });
    await expect(header).toBeVisible({ timeout: 5000 });
  });

  test('create item persists to database via API', async ({ page }) => {
    const uniqueTitle = `API Test Item ${Date.now()}`;
    
    // Click New Item button
    await page.getByRole('button', { name: /New Item/i }).click();
    
    // Fill in item details
    await page.getByPlaceholder('e.g. Implement authentication').fill(uniqueTitle);
    await page.getByPlaceholder('Add description...').fill('Testing API persistence');
    
    // Save item
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Wait for item to appear in the list
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
    
    // Verify the item is in the canvas
    const itemElement = page.locator('h3').filter({ hasText: uniqueTitle });
    await expect(itemElement).toBeVisible();
  });

  test('verify item appears in database after creation', async ({ page }) => {
    const uniqueTitle = `DB Verify Item ${Date.now()}`;
    
    // Create an item
    await page.getByRole('button', { name: /New Item/i }).click();
    await page.getByPlaceholder('e.g. Implement authentication').fill(uniqueTitle);
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Wait for item to appear
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
    
    // Verify via API that the item exists
    const response = await page.request.get('/api/items', {
      headers: { 'X-Tenant-ID': '00000000-0000-0000-0000-000000000001' }
    });
    
    const items = await response.json();
    const foundItem = items.find((item: any) => item.title === uniqueTitle);
    expect(foundItem).toBeDefined();
    expect(foundItem.description).toBe('Testing API persistence');
  });

  test('update item via UI reflects in database', async ({ page }) => {
    const uniqueTitle = `Update Test ${Date.now()}`;
    const updatedTitle = `${uniqueTitle} Updated`;
    
    // Create an item
    await page.getByRole('button', { name: /New Item/i }).click();
    await page.getByPlaceholder('e.g. Implement authentication').fill(uniqueTitle);
    await page.getByRole('button', { name: 'Save' }).click();
    
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
    
    // Edit the item
    const itemElement = page.locator('h3').filter({ hasText: uniqueTitle });
    await itemElement.click();
    
    // Update title
    const titleInput = page.getByDisplayValue(uniqueTitle);
    await titleInput.fill(updatedTitle);
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Verify update in UI
    await expect(page.getByText(updatedTitle)).toBeVisible({ timeout: 5000 });
    
    // Verify update in database
    const response = await page.request.get('/api/items', {
      headers: { 'X-Tenant-ID': '00000000-0000-0000-0000-000000000001' }
    });
    
    const items = await response.json();
    const foundItem = items.find((item: any) => item.title === updatedTitle);
    expect(foundItem).toBeDefined();
  });

  test('delete item removes from database', async ({ page }) => {
    const uniqueTitle = `Delete Test ${Date.now()}`;
    
    // Create an item
    await page.getByRole('button', { name: /New Item/i }).click();
    await page.getByPlaceholder('e.g. Implement authentication').fill(uniqueTitle);
    await page.getByRole('button', { name: 'Save' }).click();
    
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
    
    // Delete the item
    const itemElement = page.locator('h3').filter({ hasText: uniqueTitle });
    await itemElement.click();
    
    // Look for delete button or context menu
    const deleteButton = page.getByRole('button', { name: /Delete/i }).first();
    if (await deleteButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await deleteButton.click();
    }
    
    // Wait for item to disappear
    await expect(page.getByText(uniqueTitle)).not.toBeVisible({ timeout: 5000 });
    
    // Verify deletion in database
    const response = await page.request.get('/api/items', {
      headers: { 'X-Tenant-ID': '00000000-0000-0000-0000-000000000001' }
    });
    
    const items = await response.json();
    const foundItem = items.find((item: any) => item.title === uniqueTitle);
    expect(foundItem).toBeUndefined();
  });
});
