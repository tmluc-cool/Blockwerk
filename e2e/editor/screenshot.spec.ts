import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '03';

/**
 * Screenshot of the example project of the current phase while playing, for the phase report.
 * Written to `test-results/` on every run and to `docs/screenshots/phase-XX.png` when
 * `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ editor: page }) => {
  test.setTimeout(180_000);
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Held').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Held');
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  // Let the camera ride a little and every model load.
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
      timeout: 60_000,
    })
    .toBeGreaterThan(10);
  // The knight walks ahead for a moment (the Game view has the keyboard).
  await page.getByTestId('game-canvas').focus();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
  await page.getByTestId('stats-toggle').click();
  await page.getByTestId('pause').click();
  await page.waitForTimeout(1500);
  const targets = [join('test-results', 'screenshots', `phase-${PHASE}.png`)];
  if (process.env['BLOCKWERK_SCREENSHOT'] === '1') {
    targets.push(join('docs', 'screenshots', `phase-${PHASE}.png`));
  }
  for (const path of targets) {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path });
  }
});
