import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObjectData } from '@blockwerk/project';
import { controlRegistry, Game, initPhysics, motorRegistry } from '../src';
import type { ControlState, ScriptEntry } from '../src';
import { component, objectData, sceneData, scriptAsset } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

type Vec = [number, number, number];

function box(name: string, position: Vec, scale: Vec, rotation: Vec = [0, 0, 0]): SceneObjectData {
  return objectData({
    name,
    transform: { position, rotation, scale },
    components: [component('boxCollider', {}, `${name.slice(0, 8).padEnd(8, 'x')}col1`)],
  });
}

const ground = box('Ground', [0, -0.5, 0], [60, 1, 60]);

function hero(position: Vec = [0, 0, 0], control: Record<string, number | string | boolean> = {}) {
  return objectData({
    name: 'Hero',
    transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [
      component('characterController', {}, 'herocctrl001'),
      component('thirdPersonControl', control, 'herocontrol1'),
    ],
  });
}

function makeGame(objects: Record<string, SceneObjectData>, scripts: ScriptEntry[] = []): Game {
  const asset = scriptAsset('script000001', scripts);
  return new Game(sceneData(objects), { scripts: () => asset });
}

function run(game: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.stepTick();
    each?.();
  }
}

function key(game: Game, code: string, down: boolean): void {
  game.input.keyEvent(code, down, code);
}

function heroOf(game: Game) {
  const object = game.world.getObject('hero00000001');
  const state = object ? controlRegistry.get(object) : undefined;
  if (!object || !state) throw new Error('hero missing');
  return { object, state: state as ControlState };
}

