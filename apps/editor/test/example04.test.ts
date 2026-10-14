import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compileBlockScript } from '@blockwerk/compiler';
import { assetDisplayName, loadProject } from '@blockwerk/project';
import type { Project, SceneData } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import {
  AudioEngine,
  controlRegistry,
  Game,
  initPhysics,
  loadScriptModule,
  RecordingAudioContext,
  setQuality,
  setTerrainSource,
  TerrainData,
  terrainRegistry,
} from '@blockwerk/runtime';
import type { ScriptAsset } from '@blockwerk/runtime';
import { beforeAll, describe, expect, it } from 'vitest';

/** Acceptance of phase 4 without the UI: `examples/04-landschaft` (SPEC 10, phase 4). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '04-landschaft');

beforeAll(async () => {
  await initPhysics();
});

function filesOf(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (!path.endsWith('.bin'))
        result[relative(directory, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(directory);
  return result;
}

function sceneOf(project: Project): SceneData {
  const id = project.settings.startScene;
  const scene = id ? project.assetOfType(id, 'scene') : undefined;
  if (!scene) throw new Error('no start scene');
  return scene.data;
}

interface Launched {
  game: Game;
  project: Project;
  context: RecordingAudioContext;
  audio: AudioEngine;
}

async function launch(): Promise<Launched> {
  const project = await loadProject(new NodeFileSystem(folder));
  setTerrainSource((id) => {
    const bytes = project.assetBytes(id);
    return bytes ? TerrainData.deserialize(bytes) : null;
  });
  const assets = new Map<string, ScriptAsset>();
  for (const entry of project.assetsOfType('blockScript')) {
    const result = compileBlockScript(entry.data.workspace, {
      assetName: assetDisplayName(entry.path),
      variables: entry.data.variables,
    });
    expect(result.diagnostics).toEqual([]);
    assets.set(entry.id, {
      assetId: entry.id,
      module: loadScriptModule(result.code),
      variables: entry.data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `test://${entry.id}`,
    });
  }
  const context = new RecordingAudioContext();
  const audio = new AudioEngine({ createContext: () => context as unknown as AudioContext });
  const game = new Game(sceneOf(project), {
    scripts: (id) => assets.get(id) ?? null,
    audio,
    random: () => 0.5,
  });
  return { game, project, context, audio };
}

const run = (game: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
};

const idOf = (game: Game, name: string): string => {
  const object = [...game.world.allObjects()].find((candidate) => candidate.name === name);
  if (!object) throw new Error(`no object ${name}`);
  return object.id;
};

describe('examples/04-landschaft', () => {
  it('loads without problems and a save writes nothing', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const files = filesOf(folder);
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    expect(project.dirty).toBe(false);
    expect(project.settings.graphicsLevel).toBe('high');
  });

  it('is a landscape with hills, a lake, a forest, a village, sky, weather and sound', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const scene = sceneOf(project);
    const objects = Object.values(scene.objects);
    const has = (type: string) =>
      objects.some((object) => object.components.some((component) => component.type === type));
    expect(has('terrain')).toBe(true);
    expect(has('water')).toBe(true);
    expect(has('particleSystem')).toBe(true);
    expect(has('audioSource')).toBe(true);
    expect(has('postProcessing')).toBe(true);
    expect(objects.filter((object) => object.name?.startsWith('Baum')).length).toBeGreaterThan(200);
    expect(scene.environment.sky).toBeDefined();
    expect(scene.environment.weather).toBeDefined();
    const terrain = project.assets.find((asset) => asset.type === 'terrain');
    expect(terrain?.path).toBe('Assets/Landschaften/Landschaft.terrain.bin');
    // Every library model of the scene exists in the library index (when it was built).
    const models = objects.flatMap((object) =>
      object.components
        .map((component) => component.values['model'])
        .filter((model): model is string => typeof model === 'string'),
    );
    try {
      const index = JSON.parse(
        readFileSync(join(import.meta.dirname, '..', '..', '..', 'library', 'index.json'), 'utf8'),
      ) as { entries: { id: string }[] };
      const ids = new Set(index.entries.map((entry) => `library:${entry.id}`));
      expect(models.filter((model) => !ids.has(model))).toEqual([]);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error)) throw error;
    }
  });

  it('lets the knight stand on the hills, collide with trees and swim in the lake', async () => {
    const { game } = await launch();
    run(game, 2);
    const knight = game.world.getObject(idOf(game, 'Ritter'));
    const land = game.world.getObject(idOf(game, 'Landschaft'));
    const state = land && terrainRegistry.get(land);
    if (!knight || !state) throw new Error('missing knight or terrain');
    const p = knight.worldPosition();
    expect(p.y).toBeGreaterThan(state.data.heightAt(p.x, p.z) - 0.1);
    expect(p.y).toBeLessThan(state.data.heightAt(p.x, p.z) + 0.6);
    const control = controlRegistry.get(knight);
    expect(control?.swimming).toBe(false);
    // Into the lake: the water is deep there, so the knight floats and swims.
    const lake = game.world.getObject(idOf(game, 'See'));
    const level = lake?.worldPosition();
    if (!lake || !level) throw new Error('no lake');
    knight.object3d.position.set(level.x, level.y + 1, level.z);
    run(game, 3);
    expect(control?.swimming).toBe(true);
    expect(knight.worldPosition().y).toBeLessThan(level.y + 0.2);
    expect(knight.worldPosition().y).toBeGreaterThan(level.y - 2.5);
    game.dispose();
  });

  it('runs a day and night: the clock moves, the lamps light up at night, then rain falls', async () => {
    const { game } = await launch();
    run(game, 1);
    const start = game.timeOfDay();
    run(game, 10);
    // Factor 480: ten seconds are 80 minutes.
    expect(game.timeOfDay() - start).toBeGreaterThan(1.2);
    expect(game.timeOfDay() - start).toBeLessThan(1.5);
    const lamp = game.world.getObject(idOf(game, 'Lampe 1'))?.findComponent('light');
    expect(lamp?.enabled).toBe(false);
    game.setTimeOfDay(21);
    run(game, 1.5);
    expect(lamp?.enabled).toBe(true);
    game.setTimeOfDay(10);
    run(game, 1.5);
    expect(lamp?.enabled).toBe(false);
    // After 45 seconds the script makes it rain.
    expect(game.weather()).toBe('clear');
    run(game, 40);
    expect(game.weather()).toBe('rain');
    game.dispose();
  }, 120_000);

  it('has sound: music, a stream at the lake in 3D, footsteps on grass and feedback on keys', async () => {
    const { game, audio, context } = await launch();
    run(game, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(audio.currentMusic).toBe('builtin:music-calm');
    const stream = context.sources.find((source) => source.panner !== null && source.loop);
    expect(stream).toBeDefined();
    // Walking on grass sounds like grass.
    game.input.keyEvent('w', true, 'KeyW');
    run(game, 4);
    game.input.keyEvent('w', false, 'KeyW');
    expect(audio.played.some((id) => id.startsWith('footstep'))).toBe(true);
    // F: a hit with sparks, a hit sound and a short camera shake; E: an explosion.
    const before = game.world.effects.active;
    game.input.keyEvent('f', true, 'KeyF');
    run(game, 0.2);
    expect(game.world.effects.active).toBeGreaterThan(before);
    expect(audio.played).toContain('builtin:hit');
    game.input.keyEvent('e', true, 'KeyE');
    run(game, 0.2);
    expect(audio.played).toContain('builtin:explosion');
    game.dispose();
  });

  it('switches the graphics level while it runs, without a restart', async () => {
    const { game } = await launch();
    run(game, 0.5);
    for (const level of ['low', 'medium', 'high', 'ultra'] as const) {
      game.setGraphicsLevel(level);
      expect(game.graphicsLevel()).toBe(level);
      run(game, 0.2);
    }
    expect(game.world.getObject(idOf(game, 'Ritter'))).toBeDefined();
    setQuality('high');
    game.dispose();
  });
});
