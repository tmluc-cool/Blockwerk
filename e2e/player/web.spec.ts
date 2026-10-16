import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Acceptance of phase 9 for the web build: `examples/05-quest` exported for the web runs in the
 * browser with a loading screen and working settings, and `CREDITS.txt` lists the third-party
 * assets (SPEC 10, phase 9).
 */

const root = join(import.meta.dirname, '..', '..');
const windows = process.platform === 'win32';
const slow = windows && process.env['CI'] ? 3 : 1;

const MEDIA: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

function serve(folder: string): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
    const file = normalize(join(folder, path === '/' ? 'index.html' : path));
    if (!file.startsWith(folder + sep) || !existsSync(file) || !statSync(file).isFile()) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader('Content-Type', MEDIA[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

test('the web build of the quest runs in the browser with working settings', async ({ page }) => {
  test.setTimeout(300_000 * slow);
  const work = mkdtempSync(join(tmpdir(), 'blockwerk-web-'));
  const out = join(work, 'quest-web');
  execFileSync(
    windows ? 'pnpm.cmd' : 'pnpm',
    ['export', 'examples/05-quest', '--out', out, '--zip'],
    { cwd: root, shell: windows },
  );
  const { server, url } = await serve(out);
  try {
    // CREDITS.txt lists the third-party assets and the engine.
    const credits = readFileSync(join(out, 'CREDITS.txt'), 'utf8');
    expect(credits).toContain('KayKit');
    expect(credits).toContain('CC0-1.0');
    expect(credits).toContain('three.js');
    expect(existsSync(`${out}.zip`)).toBe(true);
    // No editor in the build.
    expect(existsSync(join(out, 'blocks.html'))).toBe(false);

    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('request', (request) => {
      if (!request.url().startsWith(url) && !/^(data|blob):/.test(request.url())) {
        problems.push(`network request: ${request.url()}`);
      }
    });
    await page.goto(url);
    // The loading screen shows the name of the game, then asks for a click (sound needs one).
    await expect(page.getByTestId('player-title')).toContainText('Quest');
    await expect(page.getByTestId('player-start')).toBeVisible({ timeout: 120_000 * slow });
    await page.getByTestId('player-start').click();

    const hooks = () => page.evaluate(() => window.__blockwerkPlayer?.() ?? null);
    await expect
      .poll(async () => (await hooks())?.tick ?? 0, { timeout: 60_000 * slow })
      .toBeGreaterThan(30);
    expect((await hooks())?.sceneName).toBe('Hauptmenue');
    await expect(page.getByRole('button', { name: 'Spielen' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Laden [123]$/ })).toHaveCount(3);

    // The settings work and are kept for the next start.
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
              JSON.parse(localStorage.getItem('blockwerk.Quest.settings') ?? '{}') as {
                musicVolume?: number;
              }
            ).musicVolume,
        ),
      )
      .toBe(25);
    await page.getByRole('button', { name: 'Zurück' }).click();

    // Playing leads through the loading screen into the village.
    await page.getByRole('button', { name: 'Spielen' }).click();
    await expect(page.getByTestId('loading-screen')).toBeVisible({ timeout: 60_000 * slow });
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 * slow });
    await expect.poll(async () => (await hooks())?.sceneName).toBe('Dorf');
    await expect(page.getByText('Aufgabe: Sprich mit Mira')).toBeVisible();
    // The game drew something and reported no problems.
    expect((await hooks())?.drawCalls).toBeGreaterThan(5);
    expect((await hooks())?.problems).toEqual([]);
    if (process.env['BLOCKWERK_SCREENSHOT']) {
      await page.screenshot({ path: join(root, 'docs', 'screenshots', 'phase-09-web.png') });
    }
    expect(problems).toEqual([]);
  } finally {
    server.close();
    rmSync(work, { recursive: true, force: true });
  }
});
