import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, openExample, settle, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '01';

/**
 * Screenshot of the example project of the current phase while playing, for the phase report.
 * Written to `test-results/` on every run and to `docs/screenshots/phase-XX.png` when
 * `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ editor: page }) => {
  await openExample(page);
  await page.getByTestId('hierarchy').getByText('Spieler', { exact: true }).click();
  await settle(page);
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  // Drive forward until the first sphere is collected.
  await page.keyboard.down('w');
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.liveVariable(null, 'Punkte')), {
      timeout: 20_000,
    })
    .toBe(1);
  await page.keyboard.up('w');
  await page.getByTestId('pause').click();
  await page.waitForTimeout(500);
  const targets = [join('test-results', 'screenshots', `phase-${PHASE}.png`)];
  if (process.env['BLOCKWERK_SCREENSHOT'] === '1') {
    targets.push(join('docs', 'screenshots', `phase-${PHASE}.png`));
  }
  for (const path of targets) {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path });
  }
});
