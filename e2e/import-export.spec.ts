import { test, expect } from '@playwright/test';
import { resetApp, loadSampleData, createItem, switchView } from './helpers';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Import & Export', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('load sample data (replace mode)', async ({ page }) => {
    await loadSampleData(page);
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    await expect(page.getByText('Mobile App v2').first()).toBeVisible();
  });

  test('load sample data (merge mode) adds to existing', async ({ page }) => {
    await createItem(page, 'Pre-existing Item');
    await expect(page.getByText('Pre-existing Item').first()).toBeVisible();

    // Load sample in merge mode
    await page.getByRole('button', { name: /Import/i }).click();
    await page.getByText('Load sample (merge)').click();
    await page.waitForTimeout(500);

    // Both pre-existing and sample items should be visible
    await expect(page.getByText('Pre-existing Item').first()).toBeVisible();
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
  });

  test('replace mode replaces all data', async ({ page }) => {
    await createItem(page, 'Will Be Replaced');
    await expect(page.getByText('Will Be Replaced').first()).toBeVisible();

    // Load sample in replace mode
    await loadSampleData(page);

    // Pre-existing item should be gone, sample data should be there
    await expect(page.getByText('Will Be Replaced')).not.toBeVisible();
    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
  });

  test('import JSON file (replace mode)', async ({ page }) => {
    const importData = {
      items: [
        {
          id: 'test-import-1',
          title: 'Imported Item Alpha',
          description: 'From file import',
          status: 'planned',
          milestones: [],
          position: { x: 100, y: 100 },
        },
        {
          id: 'test-import-2',
          title: 'Imported Item Beta',
          description: 'Also from file',
          status: 'backlog',
          milestones: [],
          position: { x: 300, y: 100 },
        },
      ],
      connections: [],
      groups: [],
    };

    const tmpFile = path.join(__dirname, '_test-import-temp.json');
    fs.writeFileSync(tmpFile, JSON.stringify(importData));

    try {
      // Set up file chooser handler BEFORE triggering it
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        (async () => {
          await page.getByRole('button', { name: /Import/i }).click();
          await page.getByText('Import JSON (replace all)').click();
        })(),
      ]);

      await fileChooser.setFiles(tmpFile);
      await page.waitForTimeout(500);

      // Verify imported items
      await expect(page.getByText('Imported Item Alpha').first()).toBeVisible();
      await expect(page.getByText('Imported Item Beta').first()).toBeVisible();
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  test('import then verify in kanban view', async ({ page }) => {
    await loadSampleData(page);
    await switchView(page, 'kanban');

    await expect(page.getByText('Platform Modernization').first()).toBeVisible();
    await expect(page.getByText('API Gateway').first()).toBeVisible();
    await expect(page.getByText('Observability Stack').first()).toBeVisible();
  });
});
