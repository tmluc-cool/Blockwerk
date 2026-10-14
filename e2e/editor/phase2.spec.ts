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
