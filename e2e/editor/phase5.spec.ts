import type { Page } from '@playwright/test';
import { expect, scaled, tab, test } from './fixtures';

/** Acceptance of phase 5 in the editor: Navigation window, NPCs, dialogs, quest example. */

/** Opens a bundled example by its project name. */
async function openExample(page: Page, name: string): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText(name, { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe(name);
}

/** Opens a window from the Window menu. */
async function openWindow(page: Page, id: string): Promise<void> {
  await page.getByTestId('menu-window').click();
  await page.getByTestId('menu-open-window').hover();
  await page.getByTestId(`open-${id}`).click();
  await expect(page.getByTestId(id)).toBeVisible();
}

test.describe('phase 5', () => {
  test('the Navigation window bakes a mesh of the scene and shows its size', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(120_000));
    await openExample(page, 'Hindernisparcours');
    await openWindow(page, 'navigation');
    await expect(page.getByTestId('navigation-status')).toContainText(/Noch kein|No navigation/);
    await page.getByTestId('navigation-bake').click();
    await expect(page.getByTestId('navigation-status')).toContainText(/\d+ (Dreiecke|triangles)/);
    // Changing the agent size is a scene edit with undo.
    await page.getByTestId('navigation-radius').fill('1.2');
    await expect
      .poll(() =>
        page.evaluate(() => window.__blockwerk?.scene()?.environment.navigation?.agentRadius),
      )
      .toBeCloseTo(1.2, 1);
    // Focus leaves the slider, so the shortcut reaches the editor.
    await page.getByTestId('navigation').locator('h4').first().click();
    await page.keyboard.press('Control+z');
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.scene()?.environment.navigation))
      .toBeUndefined();
  });

  test('the quest example: zombies patrol, Mira gives the quest in a dialog, the crypt loads with a loading screen', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(300_000));
    await openExample(page, 'Quest');
    // The project starts in the main menu; this test plays in the village.
    expect(await page.evaluate(() => window.__blockwerk?.openSceneByName('Dorf'))).toBe(true);
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Spiel').click();
    await page.getByTestId('game-canvas').focus();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0), {
        timeout: scaled(120_000),
      })
      .toBeGreaterThan(4);
    const probe = () => page.evaluate(() => window.__blockwerk?.questProbe());
    const frames = () => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);
    // Holds the key for two drawn frames, so the (slow, software-rendered) game sees the press.
    const press = async (code: string) => {
      const before = await frames();
      await page.evaluate((key) => window.__blockwerk?.pressKey(key, true), code);
      await expect.poll(frames, { timeout: scaled(30_000) }).toBeGreaterThan(before + 2);
      await page.evaluate((key) => window.__blockwerk?.pressKey(key, false), code);
    };
    // Both zombies patrol; their state is visible (labels above them in the game).
    await expect
      .poll(async () => (await probe())?.npcStates)
      .toMatchObject({ 'Zombie A': 'patrol', 'Zombie B': 'patrol' });
    // Mira: the hint appears, E opens the dialog box, clicking the answers accepts the quest.
    await page.evaluate(() => window.__blockwerk?.teleportLive('Ritter', [-8, 0, -10.4]));
    await expect.poll(async () => (await probe())?.hint, { timeout: scaled(30_000) }).toBe('talk');
    await press('KeyE');
    await expect(page.getByTestId('dialog-box')).toBeVisible();
    await page.getByTestId('dialog-answer-0').click();
    await page.getByTestId('dialog-answer-0').click();
    await page.getByTestId('dialog-continue').click();
    await expect(page.getByTestId('dialog-box')).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.gameVars()['questvarstat']))
      .toBe(1);
    // The key from the chest, then into the crypt: the loading screen shows and the key stays.
    await page.evaluate(() => window.__blockwerk?.teleportLive('Ritter', [4.5, 0, -8.2]));
    await expect.poll(async () => (await probe())?.hint, { timeout: scaled(30_000) }).toBe('open');
    await press('KeyE');
    await expect.poll(async () => (await probe())?.items['Schlüssel']).toBe(1);
    const village = (await probe())?.scene;
    await page.evaluate(() => window.__blockwerk?.teleportLive('Ritter', [0, 1, 34.5]));
    await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: scaled(30_000) });
    await expect(page.getByTestId('loading-title')).toContainText('Gruft');
    await expect
      .poll(async () => (await probe())?.scene, { timeout: scaled(60_000) })
      .not.toBe(village);
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: scaled(30_000) });
    expect((await probe())?.items['Schlüssel']).toBe(1);
    expect(await page.evaluate(() => window.__blockwerk?.gameVars()['questvarstat'])).toBe(1);
  });

  test('a dialog is made in the Dialog editor and saved in the project', async ({
    editor: page,
  }) => {
    await tab(page, 'Projekt').click();
    await page.getByTestId('project-create-button').click();
    await page.getByTestId('project-create').hover();
    await page.getByTestId('project-create-dialog').click();
    await page.getByTestId('prompt-input').fill('Haendler');
    await page.getByTestId('prompt-ok').click();
    await expect(page.getByTestId('asset-Haendler')).toBeVisible();
    await page.getByTestId('asset-Haendler').dblclick();
    await expect(page.getByTestId('dialog-name')).toHaveText('Haendler');
    await page.getByTestId('dialog-line-0-speaker').fill('Karl');
    await page.getByTestId('dialog-line-0-text').fill('Gute Ware, billig!');
    await page.getByTestId('dialog-line-0-add-answer').click();
    await page.getByTestId('dialog-line-0-answer-0-text').fill('Kaufen');
    await page.getByTestId('dialog-line-0-answer-0-id').fill('kaufen');
    await page.getByTestId('dialog-line-0-answer-0-actions-add').click();
    await page.getByTestId('dialog-line-0-answer-0-actions-0-item').fill('Trank');
    await page.getByTestId('dialog-line-0-answer-0-condition-type').selectOption('hasItem');
    const dialog = async () =>
      page.evaluate(() => {
        const files = window.__blockwerk?.files() ?? {};
        const path = Object.keys(files).find((name) => name.endsWith('.dialog.json'));
        return path ? (JSON.parse(files[path] ?? '{}') as Record<string, unknown>) : null;
      });
    await expect
      .poll(async () => JSON.stringify((await dialog())?.['nodes'] ?? {}))
      .toContain('"Trank"');
    const nodes = (await dialog())?.['nodes'] as Record<
      string,
      { speaker: string; answers: { id: string; condition?: { type: string } }[] }
    >;
    const first = Object.values(nodes)[0];
    expect(first?.speaker).toBe('Karl');
    expect(first?.answers[0]?.id).toBe('kaufen');
    expect(first?.answers[0]?.condition?.type).toBe('hasItem');
  });
});
