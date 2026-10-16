import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compileBlockScript } from '@blockwerk/compiler';
import { buildGame } from '@blockwerk/export';
import { readLibraryFolder } from '@blockwerk/export/node';
import { assetDisplayName, loadProject, resolvePrefab } from '@blockwerk/project';
import type { Project, SceneData } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import {
  Game,
  initNavigation,
  initPhysics,
  loadScriptModule,
  peekInventory,
} from '@blockwerk/runtime';
import type { GameLogEntry, GameObject, ScriptAsset } from '@blockwerk/runtime';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkScene } from '../src/document/sceneCheck';

/**
 * Acceptance of the template projects (SPEC phase 11) without the UI: each template opens without
 * problems, passes the scene check, runs, and its one mechanic works.
 */
const root = join(import.meta.dirname, '..', '..', '..', 'templates');
const TEMPLATES = ['abenteuer', 'arena', 'plattformer', 'koop', 'rennen'] as const;

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

function filesOf(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else result[relative(directory, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(directory);
  return result;
}

function startScene(project: Project): SceneData {
  const id = project.settings.startScene;
  const scene = id ? project.assetOfType(id, 'scene') : undefined;
  if (!scene) throw new Error('no start scene');
  return scene.data;
}

interface Launched {
  readonly game: Game;
  readonly project: Project;
  readonly log: GameLogEntry[];
}

async function launch(id: string): Promise<Launched> {
  const project = await loadProject(new NodeFileSystem(join(root, id)));
  const assets = new Map<string, ScriptAsset>();
  for (const entry of project.assetsOfType('blockScript')) {
    const result = compileBlockScript(entry.data.workspace, {
      assetName: assetDisplayName(entry.path),
      variables: entry.data.variables,
    });
    expect(result.diagnostics, entry.path).toEqual([]);
    assets.set(entry.id, {
      assetId: entry.id,
      module: loadScriptModule(result.code),
      variables: entry.data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `test://${entry.id}`,
    });
  }
  const log: GameLogEntry[] = [];
  const game = new Game(startScene(project), {
    scripts: (scriptId) => assets.get(scriptId) ?? null,
    prefabs: (prefabId) =>
      resolvePrefab(prefabId, (prefab) => project.assetOfType(prefab, 'prefab')?.data) ?? null,
    log: (entry) => log.push(entry),
    random: () => 0.5,
  });
  await game.world.modelsLoaded();
  return { game, project, log };
}

const run = (game: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
};

const named = (game: Game, name: string): GameObject => {
  const object = [...game.world.allObjects()].find((candidate) => candidate.name === name);
  if (!object) throw new Error(`no object ${name}`);
  return object;
};

const userLines = (log: readonly GameLogEntry[]): string[] =>
  log.flatMap((entry) => (entry.kind === 'userLog' ? [entry.message] : []));

describe.each(TEMPLATES)('template %s', (id) => {
  it('opens without problems, saves without changes and passes the scene check', async () => {
    const project = await loadProject(new NodeFileSystem(join(root, id)));
    expect(project.problems).toEqual([]);
    const files = filesOf(join(root, id));
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    const { game } = await launch(id);
    const problems = checkScene(game.world, {
      project,
      displayName: assetDisplayName,
      locale: 'en',
    });
    expect(problems.map((problem) => `${problem.code} ${JSON.stringify(problem.params)}`)).toEqual(
      [],
    );
    game.dispose();
  });

  it('exports as a game with credits and without a problem', async () => {
    const project = await loadProject(new NodeFileSystem(join(root, id)));
    const library = await readLibraryFolder(join(root, '..', 'library'));
    const result = await buildGame({ project, library });
    expect(result.problems.filter((problem) => problem.severity === 'error')).toEqual([]);
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('game/game.json');
    expect(paths).toContain('CREDITS.txt');
  });

  it('runs for a few seconds without an error', async () => {
    const { game, log } = await launch(id);
    run(game, 3);
    expect(log.filter((entry) => entry.level === 'error')).toEqual([]);
    expect(userLines(log).length).toBeGreaterThan(0);
    game.dispose();
  });
});

describe('template abenteuer', () => {
  it('collects a coin by walking up to it and says so when the flag is reached', async () => {
    const { game, log } = await launch('abenteuer');
    run(game, 0.5);
    const knight = named(game, 'Ritter');
    expect(peekInventory(knight)?.count('Münze') ?? 0).toBe(0);
    knight.setWorldPosition(named(game, 'Münze 1').worldPosition());
    run(game, 0.3);
    expect(peekInventory(knight)?.count('Münze')).toBe(1);
    knight.setWorldPosition(
      named(game, 'Ziel')
        .worldPosition()
        .add(new Vector3(0, 0.1, 0)),
    );
    run(game, 0.3);
    expect(userLines(log).some((line) => line.startsWith('Geschafft'))).toBe(true);
    game.dispose();
  });
});

describe('template arena', () => {
  it('shoots a bullet with the attack button, and the skeletons come for the player', async () => {
    const { game } = await launch('arena');
    run(game, 0.5);
    const before = [...game.world.allObjects()].length;
    game.input.keyEvent('KeyF', true, 'KeyF');
    run(game, 0.1);
    game.input.keyEvent('KeyF', false, 'KeyF');
    run(game, 0.1);
    expect([...game.world.allObjects()].length).toBeGreaterThan(before);
    const skeleton = named(game, 'Skelett 3');
    const player = named(game, 'Spieler');
    const start = skeleton.worldPosition().distanceTo(player.worldPosition());
    run(game, 4);
    expect(skeleton.worldPosition().distanceTo(player.worldPosition())).toBeLessThan(start - 2);
    game.dispose();
  });
});

describe('template plattformer', () => {
  it('puts the knight back on the start point after a fall', async () => {
    const { game } = await launch('plattformer');
    run(game, 0.5);
    const knight = named(game, 'Ritter');
    knight.setWorldPosition(new Vector3(30, -20, 30));
    run(game, 0.5);
    const start = named(game, 'Startpunkt').worldPosition();
    expect(knight.worldPosition().distanceTo(start)).toBeLessThan(1.5);
    game.dispose();
  });
});

describe('template koop', () => {
  it('has two players with their own cameras, and both collect the same coins', async () => {
    const { game, log } = await launch('koop');
    run(game, 0.5);
    expect(game.views().views.map((view) => view.player)).toEqual(['1', '2']);
    named(game, 'Ritter').setWorldPosition(named(game, 'Münze 1').worldPosition());
    named(game, 'Schurkin').setWorldPosition(named(game, 'Münze 2').worldPosition());
    run(game, 0.4);
    const coins = [...game.world.allObjects()].filter((o) => o.name?.startsWith('Münze'));
    expect(coins.length).toBe(10);
    expect(Object.values(game.vars).some((value) => value === 2)).toBe(true);
    expect(userLines(log).some((line) => line.startsWith('Geschafft'))).toBe(false);
    game.dispose();
  });
});

describe('template rennen', () => {
  it('counts a lap only after the halfway line, and ends after three laps', async () => {
    const { game, log } = await launch('rennen');
    run(game, 0.5);
    const car = named(game, 'Taxi');
    const finish = named(game, 'Ziellinie').worldPosition();
    const half = named(game, 'Halbzeit').worldPosition();
    const visit = (point: Vector3): void => {
      car.setWorldPosition(point.clone().add(new Vector3(0, 0.2, 0)));
      run(game, 0.2);
      car.setWorldPosition(new Vector3(-10, 0.2, -15));
      run(game, 0.2);
    };
    visit(finish);
    expect(Object.values(game.vars)).not.toContain(1);
    for (let lap = 0; lap < 3; lap++) {
      visit(half);
      visit(finish);
    }
    expect(Object.values(game.vars)).toContain(3);
    expect(userLines(log).some((line) => line.startsWith('Ziel!'))).toBe(true);
    game.dispose();
  });
});
