import { expect, tab, test } from './fixtures';

test.describe('block editor and language', () => {
  test('shows the test blocks generated from defineBlock and compiles them', async ({
    editor: page,
  }) => {
    await tab(page, 'Block-Editor').click();
    const editor = page.getByTestId('block-editor');
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
  });

  test('palette puts the categories of the active area first', async ({ editor: page }) => {
    await tab(page, 'Block-Editor').click();
    const labels = page.getByTestId('block-editor').locator('.blocklyToolboxCategoryLabel');
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
    const editor = page.getByTestId('block-editor');
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
