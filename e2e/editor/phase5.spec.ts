import type { Page } from '@playwright/test';
import { expect, scaled, test } from './fixtures';

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
});
