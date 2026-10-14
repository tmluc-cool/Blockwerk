import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { avatarFbx, avatarGlb, AVATAR_BONES } from '../../packages/character/test/avatars';
import { expect, scaled, tab, test } from './fixtures';

/** Acceptance of phase 3b in the editor: the Character Studio (SPEC 5.10, 10). */

/** Opens the bundled example project "Figur". */
async function openExample(page: Page): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Figur', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Figur');
}

/** Opens the Character Studio of the example's knight and waits until it is standing there. */
async function openStudio(page: Page): Promise<void> {
  await openExample(page);
  await tab(page, 'Figur').click();
  await expect(page.getByTestId('studio')).toBeVisible();
  await expect.poll(() => studioState(page), { timeout: scaled(60_000) }).not.toBeNull();
}

type StudioState = NonNullable<Awaited<ReturnType<typeof studioState>>>;

function studioState(page: Page) {
  return page.evaluate(() => window.__blockwerk?.studioState() ?? null);
}

/** Waits for the studio to show a figure with the given mode and returns its state. */
async function figureReady(page: Page, mode: string): Promise<StudioState> {
  await expect
    .poll(async () => (await studioState(page))?.mode, { timeout: scaled(60_000) })
    .toBe(mode);
  // Retargeted library clips arrive in a second round.
  if (mode === 'skeleton') {
    await expect
      .poll(async () => (await studioState(page))?.clips.includes('Walking_A'), {
        timeout: scaled(60_000),
      })
      .toBe(true);
  }
  const state = await studioState(page);
  if (!state) throw new Error('no figure on the turntable');
  return state;
}

/** Uploads a model file through the studio's upload button. */
async function upload(page: Page, path: string): Promise<void> {
  await page.getByTestId('studio-tab-model').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('studio-upload').click();
  await (await chooser).setFiles(path);
}

function figureValues(page: Page, type: string): Promise<Record<string, unknown> | undefined> {
  return page.evaluate((componentType) => {
    const scene = window.__blockwerk?.scene();
    const id = window.__blockwerk?.objectIds('Ritter')[0];
    const object = id ? scene?.objects[id] : undefined;
    return object?.components.find((component) => component.type === componentType)?.values as
      Record<string, unknown> | undefined;
  }, type);
}

function componentEnabled(page: Page, type: string): Promise<boolean | undefined> {
  return page.evaluate((componentType) => {
    const scene = window.__blockwerk?.scene();
    const id = window.__blockwerk?.objectIds('Ritter')[0];
    const object = id ? scene?.objects[id] : undefined;
    return object?.components.find((component) => component.type === componentType)?.enabled;
  }, type);
}

