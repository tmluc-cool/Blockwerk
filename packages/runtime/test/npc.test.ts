import { beforeAll, describe, expect, it } from 'vitest';
import { Game, initNavigation, initPhysics, navAgentRegistry, peekNpcState } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const ground = objectData({
  name: 'Ground',
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [80, 1, 80] },
  components: [component('boxCollider', {}, 'groundcoll01')],
});

const route = objectData({ name: 'Route' });
const waypoint = (z: number, order: number) =>
  objectData({
    name: `P${order}`,
    parent: 'route0000001',
    order,
    transform: { position: [-10, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1] },
  });

/** A zombie that patrols two points, watches with a guard and chases by following. */
const zombie = objectData({
  name: 'Zombie',
  transform: { position: [-10, 0, -8], rotation: [0, 0, 0], scale: [1, 1, 1] },
  components: [
    component('navAgent', { speed: 3 }, 'zombienav001'),
    component('npc', { startState: 'patrol' }, 'zombienpc001'),
    component('patrol', { route: 'route0000001', wait: 0.2, speed: 1.5 }, 'zombiepat001'),
    component(
      'guard',
      { viewDistance: 20, viewAngle: 120, hearingRadius: 2, loseTime: 2 },
      'zombiegrd001',
    ),
    component('follow', { distance: 1.5, speed: 3.5 }, 'zombiefol001'),
  ],
});

const player = (x: number, z: number) =>
  objectData({
    name: 'Spieler',
    tag: 'Player',
    transform: { position: [x, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1] },
  });

function run(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
}

describe('zombie with patrol, guard and follow', () => {
  const objects = {
    ground000001: ground,
    route0000001: route,
    point0000001: waypoint(-8, 0),
    point0000002: waypoint(-3, 1),
    zombie000001: zombie,
  };

  it('patrols, notices the player in its view cone, chases and goes back to patrol', () => {
    const game = new Game(sceneData({ ...objects, player000001: player(-10, 4) }), {
      scripts: () => null,
      random: () => 0.5,
    });
    const zombieObject = game.world.getObject('zombie000001');
    const playerObject = game.world.getObject('player000001');
    if (!zombieObject || !playerObject) throw new Error('missing objects');
    const state = peekNpcState(zombieObject);
    expect(state?.current).toBe('patrol');
    // The player stands straight ahead, 12 m away: noticed at once.
    run(game, 0.5);
    expect(state?.current).toBe('chase');
    run(game, 6);
    expect(zombieObject.position.distanceTo(playerObject.position)).toBeLessThan(2.2);
    // The player vanishes far away; after the lose time the zombie is on patrol again.
    playerObject.setPosition(35, 0, 35);
    run(game, 3.5);
    expect(state?.current).toBe('patrol');
    run(game, 3);
    expect(navAgentRegistry.get(zombieObject)?.moving || state?.seconds).toBeTruthy();
    game.dispose();
  });

  it('does not see through a wall, but hears the player standing close', () => {
    const wall = objectData({
      name: 'Wand',
      transform: { position: [-10, 1.5, 0], rotation: [0, 0, 0], scale: [12, 3, 0.5] },
      components: [component('boxCollider', {}, 'wallcoll0001')],
    });
    const game = new Game(
      sceneData({ ...objects, wall00000001: wall, player000001: player(-10, 4) }),
      { scripts: () => null, random: () => 0.5 },
    );
    const zombieObject = game.world.getObject('zombie000001');
    const playerObject = game.world.getObject('player000001');
    if (!zombieObject || !playerObject) throw new Error('missing objects');
    const state = peekNpcState(zombieObject);
    run(game, 3);
    expect(state?.current).toBe('patrol');
    // Close by (inside the hearing radius) the wall does not matter.
    playerObject.setPosition(zombieObject.position.x + 1, 0, zombieObject.position.z - 0.5);
    run(game, 0.5);
    expect(state?.current).toBe('chase');
    game.dispose();
  });

  it('draws the state above the NPC in play mode only', () => {
    const game = new Game(sceneData({ ...objects, player000001: player(35, 35) }), {
      scripts: () => null,
    });
    expect(game.world.showNpcStates).toBe(true);
    game.dispose();
  });
});
