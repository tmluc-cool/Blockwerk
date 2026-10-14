import { expect, tab, test } from './fixtures';

test('probe: studio frame rate on this machine', async ({ editor: page }) => {
  test.setTimeout(280_000);
  const t0 = Date.now();
  await page.getByTestId('menu-file').click();
  await page.getByTestId('menu-open-example').click();
  await page.getByTestId('choice-dialog').getByText('Figur', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__blockwerk?.project().name)).toBe('Figur');
  console.log('PROBE example open', Date.now() - t0);
  const measure = (label: string) =>
    page.evaluate(
      (name) =>
        new Promise<string>((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = (): void => {
            frames++;
            if (performance.now() - start < 5000) requestAnimationFrame(tick);
            else {
              const canvases = Array.from(document.querySelectorAll('canvas')).map(
                (c) => `${c.width}x${c.height}${c.offsetParent ? '' : '(hidden)'}`,
              );
              resolve(`${name} rAF fps ${(frames / 5).toFixed(2)} canvases ${canvases.join(' ')}`);
            }
          };
          requestAnimationFrame(tick);
        }),
      label,
    );
  console.log('PROBE', await measure('editor before studio'));
  await tab(page, 'Figur').click();
  await expect(page.getByTestId('studio')).toBeVisible();
  console.log('PROBE', await measure('studio opening'));
  await expect
    .poll(() => page.evaluate(() => window.__blockwerk?.studioState() ?? null), {
      timeout: 200_000,
    })
    .not.toBeNull();
  console.log('PROBE studio ready after', Date.now() - t0);
  console.log('PROBE', await measure('studio ready'));
});
