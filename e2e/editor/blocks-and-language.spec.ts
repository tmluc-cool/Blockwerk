import type { Page } from '@playwright/test';
import { blocks, expect, openExample, tab, test } from './fixtures';

const STEERING = 'hindst000001';

/** Number fields of blocks on the workspace (not in the palette). */
function workspaceFields(page: Page) {
  return blocks(page).locator(
    'svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas .blocklyEditableField',
  );
}

/** Opens the steering script of the example by double-clicking it in the project window. */
async function openSteering(page: Page): Promise<void> {
  await openExample(page);
  await tab(page, 'Projekt').click();
  await page.locator('[data-folder="Assets/Block-Skripte"]').click();
  await page.getByTestId('asset-Steuerung').dblclick();
  await expect(page.getByTestId('script-select')).toHaveValue(STEERING);
}

function compiled(page: Page): Promise<string> {
  return page.evaluate((id) => window.__blockwerk?.compiledScript(id) ?? '', STEERING);
}

test.describe('block editor and language', () => {
  test('double-click opens a block script; edits are compiled', async ({ editor: page }) => {
    await openSteering(page);
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();
    await expect(editor.getByText('Wenn Spiel startet').first()).toBeVisible();
    await expect(editor.getByText('Wenn Taste').first()).toBeVisible();
    for (const category of [
      'Ereignisse',
      'Bewegung',
      'Steuerung',
      'Fühlen',
      'Operatoren',
      'Variablen',
    ]) {
      await expect(
        editor.locator('.blocklyToolboxCategoryLabel', { hasText: category }),
      ).toBeVisible();
    }
    expect(await compiled(page)).toContain(
      'self.move("forward", (game.num(self.vars["vartempo0001"]) / 60));',
    );
    await expect(page.getByTestId('variable-card-Tempo')).toBeVisible();

    // Editing a number in a block updates the compiled script.
    const sixty = workspaceFields(page).filter({ hasText: /^60$/ }).first();
    await sixty.click();
    await editor.locator('.blocklyWidgetDiv input').fill('30');
    await page.keyboard.press('Enter');
    await expect.poll(() => compiled(page)).toContain('/ 30));');
  });

  test('works in a detached window (second screen)', async ({ editor: page }) => {
    await openSteering(page);
    await expect(blocks(page).getByText('Wenn Spiel startet').first()).toBeVisible();
    const popupPromise = page.waitForEvent('popup');
    await tab(page, 'Block-Editor').click({ button: 'right' });
    await page.getByText('In eigenes Fenster abtrennen').click();
    const popup = await popupPromise;
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.panelLocation('blockEditor')))
      .toBe('popout');

    const editor = blocks(popup);
    await expect(editor.getByText('Wenn Spiel startet').first()).toBeVisible();
    // Palette opens, numbers can be edited, blocks can be dragged.
    await editor.locator('#motion.blocklyToolboxCategory').click();
    await expect(editor.locator('.blocklyFlyout').first()).toBeVisible();
    // Click empty workspace right of the open palette to close it.
    const workspaceBox = await editor.locator('.blocklyMainBackground').boundingBox();
    if (!workspaceBox) throw new Error('no workspace');
    await popup.mouse.click(
      workspaceBox.x + workspaceBox.width - 60,
      workspaceBox.y + workspaceBox.height - 60,
    );
    await workspaceFields(popup).filter({ hasText: /^60$/ }).first().click();
    await editor.locator('.blocklyWidgetDiv input').fill('7');
    await popup.keyboard.press('Enter');
    await expect.poll(() => compiled(page)).toContain('/ 7));');

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
    await openSteering(page);
    const labels = blocks(page).locator('.blocklyToolboxCategoryLabel');
    await expect(labels.first()).toHaveText('Ereignisse');
    await page.getByTestId('area-player1').click();
    await expect(labels.first()).toHaveText('Spieler');
  });

  test('switches the whole interface to English and back', async ({ editor: page }) => {
    await openSteering(page);
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
    await expect(editor.getByText('when').first()).toBeVisible();
    await expect(
      editor.locator('.blocklyToolboxCategoryLabel', { hasText: 'Motion' }),
    ).toBeVisible();
    // The script survives the language switch.
    expect(await compiled(page)).toContain('/ 60));');

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
    await expect(hierarchy.locator('.tree-item')).toHaveCount(9);
    await page.keyboard.press('Alt+3');
    await expect(page.getByTestId('area-player1')).toHaveAttribute('aria-selected', 'true');
    await expect(hierarchy.locator('.tree-item')).toHaveText(['Spieler 1', 'Hauptkamera']);
    await page.keyboard.press('Alt+2');
    await expect(hierarchy.locator('.tree-item')).toHaveText(['Umgebung', 'Sonne', 'Boden']);
    await page.keyboard.press('Alt+1');
    await expect(hierarchy.locator('.tree-item')).toHaveCount(9);
  });

  test('custom area tabs can be added and renamed', async ({ editor: page }) => {
    await page.getByTestId('area-add').click();
    const input = page.locator('.area-tab-input');
    await input.fill('Quests');
    await input.press('Enter');
    await expect(page.getByTestId('area-tabs')).toContainText('Quests');
    // The tab is a root object of the scene and new objects land in it.
    await expect(page.getByTestId('hierarchy').locator('.tree-item')).toHaveText(['Quests']);
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
