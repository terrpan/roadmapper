import { test, expect } from '@playwright/test';
import { resetApp, loadSampleData, switchView } from './helpers';

test.describe('View Switching', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await loadSampleData(page);
  });

  test('starts in canvas view by default', async ({ page }) => {
    // Canvas should be active (React Flow renders)
    await expect(page.locator('.react-flow')).toBeVisible();
    // Export PDF should be visible (canvas-only)
    await expect(page.getByRole('button', { name: /Export PDF/i })).toBeVisible();
  });

  test('switch to kanban view', async ({ page }) => {
    await switchView(page, 'kanban');
    // Kanban columns visible
    await expect(page.getByText('Backlog')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    // Canvas should not be visible
    await expect(page.locator('.react-flow')).not.toBeVisible();
    // Export PDF should be hidden (kanban mode)
    await expect(page.getByRole('button', { name: /Export PDF/i })).not.toBeVisible();
  });

  test('switch to gantt view', async ({ page }) => {
    await switchView(page, 'gantt');
    // Gantt items should be visible
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    // Scale selector should be visible
    await expect(page.getByRole('button', { name: 'Auto' })).toBeVisible();
    // Canvas should not be visible
    await expect(page.locator('.react-flow')).not.toBeVisible();
  });

  test('switch between all views preserves data', async ({ page }) => {
    // Start in canvas
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    
    // Go to kanban
    await switchView(page, 'kanban');
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    
    // Go to gantt
    await switchView(page, 'gantt');
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    
    // Back to canvas
    await switchView(page, 'canvas');
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
  });

  test('gantt scale selector works', async ({ page }) => {
    await switchView(page, 'gantt');
    // Click through scales
    await page.getByRole('button', { name: 'Months' }).click();
    await page.getByRole('button', { name: 'Quarters' }).click();
    await page.getByRole('button', { name: 'Auto' }).click();
    // Items still visible after scale changes
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
  });
});
