import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '05';

/**
 * Screenshot of the example project of the current phase, for the phase report (phase 5: the
 * quest giver's dialog in the Game view, with the task display and a zombie that has noticed the
 * player: its state "chase" shows above it). Written to `test-results/` on every run and to
 * `docs/screenshots/phase-XX.png` when `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
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
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Quest', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Quest');
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(frames, { timeout: 120_000 }).toBeGreaterThan(4);

  // Mira's dialog in the Game view.
  await page.evaluate(() => window.__blockwerk?.teleportLive('Ritter', [-8, 0, -10.4]));
  await expect.poll(async () => (await probe())?.hint, { timeout: 60_000 }).toBe('talk');
  const before = await frames();
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyE', true));
  await expect.poll(frames, { timeout: 60_000 }).toBeGreaterThan(before + 2);
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyE', false));
  await expect(page.getByTestId('dialog-box')).toBeVisible();
  await page.waitForTimeout(3000);
  await save(`phase-${PHASE}.png`);
});
