import type { Page } from '@playwright/test';
import { expect, scaled, tab, test } from './fixtures';

/** Acceptance of phase 6 in the editor: menus, settings, saving, UI Editor. */

async function openExample(page: Page, name: string): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText(name, { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe(name);
}

test.describe('phase 6', () => {
  test('main menu → village → pause menu → settings → save → load restores the place', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(300_000));
    await openExample(page, 'Quest');
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Spiel').click();
    await page.getByTestId('game-canvas').focus();
    const frames = () => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);
    await expect.poll(frames, { timeout: scaled(120_000) }).toBeGreaterThan(4);
    const probe = () => page.evaluate(() => window.__blockwerk?.questProbe());
    const press = async (code: string) => {
      const before = await frames();
      await page.evaluate((key) => window.__blockwerk?.pressKey(key, true), code);
      await expect.poll(frames, { timeout: scaled(30_000) }).toBeGreaterThan(before + 2);
      await page.evaluate((key) => window.__blockwerk?.pressKey(key, false), code);
    };
    // Main menu with play, settings, quit and the three load slots.
    await expect(page.getByRole('button', { name: 'Spielen' })).toBeVisible({
      timeout: scaled(60_000),
    });
    await expect(page.getByRole('button', { name: /^Laden [123]$/ })).toHaveCount(3);
    const menu = (await probe())?.scene;
    await page.getByRole('button', { name: 'Spielen' }).click();
    await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: scaled(60_000) });
    await expect
      .poll(async () => (await probe())?.scene, { timeout: scaled(60_000) })
      .not.toBe(menu);
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: scaled(60_000) });
    // The HUD: life bar, task and inventory.
    await expect(page.getByText('Aufgabe: Sprich mit Mira')).toBeVisible();
    await expect(page.locator('[data-type="bar"]').first()).toHaveAttribute('data-fraction', '1');
    // The key from the chest; the inventory display shows it.
    await page.evaluate(() => window.__blockwerk?.teleportLive('Ritter', [4.5, 0, -8.2]));
    await expect.poll(async () => (await probe())?.hint, { timeout: scaled(30_000) }).toBe('open');
    await expect(page.getByTestId('interaction-hint')).toContainText('Truhe');
    await press('KeyE');
    await expect(page.getByTestId('ui-inventory-item')).toHaveText('Schlüssel × 1');
    // Esc pauses and opens the pause menu; the settings open on top of it.
    const spot = (await probe())?.ritter;
    await page.getByTestId('game-canvas').focus();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await probe())?.paused).toBe(true);
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await page.locator('[data-name="musicVolume"] input').evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = '25';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              JSON.parse(localStorage.getItem('blockwerk.settings') ?? '{}') as {
                musicVolume?: number;
              }
            ).musicVolume,
        ),
      )
      .toBe(25);
    await page.getByRole('button', { name: 'Zurück' }).click();
    // Save to slot 2, walk away, and load slot 2 from the pause menu.
    await page.getByRole('button', { name: 'Speichern 2' }).click();
    await expect(page.getByTestId('ui-notice')).toHaveText('Spiel gespeichert');
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('blockwerk.saves.Quest.2') ?? 'null'),
      ),
    ).toMatchObject({ slot: 2, sceneName: 'Dorf' });
    await page.getByRole('button', { name: 'Fortsetzen' }).click();
    await expect.poll(async () => (await probe())?.paused).toBe(false);
    await page.evaluate(() => window.__blockwerk?.teleportLive('Ritter', [-10, 0, -20]));
    await page.getByTestId('game-canvas').focus();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await probe())?.paused).toBe(true);
    await page.getByRole('button', { name: 'Laden 2' }).click();
    await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: scaled(60_000) });
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: scaled(60_000) });
    await expect.poll(async () => (await probe())?.items['Schlüssel']).toBe(1);
    const back = (await probe())?.ritter;
    expect(back && spot && Math.hypot(back[0] - spot[0], back[2] - spot[2])).toBeLessThan(1);
  });

  test('the UI Editor edits a canvas: add elements from a template, move, set properties, delete', async ({
    editor: page,
  }) => {
    await tab(page, 'Projekt').click();
    await page.getByTestId('project-create-button').click();
    await page.getByTestId('project-create').hover();
    await page.getByTestId('project-create-ui').click();
    await page.getByTestId('prompt-input').fill('Anzeige');
    await page.getByTestId('prompt-ok').click();
    await page.getByTestId('asset-Anzeige').dblclick();
    await expect(page.getByTestId('ui-name')).toHaveText('Anzeige');
    // A button from the "add element" list, selected at once.
    await page.getByTestId('ui-add').selectOption('button');
    await expect(page.getByTestId('ui-properties')).toBeVisible();
    await page.getByTestId('ui-prop-text').fill('Start');
    await page.getByTestId('ui-prop-preset').selectOption('topRight');
    const ui = () =>
      page.evaluate(() => {
        const files = window.__blockwerk?.files() ?? {};
        const path = Object.keys(files).find((name) => name.endsWith('.ui.json'));
        return path
          ? (JSON.parse(files[path] ?? '{}') as { elements: Record<string, unknown>[] })
          : null;
      });
    await expect.poll(async () => (await ui())?.elements[0]?.['text']).toBe('Start');
    const button = (await ui())?.elements[0] as {
      anchorMin: number[];
      offsetMin: number[];
      offsetMax: number[];
    };
    expect(button.anchorMin).toEqual([1, 0]);
    // Its size stays 240 × 48 after the preset.
    expect((button.offsetMax[0] ?? 0) - (button.offsetMin[0] ?? 0)).toBe(240);
    // A menu from a template appears as a second canvas with elements.
    await page.getByTestId('ui-template').selectOption('hud');
    await expect(page.getByTestId('ui-name')).toHaveText('HUD (Leben, Inventar, Hinweise)');
    await expect(page.getByTestId('ui-list')).toContainText('Life bar');
    // Dragging an element in the preview changes its offsets.
    const bar = page.locator('[data-testid="ui-preview"] [data-type="bar"]').first();
    const box = await bar.boundingBox();
    if (!box) throw new Error('no bar in the preview');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 4 });
    await page.mouse.up();
    const moved = await bar.boundingBox();
    expect(moved && moved.x - box.x).toBeGreaterThan(30);
    await page.getByTestId('ui-delete').click();
    await expect(page.locator('[data-testid="ui-preview"] [data-type="bar"]')).toHaveCount(0);
  });
});