test.describe('phase 3b', () => {
  test('a VRM avatar and a rigged FBX model are uploaded and run with the library animations', async ({
    editor: page,
  }, testInfo) => {
    test.setTimeout(scaled(240_000));
    const dir = testInfo.outputPath('avatars');
    mkdirSync(dir, { recursive: true });
    // Bone names no recognition can understand: the VRM humanoid tells which bone is which.
    const vrm = join(dir, 'Avatar.vrm');
    writeFileSync(
      vrm,
      avatarGlb({
        vrm: 1,
        name: (standard) => `b_${AVATAR_BONES.findIndex((bone) => bone.standard === standard)}`,
      }),
    );
    await openStudio(page);
    await upload(page, vrm);
    const imported = await page.evaluate(() => {
      const files = window.__blockwerk?.files() ?? {};
      return Object.entries(files).find(([path]) => path.endsWith('Avatar.glb.meta.json'))?.[1];
    });
    // The humanoid assignment and the license come from the VRM file.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Object.entries(window.__blockwerk?.files() ?? {}).find(([path]) =>
              path.endsWith('Avatar.glb.meta.json'),
            )?.[1] ?? '',
        ),
      )
      .toContain('"boneMap"');
    void imported;
    const meta = await page.evaluate(
      () =>
        Object.entries(window.__blockwerk?.files() ?? {}).find(([path]) =>
          path.endsWith('Avatar.glb.meta.json'),
        )?.[1] ?? '',
    );
    expect(meta).toContain('publicdomain/zero');
    // The new model is chosen for the figure; it walks, runs and jumps with library animations.
    await expect
      .poll(async () => (await figureValues(page, 'character'))?.['model'])
      .toMatch(/^[a-z0-9]{12}$/);
    const avatar = await figureReady(page, 'skeleton');
    expect(avatar.mapped).toBe(true);
    expect(avatar.clips).toEqual(expect.arrayContaining(['Walking_A', 'Running_A', 'Jump_Start']));
    for (const state of ['walk', 'run']) {
      await page.getByTestId(`anim-play-${state}`).click();
      await expect
        .poll(async () => (await studioState(page))?.animation, { timeout: scaled(30_000) })
        .toBe(state);
    }
    // The jump is a one-shot clip: it ends and the figure idles again, so check that it was played.
    await page.getByTestId('anim-play-jump').click();
    await expect
      .poll(async () => (await studioState(page))?.played, { timeout: scaled(30_000) })
      .toContain('jump');
    // The body is scaled to the chosen body height (1.8 m).
    expect(avatar.height).toBeGreaterThan(1.6);
    expect(avatar.height).toBeLessThan(2);

    // A rigged FBX file works the same way (its bones carry the standard names).
    const fbx = join(dir, 'Avatar2.fbx');
    writeFileSync(fbx, avatarFbx());
    await upload(page, fbx);
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.assets().map((a) => a.name)))
      .toContain('Avatar2');
    await expect
      .poll(async () => (await figureValues(page, 'character'))?.['model'])
      .toMatch(/^[a-z0-9]{12}$/);
    await expect
      .poll(async () => (await studioState(page))?.clips.includes('Walking_A'), {
        timeout: scaled(60_000),
      })
      .toBe(true);
    expect((await studioState(page))?.mapped).toBe(true);
  });

  test('a model without a skeleton is a rigid figure', async ({ editor: page }, testInfo) => {
    test.setTimeout(scaled(180_000));
    const dir = testInfo.outputPath('avatars');
    mkdirSync(dir, { recursive: true });
    const slime = join(dir, 'Schleim.glb');
    writeFileSync(slime, avatarGlb({ rigid: true }));
    await openStudio(page);
    await upload(page, slime);
    await figureReady(page, 'rigid');
    await expect(page.getByTestId('studio-rigid')).toBeVisible();
  });

  test('the builder dresses the knight and the sword follows every animation', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(240_000));
    await openStudio(page);
    const knight = await figureReady(page, 'skeleton');
    expect(knight.height).toBeGreaterThan(1.6);
    expect(knight.height).toBeLessThan(2);
    // Builder: show the cape, pick a color palette.
    await page.getByTestId('studio-tab-builder').click();
    await page.getByTestId('part-Knight_Cape').check();
    await expect
      .poll(async () => String((await figureValues(page, 'character'))?.['shownGear']))
      .toContain('Knight_Cape');
    await page.getByTestId('studio-tab-colors').click();
    await page.getByTestId('palette-2').click();
    await expect
      .poll(async () => String((await figureValues(page, 'character'))?.['tints']))
      .toContain('#3a8f5a');
    // Equipment: the sword goes to the right hand (once more, from the list).
    await page.getByTestId('studio-tab-equipment').click();
    await page.getByTestId('remove-rightHand').click();
    await expect.poll(async () => (await studioState(page))?.attached).toEqual([]);
    await page.getByTestId('point-rightHand').click();
    await page.getByTestId('studio-item-search').fill('sword');
    await page.getByTestId('item-kaykit-adventurers/sword-1handed').click();
    await expect.poll(async () => (await studioState(page))?.attached).toEqual(['rightHand']);
    // It follows the animation: the hand is somewhere else while running than while standing.
    await page.getByTestId('anim-play-idle').click();
    await page.waitForTimeout(1500);
    const standing = (await studioState(page))?.attachedAt['rightHand'] ?? [0, 0, 0];
    await page.getByTestId('anim-play-run').click();
    let farthest = 0;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const now = (await studioState(page))?.attachedAt['rightHand'] ?? standing;
      farthest = Math.max(
        farthest,
        Math.hypot(...now.map((value, axis) => value - (standing[axis] ?? 0))),
      );
    }
    expect(farthest).toBeGreaterThan(0.1);
  });

  test('switching the movement profile changes the jump arc and the feel in the test area', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(300_000));
    await openStudio(page);
    await figureReady(page, 'skeleton');
    await page.getByTestId('studio-tab-movement').click();
    await page.getByTestId('profile-arcade').click();
    await expect(page.getByTestId('jump-height')).toHaveText('1.80 m');
    const arcade = (await studioState(page))?.arc;
    await page.getByTestId('profile-heavy').click();
    await expect(page.getByTestId('jump-height')).toHaveText('0.60 m');
    const heavy = (await studioState(page))?.arc;
    expect(arcade?.height).toBeCloseTo(1.8, 1);
    expect(heavy?.height).toBeCloseTo(0.6, 1);
    expect(heavy?.run).toBeLessThan(arcade?.run ?? 0);

    // In the test area the heavy knight walks slowly (1.4 m/s) …
    await page.getByTestId('studio-test-area').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Spiel').click();
    await page.getByTestId('game-canvas').focus();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
        timeout: scaled(60_000),
      })
      .toBeGreaterThan(3);
    await page.keyboard.down('KeyW');
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.__blockwerk?.characterState('Ritter')))?.speed,
        {
          timeout: scaled(60_000),
        },
      )
      .toBeCloseTo(1.4, 0);
    await page.keyboard.up('KeyW');

    // … and the real jump is as high as the arc says (within 10 %): tick by tick.
    await page.getByTestId('pause').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('paused');
    const run = (ticks: number): Promise<number[]> =>
      page.evaluate((count) => window.__blockwerk?.stepGame(count, 'Ritter') ?? [], ticks);
    const press = (code: string, down: boolean): Promise<void> =>
      page.evaluate(
        ([key, state]) => window.__blockwerk?.pressKey(String(key), Boolean(state)),
        [code, down],
      );
    const [ground = 0] = await run(40);
    await press('Space', true);
    const rising = await run(3);
    await press('Space', false);
    const flight = await run(90);
    const apex = Math.max(...rising, ...flight) - ground;
    expect(apex).toBeGreaterThan(0.54);
    expect(apex).toBeLessThan(0.66);
  });

  test('the ability cards double jump and roll work without a single block', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(300_000));
    await openStudio(page);
    await figureReady(page, 'skeleton');
    // Take both abilities off, then drag the cards onto the figure.
    await page.getByTestId('ability-toggle-doubleJump').uncheck();
    await page.getByTestId('ability-toggle-roll').uncheck();
    await expect.poll(() => componentEnabled(page, 'doubleJump')).toBe(false);
    await expect.poll(() => componentEnabled(page, 'roll')).toBe(false);
    await page.getByTestId('ability-doubleJump').dragTo(page.getByTestId('studio-stage'));
    await page.getByTestId('ability-roll').dragTo(page.getByTestId('studio-stage'));
    await expect.poll(() => componentEnabled(page, 'doubleJump')).toBe(true);
    await expect.poll(() => componentEnabled(page, 'roll')).toBe(true);

    await page.getByTestId('studio-test-area').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Spiel').click();
    await page.getByTestId('game-canvas').focus();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
        timeout: scaled(60_000),
      })
      .toBeGreaterThan(3);
    // Stepping the paused game keeps every key press in its own tick.
    await page.getByTestId('pause').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('paused');
    const run = (ticks: number): Promise<number[]> =>
      page.evaluate((count) => window.__blockwerk?.stepGame(count, 'Ritter') ?? [], ticks);
    const press = (code: string, down: boolean): Promise<void> =>
      page.evaluate(
        ([key, state]) => window.__blockwerk?.pressKey(String(key), Boolean(state)),
        [code, down],
      );
    const events = (): Promise<Record<string, number>> =>
      page.evaluate(() => window.__blockwerk?.eventCounts() ?? {});
    await run(40);
    // Jump, then jump again in the air.
    await press('Space', true);
    await run(3);
    await press('Space', false);
    await run(15);
    await press('Space', true);
    await run(3);
    await press('Space', false);
    expect((await events())['doubleJump:started']).toBe(1);
    await run(120);
    // Roll while walking.
    await press('KeyW', true);
    await run(30);
    await press('KeyQ', true);
    await run(3);
    await press('KeyQ', false);
    expect((await events())['roll:started']).toBe(1);
  });

  test('a portrait becomes an image in the project and player 2 is a variant with other colors', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(240_000));
    await openStudio(page);
    await figureReady(page, 'skeleton');
    await page.getByTestId('studio-tab-portrait').click();
    await page.getByTestId('portrait-create').click();
    await expect(page.getByTestId('portrait-result')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => window.__blockwerk?.assets().filter((a) => a.type === 'image')),
      )
      .toHaveLength(1);

    const prefabsBefore = await page.evaluate(
      () => window.__blockwerk?.assets().filter((a) => a.type === 'prefab').length ?? 0,
    );
    const before = await figureValues(page, 'character');
    await page.getByTestId('studio-player2').click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__blockwerk?.assets().filter((a) => a.type === 'prefab').length),
      )
      .toBe(prefabsBefore + 1);
    // The new instance is steered by player 2 and wears other colors than player 1.
    const second = await page.evaluate(() => {
      const scene = window.__blockwerk?.scene();
      const found = Object.values(scene?.objects ?? {}).filter((object) =>
        object.components.some(
          (c) => c.type === 'character' && String(c.values['tints'] ?? '') !== '',
        ),
      );
      return found.map((object) => ({
        player: object.components.find((c) => c.type.endsWith('Control'))?.values['player'],
        tints: object.components.find((c) => c.type === 'character')?.values['tints'],
      }));
    });
    const players = second.filter((entry) => entry.player === '2');
    expect(players.length).toBeGreaterThanOrEqual(2);
    expect(players.some((entry) => entry.tints !== before?.['tints'])).toBe(true);
  });
});
