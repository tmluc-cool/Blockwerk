import type { Page } from '@playwright/test';
import { expect, sceneCenter, tab, test } from './fixtures';

/** Acceptance of phase 4 in the editor: terrain tools, lighting window, graphics level. */

/** Creates a terrain object with the Object menu; returns its ID. */
async function createTerrain(page: Page): Promise<string> {
  await page.getByTestId('menu-gameObject').click();
  await page.getByTestId('menu-3d-object').hover();
  await page.getByTestId('create-terrain').click();
  await page.getByTestId('rename-input').fill('Landschaft');
  await page.keyboard.press('Enter');
  const id = await page.evaluate(() => window.__blockwerk?.objectIds('Landschaft')[0]);
  if (!id) throw new Error('no terrain object');
  return id;
}

const probe = (page: Page, id: string, x: number, z: number) =>
  page.evaluate(([objectId, px, pz]) => window.__blockwerk?.terrainProbe(objectId, px, pz), [
    id,
    x,
    z,
  ] as const);

test('shapes and paints a terrain with the brush, and undo brings the old state back', async ({
  editor: page,
}) => {
  const id = await createTerrain(page);
  // New terrain: a flat file in the project.
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__blockwerk?.assets().filter((asset) => asset.type === 'terrain').length,
      ),
    )
    .toBe(1);
  expect((await probe(page, id, 0, 0))?.height).toBe(0);
  await expect(page.getByTestId('terrain-tools')).toBeVisible();
  await page.getByTestId('terrain-brush-toggle').click();
  await page.getByTestId('terrain-tool-raise').click();
  await page.getByTestId('terrain-strength').fill('1');
  await page.getByTestId('terrain-strength').press('Enter');
  const center = await sceneCenter(page);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  for (let step = 0; step < 6; step++)
    await page.mouse.move(center.x + step, center.y, { steps: 2 });
  await page.mouse.up();
  const raised = await page.evaluate((objectId) => {
    const hooks = window.__blockwerk;
    const heights: number[] = [];
    for (let x = -40; x <= 40; x += 8) {
      for (let z = -40; z <= 40; z += 8) {
        heights.push(hooks?.terrainProbe(objectId, x, z)?.height ?? 0);
      }
    }
    return Math.max(...heights);
  }, id);
  expect(raised).toBeGreaterThan(0.2);
  // The terrain file is part of the project and the scene counts the change.
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().dirty)).toBe(true);
  // Undo (Ctrl+Z) brings the flat terrain back.
  await page.keyboard.press('Control+z');
  await expect
    .poll(async () =>
      page.evaluate((objectId) => {
        const hooks = window.__blockwerk;
        let max = 0;
        for (let x = -40; x <= 40; x += 8) {
          for (let z = -40; z <= 40; z += 8) {
            max = Math.max(max, Math.abs(hooks?.terrainProbe(objectId, x, z)?.height ?? 0));
          }
        }
        return max;
      }, id),
    )
    .toBe(0);
  await tab(page, 'Szene').click();
});
