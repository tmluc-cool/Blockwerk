import type { Page } from '@playwright/test';
import { expect, scaled, tab, test } from './fixtures';

/**
 * Acceptance of phase 11 in the editor: the final game `examples/endspiel` plays from the main
 * menu through the loading screen into the landscape (SPEC phase 11).
 */

async function openExample(page: Page, name: string): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText(name, { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe(name);
}

const frames = (page: Page): Promise<number> =>
  page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);

test.describe('phase 11: the final game', () => {
  test('main menu, loading screen, landscape with HUD, split screen with Enter', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(420_000));
    await openExample(page, 'Endspiel');
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Spiel').click();
    await page.getByTestId('game-canvas').focus();
    await expect.poll(() => frames(page), { timeout: scaled(120_000) }).toBeGreaterThan(4);

    // The main menu.
    await expect(page.getByRole('button', { name: 'Spielen' })).toBeVisible({
      timeout: scaled(60_000),
    });
    await expect(page.getByRole('button', { name: /^Laden [123]$/ })).toHaveCount(3);
    await page.getByRole('button', { name: 'Spielen' }).click();
    // The loading screen, then the landscape.
    await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: scaled(60_000) });
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: scaled(120_000) });
    await expect(page.getByText('Aufgabe: Sprich mit Mira im Dorf')).toBeVisible();
    await expect(page.locator('[data-type="bar"]').first()).toHaveAttribute('data-fraction', '1');
    expect((await page.evaluate(() => window.__blockwerk?.gameViews()))?.players).toEqual(['1']);

    // Performance of the landscape (software rendering here, so only draw calls are a target).
    await page.waitForTimeout(4000);
    const performance = await page.evaluate(() => window.__blockwerk?.playPerformance());
    console.log(`PERF endspiel ${JSON.stringify(performance)}`);
    expect(performance?.drawCalls ?? 0).toBeGreaterThan(0);
    // SPEC 12: fewer than 500 draw calls in the landscape on "High".
    expect(performance?.drawCalls ?? 1000).toBeLessThan(500);
    console.log(
      `PERF play start ${await page.evaluate(() => window.__blockwerk?.playStartupMs())} ms`,
    );

    // Enter lets player 2 join: the screen splits.
    await page.getByTestId('game-canvas').focus();
    const before = await frames(page);
    await page.evaluate(() => window.__blockwerk?.pressKey('Enter', true));
    await expect.poll(() => frames(page), { timeout: scaled(30_000) }).toBeGreaterThan(before + 2);
    await page.evaluate(() => window.__blockwerk?.pressKey('Enter', false));
    await expect
      .poll(async () => (await page.evaluate(() => window.__blockwerk?.gameViews()))?.count, {
        timeout: scaled(30_000),
      })
      .toBe(2);

    // Stop: the editor goes back to the scene it was in.
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('stopped');
  });
});
