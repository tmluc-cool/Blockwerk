import type { Page } from '@playwright/test';
import { createPrimitive, expect, objectId, tab, test } from './fixtures';

const LANTERN = 'kaykit-city/streetlight';

/** Opens the asset library window and searches it. */
async function searchLibrary(page: Page, query: string): Promise<void> {
  await tab(page, 'Asset-Bibliothek').click();
  await expect(page.getByTestId('library-search')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('library-search').fill(query);
}

/** Model reference of the Mesh Renderer of an object. */
function modelOf(page: Page, id: string): Promise<unknown> {
  return page.evaluate((objectId) => {
    const object = window.__blockwerk?.scene()?.objects[objectId];
    return object?.components.find((component) => component.type === 'meshRenderer')?.values[
      'model'
    ];
  }, id);
}

test.describe('phase 2: asset library', () => {
  test('search in German and English, preview, favorites, place in scene', async ({
    editor: page,
  }) => {
    await searchLibrary(page, 'laterne');
    const tile = page.getByTestId(`library-tile-${LANTERN}`);
    await expect(tile).toBeVisible();
    await page.getByTestId('library-search').fill('streetlight');
    await expect(tile).toBeVisible();
    await tile.click();
    await expect(page.getByTestId('library-details')).toContainText('CC0-1.0');
    await expect(page.getByTestId('library-preview')).toBeVisible();

    await page.getByTestId('library-favorite').click();
    await page.getByTestId('library-search').fill('');
    await page.getByTestId('library-category-favorites').click();
    await expect(page.locator('.library-tile')).toHaveCount(1);

    await page.getByTestId('library-place').click();
    const id = await page.evaluate(() => window.__blockwerk?.selection());
    expect(id).toBeTruthy();
    expect(await modelOf(page, id ?? '')).toBe(`library:${LANTERN}`);
    await page.getByTestId('library-category-recent').click();
    await expect(page.locator('.library-tile')).toHaveCount(1);
  });

  test('dragging a model into the scene puts it on the ground under the mouse', async ({
    editor: page,
  }) => {
    await searchLibrary(page, 'laterne');
    const tile = page.getByTestId(`library-tile-${LANTERN}`);
    const target = await page.getByTestId('scene-drop').boundingBox();
    if (!target) throw new Error('no scene view');
    // Below the middle of the view, where the camera looks at the ground.
    await tile.dragTo(page.getByTestId('scene-drop'), {
      targetPosition: { x: target.width / 2, y: target.height * 0.7 },
    });
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.selection())).toBeTruthy();
    const id = (await page.evaluate(() => window.__blockwerk?.selection())) ?? '';
    expect(await modelOf(page, id)).toBe(`library:${LANTERN}`);
    const position = await page.evaluate(
      (objectId) => window.__blockwerk?.scene()?.objects[objectId]?.transform.position,
      id,
    );
    // Stands on the ground (y = 0), not floating at the camera pivot.
    expect(position?.[1]).toBeCloseTo(0, 2);
  });
});

test('the model field picks a library model and accepts dropped models', async ({
  editor: page,
}) => {
  await searchLibrary(page, 'laterne');
  await page.getByTestId(`library-tile-${LANTERN}`).dblclick();
  const id = (await page.evaluate(() => window.__blockwerk?.selection())) ?? '';
  const field = page.getByTestId('component-meshRenderer-0-model');
  await expect(field).toContainText('Strassenlaterne');
  // Shape and material are hidden while a model is set.
  await expect(page.getByTestId('component-meshRenderer-0-shape')).toHaveCount(0);
  await field.click();
  await page
    .getByTestId('component-meshRenderer-0-model-picker')
    .locator('input')
    .fill('baum tot klein');
  await page.getByTestId('model-option-kaykit-halloween/tree-dead-small').click();
  expect(await modelOf(page, id)).toBe('library:kaykit-halloween/tree-dead-small');

  await page.getByTestId('library-search').fill('kiefer orange gross');
  await page.getByTestId('library-tile-kaykit-halloween/tree-pine-orange-large').dragTo(field);
  await expect
    .poll(() => modelOf(page, id))
    .toBe('library:kaykit-halloween/tree-pine-orange-large');
});

