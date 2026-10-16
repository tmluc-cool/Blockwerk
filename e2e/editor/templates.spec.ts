import { expect, scaled, tab, test } from './fixtures';

/**
 * Acceptance of the template projects in the editor (SPEC phase 11): File > New Project from
 * Template lists the five templates, each one opens and plays.
 */

const TEMPLATES = [
  { id: 'abenteuer', name: 'Abenteuer' },
  { id: 'arena', name: 'Arena' },
  { id: 'plattformer', name: 'Plattformer' },
  { id: 'koop', name: 'Koop' },
  { id: 'rennen', name: 'Rennen' },
] as const;

test.describe('templates', () => {
  test('File > New Project from Template lists the five templates', async ({ editor: page }) => {
    await page.getByTestId('menu-file').click();
    await page.getByTestId('menu-new-from-template').click();
    const dialog = page.getByTestId('choice-dialog');
    for (const template of TEMPLATES) {
      await expect(dialog.getByText(template.name, { exact: false }).first()).toBeVisible();
    }
    await expect(dialog.locator('.choice')).toHaveCount(5);
  });

  for (const template of TEMPLATES) {
    test(`the template ${template.name} opens and plays without an error`, async ({
      editor: page,
    }) => {
      test.setTimeout(scaled(120_000));
      await page.getByTestId('menu-file').click();
      await page.getByTestId('menu-new-from-template').click();
      await page
        .getByTestId('choice-dialog')
        .locator('.choice', { hasText: template.name })
        .first()
        .click();
      await expect
        .poll(() => page.evaluate(() => window.__blockwerk?.project().name), { timeout: 30_000 })
        .toBe(template.name);
      await page.getByTestId('play').click();
      await expect
        .poll(() => page.evaluate(() => window.__blockwerk?.playStatus()), { timeout: 60_000 })
        .toBe('playing');
      await page.waitForTimeout(1500);
      // The scene check found nothing to complain about: no error or warning in the console.
      await tab(page, 'Konsole').click();
      await expect(
        page.locator('.console-row.level-error, .console-row.level-warning'),
      ).toHaveCount(0);
      await page.getByTestId('play').click();
      await expect
        .poll(() => page.evaluate(() => window.__blockwerk?.playStatus()))
        .toBe('stopped');
    });
  }
});
