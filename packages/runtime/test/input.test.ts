import { beforeAll, describe, expect, it } from 'vitest';
import { Vector2 } from 'three';
import { controlRegistry, Game, initPhysics, MOUSE_SENSITIVITY, PlayerInput } from '../src';
import type { GamepadSnapshot, RawInput } from '../src';
import { component, objectData, sceneData, scriptAsset } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

function pad(axes: number[] = [0, 0, 0, 0], pressed: number[] = []): GamepadSnapshot {
  return {
    axes,
    buttons: Array.from({ length: 17 }, (_, index) => ({
      pressed: pressed.includes(index),
      value: pressed.includes(index) ? 1 : 0,
    })),
  };
}

function raw(
  codes: string[] = [],
  pads: (GamepadSnapshot | null)[] = [],
  mouse = new Vector2(),
): RawInput {
  return {
    isCodeDown: (code) => codes.includes(code),
    mouseDelta: mouse,
    wheelDelta: 0,
    mouseDown: false,
    gamepad: (index) => pads[index] ?? null,
  };
}

describe('input actions', () => {
  it('maps keys to move and buttons with pressed, held and released', () => {
    const input = new PlayerInput(1);
    input.update(raw(['KeyW', 'KeyD', 'Space']), null, 1 / 60);
    const move = input.move();
    // Diagonals are not faster.
    expect(move.length()).toBeCloseTo(1, 5);
    expect(move.x).toBeGreaterThan(0);
    expect(move.y).toBeGreaterThan(0);
    expect(input.wasPressed('jump')).toBe(true);
    input.update(raw(['Space']), null, 1 / 60);
    expect(input.wasPressed('jump')).toBe(false);
    expect(input.isHeld('jump')).toBe(true);
    input.update(raw([]), null, 1 / 60);
    expect(input.wasReleased('jump')).toBe(true);
    // Player 2 ignores WASD and uses the arrow keys.
    const second = new PlayerInput(2);
    second.update(raw(['KeyW', 'ArrowLeft']), null, 1 / 60);
    expect(second.move().toArray()).toEqual([-1, 0]);
  });

  it('reads gamepads with dead zone, buttons and right-stick look', () => {
    const input = new PlayerInput(1);
    const pads = [pad([0.05, -1, 0.5, 0], [0])];
    input.update(raw([], pads), 0, 1 / 60);
    // Stick up is forward; the small x is inside the dead zone.
    expect(input.move().toArray()).toEqual([0, 1]);
    expect(input.wasPressed('jump')).toBe(true);
    expect(input.look().x).toBeGreaterThan(0);
    expect(input.usingGamepad).toBe(true);
  });

  it('turns the view with the mouse for player 1 only', () => {
    const input = new PlayerInput(1);
    input.update(raw([], [], new Vector2(10, -4)), null, 1 / 60);
    expect(input.look().x).toBeCloseTo(10 * MOUSE_SENSITIVITY, 5);
    expect(input.look().y).toBeCloseTo(4 * MOUSE_SENSITIVITY, 5);
    const second = new PlayerInput(2);
    second.update(raw([], [], new Vector2(10, -4)), null, 1 / 60);
    expect(second.look().length()).toBe(0);
  });

  it('fires action events and gives a single gamepad to player 2 when there is one', () => {
    const scripts = scriptAsset('script000001', [
      {
        id: 'jump2',
        event: { type: 'action', params: { action: 'jump', phase: 'pressed', player: '2' } },
        *run(_self, api) {
          api.vars['jumps2'] = Number(api.vars['jumps2'] ?? 0) + 1;
        },
      },
      {
        id: 'jump1',
        event: { type: 'action', params: { action: 'jump', phase: 'pressed', player: '1' } },
        *run(_self, api) {
          api.vars['jumps1'] = Number(api.vars['jumps1'] ?? 0) + 1;
        },
      },
    ]);
    const game = new Game(
      sceneData({
        ground000001: objectData({
          name: 'Ground',
          transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [40, 1, 40] },
          components: [component('boxCollider', {}, 'groundcoll01')],
        }),
        hero00000002: objectData({
          name: 'Hero 2',
          components: [
            component('characterController', {}, 'hero2cctrl01'),
            component('thirdPersonControl', { player: '2' }, 'hero2contrl1'),
            component('blockScript', { script: 'script000001' }, 'hero2script1'),
          ],
        }),
      }),
      { scripts: () => scripts },
    );
    // Gamepad: left stick forward and A.
    game.input.setGamepads([pad([0, -1, 0, 0], [0])]);
    game.stepTick();
    game.input.setGamepads([pad([0, -1, 0, 0])]);
    for (let i = 0; i < 60; i++) game.stepTick();
    expect(game.vars['jumps2']).toBe(1);
    expect(game.vars['jumps1']).toBeUndefined();
    const hero = game.world.getObject('hero00000002');
    expect(hero?.position.z).toBeGreaterThan(1);
    expect(hero && controlRegistry.get(hero)?.player).toBe(2);
    game.dispose();
  });
});
