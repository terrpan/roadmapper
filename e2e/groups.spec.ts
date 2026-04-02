import { test, expect, Page } from '@playwright/test';
import { resetApp, loadSampleData } from './helpers';

// Target canvas nodes by their React Flow data-testid attribute
const canvasNode = (page: Page, itemId: string) =>
  page.locator(`[data-testid="rf__node-${itemId}"]`);

/**
 * Multi-select nodes on the canvas using drag-select mode.
 * Presses 'S' to enable selection-on-drag, draws a box around the target nodes,
 * then presses 'S' again to restore pan mode.
 */
async function selectNodes(page: Page, nodeIds: string[]) {
  const boxes = await Promise.all(
    nodeIds.map((id) => canvasNode(page, id).boundingBox())
  );
  const rects = boxes.filter(Boolean) as { x: number; y: number; width: number; height: number }[];
  if (rects.length !== nodeIds.length) throw new Error('Could not find all nodes');

  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));

  // Enable selection-on-drag mode
  await page.keyboard.press('s');
  await page.waitForTimeout(200);

  // Drag a box that encloses all target nodes (with padding)
  const pad = 10;
  await page.mouse.move(minX - pad, minY - pad);
  await page.mouse.down();
  await page.mouse.move(maxX + pad, maxY + pad, { steps: 5 });
  await page.mouse.up();

  // Restore pan mode
  await page.keyboard.press('s');
}

test.describe('Groups', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await loadSampleData(page);
  });

  test('shows "No groups yet" initially', async ({ page }) => {
    await expect(page.getByText('No groups yet')).toBeVisible();
  });

  test('create a group by selecting multiple nodes', async ({ page }) => {
    // Multi-select Auth Service and API Gateway via drag-select
    await selectNodes(page, ['epic-auth', 'epic-api']);

    // Selection bar should show "2 selected"
    await expect(page.getByText('2 selected')).toBeVisible({ timeout: 5000 });

    // Click "Group" button in selection bar
    await page.getByRole('button', { name: 'Group' }).click();

    // Type group name
    const input = page.getByPlaceholder('Group label…');
    await expect(input).toBeVisible();
    await input.fill('Backend Services');

    // Confirm with ✓ button
    await page.locator('button').filter({ hasText: '✓' }).click();

    // Group should appear in navigation pane
    await expect(page.getByText('Backend Services').first()).toBeVisible();
    // "No groups yet" should be gone
    await expect(page.getByText('No groups yet')).not.toBeVisible();
  });

  test('delete a group from navigation pane', async ({ page }) => {
    // Create a group first
    await selectNodes(page, ['epic-auth', 'epic-api']);
    await expect(page.getByText('2 selected')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Group' }).click();
    await page.getByPlaceholder('Group label…').fill('Group to Delete');
    await page.locator('button').filter({ hasText: '✓' }).click();
    await expect(page.getByText('Group to Delete').first()).toBeVisible();

    // Click elsewhere to deselect, then hover group row to reveal ✕
    await page.keyboard.press('Escape');
    const groupLabel = page.getByText('Group to Delete').first();
    await groupLabel.hover();

    // Click ✕ delete button (has title="Ungroup")
    await page.locator('button[title="Ungroup"]').click();

    // Group should be gone
    await expect(page.getByText('Group to Delete')).not.toBeVisible();
    await expect(page.getByText('No groups yet')).toBeVisible();
  });
});
