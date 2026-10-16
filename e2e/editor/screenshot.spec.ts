import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openWithKey } from './aiMock';
import { expect, scaled, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '10';

/**
 * Screenshot of the current phase for the phase report (phase 10: the AI assistant proposes
 * five houses and a well as ghosts in the Scene view; the model's answer is played by the test).
 * Written to `test-results/` on every run and to `docs/screenshots/` when
 * `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ page }) => {
  test.setTimeout(scaled(300_000));
  const model = 'kaykit-medieval-hexagon/';
  const houses = [
    ['building-home-a-blue', -8, -6],
    ['building-home-b-red', 0, -8],
    ['building-home-a-yellow', 8, -6],
    ['building-home-b-yellow', -6, 6],
    ['building-tavern-blue', 6, 6],
  ] as const;
  await openWithKey(page, () => ({
    tool: 'propose_world',
    input: {
      summary: 'Fünf Häuser im Kreis um einen Brunnen.',
      objects: [
        ...houses.map(([name, x, z]) => ({ model: `${model}${name}`, position: [x, 0, z] })),
        { model: `${model}building-well-blue`, name: 'Brunnen', position: [0, 0, 0] },
      ],
    },
  }));
  const save = async (name: string) => {
    const targets = [join('test-results', 'screenshots', name)];
    if (process.env['BLOCKWERK_SCREENSHOT'] === '1')
      targets.push(join('docs', 'screenshots', name));
    for (const path of targets) {
      mkdirSync(dirname(path), { recursive: true });
      await page.screenshot({ path });
    }
  };
  const canvas = await page.getByTestId('scene-canvas').boundingBox();
  if (!canvas) throw new Error('no scene view');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  for (let i = 0; i < 2; i++) await page.mouse.wheel(0, 400);
  await page.getByTestId('toolbar-ai').click();
  await page.getByTestId('ai-task-world').click();
  await page.getByTestId('ai-prompt').fill('Stell 5 Häuser und einen Brunnen auf die Wiese');
  await page.getByTestId('ai-send').click();
  await expect(page.getByTestId('ai-preview')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.aiGhostCount())).toBe(6);
  await page.waitForTimeout(2500);
  await save(`phase-${PHASE}.png`);
});
