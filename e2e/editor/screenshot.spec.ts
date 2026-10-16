import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, scaled, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '09';

/**
 * Screenshot of the current phase for the phase report (phase 9: the quest example in Build
 * Settings after a web build). The picture of the exported game itself comes from the web build
 * test (`e2e/player/web.spec.ts`). Written to `test-results/` on every run and to
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
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Quest', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Quest');

  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-build-settings').click();
  const panel = page.getByTestId('build-settings');
  await expect(panel).toBeVisible();
  await panel.getByTestId('build-product-name').fill('Die Quest von Mira');
  await panel.getByTestId('build-product-name').blur();
  const download = page.waitForEvent('download', { timeout: scaled(180_000) });
  await panel.getByTestId('build-run').click();
  await download;
  await expect(panel.getByTestId('build-summary')).toContainText('Gebaut');
  await page.waitForTimeout(500);
  await save(`phase-${PHASE}.png`);
});
