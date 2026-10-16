import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildWindowsApp, isWindowsTemplate, pngToIco } from '../src/windowsApp';

const temps: string[] = [];
afterEach(async () => {
  for (const dir of temps.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function temp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'blockwerk-windows-app-'));
  temps.push(dir);
  return dir;
}

/** A stand-in for the player template: an "exe", the shell and the player page. */
async function fakeTemplate(platform: string): Promise<string> {
  const dir = join(await temp(), 'template');
  await mkdir(join(dir, 'resources', 'player'), { recursive: true });
  const executable = platform === 'win32' ? 'Blockwerk Player.exe' : 'blockwerk-player';
  await writeFile(join(dir, executable), 'exe');
  await writeFile(join(dir, 'resources', 'player', 'index.html'), '<html></html>');
  await writeFile(join(dir, 'blockwerk-player.json'), JSON.stringify({ platform, executable }));
  return dir;
}

/** A PNG header for a square image (only the size is read). */
function png(size: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, size);
  view.setUint32(20, size);
  return bytes;
}

describe('pngToIco', () => {
  it('wraps the PNG in an icon file with its size', () => {
    const ico = pngToIco(png(64));
    const view = new DataView(ico.buffer);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(1);
    expect(ico[6]).toBe(64);
    expect(ico[7]).toBe(64);
    expect(view.getUint32(14, true)).toBe(40);
    expect(view.getUint32(18, true)).toBe(22);
    expect([...ico.slice(22, 30)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('writes 256 pixels and more as 0', () => {
    const ico = pngToIco(png(256));
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });
});

describe('buildWindowsApp', () => {
  it('names the exe after the game and puts the pack in resources/game', async () => {
    const template = await fakeTemplate('win32');
    const folder = join(await temp(), 'Mein Spiel');
    const { exe } = await buildWindowsApp({
      template,
      folder,
      name: 'Mein Spiel',
      files: [
        { path: 'game/game.json', data: '{"x":1}' },
        { path: 'game/files/a.glb', data: new Uint8Array([1, 2, 3]) },
        { path: 'CREDITS.txt', data: 'credits' },
      ],
    });
    expect(exe).toBe(join(folder, 'Mein Spiel.exe'));
    expect(await readFile(exe, 'utf8')).toBe('exe');
    expect(await readFile(join(folder, 'resources', 'game', 'game.json'), 'utf8')).toBe('{"x":1}');
    expect([...(await readFile(join(folder, 'resources', 'game', 'files', 'a.glb')))]).toEqual([
      1, 2, 3,
    ]);
    expect(await readFile(join(folder, 'CREDITS.txt'), 'utf8')).toBe('credits');
    // The note about the template does not ship with the game.
    expect(await readdir(folder)).not.toContain('blockwerk-player.json');
  });

  it('empties an existing folder first', async () => {
    const template = await fakeTemplate('win32');
    const folder = join(await temp(), 'app');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'old.txt'), 'old');
    await buildWindowsApp({ template, folder, name: 'Spiel', files: [] });
    expect(await readdir(folder)).not.toContain('old.txt');
  });

  it('keeps the icon next to the resources for the window', async () => {
    const template = await fakeTemplate('linux');
    const folder = join(await temp(), 'app');
    const { warnings, exe } = await buildWindowsApp({
      template,
      folder,
      name: 'Spiel',
      files: [],
      icon: png(32),
    });
    expect(exe).toBe(join(folder, 'Spiel'));
    expect((await readFile(join(folder, 'resources', 'icon.png'))).byteLength).toBe(40);
    // Setting the icon of the exe needs Windows.
    if (process.platform !== 'win32') expect(warnings.length).toBe(1);
  });

  it('refuses a folder that is not a template', async () => {
    const empty = await temp();
    await expect(
      buildWindowsApp({ template: empty, folder: join(empty, 'out'), name: 'x', files: [] }),
    ).rejects.toThrow(/not a player template/);
  });
});

describe('isWindowsTemplate', () => {
  it('is true only for a template made on Windows', async () => {
    expect(await isWindowsTemplate(await fakeTemplate('win32'))).toBe(true);
    expect(await isWindowsTemplate(await fakeTemplate('linux'))).toBe(false);
    expect(await isWindowsTemplate(await temp())).toBe(false);
  });
});
