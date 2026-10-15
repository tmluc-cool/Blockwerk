import { beforeAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { controlRegistry, Game, initNavigation, initPhysics, navAgentRegistry } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const ground = objectData({
  name: 'Ground',
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [40, 1, 40] },
  components: [component('boxCollider', {}, 'groundcoll01')],
});

/** A wall along the Z axis, 12 m long, in the middle of the ground. */
function wall(extra: ReturnType<typeof component>[] = []) {
  return objectData({
    name: 'Wall',
    transform: { position: [0, 1.5, 0], rotation: [0, 0, 0], scale: [1, 3, 12] },
    components: [component('boxCollider', {}, 'wallcoll0001'), ...extra],
  });
}

function agent(name: string, position: [number, number, number], values = {}) {
  return objectData({
    name,
    transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [component('navAgent', values, `${name.slice(0, 6)}nav01`.padEnd(12, '0'))],
  });
}

function run(game: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.stepTick();
    each?.();
  }
}

describe('navigation mesh', () => {
  it('finds a way around a wall and not through it', () => {
    const game = new Game(sceneData({ ground000001: ground, wall00000001: wall() }), {
      scripts: () => null,
    });
    const path = game.world.navigation.findPath(new Vector3(-8, 0, 0), new Vector3(8, 0, 0));
    expect(path).not.toBeNull();
    // The wall is 12 m long (z from -6 to 6): the way leads past one of its ends.
    const farthest = Math.max(...(path ?? []).map((p) => Math.abs(p.z)));
    expect(farthest).toBeGreaterThan(6);
    game.dispose();
  });

  it('walks straight where nothing is in the way, and leaves out ignored objects', () => {
    const ignored = wall([component('navObstacle', { mode: 'ignore' }, 'wallmod00001')]);
    const game = new Game(sceneData({ ground000001: ground, wall00000001: ignored }), {
      scripts: () => null,
    });
    const path = game.world.navigation.findPath(new Vector3(-8, 0, 0), new Vector3(8, 0, 0));
    expect(Math.max(...(path ?? []).map((p) => Math.abs(p.z)))).toBeLessThan(1);
    game.dispose();
  });

  it('treats a Nav Obstacle box without a collider as an obstacle', () => {
    const marker = objectData({
      name: 'Marker',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component(
          'navObstacle',
          { mode: 'obstacle', center: [0, 1.5, 0], size: [1, 3, 12] },
          'markermod001',
        ),
      ],
    });
    const game = new Game(sceneData({ ground000001: ground, marker000001: marker }), {
      scripts: () => null,
    });
    const path = game.world.navigation.findPath(new Vector3(-8, 0, 0), new Vector3(8, 0, 0));
    expect(Math.max(...(path ?? []).map((p) => Math.abs(p.z)))).toBeGreaterThan(6);
    game.dispose();
  });

  it('uses the agent size of the scene: wide agents keep further from walls', () => {
    const data = sceneData({ ground000001: ground, wall00000001: wall() });
    const narrow = new Game(data, { scripts: () => null });
    const wide = new Game(
      {
        ...data,
        environment: {
          ...data.environment,
          navigation: {
            agentRadius: 1.2,
            agentHeight: 1.8,
            maxClimb: 0.4,
            maxSlope: 45,
            cellSize: 0,
          },
        },
      },
      { scripts: () => null },
    );
    const from = new Vector3(-8, 0, 0);
    const to = new Vector3(8, 0, 0);
    const reach = (game: Game): number =>
      Math.max(...(game.world.navigation.findPath(from, to) ?? []).map((p) => Math.abs(p.z)));
    expect(reach(wide)).toBeGreaterThan(reach(narrow));
    narrow.dispose();
    wide.dispose();
  });
});

