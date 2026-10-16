import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, scaled, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '11';

/**
 * Screenshots of the current phase for the phase report (phase 11: the final game `endspiel`,
 * played from the main menu with two players in split screen, and its landscape in the Scene
 * view). Written to `test-results/` on every run and to `docs/screenshots/` when
 * `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ editor: page }) => {
  test.setTimeout(scaled(600_000));
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

  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Endspiel', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Endspiel');
  await page.evaluate(() => window.__blockwerk?.openSceneByName('Land'));
  await expect(page.getByTestId('hierarchy').getByText('Brunnen', { exact: true })).toBeVisible({
    timeout: scaled(60_000),
  });
  // The village in the Scene view: double-click focuses the well, the wheel backs off.
  await page.getByTestId('hierarchy').getByText('Brunnen', { exact: true }).dblclick();
  await page.waitForTimeout(1500);
  const canvas = await page.getByTestId('scene-canvas').boundingBox();
  if (!canvas) throw new Error('no scene view');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(3000);
  await save(`phase-${PHASE}-szene.png`);

  await save(`phase-${PHASE}-szene.png`);

  // Back to the start scene: the game starts from its main menu.
  await page.evaluate(() => window.__blockwerk?.openSceneByName('Hauptmenue'));
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(frames, { timeout: scaled(120_000) }).toBeGreaterThan(4);
  await expect(page.getByRole('button', { name: 'Spielen' })).toBeVisible({
    timeout: scaled(60_000),
  });
  await page.waitForTimeout(2500);
  await save(`phase-${PHASE}-menue.png`);
  await page.getByRole('button', { name: 'Spielen' }).click();
  await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: scaled(60_000) });
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: scaled(120_000) });
  // Player 2 joins; both stand in the village, player 1 next to the well.
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
  await save(`phase-${PHASE}.png`);
});
