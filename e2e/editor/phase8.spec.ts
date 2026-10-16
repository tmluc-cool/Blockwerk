import type { Page } from '@playwright/test';
import { expect, scaled, tab, test } from './fixtures';

/** Acceptance of phase 8 in the editor: `examples/08-kaputt` (SPEC 10, phase 8). */

async function openBrokenExample(page: Page): Promise<void> {
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Kaputt', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Kaputt');
}

const frames = (page: Page): Promise<number> =>
  page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);

async function startGame(page: Page): Promise<void> {
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(() => frames(page), { timeout: scaled(120_000) }).toBeGreaterThan(4);
}

test.describe('phase 8: debugging', () => {
  test('the broken example reports its mistakes in German, and a click jumps to the place', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(180_000));
    await openBrokenExample(page);
    await page.getByTestId('play').click();
    await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
    await tab(page, 'Konsole').click();
    const row = (text: string) => page.getByTestId('console-row').filter({ hasText: text });
    // Empty inspector field, message without receiver, NPC outside the mesh, empty slot.
    await expect(row('Schalter ohne Skript').first()).toContainText('ist leer');
    await expect(row('tor-auf').first()).toContainText('kein Skript empfängt sie');
    await expect(row('Wache 2').first()).toContainText('Navigationsnetz');
    await expect(row('Steckplatz').first()).toContainText('Tor oeffnen');

    // Clicking the message problem opens the script and selects the sending block.
    await row('tor-auf').first().click();
    await expect(page.getByTestId('script-select')).toHaveValue(
      (await page.evaluate(
        () => window.__blockwerk?.assets().find((asset) => asset.name === 'Tor oeffnen')?.id,
      )) ?? '',
    );
    // Clicking the NPC problem selects the object in the hierarchy.
    await row('Wache 2').first().click();
    const wache = await page.evaluate(() => window.__blockwerk?.objectIds('Wache 2')[0]);
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.selectionIds()))
      .toContain(wache);
  });

  test('a breakpoint stops the game, a value changes, next block and continue go on', async ({
    editor: page,
  }) => {
    test.setTimeout(scaled(240_000));
    await openBrokenExample(page);
    const counter = await page.evaluate(() => {
      const hooks = window.__blockwerk;
      const asset = hooks?.assets().find((candidate) => candidate.name === 'Zaehler');
      if (!hooks || !asset) return null;
      const workspace = hooks.scriptWorkspace(asset.id) as {
        blocks: { blocks: { next?: { block?: { id: string; next?: unknown } } }[] };
      };
      const ids: string[] = [];
      let block = workspace.blocks.blocks[0]?.next?.block;
      while (block) {
        ids.push(block.id);
        block = (block.next as { block?: { id: string; next?: unknown } } | undefined)?.block;
      }
      return { asset: asset.id, ids };
    });
    expect(counter?.ids).toHaveLength(3);
    if (!counter) return;
    // Breakpoint on the second block, only once the score is at least 1.
    await page.evaluate(
      ({ asset, id }) => {
        window.__blockwerk?.toggleBreakpoint(asset, id);
        window.__blockwerk?.setBreakpointCondition(asset, id, 'punkte >= 1');
      },
      { asset: counter.asset, id: counter.ids[1] ?? '' },
    );
    await startGame(page);
    const before = await frames(page);
    await page.evaluate(() => window.__blockwerk?.pressKey('KeyZ', true));
    await expect.poll(() => frames(page), { timeout: scaled(60_000) }).toBeGreaterThan(before + 1);
    await page.evaluate(() => window.__blockwerk?.pressKey('KeyZ', false));
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.debugState().hit?.blockId), {
        timeout: scaled(60_000),
      })
      .toBe(counter.ids[1]);
    expect(await page.evaluate(() => window.__blockwerk?.playStatus())).toBe('paused');
    expect(await page.evaluate(() => window.__blockwerk?.gameVars()['kaputtvar001'])).toBe(1);

    // The Inspector shows the variable live; change it while the game is stopped.
    await page.getByTestId('hierarchy').getByText('Skript-Halter', { exact: true }).click();
    const live = page.getByTestId('live-var-punkte');
    await expect(live).toBeVisible();
    await live.fill('500');
    await live.press('Enter');
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.gameVars()['kaputtvar001']))
      .toBe(500);

    // Next block: the second block runs, the game stops before the third.
    await page.getByTestId('step-block').click();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.debugState().hit?.blockId), {
        timeout: scaled(60_000),
      })
      .toBe(counter.ids[2]);
    expect(await page.evaluate(() => window.__blockwerk?.gameVars()['kaputtvar001'])).toBe(510);

    // Continue: the rest of the script runs.
    await page.getByTestId('pause').click();
    await expect
      .poll(() => page.evaluate(() => window.__blockwerk?.gameVars()['kaputtvar001']), {
        timeout: scaled(60_000),
      })
      .toBe(610);
    expect(await page.evaluate(() => window.__blockwerk?.debugState().hit)).toBeNull();
  });

  test('the Profiler shows where the time of a frame goes', async ({ editor: page }) => {
    test.setTimeout(scaled(180_000));
    await openBrokenExample(page);
    await startGame(page);
    await page.getByTestId('menu-window').click();
    await page.getByTestId('menu-open-window').hover();
    await page.getByTestId('open-profiler').click();
    const profiler = page.getByTestId('profiler');
    await expect(profiler).toBeVisible();
    await expect(page.getByTestId('profiler-frame')).toContainText('ms');
    await expect(page.getByTestId('profiler-scripts')).toContainText('ms');
    await expect
      .poll(async () => Number(await page.getByTestId('profiler-draw-calls').textContent()), {
        timeout: scaled(60_000),
      })
      .toBeGreaterThan(0);
  });
});
