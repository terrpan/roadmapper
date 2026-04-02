import { test, expect } from '@playwright/test';
import { resetApp, loadSampleData, switchView } from './helpers';

test.describe('Sample Data Import', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('loads sample data and shows items on canvas', async ({ page }) => {
    await loadSampleData(page);
    // Empty state should be gone
    await expect(page.getByText('Your roadmap is empty')).not.toBeVisible();
    // Check for some known item titles
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    await expect(page.getByText('Auth Service').first()).toBeVisible();
  });

  test('sample data visible in kanban view', async ({ page }) => {
    await loadSampleData(page);
    await switchView(page, 'kanban');
    // Kanban columns should exist
    await expect(page.getByText('Backlog')).toBeVisible();
    await expect(page.getByText('Planned')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
    // Items should be in cards
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
  });

  test('sample data visible in gantt view', async ({ page }) => {
    await loadSampleData(page);
    await switchView(page, 'gantt');
    // Gantt shows item titles on the left
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    await expect(page.getByText('Auth Service').first()).toBeVisible();
  });

  test('navigation pane shows items after import', async ({ page }) => {
    await loadSampleData(page);
    // Navigation pane should show root items
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    await expect(page.getByText('Mobile App v2').first()).toBeVisible();
  });
});