/** Values of a component of an object in the open scene. */
function componentValues(page: Page, id: string, type: string) {
  return page.evaluate(
    ([objectId, componentType]) =>
      window.__blockwerk
        ?.scene()
        ?.objects[objectId ?? '']?.components.find((component) => component.type === componentType)
        ?.values ?? null,
    [id, type],
  );
}

/** IDs of the instance roots of a prefab in the open scene. */
function instanceRoots(page: Page, prefabName: string) {
  return page.evaluate((name) => {
    const scene = window.__blockwerk?.scene();
    const prefab = window.__blockwerk
      ?.assets()
      .find((asset) => asset.type === 'prefab' && asset.name === name);
    return Object.entries(scene?.objects ?? {})
      .filter(([, object]) => object.prefab?.asset === prefab?.id && object.prefab?.overrides)
      .map(([id]) => id)
      .sort();
  }, prefabName);
}

/** Sets a number field of the inspector. */
async function setNumber(page: Page, testId: string, value: string): Promise<void> {
  const input = page.getByTestId(testId);
  await input.fill(value);
  await input.press('Enter');
}

test('prefab "Laterne": changes reach all instances, an override stays, a variant inherits', async ({
  editor: page,
}) => {
  // A lantern: cube renamed to "Laterne".
  await createPrimitive(page, 'cube');
  await page.getByTestId('inspector-name').fill('Laterne');
  await page.getByTestId('inspector-name').press('Enter');
  const first = await objectId(page, 'Laterne');

  // Dragging it into the project window makes a prefab; the object turns blue.
  await tab(page, 'Projekt').click();
  await page
    .getByTestId('hierarchy')
    .locator(`[data-object-id="${first}"]`)
    .dragTo(page.getByTestId('project-content'));
  await expect(page.getByTestId('asset-Laterne')).toBeVisible();
  await expect(page.getByTestId('hierarchy').locator(`[data-object-id="${first}"]`)).toHaveClass(
    /prefab-instance/,
  );

  // Two more instances dragged into the scene.
  for (const y of [0.35, 0.65]) {
    const target = await page.getByTestId('scene-drop').boundingBox();
    if (!target) throw new Error('no scene view');
    await page.getByTestId('asset-Laterne').dragTo(page.getByTestId('scene-drop'), {
      targetPosition: { x: target.width * y, y: target.height * 0.75 },
    });
  }
  await expect.poll(() => instanceRoots(page, 'Laterne')).toHaveLength(3);
  const roots = await instanceRoots(page, 'Laterne');
  const other = roots.find((id) => id !== first) ?? '';

  // One instance gets a blue color: an override, shown in the inspector.
  await page.getByTestId('hierarchy').locator(`[data-object-id="${other}"]`).click();
  await page.getByTestId('component-meshRenderer-0-color').fill('#3366ff');
  await expect(page.getByTestId('prefab-overrides')).toHaveText(/\(1\)/);

  // Prefab mode: the lantern becomes metallic.
  await page.getByTestId('prefab-open').click();
  await expect(page.getByTestId('prefab-stage')).toContainText('Laterne');
  await page
    .getByTestId('hierarchy')
    .locator('.tree-item', { hasText: /^Laterne$/ })
    .click();
  await setNumber(page, 'component-meshRenderer-0-metallic', '0.8');
  await page.getByTestId('prefab-back').click();
  await expect(page.getByTestId('prefab-stage')).toHaveCount(0);

  for (const id of roots) {
    await expect
      .poll(async () => (await componentValues(page, id, 'meshRenderer'))?.['metallic'])
      .toBe(0.8);
  }
  expect((await componentValues(page, other, 'meshRenderer'))?.['color']).toBe('#3366ff');
  expect((await componentValues(page, first, 'meshRenderer'))?.['color']).not.toBe('#3366ff');

  // Variant "Laterne Variante" is red and inherits later changes of the base.
  await page.getByTestId('asset-Laterne').click({ button: 'right' });
  await page.getByTestId('project-create-variant').click();
  await expect(page.getByTestId('asset-Laterne Variante')).toBeVisible();
  await page.getByTestId('asset-Laterne Variante').dblclick();
  await expect(page.getByTestId('prefab-stage')).toContainText('Laterne Variante');
  await page
    .getByTestId('hierarchy')
    .locator('.tree-item', { hasText: /^Laterne$/ })
    .click();
  await page.getByTestId('component-meshRenderer-0-color').fill('#ff0000');
  await page.getByTestId('prefab-back').click();
  const target = await page.getByTestId('scene-drop').boundingBox();
  if (!target) throw new Error('no scene view');
  await page.getByTestId('asset-Laterne Variante').dragTo(page.getByTestId('scene-drop'), {
    targetPosition: { x: target.width * 0.5, y: target.height * 0.85 },
  });
  await expect.poll(() => instanceRoots(page, 'Laterne Variante')).toHaveLength(1);
  const [red] = await instanceRoots(page, 'Laterne Variante');

  await page.getByTestId('asset-Laterne').dblclick();
  await page
    .getByTestId('hierarchy')
    .locator('.tree-item', { hasText: /^Laterne$/ })
    .click();
  await setNumber(page, 'component-meshRenderer-0-metallic', '0.3');
  await page.getByTestId('prefab-back').click();
  await expect
    .poll(async () => componentValues(page, red ?? '', 'meshRenderer'))
    .toMatchObject({ color: '#ff0000', metallic: 0.3 });
  expect((await componentValues(page, other, 'meshRenderer'))?.['color']).toBe('#3366ff');

  // Saving and reloading keeps everything.
  await page.evaluate(() => window.__blockwerk?.save());
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.project().status), { timeout: 20_000 })
    .toBe('ready');
  expect(await instanceRoots(page, 'Laterne')).toHaveLength(3);
  expect((await componentValues(page, red ?? '', 'meshRenderer'))?.['color']).toBe('#ff0000');
});

