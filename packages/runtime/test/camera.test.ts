import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObjectData } from '@blockwerk/project';
import { Quaternion, Vector3 } from 'three';
import { cameraBehaviorRegistry, cameraRegistry, Game, initPhysics } from '../src';
import type { GameObject } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

type Vec = [number, number, number];

const ground = objectData({
  name: 'Ground',
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [80, 1, 80] },
  components: [component('boxCollider', {}, 'groundcoll01')],
});

function hero(id: string, player: '1' | '2' = '1', position: Vec = [0, 0, 0]): SceneObjectData {
  return objectData({
    name: id,
    transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [
      component('characterController', {}, `${id.slice(0, 7)}ccc1`),
      component('thirdPersonControl', { player }, `${id.slice(0, 7)}ctl1`),
    ],
  });
}

function rig(
  behavior: string,
  values: Record<string, string | number | boolean | null> = {},
  camera: Record<string, string | number> = {},
  position: Vec = [0, 3, -6],
  name = 'Rig',
): SceneObjectData {
  return objectData({
    name,
    transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [
      component('camera', camera, `${name.slice(0, 6).padEnd(6, 'x')}cam001`),
      component(behavior, values, `${name.slice(0, 6).padEnd(6, 'x')}beh001`),
    ],
  });
}

function run(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
}

function get(game: Game, id: string): GameObject {
  const object = game.world.getObject(id);
  if (!object) throw new Error(`missing ${id}`);
  return object;
}

/** View direction of a camera object (objects look along +Z). */
function forward(object: GameObject): Vector3 {
  return new Vector3(0, 0, 1).applyQuaternion(object.object3d.getWorldQuaternion(new Quaternion()));
}

