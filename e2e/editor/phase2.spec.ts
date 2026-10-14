import type { Page } from '@playwright/test';
import { expect, tab, test } from './fixtures';

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
