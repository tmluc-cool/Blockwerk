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

  test('typing finds blocks, and an expression in a number slot builds operator blocks', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(120_000));
    await openExample(page);
    const id = await newScript(page, 'Tippen');
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();
    // A variable "x" to use in the expression.
    await page.getByTestId('add-variable').click();
    await page.getByTestId('prompt-input').fill('x');
    await page.getByTestId('prompt-ok').click();
    await expect(page.getByTestId('variable-card-x')).toBeVisible();

    const types = (): Promise<string[]> =>
      page.evaluate((assetId) => {
        const workspace = window.__blockwerk?.scriptWorkspace(assetId) as {
          blocks?: { blocks?: unknown[] };
        };
        const found: string[] = [];
        const walk = (value: unknown): void => {
          if (Array.isArray(value)) value.forEach(walk);
          else if (typeof value === 'object' && value !== null) {
            const record = value as Record<string, unknown>;
            if (typeof record['type'] === 'string') found.push(record['type']);
            Object.values(record).forEach(walk);
          }
        };
        walk(workspace?.blocks?.blocks);
        return found;
      }, id);

    // "wenn taste" + Enter inserts the event block.
    await editor.locator('.blocklyMainBackground').click({ position: { x: 300, y: 200 } });
    await page.keyboard.type('wenn taste');
    await expect(editor.getByTestId('quick-insert')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect.poll(types).toContain('events.whenKey');

    // The event block is selected, so the next block goes below it; its number field is open.
    await page.keyboard.type('gehe');
    await page.keyboard.press('Enter');
    await expect.poll(types).toContain('motion.move');
    await page.keyboard.type('x/2 + 10');
    await page.keyboard.press('Enter');
    await expect
      .poll(types)
      .toEqual(expect.arrayContaining(['operators.add', 'operators.divide', 'variables.get']));
    const code = await compiled(page, id);
    expect(code).toContain('/ 2');
    expect(code).toContain('+ 10');
  });

  test('"Extract as custom block" turns the selected blocks into a block with an input', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(120_000));
    await openExample(page);
    const id = await newScript(page, 'Auslagern');
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();
    await page.evaluate(
      (assetId) =>
        window.__blockwerk?.setScriptWorkspace(assetId, {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'events.whenGameStarts',
                id: 'x-hat',
                x: 40,
                y: 40,
                next: {
                  block: {
                    type: 'locals.declare',
                    id: 'x-decl',
                    fields: { name: 'n' },
                    inputs: {
                      value: { shadow: { type: 'literal.number', id: 'x-1', fields: { NUM: 4 } } },
                    },
                    next: {
                      block: {
                        type: 'motion.move',
                        id: 'x-move',
                        fields: { direction: 'forward' },
                        inputs: {
                          meters: {
                            block: { type: 'locals.get', id: 'x-get', fields: { name: 'n' } },
                          },
                        },
                        next: {
                          block: {
                            type: 'control.wait',
                            id: 'x-wait',
                            inputs: {
                              seconds: {
                                shadow: { type: 'literal.number', id: 'x-2', fields: { NUM: 1 } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        }),
      id,
    );
    await editor.getByText('gehe').first().click({ button: 'right' });
    await editor.getByText('Als eigenen Block auslagern').click();
    await page.getByTestId('prompt-input').fill('Gehen und warten');
    await page.getByTestId('prompt-ok').click();
    await expect
      .poll(async () => (await compiled(page, id)).includes('// custom block: Gehen und warten'))
      .toBe(true);
    const code = await compiled(page, id);
    // The call passes the local variable; the body reads its input instead of the local.
    expect(code).toMatch(/yield\* f_[0-9a-f]{8}\(self, game, l_n\);/);
    expect(code).toMatch(
      /function\* f_[0-9a-f]{8}\(self, game, p_n\) \{\n {2}self\.move\("forward", game\.num\(p_n\)\);/,
    );
    expect(code).toContain('yield* game.wait(1);');
  });

  test('renaming a variable or a message changes every script, and can be undone', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(120_000));
    await openExample(page);
    const first = await newScript(page, 'Erstes');
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();
    // A game variable in the first script, shared with the second one.
    await page.getByTestId('add-variable').click();
    await page.getByTestId('prompt-input').fill('Münzen');
    await page.getByTestId('prompt-ok').click();
    await page
      .getByTestId('variable-card-Münzen')
      .getByTestId('variable-scope')
      .selectOption('game');
    const second = await newScript(page, 'Zweites');
    await page.getByTestId('use-variable-Münzen').click();
    await expect(page.getByTestId('variable-card-Münzen')).toBeVisible();
    // Both scripts also talk about the message "los".
    for (const [id, type] of [
      [first, 'events.whenMessage'],
      [second, 'control.sendMessage'],
    ] as const) {
      await page.evaluate(
        ([assetId, blockType]) => {
          const workspace = window.__blockwerk?.scriptWorkspace(assetId ?? '') as {
            blocks?: { blocks?: unknown[] };
          };
          window.__blockwerk?.setScriptWorkspace(assetId ?? '', {
            blocks: {
              languageVersion: 0,
              blocks: [
                ...(workspace?.blocks?.blocks ?? []),
                {
                  type: blockType,
                  id: `msg-${blockType}`,
                  x: 40,
                  y: 40,
                  fields: { message: 'los' },
                },
              ],
            },
          });
        },
        [id, type],
      );
    }
    const files = (): Promise<Record<string, string>> =>
      page.evaluate(() => window.__blockwerk?.files() ?? {});
    const scriptFile = async (name: string): Promise<string> =>
      (await files())[`Assets/Block-Skripte/${name}.blocks.json`] ?? '';

    // Rename the game variable in the second script: the first one follows.
    await page.getByTestId('variable-card-Münzen').getByLabel('Name der Variable').fill('Gold');
    await page.getByTestId('variable-card-Münzen').getByLabel('Name der Variable').press('Enter');
    await expect.poll(async () => await scriptFile('Erstes')).toContain('"name": "Gold"');
    expect(await scriptFile('Zweites')).toContain('"name": "Gold"');
    expect(await scriptFile('Erstes')).not.toContain('Münzen');

    // Rename the message through the Search window.
    await page.keyboard.press('Control+Shift+F');
    await page.getByTestId('search-input').fill('los');
    await expect(page.getByTestId('search-thing-los')).toBeVisible();
    await page.getByTestId('search-thing-los').getByTestId('search-rename').click();
    await page.getByTestId('prompt-input').fill('start');
    await page.getByTestId('prompt-ok').click();
    await expect.poll(async () => await scriptFile('Erstes')).toContain('"message": "start"');
    expect(await scriptFile('Zweites')).toContain('"message": "start"');

    // One undo step takes the message back everywhere.
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('menu-undo').click();
    await expect.poll(async () => await scriptFile('Erstes')).toContain('"message": "los"');
    expect(await scriptFile('Zweites')).toContain('"message": "los"');
  });

  test('the code view shows the JavaScript of the blocks, linked to the blocks, and code blocks run', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(120_000));
    await openExample(page);
    const id = await newScript(page, 'Code');
    const editor = blocks(page);
    await expect(editor.locator('.blocklyMainBackground')).toBeVisible();
    await page.evaluate(
      (assetId) =>
        window.__blockwerk?.setScriptWorkspace(assetId, {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'events.whenGameStarts',
                id: 'c-hat',
                x: 40,
                y: 40,
                next: {
                  block: {
                    type: 'code.run',
                    id: 'c-code',
                    fields: { code: 'self.position.y += 1;' },
                    next: {
                      block: {
                        type: 'control.wait',
                        id: 'c-wait',
                        inputs: {
                          seconds: {
                            shadow: { type: 'literal.number', id: 'c-n', fields: { NUM: 2 } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        }),
      id,
    );
    await page.getByTestId('code-view-toggle').click();
    const view = page.getByTestId('code-view');
    await expect(view).toContainText('self.position.y += 1;');
    await expect(view).toContainText('yield* game.wait(2);');
    // A line selects its block, and the selected block marks its lines.
    await view.locator('.code-line', { hasText: 'game.wait(2)' }).click();
    await expect(view.locator('.code-line[data-selected="true"]')).toContainText('game.wait(2)');
    // The code view cannot be edited.
    expect(await view.locator('[contenteditable], textarea, input').count()).toBe(0);
  });

  test('the large example opens quickly, plays and its library blocks work', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(180_000));
    const started = Date.now();
    await page.getByTestId('menu-file').click();
    await page.getByTestId('menu-open-example').click();
    await page.getByTestId('choice-dialog').getByText('Handelsstadt', { exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.project().name))
      .toBe('Handelsstadt');
    const seconds = (Date.now() - started) / 1000;
    console.log(`Handelsstadt opened in ${seconds.toFixed(1)} s`);
    expect(seconds).toBeLessThan(scaled(10));
    const scripts = await page.evaluate(
      () => window.__blockwerk?.assets().filter((asset) => asset.type === 'blockScript').length,
    );
    expect(scripts).toBeGreaterThanOrEqual(80);
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Spiel').click();
    await page.getByTestId('game-canvas').focus();
    const frames = (): Promise<number> =>
      page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);
    await expect.poll(frames, { timeout: scaled(120_000) }).toBeGreaterThan(4);
    const before = await frames();
    await page.evaluate(() => window.__blockwerk?.pressKey('KeyB', true));
    await expect.poll(frames, { timeout: scaled(60_000) }).toBeGreaterThan(before + 2);
    await page.evaluate(() => window.__blockwerk?.pressKey('KeyB', false));
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.gameVars()['grossvmuenz1']), {
        timeout: scaled(60_000),
      })
      .toBe(47);
  });
});
