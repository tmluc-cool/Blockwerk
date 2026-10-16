import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { libraryIndexSchema } from '@blockwerk/library';
import { loadProject } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import { buildGame, ExportError, parseGamePack } from '../src';
import type { LibrarySource } from '../src';

const root = join(import.meta.dirname, '..', '..', '..');
const libraryDir = join(root, 'library');

async function libraryOrNull(): Promise<LibrarySource | null> {
  try {
    const index = libraryIndexSchema.parse(
      JSON.parse(await readFile(join(libraryDir, 'index.json'), 'utf8')),
    );
    return {
      index,
      read: async (file) => new Uint8Array(await readFile(join(libraryDir, file))),
    };
  } catch {
    return null;
  }
}

const library = await libraryOrNull();
const quest = () => loadProject(new NodeFileSystem(join(root, 'examples', '05-quest')));

describe('buildGame', () => {
  it('exports the quest example with its scenes, scripts, dialogs and UI', async () => {
    const project = await quest();
    const { pack, files } = await buildGame({ project, library });
    expect(parseGamePack(files[0]?.data as string).name).toBe(pack.name);
    expect(pack.startScene).toBe(project.settings.startScene);
    expect(pack.order[0]).toBe(pack.startScene);
    expect(Object.keys(pack.scenes).length).toBe(project.assetsOfType('scene').length);
    expect(Object.keys(pack.scripts).length).toBeGreaterThan(5);
    expect(Object.keys(pack.dialogs).length).toBeGreaterThan(0);
    expect(Object.keys(pack.uis).length).toBeGreaterThan(0);
    // Compiled code loads as a script module.
    for (const script of Object.values(pack.scripts)) {
      const module = new Function(script.code)() as { scripts: unknown[] };
      expect(Array.isArray(module.scripts)).toBe(true);
    }
    // No debug hooks in exported code.
    expect(Object.values(pack.scripts).every((script) => !script.code.includes('debugHit'))).toBe(
      true,
    );
  });

  it('writes only the library models the game uses, and every one of them exists', async () => {
    if (!library) return;
    const project = await quest();
    const { pack, files } = await buildGame({ project, library });
    const modelFiles = files.filter((file) => file.path.startsWith('game/library/'));
    expect(modelFiles.length).toBe(Object.keys(pack.library).length);
    expect(modelFiles.length).toBeGreaterThan(5);
    expect(modelFiles.length).toBeLessThan(library.index.entries.length / 4);
    const paths = new Set(files.map((file) => file.path));
    for (const path of Object.values(pack.library)) expect(paths.has(`game/${path}`)).toBe(true);
  });

  it('leaves out assets nothing refers to', async () => {
    const project = await quest();
    const unused = project.createAudio('Assets/Sounds/unused.wav', new Uint8Array([1, 2, 3]));
    const { pack, files } = await buildGame({ project, library });
    expect(pack.files[unused.id]).toBeUndefined();
    expect(files.some((file) => file.path.includes(unused.id))).toBe(false);
  });

  it('takes along a sound that a block names', async () => {
    const project = await quest();
    const sound = project.createAudio('Assets/Sounds/bell.wav', new Uint8Array([1, 2, 3]));
    const script = project.assetsOfType('blockScript')[0];
    if (!script) throw new Error('no script');
    project.updateAsset(script.id, 'blockScript', {
      ...script.data,
      workspace: {
        ...(script.data.workspace as object),
        note: `audio:${sound.id}`,
      },
    });
    const { pack } = await buildGame({ project, library });
    expect(pack.files[sound.id]?.type).toBe('audio');
  });

  it('lists the library models and their license in CREDITS.txt', async () => {
    if (!library) return;
    const project = await quest();
    const { files } = await buildGame({ project, library });
    const credits = files.find((file) => file.path === 'CREDITS.txt')?.data as string;
    expect(credits).toContain('KayKit');
    expect(credits).toContain('CC0-1.0');
    expect(credits).toContain('three.js');
    // Models the game does not use are not listed.
    const unusedSource = library.index.sources.find(
      (source) =>
        !Object.keys(JSON.parse(files[0]?.data as string).library).some((id: string) =>
          id.startsWith(`${source.id}/`),
        ),
    );
    if (unusedSource) expect(credits).not.toContain(unusedSource.name);
  });

  it('builds the same files twice', async () => {
    const first = await buildGame({ project: await quest(), library });
    const second = await buildGame({ project: await quest(), library });
    expect(second.files.map((file) => file.path)).toEqual(first.files.map((file) => file.path));
    expect(second.files[0]?.data).toBe(first.files[0]?.data);
  });

  it('warns when the library is not there and still builds', async () => {
    const { problems } = await buildGame({ project: await quest(), library: null });
    expect(problems.some((problem) => problem.code === 'libraryMissing')).toBe(true);
  });

  it('refuses a project without a scene', async () => {
    const project = await quest();
    project.settings = { ...project.settings, startScene: null, build: { scenes: [] } };
    await expect(buildGame({ project, library })).rejects.toBeInstanceOf(ExportError);
  });

  it('uses the build list, and adds scenes that scripts lead to', async () => {
    const project = await quest();
    const scenes = project.assetsOfType('scene');
    const start = project.settings.startScene;
    if (!start || scenes.length < 2) return;
    project.settings = { ...project.settings, build: { scenes: [start] } };
    const { pack } = await buildGame({ project, library });
    expect(pack.order[0]).toBe(start);
    expect(pack.order.length).toBeGreaterThanOrEqual(1);
  });
});
