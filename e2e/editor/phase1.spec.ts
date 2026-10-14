import type { Page } from '@playwright/test';
import {
  blocks,
  createPrimitive,
  expect,
  objectId,
  openExample,
  scaled,
  settle,
  tab,
  test,
} from './fixtures';

/** Object positions of the open scene (edit mode). */
async function position(page: Page, id: string): Promise<number[]> {
  return page.evaluate((target) => {
    const object = window.__blockwerk?.scene()?.objects[target];
    return object ? [...object.transform.position] : [];
  }, id);
}

function hierarchyRow(page: Page, name: string) {
  return page.getByTestId('hierarchy').locator('.tree-item', { hasText: new RegExp(`^${name}$`) });
}

test.describe('phase 1: objects, components, block scripts, play mode', () => {
  test('hierarchy: create, rename, duplicate, reparent by drag and drop, delete and undo', async ({
    editor: page,
  }) => {
    await createPrimitive(page, 'sphere');
    const sphere = await objectId(page, 'Kugel');
    // F2 renames.
    await page.getByTestId('hierarchy').locator('[role="tree"]').focus();
    await page.keyboard.press('F2');
    await page.getByTestId('rename-input').fill('Ball');
    await page.keyboard.press('Enter');
    await expect(hierarchyRow(page, 'Ball')).toBeVisible();

    // Ctrl+D duplicates with a Unity-style name.
    await page.keyboard.press('Control+d');
    await expect(hierarchyRow(page, 'Ball \\(1\\)')).toBeVisible();

    // Drag "Ball (1)" onto "Ball": it becomes a child and keeps its world position.
    const copy = await objectId(page, 'Ball (1)');
    const before = await position(page, copy);
    await hierarchyRow(page, 'Ball \\(1\\)').dragTo(hierarchyRow(page, 'Ball'));
    await expect
      .poll(() => page.evaluate((id) => window.__blockwerk?.scene()?.objects[id]?.parent, copy))
      .toBe(sphere);
    expect(await position(page, copy)).toEqual([0, 0, 0]);
    expect(before).toEqual(await position(page, sphere));

    // Delete removes the parent with its child; Ctrl+Z brings both back.
    await hierarchyRow(page, 'Ball').click();
    await page.keyboard.press('Delete');
    await expect(hierarchyRow(page, 'Ball')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(hierarchyRow(page, 'Ball')).toBeVisible();
    expect(
      await page.evaluate((id) => window.__blockwerk?.scene()?.objects[id]?.parent, copy),
    ).toBe(sphere);
    await page.keyboard.press('Control+y');
    await expect(hierarchyRow(page, 'Ball')).toHaveCount(0);
  });

  test('inspector: transform, component fields, multi-editing with "—", add and remove components', async ({
    editor: page,
  }) => {
    await createPrimitive(page, 'cube');
    const inspector = page.getByTestId('inspector');
    await inspector.getByTestId('transform-position-y').fill('2.5');
    await inspector.getByTestId('transform-position-y').press('Enter');
    const cube = await objectId(page, 'Würfel');
    await expect.poll(() => position(page, cube)).toEqual([0, 2.5, 0]);

    await inspector.getByTestId('component-meshRenderer-0-shape').selectOption('ramp');
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.__blockwerk?.scene()?.objects[id]?.components[0]?.values['shape'],
          cube,
        ),
      )
      .toBe('ramp');

    // A second object: selecting both shows "—" where values differ.
    await createPrimitive(page, 'cube');
    await inspector.getByTestId('transform-position-y').fill('1');
    await inspector.getByTestId('transform-position-y').press('Enter');
    await hierarchyRow(page, 'Würfel')
      .first()
      .click({ modifiers: ['Control'] });
    await expect(inspector.getByTestId('transform-position-y')).toHaveValue('');
    await expect(inspector.getByTestId('transform-position-y')).toHaveAttribute('placeholder', '—');
    await expect(inspector.getByTestId('transform-position-x')).toHaveValue('0');
    // Setting it changes both.
    await inspector.getByTestId('transform-position-y').fill('4');
    await inspector.getByTestId('transform-position-y').press('Enter');
    await expect.poll(() => position(page, cube)).toEqual([0, 4, 0]);

    // Add Component with search; the context menu removes it again.
    await inspector.getByTestId('add-component').click();
    await inspector.getByTestId('add-component-search').fill('licht');
    await inspector.getByTestId('add-light').click();
    await expect(inspector.getByTestId('component-light-0')).toBeVisible();
    await inspector.getByTestId('component-light-0-menu').click();
    await page.getByTestId('component-remove').click();
    await expect(inspector.getByTestId('component-light-0')).toHaveCount(0);
  });

  test('gizmo: dragging the move handle moves the object (Ctrl snaps)', async ({
    editor: page,
  }) => {
    await createPrimitive(page, 'cube');
    const cube = await objectId(page, 'Würfel');
    await page.keyboard.press('f');
    await settle(page);
    const canvas = await page.getByTestId('scene-canvas').boundingBox();
    const point = await page.evaluate((id) => window.__blockwerk?.screenPoint(id), cube);
    if (!canvas || !point) throw new Error('cube not on screen');
    // The center handle of the move gizmo moves in the view plane.
    const x = canvas.x + point.x;
    const y = canvas.y + point.y;
    await page.mouse.move(x, y);
    await page.keyboard.down('Control');
    await page.mouse.down();
    await page.mouse.move(x + 80, y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    await expect
      .poll(async () => Math.abs((await position(page, cube))[0] ?? 0))
      .toBeGreaterThan(0.2);
    // Snapped to 0.25 m steps.
    const [px] = await position(page, cube);
    const steps = (px ?? 0) / 0.25;
    expect(Math.abs(steps - Math.round(steps)), `x = ${px}`).toBeLessThan(1e-6);
    // One undo step for the whole drag.
    await page.keyboard.press('Control+z');
    await expect.poll(() => position(page, cube)).toEqual([0, 0.5, 0]);
  });

  test('example: WASD collects three spheres, points appear, stop resets, a kept value stays', async ({
    editor: page,
  }) => {
    await openExample(page);
    const player = await objectId(page, 'Spieler');
    const startPosition = await position(page, player);

    // Play starts in under a second (from pressing Play to the first rendered game frame).
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.playStartupMs()))
      .not.toBeNull();
    const startup = (await page.evaluate(() => window.__blockwerk?.playStartupMs())) ?? Infinity;
    expect(startup).toBeLessThan(1000);
    await expect(page.getByTestId('app')).toHaveClass(/playing/);
    await expect(page.getByTestId('monitor')).toContainText('Punkte');

    // The game view has the keyboard: hold W until all spheres are collected.
    await page.keyboard.down('w');
    try {
      await expect
        .poll(() => page.evaluate(() => window.__blockwerk?.liveVariable(null, 'Punkte')), {
          timeout: scaled(30_000),
        })
        .toBe(3);
    } catch (error) {
      // Slow machines (software rendering) fail here; say what the game was doing.
      const state = await page.evaluate(() => ({
        performance: window.__blockwerk?.playPerformance(),
        player: window.__blockwerk?.liveObjects('Spieler'),
        points: window.__blockwerk?.liveVariable(null, 'Punkte'),
        focus: document.hasFocus(),
        active: document.activeElement?.tagName,
      }));
      console.log('WASD DIAGNOSTICS', JSON.stringify(state));
      throw error;
    }
    await page.keyboard.up('w');
    await expect(page.getByTestId('monitor')).toContainText('3');
    expect(await page.evaluate(() => window.__blockwerk?.liveObjects('Kugel 1').length)).toBe(0);
    // The same script on the second cube runs with its own speed (Tempo 2 instead of 4).
    const [first] = await page.evaluate(() => window.__blockwerk?.liveObjects('Spieler') ?? []);
    const [second] = await page.evaluate(
      () => window.__blockwerk?.liveObjects('Zweiter Würfel') ?? [],
    );
    expect(first && second).toBeTruthy();
    const travelled = (first?.position[2] ?? 0) - 0;
    const travelledSecond = second?.position[2] ?? 0;
    expect(travelledSecond / travelled).toBeGreaterThan(0.4);
    expect(travelledSecond / travelled).toBeLessThan(0.6);

    // Pause and step.
    await page.getByTestId('pause').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('paused');

    // Change the player's speed in the inspector and keep it; change the name without keeping.
    await hierarchyRow(page, 'Spieler').click();
    const inspector = page.getByTestId('inspector');
    await inspector.getByTestId('variable-Tempo').fill('6');
    await inspector.getByTestId('variable-Tempo').press('Enter');
    await inspector.getByTestId('script-variables').getByTestId('keep-value').click();
    await expect(
      inspector.getByTestId('script-variables').getByTestId('keep-value'),
    ).toBeDisabled();
    await inspector.getByTestId('inspector-name').fill('Rennwagen');
    await inspector.getByTestId('inspector-name').press('Enter');

    // Stop: everything resets except the kept value.
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('stopped');
    await expect(page.getByTestId('app')).not.toHaveClass(/playing/);
    expect(await position(page, player)).toEqual(startPosition);
    await expect(hierarchyRow(page, 'Kugel 1')).toBeVisible();
    await expect(hierarchyRow(page, 'Spieler')).toBeVisible();
    const tempo = await page.evaluate(
      (id) => window.__blockwerk?.scene()?.objects[id]?.components[2]?.values['variables'],
      player,
    );
    expect(tempo).toEqual({ vartempo0001: 6 });
    await hierarchyRow(page, 'Spieler').click();
    await expect(page.getByTestId('variable-Tempo')).toHaveValue('6');
  });

  test('running scripts glow and block changes apply while playing (hot reload)', async ({
    editor: page,
  }) => {
    await openExample(page);
    await tab(page, 'Projekt').click();
    await page.locator('[data-folder="Assets/Block-Skripte"]').click();
    // The spheres turn every frame, so their script glows all the time while playing.
    await page.getByTestId('asset-Einsammeln').dblclick();
    const editor = blocks(page);
    await expect(editor.getByText('Jeden Frame').first()).toBeVisible();
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Block-Editor').click();
    await expect(editor.locator('.bw-running').first()).toBeAttached();

    // Divide by 6 instead of 60 in the steering script: ten times faster, without restarting.
    await tab(page, 'Projekt').click();
    await page.getByTestId('asset-Steuerung').dblclick();
    await expect(editor.getByText('Wenn Taste').first()).toBeVisible();
    const sixty = editor
      .locator('svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas .blocklyEditableField')
      .filter({ hasText: /^60$/ })
      .first();
    await sixty.click();
    await editor.locator('.blocklyWidgetDiv input').fill('6');
    await page.keyboard.press('Enter');
    await tab(page, 'Spiel').click();
    await page.getByTestId('game-canvas').click();
    await page.keyboard.down('w');
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.__blockwerk?.liveObjects('Spieler') ?? []))[0]
            ?.position[2] ?? 0,
        { timeout: scaled(15_000) },
      )
      .toBeGreaterThan(12);
    await page.keyboard.up('w');
    await page.keyboard.press('Control+p');
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('stopped');
  });

  test('save, reload and save again: identical files, nothing written', async ({
    editor: page,
  }) => {
    await openExample(page);
    await createPrimitive(page, 'capsule');
    await page.keyboard.press('Control+s');
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().dirty)).toBe(false);
    const files = await page.evaluate(() => window.__blockwerk?.files());
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.project().name), {
        timeout: scaled(20_000),
      })
      .toBe('Hindernisparcours');
    expect(await page.evaluate(() => window.__blockwerk?.files())).toEqual(files);
    expect(await page.evaluate(() => window.__blockwerk?.project().dirty)).toBe(false);
    await page.keyboard.press('Control+s');
    await tab(page, 'Konsole').click();
    await expect(page.getByTestId('console')).toContainText(
      'Projekt gespeichert (0 Dateien geändert).',
    );
  });

  test('renaming a block script in the project window keeps the reference', async ({
    editor: page,
  }) => {
    await openExample(page);
    await tab(page, 'Projekt').click();
    await page.locator('[data-folder="Assets/Block-Skripte"]').click();
    await page.getByTestId('asset-Steuerung').click({ button: 'right' });
    await page.getByTestId('project-rename').click();
    await page.getByTestId('asset-rename-input').fill('Fahren');
    await page.getByTestId('asset-rename-input').press('Enter');
    await expect(page.getByTestId('asset-Fahren')).toBeVisible();
    await hierarchyRow(page, 'Spieler').click();
    await expect(page.getByTestId('component-blockScript-0-script')).toHaveValue('hindst000001');
    await expect(
      page.getByTestId('component-blockScript-0-script').locator('option:checked'),
    ).toHaveText('Fahren');
  });

  test('console entries jump to the block', async ({ editor: page }) => {
    // A script whose block has an invalid field value: compiling reports it with the block ID.
    const files = await page.evaluate(() => window.__blockwerk?.files() ?? {});
    const workspace = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'events.whenGameStarts',
            id: 'hat',
            x: 40,
            y: 40,
            next: {
              block: { type: 'motion.move', id: 'bad-move', fields: { direction: 'sideways' } },
            },
          },
        ],
      },
    };
    const extra: Record<string, string> = {
      'Assets/Kaputt.blocks.json': JSON.stringify({ formatVersion: 1, variables: [], workspace }),
      'Assets/Kaputt.blocks.json.meta.json': JSON.stringify({
        formatVersion: 1,
        id: 'kaputtskript',
        type: 'blockScript',
        importSettings: {},
        license: null,
      }),
    };
    await page.evaluate((all) => window.__blockwerk?.importFiles('Konsole', all), {
      ...files,
      ...extra,
    });
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await page.keyboard.press('Control+p');
    await tab(page, 'Konsole').click();
    const row = page.getByTestId('console-row').filter({ hasText: 'Ungültiger Wert' });
    await row.click();
    await expect(page.getByTestId('script-select')).toHaveValue('kaputtskript');
    await expect(blocks(page).locator('.blocklySelected')).toBeAttached();
  });
});
