import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadProject } from '@blockwerk/project';
import type { Project, SceneData } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import {
  animatorRegistry,
  cameraRegistry,
  controlRegistry,
  Game,
  initPhysics,
  ModelCache,
} from '@blockwerk/runtime';
import { AnimationClip, Group, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

/** Acceptance of phase 3 without the UI: `examples/03-held` (SPEC 10, phase 3). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '03-held');
const KNIGHT = 'kaykit-adventurers/knight';

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

/** The animation names of the knight, from the library index (or the known KayKit names). */
function knightClips(): string[] {
  try {
    const index = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', '..', '..', 'library', 'index.json'), 'utf8'),
    ) as { entries: { id: string; animations: string[] }[] };
    const entry = index.entries.find((candidate) => candidate.id === KNIGHT);
    if (entry && entry.animations.length > 0) return entry.animations;
  } catch {
    // `pnpm assets:fetch` was not run: fall back to the names of the KayKit pack.
  }
  return ['Idle', 'Walking_A', 'Running_A', 'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Cheer'];
}

async function launch(): Promise<Game> {
  const project = await loadProject(new NodeFileSystem(folder));
  const models = new ModelCache(() => null);
  models.provide(`library:${KNIGHT}`, {
    scene: new Group(),
    animations: knightClips().map((name) => new AnimationClip(name, 1, [])),
    skinned: false,
  });
  const game = new Game(sceneOf(project), { scripts: () => null, models });
  await game.world.modelsLoaded();
  return game;
}

function run(game: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.stepTick();
    each?.();
  }
}

const key = (game: Game, code: string, down: boolean): void =>
  game.input.keyEvent(code, down, code);

describe('examples/03-held', () => {
  it('loads without problems, has no block scripts and a save writes nothing', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const files = filesOf(folder);
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    expect(project.dirty).toBe(false);
    // Only components: no block script assets and no Block Script components.
    expect(project.assetsOfType('blockScript')).toHaveLength(0);
    const components = Object.values(sceneOf(project).objects).flatMap((o) => o.components);
    expect(components.some((c) => c.type === 'blockScript')).toBe(false);
    expect(components.map((c) => c.type)).toEqual(
      expect.arrayContaining([
        'characterController',
        'thirdPersonControl',
        'animator',
        'thirdPersonCamera',
      ]),
    );
  });

  it('walks, runs, jumps and lands with smooth animation states', async () => {
    const game = await launch();
    const knight = game.world.getObject('heldknight01');
    if (!knight) throw new Error('no knight');
    const animator = animatorRegistry.get(knight);
    const control = controlRegistry.get(knight);
    if (!animator || !control) throw new Error('knight is not set up');
    run(game, 0.5);
    expect(animator.current).toBe('idle');
    expect(control.grounded).toBe(true);
    // Smooth start: the speed rises over several ticks, it does not jump to full speed.
    key(game, 'KeyW', true);
    const speeds: number[] = [];
    run(game, 1.5, () => speeds.push(control.speed));
    expect(speeds[2] ?? 0).toBeLessThan((speeds[speeds.length - 1] ?? 0) * 0.6);
    expect(control.speed).toBeCloseTo(2.2, 1);
    expect(animator.current).toBe('walk');
    key(game, 'ShiftLeft', true);
    run(game, 1.5);
    expect(control.running).toBe(true);
    expect(animator.current).toBe('run');
    // A jump goes through jump, fall and land.
    const states = new Set<string | null>();
    key(game, 'Space', true);
    run(game, 0.05);
    key(game, 'Space', false);
    run(game, 1.2, () => states.add(animator.current));
    expect([...states]).toEqual(expect.arrayContaining(['jump', 'fall']));
    game.dispose();
  });

  it('keeps the camera in front of the wall behind the start', async () => {
    const game = await launch();
    run(game, 1);
    const camera = game.world.getObject('heldcamera01');
    const knight = game.world.getObject('heldknight01');
    if (!camera || !knight) throw new Error('missing');
    // The back wall is at z = -3 (0.4 thick); the camera would be 4 m behind the knight.
    expect(camera.position.z).toBeGreaterThan(-2.8);
    expect(cameraRegistry.get(camera)?.camera.fov).toBeCloseTo(60, 1);
    // Looking forward, the camera is behind the knight on the same side.
    const forward = new Vector3(0, 0, 1).transformDirection(camera.object3d.matrixWorld);
    expect(forward.z).toBeGreaterThan(0.8);
    game.dispose();
  });

  it('climbs the stairs, the ramp and pushes the crates', async () => {
    const game = await launch();
    const knight = game.world.getObject('heldknight01');
    if (!knight) throw new Error('no knight');
    // Stairs on the left (x = -4): the camera looks along +Z, so "A" walks towards +X.
    knight.setPosition(-4, 0.05, 3);
    run(game, 0.3);
    key(game, 'KeyW', true);
    let highest = 0;
    run(game, 5, () => (highest = Math.max(highest, knight.position.y)));
    expect(highest).toBeGreaterThan(1.3);
    key(game, 'KeyW', false);
    // Ramp on the right (x = 4).
    knight.setPosition(4, 0.05, 3);
    run(game, 0.3);
    key(game, 'KeyW', true);
    highest = 0;
    run(game, 5, () => (highest = Math.max(highest, knight.position.y)));
    expect(highest).toBeGreaterThan(1.0);
    key(game, 'KeyW', false);
    // Crates in the middle.
    const crates = [...game.world.allObjects()].filter((o) => o.name === 'Kiste');
    expect(crates.length).toBeGreaterThanOrEqual(6);
    const before = crates.map((c) => c.position.clone());
    knight.setPosition(0, 0.05, 14);
    run(game, 0.3);
    key(game, 'KeyW', true);
    key(game, 'ShiftLeft', true);
    run(game, 3);
    const moved = crates.filter((c, i) => before[i] && c.position.distanceTo(before[i]) > 0.4);
    expect(moved.length).toBeGreaterThan(1);
    game.dispose();
  });
});