test('the brush spreads trees with spacing; one stroke is one undo step', async ({
  editor: page,
}) => {
  await searchLibrary(page, 'baum tot klein');
  await page.getByTestId('library-tile-kaykit-halloween/tree-dead-small').click();
  await page.getByTestId('brush-toggle').click();
  await setNumber(page, 'brush-radius', '4');
  await setNumber(page, 'brush-spacing', '1.5');
  await expect(page.getByTestId('brush-hint')).toContainText('Baum Tot Klein');

  const box = await page.getByTestId('scene-canvas').boundingBox();
  if (!box) throw new Error('no scene view');
  const count = () =>
    page.evaluate(
      () =>
        Object.values(window.__blockwerk?.scene()?.objects ?? {}).filter((object) =>
          object.components.some(
            (component) => component.values['model'] === 'library:kaykit-halloween/tree-dead-small',
          ),
        ).length,
    );
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.75);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.75, { steps: 12 });
  await page.mouse.up();
  const painted = await count();
  expect(painted).toBeGreaterThan(5);
  // Trees stand on the ground and keep their distance.
  const positions = await page.evaluate(() =>
    Object.values(window.__blockwerk?.scene()?.objects ?? {})
      .filter((object) =>
        object.components.some((component) =>
          String(component.values['model']).includes('tree-dead-small'),
        ),
      )
      .map((object) => object.transform.position),
  );
  for (const a of positions) {
    expect(a[1]).toBeCloseTo(0, 2);
    for (const b of positions) {
      if (a !== b) expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThanOrEqual(1.49);
    }
  }
  await page.keyboard.press('Control+z');
  await expect.poll(count).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('brush-hint')).toHaveCount(0);
});

/** A 1 × 2 × 1 m box as an OBJ file (Y up, corner at the origin). */
const BOX_OBJ = [
  'v 0 0 0',
  'v 1 0 0',
  'v 1 2 0',
  'v 0 2 0',
  'v 0 0 1',
  'v 1 0 1',
  'v 1 2 1',
  'v 0 2 1',
  'f 1 2 3 4',
  'f 5 8 7 6',
  'f 1 5 6 2',
  'f 2 6 7 3',
  'f 3 7 8 4',
  'f 4 8 5 1',
].join('\n');

