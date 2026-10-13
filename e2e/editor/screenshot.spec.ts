import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, settle, test } from './fixtures';

/**
 * Screenshot of the sample scene for the phase report. Written to `test-results/` on every run
 * and to `docs/screenshots/phase-00.png` when `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('sample scene screenshot', async ({ editor: page }) => {
  await page.getByTestId('hierarchy').getByText('Testwürfel').click();
  await settle(page);
  // Let the stats overlay of the game view render once so the screenshot shows the main view only.
  await expect(page.getByTestId('scene-canvas')).toBeVisible();
  await page.waitForTimeout(500);
  const targets = [join('test-results', 'screenshots', 'phase-00.png')];
  if (process.env['BLOCKWERK_SCREENSHOT'] === '1')
    targets.push(join('docs', 'screenshots', 'phase-00.png'));
  for (const path of targets) {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path });
  }
});
