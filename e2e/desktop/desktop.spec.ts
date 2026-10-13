import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { WEBGL_ARGS } from '../../playwright.config';

const desktopDir = join(import.meta.dirname, '..', '..', 'apps', 'desktop');

/** Chromium switches for CI: no GPU, and no sandbox on Linux runners (AppArmor) or as root. */
const SWITCHES = [...WEBGL_ARGS, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];

async function launch(userData: string): Promise<{ app: ElectronApplication; window: Page }> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  delete env['BLOCKWERK_EDITOR_URL'];
  env['BLOCKWERK_USER_DATA'] = userData;
  const app = await electron.launch({ args: [...SWITCHES, desktopDir], env });
  const window = await app.firstWindow();
  await expect(window.getByTestId('scene-canvas')).toBeVisible();
  return { app, window };
}

test('the desktop app opens the editor offline and keeps the layout across restarts', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'blockwerk-desktop-'));
  try {
    let { app, window } = await launch(userData);
    expect(await window.title()).toBe('Blockwerk');
    expect(new URL(window.url()).protocol).toBe('blockwerk:');
    await expect(window.getByTestId('menu-bar')).toBeVisible();
    await expect(window.locator('.dv-tab', { hasText: 'Hierarchie' })).toBeVisible();
    expect(
      await window.evaluate(
        () =>
          (window as unknown as { blockwerkDesktop?: { electron: string } }).blockwerkDesktop
            ?.electron,
      ),
    ).toBeTruthy();

    // Undock the console into a floating window, then restart the app.
    await window.locator('.dv-tab', { hasText: 'Konsole' }).click({ button: 'right' });
    await window.getByText('Lösen (schwebend)').click();
    await expect
      .poll(() => window.evaluate(() => window.__blockwerk?.panelLocation('console')))
      .toBe('floating');
    await window.waitForTimeout(800);
    await app.close();

    ({ app, window } = await launch(userData));
    await expect
      .poll(() => window.evaluate(() => window.__blockwerk?.panelLocation('console')))
      .toBe('floating');

    // A panel can be moved to its own window (second screen).
    const popupPromise = app.waitForEvent('window');
    await window.locator('.dv-tab', { hasText: 'Inspektor' }).click({ button: 'right' });
    await window.getByText('In eigenes Fenster abtrennen').click();
    const popup = await popupPromise;
    await expect(popup.getByTestId('inspector')).toBeVisible();
    await expect
      .poll(() => window.evaluate(() => window.__blockwerk?.panelLocation('inspector')))
      .toBe('popout');
    await app.close();
  } finally {
    rmSync(userData, { recursive: true, force: true });
  }
});
