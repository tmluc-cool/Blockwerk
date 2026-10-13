import { expect, tab, test } from './fixtures';
import type { Page } from '@playwright/test';

/** The Blockly page inside the block editor window. */
function blocks(page: Page) {
  return page.frameLocator('iframe.block-frame');
}

/** Number fields of blocks on the workspace (not in the palette). */
function workspaceFields(page: Page) {
  return blocks(page).locator(
    'svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas .blocklyEditableField',
  );
}

test.describe('block editor and language', () => {
  test('shows the test blocks generated from defineBlock and compiles them', async ({
    editor: page,
  }) => {
    await tab(page, 'Block-Editor').click();
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();
    await expect(editor.getByText('Wenn Spiel startet').first()).toBeVisible();
    await expect(editor.getByText('Meter vorwärts').first()).toBeVisible();
    await expect(
      editor.locator('.blocklyToolboxCategoryLabel', { hasText: 'Ereignisse' }),
    ).toBeVisible();
    await expect(
      editor.locator('.blocklyToolboxCategoryLabel', { hasText: 'Bewegung' }),
    ).toBeVisible();
    const code = await page.evaluate(() => window.__blockwerk?.compiledDemoScript() ?? '');
    expect(code).toContain('self.moveLocal(0, 0, 2);');

    // Editing a number in a block updates the compiled script.
    await workspaceFields(page).first().click();
    await editor.locator('.blocklyWidgetDiv input').fill('3.5');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.compiledDemoScript() ?? ''))
      .toContain('self.moveLocal(0, 0, 3.5);');
  });

  test('works in a detached window (second screen)', async ({ editor: page }) => {
    await tab(page, 'Block-Editor').click();
    await expect(blocks(page).getByText('Meter vorwärts').first()).toBeVisible();
    const popupPromise = page.waitForEvent('popup');
    await tab(page, 'Block-Editor').click({ button: 'right' });
    await page.getByText('In eigenes Fenster abtrennen').click();
    const popup = await popupPromise;
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.panelLocation('blockEditor')))
      .toBe('popout');

    const editor = blocks(popup);
    await expect(editor.getByText('Meter vorwärts').first()).toBeVisible();
    // Palette opens, numbers can be edited, blocks can be dragged.
    await editor.locator('#motion.blocklyToolboxCategory').click();
    await expect(editor.locator('.blocklyFlyout').first()).toBeVisible();
    await editor.locator('.blocklyMainBackground').click({ position: { x: 500, y: 400 } });
    await workspaceFields(popup).first().click();
    await editor.locator('.blocklyWidgetDiv input').fill('7');
    await popup.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.compiledDemoScript() ?? ''))
      .toContain('self.moveLocal(0, 0, 7);');

    const hat = editor.getByText('Wenn Spiel startet').first();
    const before = await hat.boundingBox();
    if (!before) throw new Error('hat block not visible');
    await popup.mouse.move(before.x + 10, before.y + 5);
    await popup.mouse.down();
    await popup.mouse.move(before.x + 160, before.y + 120, { steps: 8 });
    await popup.mouse.up();
    await expect
      .poll(async () => ((await hat.boundingBox())?.x ?? 0) - before.x)
      .toBeGreaterThan(100);
  });

  test('palette puts the categories of the active area first', async ({ editor: page }) => {
    await tab(page, 'Block-Editor').click();
    const labels = blocks(page).locator('.blocklyToolboxCategoryLabel');
    await expect(labels.first()).toHaveText('Ereignisse');
    await page.getByTestId('area-player1').click();
    await expect(labels.first()).toHaveText('Bewegung');
  });

  test('switches the whole interface to English and back', async ({ editor: page }) => {
    await tab(page, 'Block-Editor').click();
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-language').click();
    await page.getByTestId('language-en').click();

    await expect(page.getByTestId('menu-bar')).toContainText('GameObject');
    await expect(tab(page, 'Hierarchy')).toBeVisible();
    await expect(tab(page, 'Scene')).toBeVisible();
    await expect(tab(page, 'Inspector')).toBeVisible();
    await expect(page.getByTestId('area-tabs')).toContainText('Player 1');
    const editor = blocks(page);
    await expect(editor.getByText('when game starts').first()).toBeVisible();
    await expect(editor.getByText('m forward').first()).toBeVisible();
    await expect(
      editor.locator('.blocklyToolboxCategoryLabel', { hasText: 'Motion' }),
    ).toBeVisible();
    // The script survives the language switch.
    expect(await page.evaluate(() => window.__blockwerk?.compiledDemoScript() ?? '')).toContain(
      'self.moveLocal(0, 0, 2);',
    );

    await tab(page, 'Console').click();
    await expect(page.getByTestId('console')).toContainText('Language switched to English.');

    // The choice is remembered.
    await page.reload();
    await expect(tab(page, 'Hierarchy')).toBeVisible();
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-language').click();
    await page.getByTestId('language-de').click();
    await expect(tab(page, 'Hierarchie')).toBeVisible();
  });

  test('light theme can be selected', async ({ editor: page }) => {
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-theme').click();
    await page.getByTestId('theme-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.dockview-theme-light')).toBeVisible();
  });
});

test.describe('shortcuts and area tabs', () => {
  test('Q W E R T Y select tools', async ({ editor: page }) => {
    for (const [key, tool] of [
      ['q', 'hand'],
      ['e', 'rotate'],
      ['r', 'scale'],
      ['t', 'rect'],
      ['y', 'transform'],
      ['w', 'move'],
    ] as const) {
      await page.keyboard.press(key);
      expect(await page.evaluate(() => window.__blockwerk?.tool())).toBe(tool);
    }
    await expect(page.getByTestId('tool-move')).toHaveAttribute('aria-checked', 'true');
  });

  test('Alt+number switches area tabs and filters the hierarchy', async ({ editor: page }) => {
    const hierarchy = page.getByTestId('hierarchy');
    await expect(hierarchy.locator('.tree-item')).toHaveCount(4);
    await page.keyboard.press('Alt+3');
    await expect(page.getByTestId('area-player1')).toHaveAttribute('aria-selected', 'true');
    await expect(hierarchy.locator('.tree-item')).toHaveText(['Testwürfel']);
    await page.keyboard.press('Alt+2');
    await expect(hierarchy.locator('.tree-item')).toHaveText(['Sonne', 'Boden']);
    await page.keyboard.press('Alt+1');
    await expect(hierarchy.locator('.tree-item')).toHaveCount(4);
  });

  test('custom area tabs can be added and renamed', async ({ editor: page }) => {
    await page.getByTestId('area-add').click();
    const input = page.locator('.area-tab-input');
    await input.fill('Quests');
    await input.press('Enter');
    await expect(page.getByTestId('area-tabs')).toContainText('Quests');
  });

  test('Ctrl+number focuses windows', async ({ editor: page }) => {
    await page.keyboard.press('Control+2');
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.activePanel('game')))
      .toBe(true);
    await page.keyboard.press('Control+1');
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.activePanel('scene')))
      .toBe(true);
  });
});
