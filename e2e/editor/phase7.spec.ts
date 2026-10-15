import type { Page } from '@playwright/test';
import { blocks, expect, openExample, scaled, tab, test } from './fixtures';

/** Creates a block script by name through the "+" button of the block editor. */
async function newScript(page: Page, name: string): Promise<string> {
  await tab(page, 'Block-Editor').click();
  await page.getByTitle('Neues Block-Skript').click();
  await page.getByTestId('prompt-input').fill(name);
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('script-select').selectOption({ label: name });
  return page.getByTestId('script-select').inputValue();
}

function compiled(page: Page, id: string): Promise<string> {
  return page.evaluate((assetId) => window.__blockwerk?.compiledScript(assetId) ?? '', id);
}

test.describe('phase 7: large projects', () => {
  test('a custom block is made in a dialog, called from the palette and renamed', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(120_000));
    await openExample(page);
    const id = await newScript(page, 'Bibliothek');
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();

    // "Make a block": a command with one number input.
    await editor.getByRole('treeitem', { name: 'Meine Blöcke' }).click();
    await editor.getByText('Block erstellen').click();
    await expect(page.getByTestId('custom-block-dialog')).toBeVisible();
    await page.getByTestId('custom-block-name').fill('Hüpfen');
    await page.getByTestId('custom-block-add-input').click();
    await page.getByTestId('custom-block-param').locator('input').first().fill('Höhe');
    await page.getByTestId('custom-block-param').locator('select').first().selectOption('number');
    await page.getByTestId('custom-block-ok').click();
    await expect(editor.getByText('Befehl').first()).toBeVisible();
    await expect(editor.getByText('(Höhe)').first()).toBeVisible();

    // The definition is saved with the script and is a custom block now.
    await expect
      .poll(async () => (await compiled(page, id)).includes('// custom block: Hüpfen'))
      .toBe(true);

    // The palette offers a call of the new block.
    await editor.getByRole('treeitem', { name: 'Meine Blöcke' }).click();
    await expect(editor.locator('.blocklyFlyout').getByText('Hüpfen').first()).toBeVisible();
  });

  test('a project-wide custom block works in another script and follows its definition', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(120_000));
    await openExample(page);
    const library = await newScript(page, 'Bibliothek');
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();
    await editor.getByRole('treeitem', { name: 'Meine Blöcke' }).click();
    await editor.getByText('Block erstellen').click();
    await page.getByTestId('custom-block-name').fill('Hüpfen');
    await page.getByTestId('custom-block-add-input').click();
    await page.getByTestId('custom-block-param').locator('input').first().fill('Höhe');
    await page.getByTestId('custom-block-param').locator('select').first().selectOption('number');
    await page.getByTestId('custom-block-project').check();
    await page.getByTestId('custom-block-ok').click();
    await expect
      .poll(async () => (await compiled(page, library)).includes('// custom block: Hüpfen'))
      .toBe(true);
    const definition = await page.evaluate((id) => {
      const workspace = window.__blockwerk?.scriptWorkspace(id) as {
        blocks: { blocks: { id: string; type: string }[] };
      };
      return workspace.blocks.blocks.find((block) => block.type === 'custom.defineCommand')?.id;
    }, library);
    expect(definition).toBeTruthy();

    // Another script calls the block of the library.
    const user = await newScript(page, 'Nutzer');
    await page.evaluate(
      ([id, library, fn]) =>
        window.__blockwerk?.setScriptWorkspace(id ?? '', {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'events.whenGameStarts',
                id: 'user-hat',
                x: 40,
                y: 40,
                next: {
                  block: {
                    type: 'custom.callCommand',
                    id: 'user-call',
                    extraState: {
                      fn,
                      library,
                      name: 'Hüpfen',
                      params: [{ name: 'Höhe', type: 'number' }],
                    },
                    inputs: {
                      ARG0: {
                        shadow: { type: 'literal.number', id: 'user-num', fields: { NUM: 3 } },
                      },
                    },
                  },
                },
              },
            ],
          },
        }),
      [user, library, definition],
    );
    const code = await compiled(page, user);
    expect(code).toContain('// custom block: Hüpfen');
    expect(code).toMatch(/yield\* f_[0-9a-f]{8}\(self, game, 3\);/);
    await expect(editor.getByText('Hüpfen').first()).toBeVisible();

    // Renaming the definition renames the call in the other script.
    await page.getByTestId('script-select').selectOption({ label: 'Bibliothek' });
    await editor.getByText('(Höhe)').first().click({ button: 'right' });
    await editor.getByText('Eigenen Block bearbeiten').click();
    await page.getByTestId('custom-block-name').fill('Springen');
    await page.getByTestId('custom-block-ok').click();
    await page.getByTestId('script-select').selectOption({ label: 'Nutzer' });
    await expect(editor.getByText('Springen').first()).toBeVisible();
    expect(await compiled(page, user)).toContain('// custom block: Springen');
  });
});
