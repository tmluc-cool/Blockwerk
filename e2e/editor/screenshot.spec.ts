import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { blocks, expect, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '07';

/**
 * Screenshots of the example project of the current phase, for the phase report (phase 7: the
 * script library "Werkzeuge" with its custom blocks and the code view, and the market playing with
 * a purchase in the message line). Written to `test-results/` on every run and to
 * `docs/screenshots/` when `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ editor: page }) => {
  test.setTimeout(300_000);
  const save = async (name: string) => {
    const targets = [join('test-results', 'screenshots', name)];
    if (process.env['BLOCKWERK_SCREENSHOT'] === '1')
      targets.push(join('docs', 'screenshots', name));
    for (const path of targets) {
      mkdirSync(dirname(path), { recursive: true });
      await page.screenshot({ path });
    }
  };
  const frames = () => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Handelsstadt', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.project().name))
    .toBe('Handelsstadt');

  // The script library with its custom blocks, and the JavaScript they turn into.
  await tab(page, 'Projekt').click();
  await page.locator('[data-folder="Assets/Block-Skripte"]').click();
  await page.getByTestId('asset-Werkzeuge').dblclick();
  const editor = blocks(page);
  await expect(editor.getByText('Befehl').first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('code-view-toggle').click();
  await expect(page.getByTestId('code-view')).toContainText('custom block');
  await page.waitForTimeout(1500);
  await save(`phase-${PHASE}.png`);

  // The market playing: a purchase shows in the message line of the HUD.
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(frames, { timeout: 120_000 }).toBeGreaterThan(4);
  const before = await frames();
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyB', true));
  await expect.poll(frames, { timeout: 60_000 }).toBeGreaterThan(before + 2);
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyB', false));
  await expect(page.getByText('Gekauft: Brot')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000);
  await save(`phase-${PHASE}-spiel.png`);
});
