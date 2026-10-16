import type { Page } from '@playwright/test';
import { createPrimitive, expect, objectId, scaled, tab, test } from './fixtures';

/**
 * The tutorial "Your first world in 10 minutes" (SPEC phase 11): it starts from the Help menu,
 * points at the real editor and moves on by itself when the user has done what a step asks.
 */

const step = (page: Page) => page.getByTestId('tutorial-card').getAttribute('data-step');

async function startTutorial(page: Page): Promise<void> {
  await page.getByTestId('menu-help').click();
  await page.getByTestId('menu-tutorial').click();
  await expect(page.getByTestId('tutorial-card')).toBeVisible();
}

test.describe('phase 11: tutorial', () => {
  test('is hidden until started and can be closed at any step', async ({ editor: page }) => {
    await expect(page.getByTestId('tutorial-card')).toHaveCount(0);
    await startTutorial(page);
    expect(await step(page)).toBe('welcome');
    await expect(page.getByTestId('tutorial-progress')).toContainText('1');
    await page.getByTestId('tutorial-next').click();
    expect(await step(page)).toBe('cube');
    await expect(page.getByTestId('tutorial-spot')).toBeVisible();
    await page.getByTestId('tutorial-close').click();
    await expect(page.getByTestId('tutorial-card')).toHaveCount(0);
  });

  test('walks from the first cube to a spinning one by doing the steps', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(180_000));
    await startTutorial(page);
    await page.getByTestId('tutorial-next').click();
    expect(await step(page)).toBe('cube');

    // 1. A cube advances the tutorial.
    await createPrimitive(page, 'cube');
    await expect.poll(() => step(page)).toBe('move');

    // 2. Moving it.
    const inspector = page.getByTestId('inspector');
    await inspector.getByTestId('transform-position-y').fill('2');
    await inspector.getByTestId('transform-position-y').press('Enter');
    await expect.poll(() => step(page)).toBe('scriptAsset');

    // 3. A block script in the project.
    await tab(page, 'Block-Editor').click();
    await page.getByTitle('Neues Block-Skript').click();
    await page.getByTestId('prompt-input').fill('Drehen');
    await page.getByTestId('prompt-ok').click();
    await expect.poll(() => step(page)).toBe('attach');

    // 4. Attached to the cube.
    const cube = await objectId(page, 'Würfel');
    await page.getByTestId('hierarchy').getByText('Würfel', { exact: true }).click();
    await inspector.getByTestId('add-component').click();
    await inspector.getByTestId('add-component-search').fill('skript');
    await inspector.getByTestId('add-blockScript').click();
    await inspector.getByTestId('component-blockScript-0-script').selectOption({ label: 'Drehen' });
    await expect.poll(() => step(page)).toBe('blocks');
    const scriptId =
      (await page.evaluate(
        () => window.__blockwerk?.assets().find((asset) => asset.name === 'Drehen')?.id,
      )) ?? '';
    expect(scriptId).not.toBe('');

    // 5. Two blocks.
    await page.evaluate((id) => {
      window.__blockwerk?.setScriptWorkspace(id, {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'events.everyFrame',
              id: 'tut-hat',
              x: 40,
              y: 40,
              next: {
                block: {
                  type: 'motion.turn',
                  id: 'tut-turn',
                  fields: { direction: 'right' },
                  inputs: {
                    degrees: {
                      shadow: { type: 'literal.number', id: 'tut-num', fields: { NUM: 5 } },
                    },
                  },
                },
              },
            },
          ],
        },
      });
    }, scriptId);
    await expect.poll(() => step(page)).toBe('play');

    // 6. and 7. Play, then stop.
    await page.getByTestId('play').click();
    await expect.poll(() => step(page)).toBe('stop');
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await page.getByTestId('play').click();
    await expect.poll(() => step(page)).toBe('finish');
    expect(cube).toBeTruthy();
    await page.getByTestId('tutorial-next').click();
    await expect(page.getByTestId('tutorial-card')).toHaveCount(0);
  });
});
