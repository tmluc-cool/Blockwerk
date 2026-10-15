import { join } from 'node:path';
import { compileProject } from '@blockwerk/compiler';
import {
  assetDependencies,
  assetDisplayName,
  loadProject,
  renameGameVariable,
  resolvePrefab,
} from '@blockwerk/project';
import type { JsonValue, Project } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import {
  Game,
  initNavigation,
  initPhysics,
  loadScriptModule,
  MemorySaveStorage,
} from '@blockwerk/runtime';
import type { GameObject, GameLogEntry, ScriptAsset } from '@blockwerk/runtime';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

/** Acceptance of phase 7 without the UI: `examples/07-gross` (SPEC 10, phase 7). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '07-gross');

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const VAR_COINS = 'grossvmuenz1';
const VAR_BAG = 'grossvsack01';
const VAR_MESSAGE = 'grossvmeld01';

/** Compiles every script of the project together (so project-wide custom blocks are linked). */
function compileAll(project: Project) {
  return compileProject(
    project.assetsOfType('blockScript').map((entry) => ({
      assetId: entry.id,
      assetName: assetDisplayName(entry.path),
      workspace: entry.data.workspace,
      variables: entry.data.variables,
    })),
  );
}

function launch(project: Project, log: GameLogEntry[] = []): Game {
  const compiled = compileAll(project);
  const assets = new Map<string, ScriptAsset>();
  for (const entry of project.assetsOfType('blockScript')) {
    const result = compiled.get(entry.id);
    if (!result) throw new Error(`no result for ${entry.id}`);
    assets.set(entry.id, {
      assetId: entry.id,
      module: loadScriptModule(result.code),
      variables: entry.data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `test://${entry.id}`,
    });
  }
  const scene = project.assetsOfType('scene')[0];
  if (!scene) throw new Error('no scene');
  return new Game(scene.data, {
    scripts: (id) => assets.get(id) ?? null,
    prefabs: (id) =>
      resolvePrefab(id, (prefab) => project.assetOfType(prefab, 'prefab')?.data) ?? null,
    uis: (id) => project.assetOfType(id, 'ui')?.data ?? null,
    saves: new MemorySaveStorage(),
    sceneId: scene.id,
    log: (entry) => log.push(entry),
    random: () => 0.5,
  });
}

const run = (game: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
};

const named = (game: Game, name: string): GameObject => {
  const object = [...game.world.allObjects()].find((candidate) => candidate.name === name);
  if (!object) throw new Error(`no object ${name}`);
  return object;
};

const press = (game: Game, key: string): void => {
  game.input.keyEvent(key.toLowerCase(), true, `Key${key}`);
  run(game, 0.05);
  game.input.keyEvent(key.toLowerCase(), false, `Key${key}`);
  run(game, 0.05);
};

