import { beforeAll, describe, expect, it } from 'vitest';
import {
  Game,
  initNavigation,
  initPhysics,
  peekHealth,
  peekInventory,
  thingRegistry,
} from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const ground = objectData({
  name: 'Ground',
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [60, 1, 60] },
  components: [component('boxCollider', {}, 'groundcoll01')],
});

const at = (x: number, z: number) => ({
  position: [x, 0, z] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
});

/** A player: the Interact action and hints belong to the object a control component drives. */
const hero = (x: number, z: number, more: ReturnType<typeof component>[] = []) =>
  objectData({
    name: 'Held',
    tag: 'Player',
    transform: at(x, z),
    components: [
      component('characterController', {}, 'heroccontr01'),
      component('thirdPersonControl', {}, 'herocontrol1'),
      ...more,
    ],
  });

function launch(objects: Parameters<typeof sceneData>[0]): Game {
  return new Game(sceneData({ ground000001: ground, ...objects }), {
    scripts: () => null,
    random: () => 0.5,
  });
}

function run(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
}

function find(game: Game, id: string) {
  const object = game.world.getObject(id);
  if (!object) throw new Error(`missing ${id}`);
  return object;
}

/** Presses and releases the Interact key (E). */
function interact(game: Game): void {
  game.input.keyEvent('e', true, 'KeyE');
  game.stepTick();
  game.input.keyEvent('e', false, 'KeyE');
  game.stepTick();
}

describe('pickups', () => {
  it('are taken on touch, go into the inventory and leave the scene', () => {
    const game = launch({
      hero000001: hero(0, 0),
      coin00000001: objectData({
        name: 'Muenze',
        transform: at(0.4, 0),
        components: [component('pickup', { item: 'Münze', count: 3, sound: '' }, 'pickupcomp01')],
      }),
    });
    run(game, 0.3);
    expect(peekInventory(find(game, 'hero000001'))?.count('Münze')).toBe(3);
    expect(game.world.getObject('coin00000001')).toBeFalsy();
    game.dispose();
  });

  it('with mode "interact" wait for the Interact action and show a hint', () => {
    const game = launch({
      hero000001: hero(0, 0),
      gem000000001: objectData({
        name: 'Edelstein',
        transform: at(0.6, 0),
        components: [
          component('pickup', { item: 'gem', mode: 'interact', sound: '' }, 'pickupcomp02'),
        ],
      }),
    });
    run(game, 0.3);
    expect(peekInventory(find(game, 'hero000001'))?.count('gem') ?? 0).toBe(0);
    expect(game.interactionHint(1)).not.toBeNull();
    interact(game);
    expect(peekInventory(find(game, 'hero000001'))?.count('gem')).toBe(1);
    run(game, 0.1);
    expect(game.interactionHint(1)).toBeNull();
    game.dispose();
  });
});

describe('doors and chests', () => {
  const lockedDoor = objectData({
    name: 'Tor',
    transform: at(1, 0),
    components: [component('door', { key: 'key', consumeKey: true }, 'doorcomp0001')],
  });

  it('a locked door stays shut without the key and opens with it', () => {
    const game = launch({ hero000001: hero(0, 0), gate00000001: lockedDoor });
    run(game, 0.2);
    interact(game);
    expect(thingRegistry.get(find(game, 'gate00000001'))?.isOpen).toBe(false);
    const hero1 = find(game, 'hero000001');
    // Give the key through the same path blocks use.
    game.addItem(hero1, 'self', 'key', 1);
    run(game, 0.1);
    interact(game);
    expect(thingRegistry.get(find(game, 'gate00000001'))?.isOpen).toBe(true);
    // The key was used up.
    expect(peekInventory(hero1)?.count('key')).toBe(0);
    game.dispose();
  });

  it('a chest gives its contents once to whoever opens it', () => {
    const game = launch({
      hero000001: hero(0, 0),
      chest0000001: objectData({
        name: 'Truhe',
        transform: at(1, 0),
        components: [component('chest', { contents: 'key:1, coin:5' }, 'chestcomp001')],
      }),
    });
    run(game, 0.2);
    interact(game);
    const items = peekInventory(find(game, 'hero000001'));
    expect(items?.count('key')).toBe(1);
    expect(items?.count('coin')).toBe(5);
    interact(game);
    expect(items?.count('coin')).toBe(5);
    game.dispose();
  });
});

describe('health', () => {
  it('is invulnerable for a moment after a hit, then hurts again, and destroys at zero', () => {
    const game = launch({
      dummy0000001: objectData({
        name: 'Puppe',
        transform: at(0, 0),
        components: [component('health', { max: 50, invulnerable: 0.5 }, 'healthcomp01')],
      }),
      hero000001: hero(5, 5),
    });
    const dummy = find(game, 'dummy0000001');
    const hitter = find(game, 'hero000001');
    game.damageObject(hitter, 'object:dummy0000001', 20);
    game.damageObject(hitter, 'object:dummy0000001', 20);
    expect(peekHealth(dummy)?.current).toBe(30);
    run(game, 0.6);
    game.damageObject(hitter, 'object:dummy0000001', 40);
    expect(peekHealth(dummy)?.current).toBe(0);
    run(game, 0.2);
    expect(game.world.getObject('dummy0000001')).toBeFalsy();
    game.dispose();
  });

  it('heal never goes above the maximum', () => {
    const game = launch({
      dummy0000001: objectData({
        name: 'Puppe',
        transform: at(0, 0),
        components: [component('health', { max: 40, invulnerable: 0 }, 'healthcomp01')],
      }),
      hero000001: hero(5, 5),
    });
    const hitter = find(game, 'hero000001');
    game.damageObject(hitter, 'object:dummy0000001', 15);
    game.healObject(hitter, 'object:dummy0000001', 100);
    expect(game.healthOfObject(hitter, 'object:dummy0000001')).toBe(40);
    game.dispose();
  });
});

describe('combat', () => {
  it('the player attack key hits a destructible in front, and the destructible breaks', () => {
    const game = launch({
      hero000001: hero(0, 0, [
        component('meleeHit', { damage: 25, range: 2.5, cooldown: 0.2 }, 'meleecomp001'),
      ]),
      crate0000001: objectData({
        name: 'Kiste',
        transform: at(0, 1.5),
        components: [component('destructible', { health: 20 }, 'destructcomp1')],
      }),
    });
    run(game, 0.2);
    game.input.keyEvent('f', true, 'KeyF');
    run(game, 0.1);
    game.input.keyEvent('f', false, 'KeyF');
    run(game, 0.3);
    expect(game.world.getObject('crate0000001')).toBeFalsy();
    game.dispose();
  });
});
