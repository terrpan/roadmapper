import { Page } from '@playwright/test';

/**
 * Clear localStorage and reload to get a fresh empty state.
 */
export async function resetApp(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('text=Your roadmap is empty', { timeout: 10000 });
}

/**
 * Load the sample roadmap data via the Import menu.
 */
export async function loadSampleData(page: Page) {
  await page.getByRole('button', { name: /Import/i }).click();
  await page.getByText('Load sample (replace all)').click();
  // Wait for items to render (canvas nodes or any item indicator)
  await page.waitForTimeout(500);
}

/**
 * Create a new item via the dialog.
 */
export async function createItem(page: Page, title: string, opts?: { status?: string; description?: string }) {
  await page.getByRole('button', { name: /New Item/i }).click();
  await page.getByPlaceholder(/implement authentication/i).fill(title);
  if (opts?.description) {
    await page.getByPlaceholder(/add details/i).fill(opts.description);
  }
  if (opts?.status) {
    await page.locator('label').filter({ hasText: /^Status$/ }).locator('..').locator('select').selectOption(opts.status);
  }
  await page.getByRole('button', { name: /^Create$/i }).click();
}

/**
 * Switch to a specific view mode.
 */
export async function switchView(page: Page, view: 'canvas' | 'kanban' | 'gantt') {
  const labels: Record<string, RegExp> = {
    canvas: /🔗 Canvas/,
    kanban: /📋 Kanban/,
    gantt: /📊 Gantt/,
  };
  await page.getByRole('button', { name: labels[view] }).click();
}