test('imports an OBJ model with import settings and places it with a collider', async ({
  editor: page,
}) => {
  await tab(page, 'Projekt').click();
  await page.getByTestId('project-create-button').click();
  await page.getByTestId('project-create').hover();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('project-import-model').click();
  await (
    await chooser
  ).setFiles({ name: 'Kiste.obj', mimeType: 'text/plain', buffer: Buffer.from(BOX_OBJ) });
  await expect(page.getByTestId('asset-Kiste')).toBeVisible();
  const asset = await page.evaluate(
    () => window.__blockwerk?.assets().find((item) => item.name === 'Kiste')?.path,
  );
  expect(asset).toBe('Assets/Kiste.glb');

  // Import inspector: size, then twice the scale.
  await page.getByTestId('asset-Kiste').click();
  await expect(page.getByTestId('model-size')).toContainText('1.00 × 2.00 × 1.00');
  await page.getByTestId('import-scale').fill('2');
  await page.getByTestId('import-scale').press('Enter');
  await expect(page.getByTestId('model-size')).toContainText('2.00 × 4.00 × 2.00');

  // Dragged into the scene: stands on the ground with a box collider of its size.
  const target = await page.getByTestId('scene-drop').boundingBox();
  if (!target) throw new Error('no scene view');
  await page.getByTestId('asset-Kiste').dragTo(page.getByTestId('scene-drop'), {
    targetPosition: { x: target.width / 2, y: target.height * 0.7 },
  });
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.selection())).toBeTruthy();
  const id = (await page.evaluate(() => window.__blockwerk?.selection())) ?? '';
  await expect
    .poll(async () => (await componentValues(page, id, 'boxCollider'))?.['size'])
    .toEqual([2, 4, 2]);
  expect((await componentValues(page, id, 'boxCollider'))?.['center']).toEqual([0, 2, 0]);
});

test('"My Prefabs" carries a prefab with its model into another project', async ({
  editor: page,
}) => {
  // A crate model and a prefab using it.
  await tab(page, 'Projekt').click();
  await page.getByTestId('project-create-button').click();
  await page.getByTestId('project-create').hover();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('project-import-model').click();
  await (
    await chooser
  ).setFiles({ name: 'Kiste.obj', mimeType: 'text/plain', buffer: Buffer.from(BOX_OBJ) });
  await page.getByTestId('asset-Kiste').dblclick();
  const target = await page.getByTestId('scene-drop').boundingBox();
  if (!target) throw new Error('no scene view');
  await page.getByTestId('asset-Kiste').dragTo(page.getByTestId('scene-drop'), {
    targetPosition: { x: target.width / 2, y: target.height * 0.7 },
  });
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.selection())).toBeTruthy();
  const crate = (await page.evaluate(() => window.__blockwerk?.selection())) ?? '';
  await page
    .getByTestId('hierarchy')
    .locator(`[data-object-id="${crate}"]`)
    .dragTo(page.getByTestId('project-content'));
  await expect(page.getByTestId('asset-Kiste').nth(1)).toBeVisible();
  await page.locator('[data-testid="asset-Kiste"]', { has: page.locator('.prefab-icon') }).click({
    button: 'right',
  });
  await page.getByTestId('project-add-my-prefab').click();
  await tab(page, 'Konsole').click();
  await expect(page.getByTestId('console')).toContainText('Meine Prefabs');

  // A new project gets the prefab and the model it needs.
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-new-project').click();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.assets().length)).toBe(1);
  await tab(page, 'Asset-Bibliothek').click();
  await page.getByTestId('library-category-mine').click();
  await page.getByTestId('my-prefab-Kiste').click();
  await page.getByTestId('my-prefab-place').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__blockwerk
          ?.assets()
          .map((asset) => asset.type)
          .sort(),
      ),
    )
    .toEqual(['model', 'prefab', 'scene']);
  const selected = (await page.evaluate(() => window.__blockwerk?.selection())) ?? '';
  expect(
    await page.evaluate(
      (id) => window.__blockwerk?.scene()?.objects[id]?.prefab?.overrides,
      selected,
    ),
  ).toEqual([]);
});

