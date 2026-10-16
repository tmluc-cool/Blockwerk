import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, scaled, test } from './fixtures';

/** Acceptance of phase 9 in the editor: Build Settings and the web build (SPEC 9.3, phase 9). */

async function openQuest(page: Page): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Quest', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Quest');
}

test.describe('phase 9: build', () => {
  test('Build Settings lists the scenes and builds a web ZIP with credits', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(240_000));
    await openQuest(page);
    await page.getByTestId('menu-file').click();
    await page.getByTestId('menu-build-settings').click();
    const panel = page.getByTestId('build-settings');
    await expect(panel).toBeVisible();
    // The scenes of the quest, and the start scene is marked.
    await expect(panel.getByTestId('build-scene-Dorf')).toBeVisible();
    await expect(panel.getByTestId('build-scene-Gruft')).toBeVisible();
    await expect(panel.getByTestId('build-scene-Hauptmenue').getByRole('radio')).toBeChecked();
    // In the browser the web build is the only platform.
    await expect(panel.getByTestId('build-platform')).toHaveValue('web');
    await panel.getByTestId('build-product-name').fill('Mira Quest');
    await panel.getByTestId('build-product-name').blur();

    const download = page.waitForEvent('download', { timeout: scaled(180_000) });
    await panel.getByTestId('build-run').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('Mira Quest-web.zip');
    const path = await file.path();
    expect((await readFile(path)).byteLength).toBeGreaterThan(1_000_000);
    await expect(panel.getByTestId('build-summary')).toContainText('Gebaut');
    const result = await page.evaluate(() => window.__blockwerk?.buildResult());
    expect(result?.ok).toBe(true);
    const files = result?.files ?? [];
    expect(files).toContain('index.html');
    expect(files).toContain('game/game.json');
    expect(files).toContain('CREDITS.txt');
    expect(files.some((name) => name.startsWith('game/library/'))).toBe(true);
    // Nothing of the editor ships with the game.
    expect(files.some((name) => /blockly|blocks\.html/i.test(name))).toBe(false);
  });

  test('Build Settings open with Ctrl+Shift+B', async ({ editor: page }) => {
    await page.keyboard.press('Control+Shift+B');
    await expect(page.getByTestId('build-settings')).toBeVisible();
  });
});