describe('examples/07-gross', { timeout: 180_000 }, () => {
  it('loads without problems, has 80+ scripts over all areas, and loads in under 3 seconds', async () => {
    const started = performance.now();
    const project = await loadProject(new NodeFileSystem(folder));
    const compiled = compileAll(project);
    const game = launch(project);
    const seconds = (performance.now() - started) / 1000;
    expect(project.problems).toEqual([]);
    const scripts = project.assetsOfType('blockScript');
    expect(scripts.length).toBeGreaterThanOrEqual(80);
    // Every script compiles without a single problem.
    for (const entry of scripts) {
      expect(compiled.get(entry.id)?.diagnostics, assetDisplayName(entry.path)).toEqual([]);
    }
    // Scripts hang on objects of every area.
    const scene = project.assetsOfType('scene')[0]?.data;
    const areaOf = (id: string): string | undefined => {
      let object = scene?.objects[id];
      while (object?.parent) object = scene?.objects[object.parent];
      return object?.area;
    };
    const areas = new Set<string>();
    for (const [id, object] of Object.entries(scene?.objects ?? {})) {
      if (object.components.some((component) => component.type === 'blockScript')) {
        const area = areaOf(id);
        if (area) areas.add(area);
      }
    }
    expect([...areas].sort()).toEqual(['environment', 'items', 'npcs', 'player1', 'player2', 'ui']);
    expect(seconds).toBeLessThan(3);
    game.dispose();
  });

  it('runs for a while without a script error', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const log: GameLogEntry[] = [];
    const game = launch(project, log);
    run(game, 20);
    expect(log.filter((entry) => entry.kind === 'scriptError')).toEqual([]);
    game.dispose();
  });

  it('custom blocks of the library work across scripts: buying, lists, dictionaries, locals, dice', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = launch(project);
    run(game, 0.2);
    expect(game.vars[VAR_COINS]).toBe(50);
    press(game, 'B');
    expect(game.vars[VAR_COINS]).toBe(47);
    expect(game.vars[VAR_BAG]).toEqual(['Brot']);
    expect(game.vars[VAR_MESSAGE]).toBe('Gekauft: Brot');
    press(game, 'R');
    expect(game.vars[VAR_MESSAGE]).toBe('Rucksack: Brot');
    press(game, 'P');
    expect(String(game.vars[VAR_MESSAGE])).toContain('Apfel, Brot, Fackel');
    // The average of 2,3,40,12,25 (a list, local variables, a loop in a custom block).
    press(game, 'D');
    expect(game.vars[VAR_MESSAGE]).toBe('Durchschnitt: 16');
    // Ten dice in one tick (the block runs without screen refresh); the random test source is 0.5.
    press(game, 'T');
    expect(String(game.vars[VAR_MESSAGE])).toMatch(/^Würfel: \d+$/);
    game.dispose();
  });

  it('a merchant sells to the player who walks up to the stall', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const game = launch(project);
    run(game, 0.2);
    const stall = named(game, 'Obst-Max').worldPosition();
    named(game, 'Ritter').setWorldPosition(stall.clone().add(new Vector3(0, 0.2, 0.5)));
    run(game, 2.5);
    // Apfel costs 2; one purchase, even though the player stays in the zone.
    expect(game.vars[VAR_COINS]).toBe(48);
    expect(game.vars[VAR_BAG]).toEqual(['Apfel']);
    game.dispose();
  });

  it('renaming a game variable changes it in every script that uses it', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const scripts = project.assetsOfType('blockScript').map((entry) => ({
      id: entry.id,
      data: entry.data,
    }));
    const users = scripts.filter((script) =>
      script.data.variables.some((variable) => variable.id === VAR_COINS),
    );
    expect(users.length).toBeGreaterThan(20);
    const changed = renameGameVariable(scripts, VAR_COINS, 'Gold');
    expect(changed.size).toBe(users.length);
    for (const data of changed.values()) {
      expect(data.variables.find((variable) => variable.id === VAR_COINS)?.name).toBe('Gold');
    }
    // The blocks refer to the variable by ID, so every script still compiles and behaves the same.
    for (const [id, data] of changed) project.updateAsset(id, 'blockScript', data);
    const game = launch(project);
    run(game, 0.2);
    press(game, 'B');
    expect(game.vars[VAR_COINS]).toBe(47);
    game.dispose();
  });

  it('a prefab with its script takes the library script along', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const prefab = project.assetsOfType('prefab')[0];
    expect(prefab).toBeDefined();
    if (!prefab) return;
    const needed = assetDependencies(
      prefab.id,
      (id) => {
        const asset = project.asset(id);
        return asset && asset.type !== 'model' ? (asset.data as unknown as JsonValue) : undefined;
      },
      (id) => project.asset(id) !== undefined,
    );
    const names = needed.map((id) => assetDisplayName(project.asset(id)?.path ?? ''));
    expect(names).toContain('Marktstand');
    expect(names).toContain('Werkzeuge');
    // Only these assets go into another project; the script compiles there without a missing block.
    const subset = project
      .assetsOfType('blockScript')
      .filter((entry) => needed.includes(entry.id))
      .map((entry) => ({
        assetId: entry.id,
        assetName: assetDisplayName(entry.path),
        workspace: entry.data.workspace,
        variables: entry.data.variables,
      }));
    for (const [, result] of compileProject(subset)) expect(result.diagnostics).toEqual([]);
  });
});
