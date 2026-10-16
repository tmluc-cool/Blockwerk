import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, scaled, tab, test } from './fixtures';

/**
 * Frames for the animated tour in the README (`pnpm tour` turns them into a GIF). Skipped unless
 * `BLOCKWERK_TOUR` names a template or example folder to show; the English interface is used.
 */
const FOLDER = process.env['BLOCKWERK_TOUR'] ?? '';

test('README tour frames', async ({ editor: page }) => {
  test.skip(FOLDER === '', 'only runs for `pnpm tour`');
  test.setTimeout(scaled(300_000));
  const out = join('test-results', 'tour');
  mkdirSync(out, { recursive: true });
  let frame = 0;
  const shot = async (): Promise<void> => {
    await page.screenshot({ path: join(out, `frame-${String(frame++).padStart(2, '0')}.png`) });
  };

  await page.evaluate(() => {
    window.localStorage.setItem(
      'blockwerk.settings',
      JSON.stringify({ state: { locale: 'en' }, version: 1 }),
    );
  });
  await page.reload();
  await expect(page.getByTestId('scene-canvas')).toBeVisible();
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-new-from-template').click();
  await page.getByTestId('choice-dialog').locator('.choice').first().click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.project().status), { timeout: 30_000 })
    .toBe('ready');
  await page.waitForTimeout(2500);
  await shot();

  // Select the hero and look at its components.
  await page.getByTestId('hierarchy').getByText('Ritter', { exact: true }).click();
  await page.waitForTimeout(800);
  await shot();

  // The block script.
  await tab(page, 'Block Editor').click();
  await page.getByTestId('script-select').selectOption({ index: 1 });
  await page.waitForTimeout(2000);
  await shot();

  // Play.
  await page.getByTestId('play').click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.playStatus()), { timeout: 60_000 })
    .toBe('playing');
  await tab(page, 'Game').click();
  await page.waitForTimeout(2500);
  await shot();
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyW', true));
  await page.waitForTimeout(2500);
  await shot();
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyW', false));
});
