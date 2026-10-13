import { expect, tab, test } from './fixtures';
import type { Page } from '@playwright/test';

const PANEL_TITLES = [
  'Hierarchie',
  'Szene',
  'Spiel',
  'Block-Editor',
  'Inspektor',
  'Projekt',
  'Asset-Bibliothek',
  'Konsole',
];

async function group(page: Page, id: string): Promise<string | null> {
  return page.evaluate((panelId) => window.__blockwerk?.panelGroup(panelId) ?? null, id);
}

async function location(page: Page, id: string): Promise<string | null> {
  return page.evaluate((panelId) => window.__blockwerk?.panelLocation(panelId) ?? null, id);
}

test.describe('docking layout', () => {
  test('opens with the standard layout of SPEC 5.2', async ({ editor: page }) => {
    await expect(page.getByTestId('menu-bar')).toBeVisible();
    await expect(page.getByTestId('toolbar')).toBeVisible();
    await expect(page.getByTestId('area-tabs')).toContainText('Spieler 1');
    for (const title of PANEL_TITLES) await expect(tab(page, title)).toBeVisible();
    // Scene, Game and Block Editor share the center group; Project, Asset Library, Console the bottom.
    expect(await group(page, 'game')).toBe(await group(page, 'scene'));
    expect(await group(page, 'blockEditor')).toBe(await group(page, 'scene'));
    expect(await group(page, 'console')).toBe(await group(page, 'project'));
    expect(await group(page, 'hierarchy')).not.toBe(await group(page, 'scene'));
  });

  test('windows can be moved into another group as tabs, and the layout survives a restart', async ({
    editor: page,
  }) => {
    const target = page
      .locator('.dv-groupview', { has: page.getByTestId('inspector') })
      .locator('.dv-tabs-and-actions-container');
    await tab(page, 'Konsole').dragTo(target);
    await expect.poll(() => group(page, 'console')).toBe(await group(page, 'inspector'));

    // Moving the Hierarchy to the right edge of the scene group splits it.
    const sceneContent = page
      .locator('.dv-groupview', { has: page.getByTestId('scene-view') })
      .locator('.dv-content-container');
    const box = await sceneContent.boundingBox();
    if (!box) throw new Error('no scene group');
    await tab(page, 'Hierarchie').dragTo(sceneContent, {
      targetPosition: { x: box.width - 20, y: box.height / 2 },
    });
    await expect.poll(() => group(page, 'hierarchy')).not.toBe(await group(page, 'scene'));
    const layoutBefore = await page.evaluate(() => JSON.stringify(window.__blockwerk?.layout()));

    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByTestId('scene-canvas')).toBeVisible();
    expect(await group(page, 'console')).toBe(await group(page, 'inspector'));
    const layoutAfter = await page.evaluate(() => JSON.stringify(window.__blockwerk?.layout()));
    expect(JSON.parse(layoutAfter).grid).toEqual(JSON.parse(layoutBefore).grid);
  });

  test('a window can be undocked into a floating window and into its own browser window', async ({
    editor: page,
  }) => {
    await tab(page, 'Konsole').click({ button: 'right' });
    await page.getByText('Lösen (schwebend)').click();
    await expect.poll(() => location(page, 'console')).toBe('floating');
    await expect(page.getByTestId('console')).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await tab(page, 'Inspektor').click({ button: 'right' });
    await page.getByText('In eigenes Fenster abtrennen').click();
    const popup = await popupPromise;
    await expect.poll(() => location(page, 'inspector')).toBe('popout');
    await expect(popup.getByTestId('inspector')).toBeVisible();

    // The detached window is a real editor window: selecting in the main window updates it.
    await page.getByTestId('hierarchy').getByText('Testwürfel').click();
    await expect(popup.getByTestId('inspector-name')).toHaveValue('Testwürfel');

    // Floating windows are part of the saved layout.
    await page.waitForTimeout(500);
    await page.reload();
    await expect.poll(() => location(page, 'console')).toBe('floating');
  });

  test('built-in and named layouts can be applied, saved and loaded', async ({ editor: page }) => {
    await page.getByTestId('layout-dropdown').click();
    await page.getByTestId('layout-largeBlocks').click();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.activePanel('blockEditor')))
      .toBe(true);
    await expect(page.getByTestId('block-editor')).toBeVisible();
    await expect(page.getByTestId('scene-view')).toBeVisible();
    // The block editor is now the widest window.
    const blocks = await page.getByTestId('block-editor').boundingBox();
    const scene = await page.getByTestId('scene-view').boundingBox();
    expect(blocks?.width ?? 0).toBeGreaterThan(scene?.width ?? 0);

    await page.getByTestId('layout-dropdown').click();
    await page.getByTestId('layout-save-as').click();
    await page.getByTestId('prompt-input').fill('Meine Blöcke');
    await page.getByTestId('prompt-ok').click();

    await page.getByTestId('layout-dropdown').click();
    await page.getByTestId('layout-standard').click();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.activePanel('scene')))
      .toBe(true);

    await page.getByTestId('layout-dropdown').click();
    await page.getByTestId('layout-named-Meine Blöcke').click();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.activePanel('blockEditor')))
      .toBe(true);
  });

  test('closed windows can be reopened from the Window menu', async ({ editor: page }) => {
    await tab(page, 'Konsole').click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: 'Schliessen' })
      .or(page.getByText('Schliessen', { exact: true }))
      .first()
      .click();
    await expect(tab(page, 'Konsole')).toHaveCount(0);
    await page.getByTestId('menu-window').click();
    await page.getByTestId('menu-open-window').click();
    await page.getByTestId('open-console').click();
    await expect(tab(page, 'Konsole')).toBeVisible();
  });
});
