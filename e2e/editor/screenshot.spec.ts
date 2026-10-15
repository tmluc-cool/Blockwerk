import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '06';

/**
 * Screenshots of the example project of the current phase, for the phase report (phase 6: the main
 * menu, and the village with the life bar, the task and the inventory under the pause menu with the
 * settings open). Written to `test-results/` on every run and to `docs/screenshots/` when
 * `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
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
  const probe = () => page.evaluate(() => window.__blockwerk?.questProbe());
  const press = async (code: string) => {
    const before = await frames();
    await page.evaluate((key) => window.__blockwerk?.pressKey(key, true), code);
    await expect.poll(frames, { timeout: 60_000 }).toBeGreaterThan(before + 2);
    await page.evaluate((key) => window.__blockwerk?.pressKey(key, false), code);
  };
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Quest', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Quest');
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(frames, { timeout: 120_000 }).toBeGreaterThan(4);

  // The main menu.
  await expect(page.getByRole('button', { name: 'Spielen' })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000);
  await save(`phase-${PHASE}-menu.png`);

  // Into the village, a key from the chest, then the pause menu with the settings.
  const village = (await probe())?.scene;
  await page.getByRole('button', { name: 'Spielen' }).click();
  await expect.poll(async () => (await probe())?.scene, { timeout: 120_000 }).not.toBe(village);
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 60_000 });
  await page.getByTestId('game-canvas').focus();
  await page.evaluate(() => window.__blockwerk?.teleportLive('Ritter', [4.5, 0, -8.2]));
  await expect.poll(async () => (await probe())?.hint, { timeout: 60_000 }).toBe('open');
  await press('KeyE');
  await expect.poll(async () => (await probe())?.items['Schlüssel']).toBe(1);
  await page.getByTestId('game-canvas').focus();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe())?.paused).toBe(true);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('Tastenbelegung', { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(2000);
  await save(`phase-${PHASE}.png`);
});