describe('character controller', () => {
  it('stands on the ground and walks with smooth acceleration', () => {
    const game = makeGame({ ground000001: ground, hero00000001: hero() });
    run(game, 0.3);
    const { object, state } = heroOf(game);
    expect(state.grounded).toBe(true);
    expect(object.position.y).toBeCloseTo(0, 1);
    key(game, 'KeyW', true);
    run(game, 0.1);
    // Still speeding up after 0.1 s ...
    expect(state.speed).toBeGreaterThan(0.5);
    expect(state.speed).toBeLessThan(2.1);
    run(game, 1.4);
    // ... at walking speed after a while, walking forward (+Z, no camera).
    expect(state.speed).toBeCloseTo(2.2, 1);
    expect(object.position.z).toBeGreaterThan(2.5);
    expect(Math.abs(object.position.x)).toBeLessThan(0.05);
    // Sprinting and stopping smoothly.
    key(game, 'ShiftLeft', true);
    run(game, 1);
    expect(state.running).toBe(true);
    expect(state.speed).toBeCloseTo(5.5, 0);
    key(game, 'KeyW', false);
    key(game, 'ShiftLeft', false);
    run(game, 0.05);
    expect(state.speed).toBeGreaterThan(1);
    run(game, 1);
    expect(state.speed).toBeLessThan(0.05);
    game.dispose();
  });

  it('turns into the walking direction', () => {
    const game = makeGame({ ground000001: ground, hero00000001: hero() });
    run(game, 0.2);
    key(game, 'KeyD', true);
    run(game, 1);
    const { object } = heroOf(game);
    // Right is -X; the character faces it (yaw -90°).
    expect(object.position.x).toBeLessThan(-1);
    expect(object.object3d.rotation.y).toBeCloseTo(-Math.PI / 2, 1);
    game.dispose();
  });

  it('climbs gentle slopes but not steep ones', () => {
    const ramp = (angle: number): SceneObjectData => {
      const radians = (angle * Math.PI) / 180;
      const length = 12;
      return box(
        'Ramp',
        [0, (length / 2) * Math.sin(radians), 1.5 + (length / 2) * Math.cos(radians)],
        [4, 0.2, length],
        [-angle, 0, 0],
      );
    };
    for (const [angle, climbs] of [
      [30, true],
      [55, false],
    ] as const) {
      const game = makeGame({
        ground000001: ground,
        ramp00000001: ramp(angle),
        hero00000001: hero(),
      });
      run(game, 0.2);
      key(game, 'KeyW', true);
      run(game, 4);
      const { object } = heroOf(game);
      if (climbs) expect(object.position.y).toBeGreaterThan(2);
      else expect(object.position.y).toBeLessThan(0.8);
      game.dispose();
    }
  });

  it('walks up stairs', () => {
    const steps: Record<string, SceneObjectData> = {};
    for (let i = 0; i < 4; i++) {
      const height = (i + 1) * 0.25;
      const depth = i === 3 ? 4 : 0.5;
      steps[`step0000000${i}`] = box(
        `Step${i}`,
        [0, height / 2, 2 + i * 0.5 + depth / 2],
        [3, height, depth],
      );
    }
    const game = makeGame({ ground000001: ground, ...steps, hero00000001: hero() });
    run(game, 0.2);
    key(game, 'KeyW', true);
    run(game, 3);
    const { object } = heroOf(game);
    expect(object.position.z).toBeGreaterThan(4);
    expect(object.position.y).toBeCloseTo(1, 1);
    game.dispose();
  });

  it('jumps as high as set, with jump buffer and coyote time', () => {
    const game = makeGame({ ground000001: ground, hero00000001: hero() });
    run(game, 0.3);
    const { object, state } = heroOf(game);
    const rest = object.position.y;
    let top = 0;
    key(game, 'Space', true);
    run(game, 0.05);
    key(game, 'Space', false);
    expect(state.jumping).toBe(true);
    run(game, 1.2, () => (top = Math.max(top, object.position.y)));
    expect(top - rest).toBeCloseTo(1.2, 1);
    expect(state.grounded).toBe(true);

    // Jump buffer: pressing just before landing still jumps.
    key(game, 'Space', true);
    run(game, 0.02);
    key(game, 'Space', false);
    let pressed = false;
    let second = 0;
    run(game, 1.6, () => {
      if (!pressed && state.verticalVelocity < 0 && object.position.y < 0.3) {
        pressed = true;
        key(game, 'Space', true);
      } else if (pressed) key(game, 'Space', false);
      if (pressed) second = Math.max(second, object.position.y);
    });
    expect(pressed).toBe(true);
    expect(second).toBeGreaterThan(0.9);
    game.dispose();
  });

  it('allows a jump right after walking off an edge (coyote time)', () => {
    const tryCoyote = (coyoteTime: number): number => {
      const ledge = box('Ledge', [0, 2.5, 0], [4, 1, 4]);
      const game = makeGame({
        ground000001: ground,
        ledge0000001: ledge,
        hero00000001: hero([0, 3, 0], { coyoteTime }),
      });
      run(game, 0.3);
      const { object, state } = heroOf(game);
      key(game, 'KeyW', true);
      let left = false;
      let highest = -Infinity;
      run(game, 2, () => {
        if (!left && !state.grounded && object.position.z > 1.5) {
          left = true;
          key(game, 'Space', true);
        }
        if (left) highest = Math.max(highest, object.position.y);
      });
      game.dispose();
      return highest;
    };
    // With coyote time the character rises above the ledge, without it it only falls.
    expect(tryCoyote(0.15)).toBeGreaterThan(3.5);
    expect(tryCoyote(0)).toBeLessThan(3.05);
  });

  it('pushes loose objects', () => {
    const crate = objectData({
      name: 'Crate',
      transform: { position: [0, 0.5, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component('boxCollider', {}, 'cratecoll001'),
        component('rigidbody', { mass: 10 }, 'craterigid01'),
      ],
    });
    const game = makeGame({ ground000001: ground, crate0000001: crate, hero00000001: hero() });
    run(game, 0.2);
    key(game, 'KeyW', true);
    run(game, 2.5);
    expect(game.world.getObject('crate0000001')?.position.z).toBeGreaterThan(3);
    game.dispose();
  });

  it('rides moving platforms', () => {
    const platform = objectData({
      name: 'Platform',
      transform: { position: [0, 0.25, 0], rotation: [0, 0, 0], scale: [3, 0.5, 3] },
      components: [
        component('boxCollider', {}, 'platcoll0001'),
        component('blockScript', { script: 'script000001' }, 'platscript01'),
      ],
    });
    const slide: ScriptEntry = {
      id: 'slide',
      event: { type: 'update' },
      *run(self) {
        if (self.position.x < 4) self.position.x += 0.03;
      },
    };
    const game = makeGame(
      {
        ground000001: { ...ground, transform: { ...ground.transform, position: [0, -5, 0] } },
        platform0001: platform,
        hero00000001: hero([0, 0.5, 0]),
      },
      [slide],
    );
    run(game, 3);
    const { object, state } = heroOf(game);
    expect(game.world.getObject('platform0001')?.position.x).toBeCloseTo(4, 1);
    expect(object.position.x).toBeGreaterThan(3.3);
    expect(object.position.y).toBeCloseTo(0.5, 1);
    expect(state.grounded).toBe(true);
    game.dispose();
  });

  it('crouches and only stands up with room above', () => {
    const roof = box('Roof', [0, 1.6, 3], [4, 0.2, 2]);
    const game = makeGame({ ground000001: ground, roof00000001: roof, hero00000001: hero() });
    run(game, 0.2);
    const { object, state } = heroOf(game);
    const motor = motorRegistry.get(object);
    key(game, 'KeyC', true);
    run(game, 0.1);
    expect(state.crouching).toBe(true);
    expect(motor?.height).toBeCloseTo(1.1, 2);
    key(game, 'KeyW', true);
    run(game, 2.5);
    key(game, 'KeyW', false);
    // Under the roof: letting go does not stand up.
    expect(object.position.z).toBeGreaterThan(2.5);
    expect(object.position.z).toBeLessThan(3.6);
    key(game, 'KeyC', false);
    run(game, 0.2);
    expect(state.crouching).toBe(true);
    // Walking out lets the character stand.
    key(game, 'KeyW', true);
    run(game, 2);
    expect(state.crouching).toBe(false);
    expect(motor?.height).toBeCloseTo(1.8, 2);
    game.dispose();
  });
});