describe('camera behaviors', () => {
  it('third person: starts behind the character, follows with lag, orbits with the mouse', () => {
    const game = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: hero('hero00000001'),
        rig000000001: rig('thirdPersonCamera'),
      }),
      { scripts: () => null },
    );
    run(game, 0.5);
    const camera = get(game, 'rig000000001');
    const target = get(game, 'hero00000001');
    const pivot = (): Vector3 => target.worldPosition().add(new Vector3(0, 1.5, 0));
    // Behind (-Z) the character, looking forward, about 4 m from the pivot.
    expect(camera.position.z).toBeLessThan(-3);
    expect(forward(camera).z).toBeGreaterThan(0.8);
    expect(camera.position.distanceTo(pivot())).toBeCloseTo(4, 0);
    // Walking forward: the camera lags behind a little, then keeps up.
    game.input.keyEvent('KeyW', true, 'KeyW');
    run(game, 1);
    const lag = camera.position.distanceTo(pivot());
    expect(lag).toBeGreaterThan(4.05);
    expect(lag).toBeLessThan(4.6);
    game.input.keyEvent('KeyW', false, 'KeyW');
    run(game, 1);
    expect(camera.position.distanceTo(pivot())).toBeCloseTo(4, 1);
    // Mouse right by 600 px = 90°: the camera now looks towards -X (to the right).
    game.input.mouseMove(600, 0);
    run(game, 0.05);
    expect(forward(camera).x).toBeLessThan(-0.9);
    game.dispose();
  });

  it('third person: moves in front of walls and zooms with the wheel', () => {
    const wall = objectData({
      name: 'Wall',
      transform: { position: [0, 1.5, -2.5], rotation: [0, 0, 0], scale: [6, 3, 0.3] },
      components: [component('boxCollider', {}, 'wallcoll0001')],
    });
    const game = new Game(
      sceneData({
        ground000001: ground,
        wall00000001: wall,
        hero00000001: hero('hero00000001'),
        rig000000001: rig('thirdPersonCamera'),
      }),
      { scripts: () => null },
    );
    run(game, 0.5);
    const camera = get(game, 'rig000000001');
    // The wall is 2.35 m behind the character: the camera stays in front of it.
    expect(camera.position.z).toBeGreaterThan(-2.35);
    get(game, 'wall00000001').setActive(false);
    game.stepTick();
    game.dispose();

    const open = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: hero('hero00000001'),
        rig000000001: rig('thirdPersonCamera'),
      }),
      { scripts: () => null },
    );
    run(open, 0.3);
    open.input.wheel(300);
    run(open, 0.02);
    const behavior = cameraBehaviorRegistry.get(get(open, 'rig000000001'))?.[0];
    expect(behavior?.distance).toBeCloseTo(5.5, 5);
    run(open, 1.5);
    const pivot = get(open, 'hero00000001')
      .worldPosition()
      .add(new Vector3(0, 1.5, 0));
    expect(get(open, 'rig000000001').position.distanceTo(pivot)).toBeCloseTo(5.5, 0);
    open.dispose();
  });

  it('widens the view while sprinting and shakes', () => {
    const game = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: hero('hero00000001'),
        rig000000001: rig('thirdPersonCamera'),
      }),
      { scripts: () => null },
    );
    run(game, 0.3);
    const entry = cameraRegistry.get(get(game, 'rig000000001'));
    if (!entry) throw new Error('camera');
    expect(entry.camera.fov).toBeCloseTo(60, 3);
    game.input.keyEvent('KeyW', true, 'KeyW');
    game.input.keyEvent('ShiftLeft', true, 'ShiftLeft');
    run(game, 1.5);
    expect(entry.camera.fov).toBeGreaterThan(66);
    game.input.keyEvent('ShiftLeft', false, 'ShiftLeft');
    run(game, 2);
    expect(entry.camera.fov).toBeLessThan(61);
    entry.shake(3, 0.5);
    run(game, 0.1);
    expect(Math.abs(entry.camera.rotation.x) + Math.abs(entry.camera.rotation.z)).toBeGreaterThan(
      0.001,
    );
    run(game, 0.5);
    expect(entry.camera.rotation.x).toBe(0);
    entry.animateFov(90, 1);
    run(game, 0.5);
    expect(entry.camera.fov).toBeGreaterThan(70);
    expect(entry.camera.fov).toBeLessThan(85);
    run(game, 0.6);
    expect(entry.camera.fov).toBeCloseTo(90, 3);
    game.dispose();
  });

  it('does not shake the camera when motion is reduced (accessibility)', () => {
    const make = (reduceMotion: boolean): Game =>
      new Game(
        sceneData({
          ground000001: ground,
          hero00000001: hero('hero00000001'),
          rig000000001: rig('thirdPersonCamera'),
        }),
        { scripts: () => null, reduceMotion },
      );
    const shaken = (game: Game): number => {
      run(game, 0.3);
      game.shakeCamera(get(game, 'rig000000001'), 3, 0.5);
      run(game, 0.1);
      const entry = cameraRegistry.get(get(game, 'rig000000001'));
      return Math.abs(entry?.camera.rotation.x ?? 0) + Math.abs(entry?.camera.rotation.z ?? 0);
    };
    const normal = make(false);
    expect(shaken(normal)).toBeGreaterThan(0.001);
    normal.dispose();
    const calm = make(true);
    expect(shaken(calm)).toBe(0);
    calm.dispose();
  });

  it('first person, top down, side, fixed, path and shared cameras', () => {
    const path = objectData({
      name: 'Path',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    });
    const point = (x: number, order: number): SceneObjectData =>
      objectData({
        name: `P${order}`,
        parent: 'path00000001',
        order,
        transform: { position: [x, 2, 10], rotation: [0, 0, 0], scale: [1, 1, 1] },
      });
    const game = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: hero('hero00000001', '1', [0, 0, 0]),
        hero00000002: hero('hero00000002', '2', [6, 0, 0]),
        firstp000001: rig('firstPersonCamera', {}, { player: '1' }, [0, 0, 0], 'FirstP'),
        topdown00001: rig('topDownCamera', { distance: 10, angle: 90 }, {}, [0, 0, 0], 'TopDown'),
        side00000001: rig('sideCamera', {}, {}, [0, 0, 0], 'Side'),
        fixed0000001: rig(
          'fixedCamera',
          { lookAtPlayer: true, damping: 0 },
          {},
          [5, 4, 5],
          'Fixed',
        ),
        pathcam00001: rig(
          'cameraPath',
          { path: 'path00000001', duration: 2 },
          {},
          [0, 0, 0],
          'PathCam',
        ),
        shared000001: rig('sharedCamera', { distance: 4, damping: 0 }, {}, [0, 0, 0], 'Shared'),
        path00000001: path,
        point0000001: point(-4, 0),
        point0000002: point(0, 1),
        point0000003: point(4, 2),
      }),
      { scripts: () => null },
    );
    run(game, 0.5);
    const hero1 = get(game, 'hero00000001').worldPosition();
    // First person at eye height, looking up after moving the mouse up.
    const fp = get(game, 'firstp000001');
    expect(fp.position.y - hero1.y).toBeCloseTo(1.6, 1);
    game.input.mouseMove(0, -200);
    run(game, 0.05);
    expect(forward(fp).y).toBeGreaterThan(0.4);
    // Top down at 90°: straight above, looking down.
    const top = get(game, 'topdown00001');
    expect(top.position.y - hero1.y).toBeCloseTo(10, 0);
    expect(forward(top).y).toBeLessThan(-0.99);
    // Side view: behind on -Z, looking along +Z.
    const side = get(game, 'side00000001');
    expect(side.position.z).toBeCloseTo(-10, 0);
    expect(forward(side).z).toBeCloseTo(1, 3);
    // Fixed camera stays and looks at player 1.
    const fixed = get(game, 'fixed0000001');
    expect(fixed.position.toArray()).toEqual([5, 4, 5]);
    const toHero = hero1
      .clone()
      .add(new Vector3(0, 1, 0))
      .sub(fixed.position)
      .normalize();
    expect(forward(fixed).dot(toHero)).toBeGreaterThan(0.99);
    // Path: half way after 1 s, at the end after 2 s.
    const pathCam = get(game, 'pathcam00001');
    cameraBehaviorRegistry.get(pathCam)?.[0]?.play();
    run(game, 1);
    expect(pathCam.position.x).toBeCloseTo(0, 0);
    run(game, 1.1);
    expect(pathCam.position.x).toBeCloseTo(4, 1);
    // Shared camera: both players in view.
    const shared = get(game, 'shared000001');
    const camera = cameraRegistry.get(shared)?.camera;
    if (!camera) throw new Error('camera');
    camera.updateWorldMatrix(true, false);
    for (const id of ['hero00000001', 'hero00000002']) {
      const projected = get(game, id).worldPosition().project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
    }
    game.dispose();
  });
});

