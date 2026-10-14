import { beforeAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Game, initPhysics } from '../src';
import type { ScriptEntry } from '../src';
import { component, objectData, sceneData, scriptAsset } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

const ground = objectData({
  name: 'Ground',
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [20, 1, 20] },
  components: [component('boxCollider', {}, 'groundcoll01')],
});

function crate(id: string, position: [number, number, number], values = {}) {
  return objectData({
    name: id,
    transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [
      component('boxCollider', {}, `${id.slice(0, 8)}col1`),
      component('rigidbody', values, `${id.slice(0, 8)}rb01`),
    ],
  });
}

function run(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
}

describe('physics', () => {
  it('drops a crate onto the ground and stacks crates', () => {
    const game = new Game(
      sceneData({
        ground000001: ground,
        crate0000001: crate('crate0000001', [0, 3, 0]),
        crate0000002: crate('crate0000002', [0.1, 5, 0]),
      }),
      { scripts: () => null },
    );
    expect(game.physics).not.toBeNull();
    run(game, 0.3);
    const falling = game.world.getObject('crate0000001')?.position.y ?? 0;
    expect(falling).toBeLessThan(3);
    run(game, 3);
    expect(game.world.getObject('crate0000001')?.position.y).toBeCloseTo(0.5, 1);
    expect(game.world.getObject('crate0000002')?.position.y).toBeCloseTo(1.5, 1);
    game.dispose();
  });

  it('respects gravity off, frozen rotation and scene gravity', () => {
    const game = new Game(
      {
        ...sceneData({
          ground000001: ground,
          float0000001: crate('float0000001', [3, 2, 0], { useGravity: false }),
          crate0000001: crate('crate0000001', [-3, 2, 0]),
        }),
        environment: {
          ambientIntensity: 0.3,
          fog: { enabled: false, near: 10, far: 100 },
          gravity: [0, -1.62, 0],
        },
      },
      { scripts: () => null },
    );
    run(game, 0.5);
    expect(game.world.getObject('float0000001')?.position.y).toBeCloseTo(2, 5);
    // Moon gravity: after 0.5 s a free fall covers about 0.2 m.
    expect(game.world.getObject('crate0000001')?.position.y).toBeCloseTo(2 - 0.5 * 1.62 * 0.25, 1);
    game.dispose();
  });

  it('a moving collider without rigidbody becomes kinematic and carries a crate', () => {
    const platform = objectData({
      name: 'Platform',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [4, 0.5, 4] },
      components: [
        component('boxCollider', {}, 'platcoll0001'),
        component('blockScript', { script: 'script000001' }, 'platscript01'),
      ],
    });
    const lift: ScriptEntry = {
      id: 'lift',
      event: { type: 'update' },
      *run(self) {
        if (self.position.y < 3) self.move('up', 0.02);
      },
    };
    const asset = scriptAsset('script000001', [lift]);
    const game = new Game(
      sceneData({ platform0001: platform, crate0000001: crate('crate0000001', [0, 1, 0]) }),
      { scripts: () => asset },
    );
    run(game, 3);
    // The platform rose 3 m and the crate stands on it.
    expect(game.world.getObject('platform0001')?.position.y).toBeCloseTo(3, 1);
    expect(game.world.getObject('crate0000001')?.position.y).toBeGreaterThan(3.3);
    game.dispose();
  });

  it('pushes, sets velocity and reports zone events on triggers', () => {
    const zoneScript = scriptAsset('script000002', [
      {
        id: 'enter',
        event: { type: 'zone', params: { target: 'any', phase: 'enter' } },
        *run(_self, api) {
          api.vars['entered'] = 1;
        },
      },
    ]);
    const zone = objectData({
      name: 'Zone',
      transform: { position: [5, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component('boxCollider', { isTrigger: true }, 'zonecoll0001'),
        component('blockScript', { script: 'script000002' }, 'zonescript01'),
      ],
    });
    const game = new Game(
      sceneData({
        ground000001: ground,
        zone00000001: zone,
        crate0000001: crate('crate0000001', [0, 0.5, 0], { freezeRotationZ: true }),
      }),
      { scripts: () => zoneScript },
    );
    run(game, 0.2);
    const object = game.world.getObject('crate0000001');
    if (!object || !game.physics) throw new Error('setup');
    game.physics.setVelocity(object, new Vector3(8, 0, 0));
    run(game, 1.5);
    expect(object.position.x).toBeGreaterThan(4);
    expect(game.vars['entered']).toBe(1);
    // A ray from above hits the crate.
    const hit = game.physics.raycast(
      object.worldPosition().add(new Vector3(0, 5, 0)),
      new Vector3(0, -1, 0),
      10,
    );
    expect(hit?.object).toBe(object);
    expect(hit?.distance).toBeCloseTo(4.5, 1);
    game.dispose();
  });

  it('layers that ignore each other pass through', () => {
    const ghost = { ...crate('ghost0000001', [0, 3, 0]), layer: 'Geister' };
    const game = new Game(
      sceneData({ ground000001: { ...ground, layer: 'Boden' }, ghost0000001: ghost }),
      {
        scripts: () => null,
        physics: {
          gravity: [0, -9.81, 0],
          layers: ['Default', 'Boden', 'Geister'],
          ignoredPairs: [['Boden', 'Geister']],
        },
      },
    );
    run(game, 1.5);
    expect(game.world.getObject('ghost0000001')?.position.y).toBeLessThan(-2);
    game.dispose();
  });
});
