import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Acceptance of phase 9 for the app: `examples/05-quest` exported as an app, started without the
 * editor. On Windows the template and the app are real Windows ones (the exe of the release);
 * elsewhere the same code makes an app of that system.
 */

const root = join(import.meta.dirname, '..', '..');
const windows = process.platform === 'win32';
const pnpm = windows ? 'pnpm.cmd' : 'pnpm';

function run(args: string[]): string {
  return execFileSync(pnpm, args, { cwd: root, encoding: 'utf8', shell: windows });
}

test('an exported app starts in fullscreen without the editor, offline, and shows the game', async () => {
  test.setTimeout(600_000);
  const work = mkdtempSync(join(tmpdir(), 'blockwerk-player-'));
  try {
    const template = join(work, 'template');
    run(['player-template', template]);
    const app = join(work, 'Quest-App');
    run([
      'export',
      'examples/05-quest',
      '--out',
      app,
      '--platform',
      windows ? 'windows' : 'app',
      '--template',
      template,
    ]);
    const exe = join(app, windows ? 'Quest.exe' : 'Quest');
    expect(existsSync(exe)).toBe(true);
    expect(existsSync(join(app, 'CREDITS.txt'))).toBe(true);
    expect(readFileSync(join(app, 'CREDITS.txt'), 'utf8')).toContain('KayKit');
    // Only the runtime ships: no editor page, no Blockly.
    expect(existsSync(join(app, 'resources', 'player', 'blocks.html'))).toBe(false);
    expect(existsSync(join(app, 'resources', 'player', 'blockly-media'))).toBe(false);
    expect(existsSync(join(app, 'resources', 'game', 'game.json'))).toBe(true);

    const report = join(work, 'report.json');
    const env: NodeJS.ProcessEnv = { ...process.env, BLOCKWERK_PLAYER_SMOKE: report };
    delete env['BLOCKWERK_EDITOR_URL'];
    const args = process.platform === 'linux' ? ['--no-sandbox'] : [];
    const child = spawn(exe, args, { env, stdio: 'ignore', cwd: app });
    await new Promise<void>((resolve, reject) => {
      child.on('exit', () => resolve());
      child.on('error', reject);
    });
    const result = JSON.parse(readFileSync(report, 'utf8')) as {
      ok: boolean;
      state: { tick: number; sceneName: string; problems: string[]; fullscreenRequested: boolean };
      fullScreen: boolean;
      title: string;
      menuBar: boolean;
      blockedRequests: string[];
      editorFiles: boolean;
    };
    expect(result.ok).toBe(true);
    // Fullscreen, no menu bar, the game's name as the title.
    expect(result.fullScreen).toBe(true);
    expect(result.menuBar).toBe(false);
    expect(result.title).toBe('Quest');
    // The game runs and reports no problems; it asked for nothing outside the app.
    expect(result.state.tick).toBeGreaterThanOrEqual(30);
    expect(result.state.sceneName).toBe('Hauptmenue');
    expect(result.state.problems).toEqual([]);
    expect(result.blockedRequests).toEqual([]);
    expect(result.editorFiles).toBe(false);
  } finally {
    try {
      rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // Temporary files; the system cleans them up later.
    }
  }
});
