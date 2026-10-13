import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDefaultScene,
  createProject,
  FORMAT_VERSION,
  FormatTooNewError,
  loadProject,
  MemoryFileSystem,
  migrate,
  MIGRATIONS,
  ProjectLoadError,
  sceneSchema,
  stringifyDeterministic,
} from '../src';
import type {
  BlockScriptData,
  MigrationRegistry,
  ProjectFileSystem,
  SceneData,
  Project,
} from '../src';
import { NodeFileSystem } from '../src/node';

const NAMES = { camera: 'Main Camera', sun: 'Sonne', ground: 'Boden' };
const FOLDERS = { scenes: 'Szenen', blockScripts: 'Block-Skripte' };

function newProject(fs: ProjectFileSystem): Promise<Project> {
  return createProject(fs, {
    name: 'Test',
    sceneName: 'Hauptszene',
    folders: FOLDERS,
    scene: createDefaultScene(NAMES),
  });
}

function blockScript(): BlockScriptData {
  return {
    formatVersion: FORMAT_VERSION,
    variables: [
      {
        id: 'speed0000000',
        name: 'Tempo',
        type: 'number',
        scope: 'object',
        default: 3,
        inspector: true,
      },
    ],
    workspace: { blocks: { languageVersion: 0, blocks: [] } },
  };
}

describe('default scene', () => {
  it('is valid and has area roots, camera, sun and ground', () => {
    const scene = createDefaultScene(NAMES);
    expect(sceneSchema.safeParse(scene).success).toBe(true);
    const objects = Object.values(scene.objects);
    expect(objects.filter((object) => object.area).map((object) => object.area)).toEqual([
      'environment',
      'player1',
      'player2',
      'npcs',
      'items',
      'ui',
    ]);
    expect(objects.map((object) => object.name).filter(Boolean)).toEqual([
      'Main Camera',
      'Sonne',
      'Boden',
    ]);
  });
});

describe('project files', () => {
  it('creates a project with deterministic files', async () => {
    const fs = new MemoryFileSystem();
    const project = await newProject(fs);
    const files = fs.snapshot();
    expect(Object.keys(files)).toEqual([
      '.gitignore',
      'Assets/Szenen/Hauptszene.scene.json',
      'Assets/Szenen/Hauptszene.scene.json.meta.json',
      'blockwerk.json',
      'Einstellungen/tags-und-ebenen.json',
    ]);
    expect(files['.gitignore']).toBe('.blockwerk/\n');
    const scene = project.assetsOfType('scene')[0];
    expect(project.settings.startScene).toBe(scene?.id);
    for (const [path, text] of Object.entries(files)) {
      if (!path.endsWith('.json')) continue;
      expect(text, path).toBe(stringifyDeterministic(JSON.parse(text)));
      expect(text).not.toContain('\r');
    }
  });

  it('loads what it saved and an unchanged save writes nothing', async () => {
    const fs = new MemoryFileSystem();
    const created = await newProject(fs);
    created.createAsset('blockScript', 'Assets/Block-Skripte/Steuerung.blocks.json', blockScript());
    await created.save(fs);
    const before = fs.snapshot();

    const loaded = await loadProject(fs);
    expect(loaded.problems).toEqual([]);
    expect(loaded.assets.map((entry) => [entry.id, entry.path])).toEqual(
      created.assets.map((entry) => [entry.id, entry.path]),
    );
    expect(loaded.dirty).toBe(false);
    expect(await loaded.save(fs)).toEqual({ written: [], removed: [] });
    expect(fs.snapshot()).toEqual(before);
  });

  it('writes only the files that changed', async () => {
    const fs = new MemoryFileSystem();
    const project = await newProject(fs);
    const scene = project.assetsOfType('scene')[0];
    if (!scene) throw new Error('no scene');
    const changed: SceneData = {
      ...scene.data,
      environment: { ...scene.data.environment, ambientIntensity: 0.5 },
    };
    project.updateAsset(scene.id, 'scene', changed);
    expect(project.dirty).toBe(true);
    expect(await project.save(fs)).toEqual({ written: [scene.path], removed: [] });
  });

  it('keeps IDs and references when an asset is renamed or moved', async () => {
    const fs = new MemoryFileSystem();
    const project = await newProject(fs);
    const script = project.createAsset(
      'blockScript',
      'Assets/Block-Skripte/Steuerung.blocks.json',
      blockScript(),
    );
    await project.save(fs);

    project.moveAsset(script.id, 'Assets/Spieler/Laufen.blocks.json');
    const result = await project.save(fs);
    expect(result.written).toEqual([
      'Assets/Spieler/Laufen.blocks.json',
      'Assets/Spieler/Laufen.blocks.json.meta.json',
    ]);
    expect(result.removed).toEqual([
      'Assets/Block-Skripte/Steuerung.blocks.json',
      'Assets/Block-Skripte/Steuerung.blocks.json.meta.json',
    ]);
    const loaded = await loadProject(fs);
    expect(loaded.asset(script.id)?.path).toBe('Assets/Spieler/Laufen.blocks.json');
  });

  it('renames safely when only the letter case changes', async () => {
    const fs = new MemoryFileSystem();
    const project = await newProject(fs);
    const script = project.createAsset('blockScript', 'Assets/a.blocks.json', blockScript());
    await project.save(fs);
    project.moveAsset(script.id, 'Assets/A.blocks.json');
    await project.save(fs);
    const loaded = await loadProject(fs);
    expect(loaded.asset(script.id)?.path).toBe('Assets/A.blocks.json');
    expect(
      Object.keys(fs.snapshot()).filter((path) => path.toLowerCase().includes('a.blocks')),
    ).toEqual(['Assets/A.blocks.json', 'Assets/A.blocks.json.meta.json']);
  });

  it('deletes the files of removed assets', async () => {
    const fs = new MemoryFileSystem();
    const project = await newProject(fs);
    const script = project.createAsset('blockScript', 'Assets/x.blocks.json', blockScript());
    await project.save(fs);
    project.deleteAsset(script.id);
    expect((await project.save(fs)).removed).toEqual([
      'Assets/x.blocks.json',
      'Assets/x.blocks.json.meta.json',
    ]);
  });

  it('finds free names like Unity', async () => {
    const fs = new MemoryFileSystem();
    const project = await newProject(fs);
    expect(project.uniqueAssetPath('Assets/Szenen', 'Hauptszene', 'scene')).toBe(
      'Assets/Szenen/Hauptszene 1.scene.json',
    );
    expect(project.uniqueAssetPath('Assets/Szenen', 'hauptszene', 'scene')).toBe(
      'Assets/Szenen/hauptszene 1.scene.json',
    );
    expect(project.uniqueAssetPath('Assets', 'a/b', 'blockScript')).toBe('Assets/a_b.blocks.json');
    expect(() =>
      project.createAsset(
        'scene',
        'Assets/Szenen/Hauptszene.scene.json',
        createDefaultScene(NAMES),
      ),
    ).toThrow(/taken/);
    expect(() =>
      project.createAsset('scene', 'Szenen/x.scene.json', createDefaultScene(NAMES)),
    ).toThrow(/inside Assets/);
    expect(() =>
      project.createAsset('scene', 'Assets/x.blocks.json', createDefaultScene(NAMES)),
    ).toThrow(/must end/);
  });
});

