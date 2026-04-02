import { test, expect } from '@playwright/test';
import { resetApp, createItem, loadSampleData } from './helpers';

/** Click a canvas node (ReactFlow node) by its visible text. */
async function clickCanvasNode(page: import('@playwright/test').Page, text: string) {
  const node = page.locator('.react-flow__node').filter({ hasText: text }).first();
  await node.click();
}

test.describe('Connections', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('sample data connections show in sidebar', async ({ page }) => {
    await loadSampleData(page);

    // Click the canvas node for "Auth Service" to select it (sidebar opens)
    await clickCanvasNode(page, 'Auth Service');
    await expect(page.getByText('Connections')).toBeVisible();

    // Auth Service has outgoing connections — arrows "→" should be visible
    await expect(page.locator('text=→').first()).toBeVisible();
  });

  test('blocking connection shows read-only badge on target', async ({ page }) => {
    await loadSampleData(page);

    // API Gateway is the target of a blocking connection from Auth Service
    await clickCanvasNode(page, 'API Gateway');
    await expect(page.getByText('Connections')).toBeVisible();

    // Incoming blocking connection shows read-only badge
    await expect(page.getByText('Blocking (read-only)')).toBeVisible();
  });

  test('indirect connection shown for sample data', async ({ page }) => {
    await loadSampleData(page);

    // Scope to Observability Stack to see its children (Centralized Logging, Distributed Tracing)
    await page.getByText('Observability Stack').first().click();
    await page.waitForTimeout(300);

    // Now click the canvas node for Centralized Logging
    await clickCanvasNode(page, 'Centralized Logging');
    await expect(page.getByText('Connections')).toBeVisible();

    // The outgoing connection to Distributed Tracing should show in sidebar
    const sidebar = page.locator('text=→').first();
    await expect(sidebar).toBeVisible();
  });

  test('create connection between two items via canvas', async ({ page }) => {
    await createItem(page, 'Source Item');
    await createItem(page, 'Target Item');

    // Hover the source canvas node to reveal the "+" button
    const sourceNode = page.locator('.react-flow__node').filter({ hasText: 'Source Item' }).first();
    await sourceNode.hover();

    // Click the + button (appears on hover, positioned on the right edge)
    const plusButton = sourceNode.locator('button', { hasText: '+' });
    await plusButton.click();

    // Context menu appears — click "Direct" connection type
    await page.getByText('Direct', { exact: true }).first().click();

    // Now in connecting mode — the target node shows a "click to connect" overlay
    // Use force:true because the overlay may be partially behind the header
    await page.getByText('Set as direct').click({ force: true });

    // Verify: select source item and check sidebar shows the connection
    await sourceNode.click();
    await expect(page.getByText('Connections')).toBeVisible();
    await expect(page.locator('text=→').first()).toBeVisible();
  });

  test('remove connection from sidebar', async ({ page }) => {
    await loadSampleData(page);

    // Select "Auth Service" canvas node (has outgoing connections)
    await clickCanvasNode(page, 'Auth Service');
    await expect(page.getByText('Connections')).toBeVisible();

    // Count remove buttons before
    const removeButtons = page.locator('[title="Remove connection"]');
    const countBefore = await removeButtons.count();
    expect(countBefore).toBeGreaterThan(0);

    // Click the first remove button
    await removeButtons.first().click();

    // Should have one fewer connection
    const countAfter = await page.locator('[title="Remove connection"]').count();
    expect(countAfter).toBe(countBefore - 1);
  });
});
