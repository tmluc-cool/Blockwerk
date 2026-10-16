import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, scaled, tab, test } from './fixtures';

/** Phase whose example the screenshot shows. */
const PHASE = '08';

/**
 * Screenshots of the example project of the current phase, for the phase report (phase 8: the
 * broken example with its mistakes in the console, and a script stopped at a breakpoint with the
 * live variables in the Inspector). Written to `test-results/` on every run and to
 * `docs/screenshots/` when `BLOCKWERK_SCREENSHOT=1` (see `pnpm screenshot`).
 */
test('example scene screenshot', async ({ editor: page }) => {
  test.setTimeout(300_000);
  const save = async (name: string) => {
    const targets = [join('test-results', 'screenshots', name)];
    if (process.env['BLOCKWERK_SCREENSHOT'] === '1')
      targets.push(join('docs', 'screenshots', name));
    for (const path of targets) {
      mkdirSync(dirname(path), { recursive: true });
      await page.screenshot({ path });
    }
  };
  const frames = () => page.evaluate(() => window.__blockwerk?.playPerformance().frames ?? 0);
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Kaputt', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Kaputt');

  // The mistakes in the console, in plain German.
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(frames, { timeout: scaled(120_000) }).toBeGreaterThan(4);
  await tab(page, 'Konsole').click();
  await expect(
    page.getByTestId('console-row').filter({ hasText: 'Navigationsnetz' }).first(),
  ).toBeVisible();
  // Only the errors, so the small console shows the mistakes and not the start-up messages.
  await page.locator('.level-toggle.level-info').click();
  await page.locator('.level-toggle.level-warning').click();
  await page
    .getByTestId('console')
    .locator('.console-list')
    .evaluate((list) => {
      list.scrollTop = list.scrollHeight;
    });
  await page.waitForTimeout(1500);
  await save(`phase-${PHASE}.png`);

  // A breakpoint: the script stops, the Inspector shows the live variable.
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('stopped');
  const counter = await page.evaluate(() => {
    const hooks = window.__blockwerk;
    const asset = hooks?.assets().find((candidate) => candidate.name === 'Zaehler');
    if (!hooks || !asset) return null;
    const workspace = hooks.scriptWorkspace(asset.id) as {
      blocks: { blocks: { next?: { block?: { id: string; next?: unknown } } }[] };
    };
    const second = (
      workspace.blocks.blocks[0]?.next?.block?.next as { block?: { id: string } } | undefined
    )?.block?.id;
    return second ? { asset: asset.id, block: second } : null;
  });
  if (!counter) throw new Error('no counter script');
  await page.evaluate(
    ({ asset, block }) => window.__blockwerk?.toggleBreakpoint(asset, block),
    counter,
  );
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.playStatus())).toBe('playing');
  await tab(page, 'Spiel').click();
  await page.getByTestId('game-canvas').focus();
  await expect.poll(frames, { timeout: scaled(120_000) }).toBeGreaterThan(4);
  const before = await frames();
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyZ', true));
  await expect.poll(frames, { timeout: scaled(60_000) }).toBeGreaterThan(before + 1);
  await page.evaluate(() => window.__blockwerk?.pressKey('KeyZ', false));
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.debugState().hit?.blockId), {
      timeout: scaled(60_000),
    })
    .toBe(counter.block);
  await page.getByTestId('hierarchy').getByText('Skript-Halter', { exact: true }).click();
  await tab(page, 'Block-Editor').click();
  await page.waitForTimeout(1500);
  await save(`phase-${PHASE}-haltepunkt.png`);
});
