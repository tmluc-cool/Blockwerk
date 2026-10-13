import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { WEBGL_ARGS } from '../../playwright.config';

const desktopDir = join(import.meta.dirname, '..', '..', 'apps', 'desktop');

/** Chromium switches for CI: no GPU, and no sandbox on Linux runners (AppArmor) or as root. */
const SWITCHES = [...WEBGL_ARGS, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];

/**
 * Removes a temporary folder. Windows keeps files of a just-closed Electron app locked for a
 * moment, so this retries and leaves the folder to the system if it is still locked.
 */
function removeTemp(folder: string): void {
  try {
    rmSync(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    // Temporary files; the system cleans them up later.
  }
}

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
    await expect.poll(() => window.title()).toBe('Mein Spiel – Blockwerk');
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

    // The first project was created as a real folder (plain JSON files, ready for Git).
    const project = join(userData, 'projects', 'Mein Spiel');
    expect(JSON.parse(readFileSync(join(project, 'blockwerk.json'), 'utf8'))).toMatchObject({
      name: 'Mein Spiel',
      formatVersion: 1,
    });
    expect(existsSync(join(project, 'Assets', 'Szenen', 'Hauptszene.scene.json'))).toBe(true);
    expect(existsSync(join(project, 'Assets', 'Szenen', 'Hauptszene.scene.json.meta.json'))).toBe(
      true,
    );
    expect(readFileSync(join(project, '.gitignore'), 'utf8')).toBe('.blockwerk/\n');
  } finally {
    removeTemp(userData);
  }
});

test('the desktop app saves edits to the project folder and reopens it', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'blockwerk-desktop-'));
  try {
    let { app, window } = await launch(userData);
    await expect
      .poll(() => window.evaluate(() => window.__blockwerk?.project().status))
      .toBe('ready');
    await window.getByTestId('menu-gameObject').click();
    await window.getByTestId('menu-3d-object').hover();
    await window.getByTestId('create-cube').click();
    await window.getByTestId('rename-input').fill('Kiste');
    await window.keyboard.press('Enter');
    await window.keyboard.press('Control+s');
    await expect.poll(() => window.evaluate(() => window.__blockwerk?.project().dirty)).toBe(false);
    const scene = readFileSync(
      join(userData, 'projects', 'Mein Spiel', 'Assets', 'Szenen', 'Hauptszene.scene.json'),
      'utf8',
    );
    expect(scene).toContain('"name": "Kiste"');
    await app.close();

    ({ app, window } = await launch(userData));
    await expect(window.getByTestId('hierarchy').getByText('Kiste')).toBeVisible();
    await app.close();
  } finally {
    removeTemp(userData);
  }
});