describe('loading problems', () => {
  async function prepared(): Promise<{ fs: MemoryFileSystem; project: Project }> {
    const fs = new MemoryFileSystem();
    const project = await newProject(fs);
    project.createAsset('blockScript', 'Assets/s.blocks.json', blockScript());
    await project.save(fs);
    return { fs, project };
  }

  it('creates missing meta files with a new ID', async () => {
    const { fs } = await prepared();
    await fs.remove('Assets/s.blocks.json.meta.json');
    const loaded = await loadProject(fs);
    expect(loaded.problems).toEqual([
      { severity: 'info', code: 'missingMeta', path: 'Assets/s.blocks.json' },
    ]);
    const id = loaded.assetAt('Assets/s.blocks.json')?.id;
    expect((await loaded.save(fs)).written).toEqual(['Assets/s.blocks.json.meta.json']);
    expect((await loadProject(fs)).assetAt('Assets/s.blocks.json')?.id).toBe(id);
  });

  it('gives copied assets a new identity', async () => {
    const { fs, project } = await prepared();
    const original = project.assetAt('Assets/s.blocks.json');
    await fs.writeText('Assets/t.blocks.json', await fs.readText('Assets/s.blocks.json'));
    await fs.writeText(
      'Assets/t.blocks.json.meta.json',
      await fs.readText('Assets/s.blocks.json.meta.json'),
    );
    const loaded = await loadProject(fs);
    expect(loaded.problems.map((problem) => [problem.code, problem.path])).toEqual([
      ['duplicateId', 'Assets/t.blocks.json'],
    ]);
    expect(loaded.assetAt('Assets/s.blocks.json')?.id).toBe(original?.id);
    expect(loaded.assetAt('Assets/t.blocks.json')?.id).not.toBe(original?.id);
  });

  it('skips broken files, never overwrites them and reports orphan meta files', async () => {
    const { fs } = await prepared();
    await fs.writeText('Assets/kaputt.scene.json', '{ nope');
    await fs.writeText('Assets/falsch.blocks.json', '{"formatVersion":1}');
    await fs.writeText('Assets/weg.scene.json.meta.json', '{}');
    await fs.writeText('Assets/Modell.glb', 'binary');
    const loaded = await loadProject(fs);
    expect(loaded.problems.map((problem) => [problem.code, problem.path])).toEqual([
      ['invalidFile', 'Assets/falsch.blocks.json'],
      ['invalidFile', 'Assets/kaputt.scene.json'],
      ['orphanMeta', 'Assets/weg.scene.json.meta.json'],
    ]);
    expect(loaded.uniqueAssetPath('Assets', 'kaputt', 'scene')).toBe('Assets/kaputt 1.scene.json');
    expect(await loaded.save(fs)).toEqual({ written: [], removed: [] });
    expect(await fs.readText('Assets/kaputt.scene.json')).toBe('{ nope');
  });

  it('refuses files from newer versions', async () => {
    const { fs } = await prepared();
    const text = await fs.readText('Assets/s.blocks.json');
    await fs.writeText(
      'Assets/s.blocks.json',
      text.replace('"formatVersion": 1', '"formatVersion": 99'),
    );
    const loaded = await loadProject(fs);
    expect(loaded.problems[0]?.code).toBe('formatTooNew');
    await fs.writeText('blockwerk.json', '{"formatVersion":99,"name":"x","startScene":null}');
    await expect(loadProject(fs)).rejects.toThrow(ProjectLoadError);
  });

  it('fails clearly without blockwerk.json', async () => {
    await expect(loadProject(new MemoryFileSystem())).rejects.toThrow(/blockwerk.json is missing/);
  });
});