test('a village of houses, a well, fences and 200 trees is built from the library and plays', async ({
  editor: page,
}) => {
  test.setTimeout(15 * 60_000);
  const started = Date.now();
  const scene = page.getByTestId('scene-drop');
  const box = await scene.boundingBox();
  if (!box) throw new Error('no scene view');
  // Look at the ground from above so drops land on it.
  await page.locator('.axis-gizmo-handle[data-view="top"]').click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  const at = (u: number, v: number) => ({ x: box.width * u, y: box.height * v });

  const drop = async (query: string, id: string, u: number, v: number): Promise<void> => {
    await page.getByTestId('library-search').fill(query);
    await page.getByTestId(`library-tile-${id}`).dragTo(scene, { targetPosition: at(u, v) });
  };
  await searchLibrary(page, '');
  const houses = [
    ['haus a blau', 'kaykit-medieval-hexagon/building-home-a-blue'],
    ['haus b rot', 'kaykit-medieval-hexagon/building-home-b-red'],
    ['taverne blau', 'kaykit-medieval-hexagon/building-tavern-blue'],
    ['kirche blau', 'kaykit-medieval-hexagon/building-church-blue'],
    ['haus a gelb', 'kaykit-medieval-hexagon/building-home-a-yellow'],
    ['schmiede blau', 'kaykit-medieval-hexagon/building-blacksmith-blue'],
    ['markt blau', 'kaykit-medieval-hexagon/building-market-blue'],
    ['haus b gelb', 'kaykit-medieval-hexagon/building-home-b-yellow'],
  ] as const;
  for (const [index, [query, id]] of houses.entries()) {
    const angle = (index / houses.length) * Math.PI * 2;
    await drop(query, id, 0.5 + Math.cos(angle) * 0.22, 0.5 + Math.sin(angle) * 0.3);
  }
  await drop('brunnen blau', 'kaykit-medieval-hexagon/building-well-blue', 0.5, 0.5);
  for (const u of [0.2, 0.3, 0.4, 0.6, 0.7, 0.8]) {
    await drop('zaun einzeln', 'kaykit-halloween/fence-seperate', u, 0.92);
  }

  // 200 trees with the brush around the village.
  await page.getByTestId('library-search').fill('baum einzeln a');
  await page.getByTestId('library-tile-kaykit-medieval-hexagon/tree-single-a').click();
  await page.getByTestId('brush-toggle').click();
  await setNumber(page, 'brush-radius', '6');
  await setNumber(page, 'brush-spacing', '2');
  const trees = () =>
    page.evaluate(
      () =>
        Object.values(window.__blockwerk?.scene()?.objects ?? {}).filter((object) =>
          object.components.some((component) =>
            String(component.values['model']).includes('tree-single-a'),
          ),
        ).length,
    );
  for (let row = 0; (await trees()) < 200 && row < 12; row++) {
    const v = 0.06 + (row % 6) * 0.17;
    const side = row < 6 ? [0.02, 0.2] : [0.8, 0.98];
    await page.mouse.move(box.x + box.width * (side[0] ?? 0), box.y + box.height * v);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * (side[1] ?? 0), box.y + box.height * v, { steps: 8 });
    await page.mouse.up();
  }
  await page.keyboard.press('Escape');
  expect(await trees()).toBeGreaterThanOrEqual(200);
  const buildMinutes = (Date.now() - started) / 60_000;
  expect(buildMinutes).toBeLessThan(15);

  // Play: equal models are drawn together, so draw calls stay low.
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(5);
  const performance = await page.evaluate(() => window.__blockwerk?.playPerformance());
  console.log(
    `village built in ${buildMinutes.toFixed(1)} min; play:`,
    JSON.stringify(performance),
  );
  expect(performance?.drawCalls).toBeGreaterThan(0);
  expect(performance?.drawCalls).toBeLessThan(80);
  // Play again stops (like Unity).
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('stopped');
});
