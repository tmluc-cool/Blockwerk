import type { Page } from '@playwright/test';
import { expect, sceneCenter, tab, test } from './fixtures';

/** Acceptance of phase 4 in the editor: terrain tools, lighting window, graphics level, example. */

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

/** Highest and lowest height over a grid of the terrain. */
const extent = (page: Page, id: string) =>
  page.evaluate((objectId) => {
    const hooks = window.__blockwerk;
    let max = -Infinity;
    let min = Infinity;
    for (let x = -40; x <= 40; x += 8) {
      for (let z = -40; z <= 40; z += 8) {
        const height = hooks?.terrainProbe(objectId, x, z)?.height ?? 0;
        max = Math.max(max, height);
        min = Math.min(min, height);
      }
    }
    return { max, min };
  }, id);

/** Opens the bundled example "Landschaft". */
async function openExample(page: Page): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Landschaft').click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.project().name))
    .toBe('Landschaft');
}

/** Starts play mode and waits until frames were drawn. */
async function play(page: Page, frames = 4): Promise<void> {
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
      timeout: 120_000,
    })
    .toBeGreaterThan(frames);
}

/** Sets a range input the way a drag would. */
async function setRange(page: Page, testId: string, value: number): Promise<void> {
  await page.getByTestId(testId).evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function openLighting(page: Page): Promise<void> {
  await page.getByTestId('menu-window').click();
  await page.getByTestId('menu-open-window').hover();
  await page.getByTestId('open-lighting').click();
  await expect(page.getByTestId('lighting')).toBeVisible();
}

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
  expect((await extent(page, id)).max).toBeGreaterThan(0.2);
  // The terrain file is part of the project and the scene counts the change.
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().dirty)).toBe(true);
  // Painting changes the layer weights.
  await page.getByTestId('terrain-tool-paint').click();
  await page.getByTestId('terrain-layer-2').click();
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  for (let step = 0; step < 6; step++)
    await page.mouse.move(center.x + step, center.y, { steps: 2 });
  await page.mouse.up();
  // Undo twice (paint, raise) brings the flat terrain back.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await extent(page, id)).max).toBe(0);
});

test('the lighting window sets time of day, weather and graphics level, with undo', async ({
  editor: page,
}) => {
  await openLighting(page);
  await page.getByTestId('lighting-cycle').check();
  await setRange(page, 'lighting-time', 20);
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.scene()?.environment.sky?.timeOfDay))
    .toBe(20);
  await expect(page.getByTestId('lighting-clock')).toContainText('20');
  await page.getByTestId('lighting-weather').selectOption('rain');
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.scene()?.environment.weather?.type))
    .toBe('rain');
  await page.getByTestId('lighting-quality').selectOption('low');
  // Focus leaves the form field, so the shortcut reaches the editor.
  await page.getByTestId('lighting').locator('h4').first().click();
  await page.keyboard.press('Control+z');
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.scene()?.environment.weather?.type))
    .not.toBe('rain');
});

test('the example "Landschaft" plays with few draw calls and the graphics level switches while it runs', async ({
  editor: page,
}) => {
  test.setTimeout(300_000);
  await openExample(page);
  await play(page);
  const first = await page.evaluate(() => window.__blockwerk?.playPerformance());
  // Phase 4 acceptance: fewer than 500 draw calls (60 FPS needs a real GPU; see PROGRESS.md).
  expect(first?.drawCalls).toBeGreaterThan(10);
  expect(first?.drawCalls).toBeLessThan(500);
  const started = await page.evaluate(() => window.__blockwerk?.playStartupMs());
  // Low, medium, high and ultra, one after the other, without a restart.
  for (const level of ['low', 'ultra', 'medium', 'high']) {
    const before = (await page.evaluate(() => window.__blockwerk?.playPerformance().frames)) ?? 0;
    await page.getByTestId('game-quality').selectOption(level);
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
        timeout: 120_000,
      })
      .toBeGreaterThan(before + 1);
    expect(await page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    expect(
      (await page.evaluate(() => window.__blockwerk?.playPerformance().drawCalls)) ?? 1000,
    ).toBeLessThan(500);
  }
  expect(await page.evaluate(() => window.__blockwerk?.playStartupMs())).toBe(started);
  // The sound is on a mixer channel: mute and unmute from the Game view.
  await page.getByTestId('mute-toggle').click();
  await expect(page.getByTestId('mute-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('mute-toggle').click();
});

test('an audio source gets a built-in sound from the inspector', async ({ editor: page }) => {
  await page.getByTestId('menu-gameObject').click();
  await page.getByTestId('create-empty').click();
  await page.getByTestId('rename-input').fill('Radio');
  await page.keyboard.press('Enter');
  await page.getByTestId('menu-component').click();
  await page.getByTestId('menu-component-audioSource').click();
  const field = page.getByTestId('component-audioSource-0-sound');
  await field.selectOption('builtin:music-adventure');
  await expect
    .poll(async () => {
      const scene = await page.evaluate(() => window.__blockwerk?.scene());
      return Object.values(scene?.objects ?? {})
        .find((object) => object.name === 'Radio')
        ?.components.find((component) => component.type === 'audioSource')?.values['sound'];
    })
    .toBe('builtin:music-adventure');
  await page.getByTestId('component-audioSource-0-sound-preview').click();
});