describe('migrations', () => {
  const registry: MigrationRegistry = {
    ...MIGRATIONS,
    scene: [
      {
        from: 0,
        migrate: (data) => ({
          ...data,
          environment: {
            ambientIntensity: data['ambient'],
            fog: { enabled: false, near: 1, far: 2 },
          },
        }),
      },
    ],
  };

  it('runs steps up to the current version', () => {
    const result = migrate('scene', { formatVersion: 0, ambient: 0.4, objects: {} }, registry);
    expect(result).toMatchObject({ fromVersion: 0, migrated: true, data: { formatVersion: 1 } });
    expect(() => migrate('scene', { formatVersion: 2 })).toThrow(FormatTooNewError);
    expect(() => migrate('meta', { formatVersion: 0 })).toThrow(/No meta migration/);
    expect(migrate('meta', {}).migrated).toBe(false);
  });

  it('backs up the original file before migrating', async () => {
    const fs = new MemoryFileSystem();
    await newProject(fs);
    const old = '{"formatVersion":0,"ambient":0.4,"objects":{}}';
    await fs.writeText('Assets/alt.scene.json', old);
    const loaded = await loadProject(fs, {
      migrations: registry,
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
    expect(loaded.problems).toContainEqual({
      severity: 'info',
      code: 'migrated',
      path: 'Assets/alt.scene.json',
    });
    expect(
      await fs.readText('.blockwerk/backup/2026-01-02T03-04-05-000Z/Assets/alt.scene.json'),
    ).toBe(old);
    expect(loaded.assetAt('Assets/alt.scene.json')?.data).toMatchObject({
      environment: { ambientIntensity: 0.4 },
    });
    const { written } = await loaded.save(fs);
    expect(written).toContain('Assets/alt.scene.json');
    expect(JSON.parse(await fs.readText('Assets/alt.scene.json'))).toMatchObject({
      formatVersion: 1,
    });
  });
});

describe('NodeFileSystem', () => {
  const folders: string[] = [];
  afterEach(async () => {
    for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
  });

  it('round-trips a project on disk byte for byte', async () => {
    const root = await mkdtemp(join(tmpdir(), 'blockwerk-'));
    folders.push(root);
    const fs = new NodeFileSystem(root);
    const project = await newProject(fs);
    const script = project.createAsset(
      'blockScript',
      'Assets/Block-Skripte/Ä Ö.blocks.json',
      blockScript(),
    );
    await project.save(fs);
    const read = async (): Promise<Record<string, string>> => {
      const result: Record<string, string> = {};
      const walk = async (folder: string): Promise<void> => {
        for (const entry of await readdir(folder, { withFileTypes: true })) {
          const path = join(folder, entry.name);
          if (entry.isDirectory()) await walk(path);
          else result[path.slice(root.length)] = await readFile(path, 'utf8');
        }
      };
      await walk(root);
      return result;
    };
    const before = await read();
    const loaded = await loadProject(fs);
    expect(loaded.asset(script.id)?.path).toBe('Assets/Block-Skripte/Ä Ö.blocks.json');
    expect(await loaded.save(fs)).toEqual({ written: [], removed: [] });
    expect(await read()).toEqual(before);

    loaded.moveAsset(script.id, 'Assets/Neu/b.blocks.json');
    await loaded.save(fs);
    expect(await fs.exists('Assets/Block-Skripte/Ä Ö.blocks.json')).toBe(false);
    expect(await fs.list('Assets/Neu')).toEqual([
      { name: 'b.blocks.json', kind: 'file' },
      { name: 'b.blocks.json.meta.json', kind: 'file' },
    ]);
    expect(await fs.list('gibt-es-nicht')).toEqual([]);
    await expect(fs.readText('gibt-es-nicht.json')).rejects.toThrow(/not found/);
  });
});
