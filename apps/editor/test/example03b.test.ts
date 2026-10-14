import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadProject } from '@blockwerk/project';
import type { Project, SceneData } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import { controlRegistry, figureRegistry, Game, initPhysics, ModelCache } from '@blockwerk/runtime';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

/** Acceptance of phase 3b without the UI: `examples/03b-figur` (SPEC 10, phase 3b). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '03b-figur');

beforeAll(async () => {
  await initPhysics();
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

function sceneOf(project: Project): SceneData {
  const id = project.settings.startScene;
  const scene = id ? project.assetOfType(id, 'scene') : undefined;
  if (!scene) throw new Error('no start scene');
  return scene.data;
}

/** A model with the parts of the knight (the real one needs `pnpm assets:fetch`). */
function stubModels(): ModelCache {
  const models = new ModelCache(() => null);
  const scene = new Group();
  for (const name of ['Knight_Body', 'Knight_Head', 'Knight_ArmLeft', 'Knight_ArmRight']) {
    const part = new Mesh(
      new BoxGeometry(0.4, 0.4, 0.4).translate(0, 0.2, 0),
      new MeshStandardMaterial(),
    );
    part.name = name;
    scene.add(part);
  }
  models.provide('library:kaykit-adventurers/knight', { scene, animations: [], skinned: false });
  const sword = new Group();
  sword.add(new Mesh(new BoxGeometry(0.05, 0.6, 0.05)));
  models.provide('library:kaykit-adventurers/sword-1handed', {
    scene: sword,
    animations: [],
    skinned: false,
  });
  return models;
}

async function launch(): Promise<Game> {
  const project = await loadProject(new NodeFileSystem(folder));
  const game = new Game(sceneOf(project), {
    scripts: () => null,
    models: stubModels(),
  });
  await game.world.modelsLoaded();
  return game;
}

function run(game: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.stepTick();
    each?.();
  }
}

describe('examples/03b-figur', () => {
  it('loads without problems, uses only components and a save writes nothing', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const files = filesOf(folder);
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    expect(project.dirty).toBe(false);
    expect(project.assetsOfType('blockScript')).toHaveLength(0);
    const prefabs = project.assetsOfType('prefab');
    expect(prefabs.map((asset) => asset.data.base !== null).sort()).toEqual([false, true]);
    const types = Object.values(sceneOf(project).objects).flatMap((o) =>
      o.components.map((c) => c.type),
    );
    expect(types).toEqual(expect.arrayContaining(['character', 'doubleJump', 'roll']));
    expect(types).not.toContain('blockScript');
  });

  it('dresses the knight: helmet shown, sword in the right hand, blue colors', async () => {
    const game = await launch();
    run(game, 0.3);
    await game.world.modelsLoaded();
    const knight = game.world.getObject('heldknight01');
    const info = knight ? figureRegistry.get(knight) : undefined;
    expect(info?.mode).toBe('rigid');
    expect([...(info?.attached.keys() ?? [])]).toEqual(['rightHand']);
    game.dispose();
  });

  it('double jump and roll work without a single block', async () => {
    const game = await launch();
    const knight = game.world.getObject('heldknight01');
    const control = knight ? controlRegistry.get(knight) : undefined;
    if (!knight || !control) throw new Error('knight is not set up');
    run(game, 0.5);
    const jump = (airTicks: number, again: boolean): number => {
      let highest = 0;
      game.input.keyEvent('Space', true, 'Space');
      run(game, 0.05);
      game.input.keyEvent('Space', false, 'Space');
      run(game, airTicks / 60, () => (highest = Math.max(highest, knight.worldPosition().y)));
      if (again) {
        game.input.keyEvent('Space', true, 'Space');
        run(game, 0.05);
        game.input.keyEvent('Space', false, 'Space');
      }
      run(game, 1.5, () => (highest = Math.max(highest, knight.worldPosition().y)));
      return highest;
    };
    const single = jump(0, false);
    run(game, 1);
    const double = jump(25, true);
    expect(double).toBeGreaterThan(single + 0.5);
    run(game, 1);
    game.input.keyEvent('KeyW', true, 'KeyW');
    run(game, 0.5);
    game.input.keyEvent('KeyQ', true, 'KeyQ');
    run(game, 0.1);
    expect(control.rolling).toBe(true);
    game.dispose();
  });

  it('player 2 is a prefab variant with other colors, its own steering and camera', async () => {
    const game = await launch();
    run(game, 0.2);
    const two = [...game.world.allObjects()].find((object) => object.name === 'Ritter Variante');
    expect(two).toBeDefined();
    const control = two ? controlRegistry.get(two) : undefined;
    expect(control?.player).toBe(2);
    const character = two?.findComponent('character');
    expect(String(character?.values['tints'])).toContain('#a53a3a');
    expect(game.views().views.map((view) => view.player)).toEqual(['1', '2']);
    game.dispose();
  });
});
