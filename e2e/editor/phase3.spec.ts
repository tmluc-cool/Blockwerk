import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, tab, test } from './fixtures';

/** Acceptance of phase 3 in the editor: physics settings, player, test area, split screen. */

const example = join(import.meta.dirname, '..', '..', 'examples', '03-held');

/** Opens the bundled example project "Held". */
async function openExample(page: Page): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Held').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Held');
}

/** Starts play mode and waits until the first frames were drawn. */
async function play(page: Page): Promise<void> {
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  // The Game view receives the keyboard (like after pressing Play).
  await page.getByTestId('game-canvas').focus();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
      timeout: 60_000,
    })
    .toBeGreaterThan(3);
}

/** Position of the first live object with a name. */
async function positionOf(page: Page, name: string): Promise<[number, number, number]> {
  const position = await page.evaluate(
    (objectName) => window.__blockwerk?.liveObjects(objectName)[0]?.position,
    name,
  );
  if (!position) throw new Error(`no live object ${name}`);
  return [position[0], position[1], position[2]];
}

function filesOf(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else result[relative(directory, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(directory);
  return result;
}

test.describe('phase 3', () => {
  test('physics settings store the scene gravity and the layer matrix', async ({
    editor: page,
  }) => {
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-physics-settings').click();
    await expect(page.getByTestId('physics-dialog')).toBeVisible();
    const gravity = page.getByTestId('physics-gravity');
    await gravity.fill('-1.62');
    await gravity.press('Enter');
    await page.getByTestId('matrix-Default-Default').uncheck();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.scene()?.environment.gravity))
      .toEqual([0, -1.62, 0]);
    const settings = () =>
      page.evaluate(() => window.__blockwerk?.files()['Einstellungen/tags-und-ebenen.json']);
    await expect.poll(settings).toContain('"ignoredCollisions"');
    await page.getByTestId('matrix-Default-Default').check();
    await expect.poll(settings).not.toContain('ignoredCollisions');
    await page.getByTestId('physics-dialog').getByRole('button').click();
    await expect(page.getByTestId('physics-dialog')).toBeHidden();
  });

  test('the knight walks, runs and jumps with the keyboard and animates', async ({
    editor: page,
  }) => {
    test.setTimeout(180_000);
    await openExample(page);
    await play(page);
    const state = () => page.evaluate(() => window.__blockwerk?.characterState('Ritter'));
    await expect.poll(async () => (await state())?.animation).toBe('idle');
    const start = await positionOf(page, 'Ritter');
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await state())?.animation, { timeout: 60_000 }).toBe('walk');
    await expect
      .poll(async () => (await positionOf(page, 'Ritter'))[2], { timeout: 60_000 })
      .toBeGreaterThan(start[2] + 1);
    await page.keyboard.down('ShiftLeft');
    await expect.poll(async () => (await state())?.animation, { timeout: 60_000 }).toBe('run');
    await expect.poll(async () => (await state())?.running).toBe(true);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    // Jump: leaves the ground.
    await page.keyboard.down('Space');
    await expect
      .poll(async () => (await positionOf(page, 'Ritter'))[1], { timeout: 60_000 })
      .toBeGreaterThan(0.3);
    await page.keyboard.up('Space');
  });

  test('the test area plays the chosen player and leaves the scene untouched', async ({
    editor: page,
  }) => {
    test.setTimeout(180_000);
    await openExample(page);
    const before = await page.evaluate(
      () => Object.keys(window.__blockwerk?.scene()?.objects ?? {}).length,
    );
    await page.getByTestId('menu-window').click();
    await page.getByTestId('menu-test-area').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Spiel').click();
    // The knight stands at the start of the test area, which has a moving platform.
    await expect.poll(async () => (await positionOf(page, 'Ritter'))[2]).toBeCloseTo(-10, 0);
    expect(
      await page.evaluate(() => window.__blockwerk?.liveObjects('Bewegliche Plattform').length),
    ).toBe(1);
    expect(
      await page.evaluate(() => window.__blockwerk?.liveObjects('Treppe 0.25 m').length),
    ).toBeGreaterThan(0);
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('stopped');
    expect(
      await page.evaluate(() => Object.keys(window.__blockwerk?.scene()?.objects ?? {}).length),
    ).toBe(before);
  });

  test('player 2 plays with a gamepad in split screen, each with their own camera', async ({
    editor: page,
  }) => {
    test.setTimeout(180_000);
    // The example with a second knight, a second camera and a split screen.
    const files = filesOf(example);
    const scenePath = 'Assets/Szenen/Held.scene.json';
    const scene = JSON.parse(files[scenePath] ?? '{}') as {
      objects: Record<string, Record<string, unknown>>;
    };
    const cameraObject = scene.objects['heldcamera01'] as {
      components: { values: Record<string, unknown>; type: string }[];
    };
    const camera = cameraObject.components.find((c) => c.type === 'camera');
    if (camera) camera.values = { player: '1', split: 'vertical' };
    const knight = JSON.parse(JSON.stringify(scene.objects['heldknight01'])) as {
      name: string;
      transform: { position: number[] };
      components: { id: string; type: string; values: Record<string, unknown> }[];
    };
    knight.name = 'Ritterin';
    knight.transform.position = [3, 0, 0];
    knight.components = knight.components.map((c, index) => ({
      ...c,
      id: `heldk2c${String(index).padStart(5, '0')}`,
      values: c.type === 'thirdPersonControl' ? { player: '2' } : c.values,
    }));
    scene.objects['heldknight02'] = knight;
    const secondCamera = JSON.parse(JSON.stringify(cameraObject)) as typeof cameraObject & {
      name: string;
      tag: string;
      transform: { position: number[] };
    };
    secondCamera.name = 'Kamera 2';
    secondCamera.tag = 'Untagged';
    secondCamera.transform.position = [3, 3, -6];
    secondCamera.components = secondCamera.components.map((c, index) => ({
      ...c,
      id: `heldk2m${String(index).padStart(5, '0')}`,
      values: c.type === 'camera' ? { player: '2' } : c.values,
    }));
    scene.objects['heldcamera02'] = secondCamera;
    files[scenePath] = `${JSON.stringify(scene, null, 2)}\n`;
    files['blockwerk.json'] = files['blockwerk.json']?.replace('"Held"', '"Zwei"') ?? '';
    await page.evaluate(
      async ([name, data]) => window.__blockwerk?.importFiles(name as string, data as never),
      ['Zwei', files] as const,
    );
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Zwei');

    // A simulated gamepad (Gamepad API, standard mapping) that the test steers.
    await page.evaluate(() => {
      const pad = {
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      (window as unknown as { __pad: typeof pad }).__pad = pad;
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => [{ index: 0, id: 'simulated', connected: true, ...pad }],
      });
    });
    await play(page);
    const views = await page.evaluate(() => window.__blockwerk?.gameViews());
    expect(views).toEqual({ count: 2, split: 'vertical', players: ['1', '2'] });
    const first = await positionOf(page, 'Ritter');
    const second = await positionOf(page, 'Ritterin');
    // Stick forward: with one gamepad and a second player, player 2 gets it.
    await page.evaluate(() => {
      (window as unknown as { __pad: { axes: number[] } }).__pad.axes = [0, -1, 0, 0];
    });
    await expect
      .poll(async () => (await positionOf(page, 'Ritterin'))[2], { timeout: 60_000 })
      .toBeGreaterThan(second[2] + 1);
    expect((await positionOf(page, 'Ritter'))[2]).toBeCloseTo(first[2], 1);
    // Button A (jump) lifts player 2 off the ground.
    await page.evaluate(() => {
      const pad = (window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad;
      pad.buttons[0] = { pressed: true, value: 1 } as never;
    });
    await expect
      .poll(async () => (await positionOf(page, 'Ritterin'))[1], { timeout: 60_000 })
      .toBeGreaterThan(0.2);
    await expect(page.getByTestId('game-canvas')).toBeVisible();
  });
});
