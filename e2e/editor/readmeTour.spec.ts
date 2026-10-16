import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, scaled, tab, test } from './fixtures';

/**
 * Frames for the animated tour in the README (`pnpm tour` turns them into a GIF): the final game
 * `endspiel` in the editor with the English interface. Skipped unless `BLOCKWERK_TOUR` is set.
 */
test('README tour frames', async ({ editor: page }) => {
  test.skip((process.env['BLOCKWERK_TOUR'] ?? '') === '', 'only runs for `pnpm tour`');
  test.setTimeout(scaled(600_000));
  const out = join('test-results', 'tour');
  mkdirSync(out, { recursive: true });
  let frame = 0;
  const shot = async (): Promise<void> => {
    await page.screenshot({ path: join(out, `frame-${String(frame++).padStart(2, '0')}.png`) });
  };
  const frames = () => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);

  await page.evaluate(() => {
    window.localStorage.setItem(
      'blockwerk.settings',
      JSON.stringify({ state: { locale: 'en' }, version: 1 }),
    );
  });
  await page.reload();
  await expect(page.getByTestId('scene-canvas')).toBeVisible();
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Endspiel', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.project().name), { timeout: 30_000 })
    .toBe('Endspiel');

  // The village in the Scene view.
  await page.evaluate(() => window.__blockwerk?.openSceneByName('Land'));
  const hierarchy = page.getByTestId('hierarchy');
  await expect(hierarchy.getByText('Brunnen', { exact: true })).toBeVisible({
    timeout: scaled(60_000),
  });
  await hierarchy.getByText('Brunnen', { exact: true }).dblclick();
  await page.waitForTimeout(1500);
  const canvas = await page.getByTestId('scene-canvas').boundingBox();
  if (!canvas) throw new Error('no scene view');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(3000);
  await shot();

  // The hero with its figure and ability cards in the Inspector.
  await hierarchy.getByText('Ritter', { exact: true }).click();
  await page.waitForTimeout(1000);
  await shot();

  // A block script.
  await tab(page, 'Block Editor').click();
  await page.getByTestId('script-select').selectOption({ label: 'Mira' });
  await page.waitForTimeout(2000);
  await shot();

  // Play: main menu, then the landscape with two players.
  await page.evaluate(() => window.__blockwerk?.openSceneByName('Hauptmenue'));
  await page.getByTestId('play').click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.playStatus()), { timeout: 60_000 })
    .toBe('playing');
  await tab(page, 'Game').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(frames, { timeout: scaled(120_000) }).toBeGreaterThan(4);
  await expect(page.getByRole('button', { name: 'Spielen' })).toBeVisible({
    timeout: scaled(60_000),
  });
  await page.waitForTimeout(2500);
  await shot();
  await page.getByRole('button', { name: 'Spielen' }).click();
  await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: scaled(60_000) });
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: scaled(120_000) });
  await page.waitForTimeout(2500);
  await shot();
  await page.getByTestId('game-canvas').focus();
  const before = await frames();
  await page.evaluate(() => window.__blockwerk?.pressKey('Enter', true));
  await expect.poll(frames, { timeout: scaled(30_000) }).toBeGreaterThan(before + 2);
  await page.evaluate(() => window.__blockwerk?.pressKey('Enter', false));
  await expect
    .poll(async () => (await page.evaluate(() => window.__blockwerk?.gameViews()))?.count, {
      timeout: scaled(30_000),
    })
    .toBe(2);
  await page.waitForTimeout(6000);
  await shot();
});