describe('camera views', () => {
  it('splits the screen for two player cameras', () => {
    const game = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: hero('hero00000001', '1'),
        hero00000002: hero('hero00000002', '2', [4, 0, 0]),
        rig000000001: rig(
          'thirdPersonCamera',
          {},
          { player: '1', split: 'horizontal' },
          [0, 3, -6],
          'Rig1',
        ),
        rig000000002: rig('thirdPersonCamera', {}, { player: '2' }, [4, 3, -6], 'Rig2'),
      }),
      { scripts: () => null },
    );
    run(game, 0.2);
    const { views, split } = game.views();
    expect(views.map((view) => view.player)).toEqual(['1', '2']);
    expect(split).toBe('horizontal');
    // Each camera follows its own player.
    expect(get(game, 'rig000000002').position.x).toBeCloseTo(4, 0);
    game.dispose();
  });

  it('glides smoothly to a new camera', () => {
    const game = new Game(
      sceneData({
        a00000000001: rig('fixedCamera', {}, { blendTime: 1 }, [0, 2, -10], 'CamA'),
        b00000000001: rig('fixedCamera', {}, { blendTime: 1 }, [10, 2, -10], 'CamB'),
      }),
      { scripts: () => null },
    );
    get(game, 'b00000000001').setActive(false);
    run(game, 0.1);
    const camA = cameraRegistry.get(get(game, 'a00000000001'))?.camera;
    const camB = cameraRegistry.get(get(game, 'b00000000001'))?.camera;
    expect(game.views().views[0]?.camera).toBe(camA);
    get(game, 'a00000000001').setActive(false);
    get(game, 'b00000000001').setActive(true);
    run(game, 0.5);
    const mid = game.views().views[0]?.camera;
    expect(mid).not.toBe(camB);
    const x = mid?.getWorldPosition(new Vector3()).x ?? 0;
    expect(x).toBeGreaterThan(3);
    expect(x).toBeLessThan(7);
    run(game, 0.6);
    expect(game.views().views[0]?.camera).toBe(camB);
    game.dispose();
  });
});
