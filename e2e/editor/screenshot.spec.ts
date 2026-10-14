import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '03b';

/**
 * Screenshot of the example project of the current phase, for the phase report (phase 3b: the
 * Character Studio with the example's knight). Written to `test-results/` on every run and to
 * `docs/screenshots/phase-XX.png` when `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ editor: page }) => {
  test.setTimeout(180_000);
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Figur', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Figur');
  await tab(page, 'Figur').click();
  await expect(page.getByTestId('studio')).toBeVisible();
  // The knight stands on the turntable and the retargeted animations are there.
  await expect
    .poll(async () => (await page.evaluate(() => window.__blockwerk?.studioState()))?.mode, {
      timeout: 60_000,
    })
    .toBe('skeleton');
  await page.getByTestId('studio-tab-movement').click();
  await page.getByTestId('anim-play-run').click();
  await page.waitForTimeout(2500);
  const targets = [join('test-results', 'screenshots', `phase-${PHASE}.png`)];
  if (process.env['BLOCKWERK_SCREENSHOT'] === '1') {
    targets.push(join('docs', 'screenshots', `phase-${PHASE}.png`));
  }
  for (const path of targets) {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path });
  }
});
