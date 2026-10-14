import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '04';

/**
 * Screenshot of the example project of the current phase, for the phase report (phase 4: the
 * landscape with its lake, forest and village in the scene view while the game runs). Written to
 * `test-results/` on every run and to `docs/screenshots/phase-XX.png` when
 * `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ editor: page }) => {
  test.setTimeout(300_000);
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Landschaft', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.project().name))
    .toBe('Landschaft');
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
      timeout: 120_000,
    })
    .toBeGreaterThan(4);
  // The scene view shows the running game: frame the lake with its forest and the village.
  await tab(page, 'Szene').click();
  await page.getByTestId('hierarchy').getByText('See', { exact: true }).click();
  await page.keyboard.press('f');
  await page.waitForTimeout(6000);
  const targets = [join('test-results', 'screenshots', `phase-${PHASE}.png`)];
  if (process.env['BLOCKWERK_SCREENSHOT'] === '1') {
    targets.push(join('docs', 'screenshots', `phase-${PHASE}.png`));
  }
  for (const path of targets) {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path });
  }
});