describe('nav agent', () => {
  it('walks around the wall to a destination and stops there', () => {
    const game = new Game(
      sceneData({
        ground000001: ground,
        wall00000001: wall(),
        agent0000001: agent('Agent', [-8, 0, 0]),
      }),
      { scripts: () => null },
    );
    const object = game.world.getObject('agent0000001');
    const handle = object ? navAgentRegistry.get(object) : undefined;
    expect(handle).toBeDefined();
    game.stepTick();
    expect(handle?.moveTo(new Vector3(8, 0, 0))).toBe(true);
    let crossedWithin = Infinity;
    run(game, 14, () => {
      const p = object?.position;
      if (p && Math.abs(p.x) < 0.8) crossedWithin = Math.min(crossedWithin, Math.abs(p.z));
    });
    expect(object?.position.x).toBeGreaterThan(7.5);
    expect(object?.position.y).toBeCloseTo(0, 1);
    // It went round the end of the wall, never through it.
    expect(crossedWithin).toBeGreaterThan(5.9);
    expect(handle?.arrived).toBe(true);
    expect(handle?.moving).toBe(false);
    game.dispose();
  });

  it('refuses a destination far outside the mesh', () => {
    const game = new Game(
      sceneData({ ground000001: ground, agent0000001: agent('Agent', [0, 0, 5]) }),
      { scripts: () => null },
    );
    const object = game.world.getObject('agent0000001');
    const handle = object ? navAgentRegistry.get(object) : undefined;
    game.stepTick();
    expect(handle?.moveTo(new Vector3(200, 0, 200))).toBe(false);
    expect(handle?.moving).toBe(false);
    game.dispose();
  });

  it('gives the animator a control state with the walking speed', () => {
    const game = new Game(
      sceneData({ ground000001: ground, agent0000001: agent('Agent', [-5, 0, 0], { speed: 4 }) }),
      { scripts: () => null },
    );
    const object = game.world.getObject('agent0000001');
    const handle = object ? navAgentRegistry.get(object) : undefined;
    game.stepTick();
    handle?.moveTo(new Vector3(5, 0, 0));
    run(game, 1);
    const control = object ? controlRegistry.get(object) : undefined;
    expect(control?.mode).toBe('agent');
    expect(control?.speed).toBeGreaterThan(2);
    expect(control?.speed).toBeLessThanOrEqual(4.2);
    // It faces the way it walks (+X is heading 90°).
    expect(object?.heading).toBeGreaterThan(80);
    expect(object?.heading).toBeLessThan(100);
    game.dispose();
  });

  it('keeps agents that walk towards each other apart', () => {
    const game = new Game(
      sceneData({
        ground000001: ground,
        agenta000001: agent('AgentA', [-6, 0, 0.05]),
        agentb000001: agent('AgentB', [6, 0, -0.05]),
      }),
      { scripts: () => null },
    );
    const a = game.world.getObject('agenta000001');
    const b = game.world.getObject('agentb000001');
    game.stepTick();
    if (a) navAgentRegistry.get(a)?.moveTo(new Vector3(6, 0, 0));
    if (b) navAgentRegistry.get(b)?.moveTo(new Vector3(-6, 0, 0));
    let closest = Infinity;
    run(game, 8, () => {
      if (a && b) closest = Math.min(closest, a.position.distanceTo(b.position));
    });
    expect(closest).toBeGreaterThan(0.5);
    // Both got through to the other side.
    expect(a?.position.x).toBeGreaterThan(4);
    expect(b?.position.x).toBeLessThan(-4);
    game.dispose();
  });

  it('follows a teleport instead of snapping back', () => {
    const game = new Game(
      sceneData({ ground000001: ground, agent0000001: agent('Agent', [-5, 0, 0]) }),
      { scripts: () => null },
    );
    const object = game.world.getObject('agent0000001');
    game.stepTick();
    object?.setPosition(5, 0, 5);
    run(game, 0.5);
    expect(object?.position.x).toBeCloseTo(5, 0);
    expect(object?.position.z).toBeCloseTo(5, 0);
    game.dispose();
  });
});
