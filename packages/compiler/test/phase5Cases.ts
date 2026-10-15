import { navAgentRegistry, peekHealth, peekInventory, thingRegistry } from '@blockwerk/runtime';
import { expect } from 'vitest';
import { b, set, workspace } from './dsl';
import { A, B, get, ground, launch, object, run, when } from './phase3Cases';
import type { RuntimeCase } from './phase3Cases';
import { component } from './phase3Cases';

/** Runtime cases of the phase 5 blocks (NPCs, items, messages, scenes). */

type Vec = [number, number, number];

/** An NPC with a Nav Agent and a block script `asset`. */
function npc(
  name: string,
  position: Vec,
  asset: string,
  more: ReturnType<typeof component>[] = [],
) {
  return object(name, position, [
    component('navAgent', { speed: 4 }, `${name.slice(0, 4)}nav`),
    ...more,
    component('blockScript', { script: asset }, `${name.slice(0, 4)}scr`),
  ]);
}

/** A target the NPCs look for (tag Player). */
const player = (position: Vec) => object('Spieler', position, [], { tag: 'Player' });

/** A plain object with a block script. */
const scripted = (name: string, position: Vec, asset: string, more = {}) =>
  object(
    name,
    position,
    [component('blockScript', { script: asset }, `${asset.slice(0, 6)}scr`)],
    more,
  );

export const phase5Cases: RuntimeCase[] = [
  {
    name: 'goTo walks the path to an object, waits for the arrival and then goes on',
    covers: ['npc.goTo', 'npc.stop'],
    run: () => {
      const target = object('Ziel', [12, 0, 4], []);
      const wall = object('Wand', [0, 1.5, 0], [component('boxCollider', {}, 'wallcol00001')], {
        transform: { position: [0, 1.5, 0], rotation: [0, 0, 0], scale: [1, 3, 10] },
      });
      const game = launch({
        objects: {
          ground000001: ground,
          wall00000001: wall,
          target000001: target,
          walker000001: npc('Walker', [-10, 0, 0], 'walker'),
        },
        scripts: {
          walker: workspace(
            when(
              b('events.whenGameStarts'),
              b('npc.goTo', { target: 'object:target000001' }),
              set(A, 1),
              b('npc.stop'),
            ),
          ),
        },
      });
      run(game, 1);
      expect(game.vars[A]).not.toBe(1);
      run(game, 12);
      const walker = get(game, 'walker000001');
      expect(game.vars[A]).toBe(1);
      expect(walker.position.x).toBeGreaterThan(11.5);
      expect(walker.position.z).toBeGreaterThan(3.5);
      game.dispose();
    },
  },
  {
    name: 'follow keeps a distance, flee runs away, wander and patrol keep it walking, stop halts',
    covers: ['npc.follow', 'npc.flee', 'npc.wander', 'npc.patrol'],
    run: () => {
      const route = object('Route', [0, 0, 0], []);
      const points: Record<string, ReturnType<typeof object>> = {};
      const corners: Vec[] = [
        [6, 0, 0],
        [6, 0, 6],
        [0, 0, 6],
      ];
      corners.forEach((position, index) => {
        points[`point${index}000000`.slice(0, 12)] = object(`P${index}`, position, [], {
          parent: 'route0000001',
          order: index,
        });
      });
      const game = launch({
        objects: {
          ground000001: ground,
          route0000001: route,
          ...points,
          player000001: player([10, 0, -10]),
          follower0001: npc('Follower', [10, 0, 10], 'follower'),
          runner000001: npc('Runner', [10, 0, -8], 'runner'),
          roamer000001: npc('Roamer', [-10, 0, -10], 'roamer'),
          patroller001: npc('Patroller', [0.5, 0, 0.5], 'patroller'),
        },
        scripts: {
          follower: workspace(
            when(
              b('events.whenGameStarts'),
              b('npc.follow', { target: 'tag:Player' }, { distance: 2.5 }),
              b('control.wait', {}, { seconds: 8 }),
              b('npc.stop'),
            ),
          ),
          runner: workspace(
            when(b('events.whenGameStarts'), b('npc.flee', { target: 'tag:Player' })),
          ),
          roamer: workspace(when(b('events.whenGameStarts'), b('npc.wander', {}, { radius: 6 }))),
          patroller: workspace(
            when(b('events.whenGameStarts'), b('npc.patrol', { route: 'object:route0000001' })),
          ),
        },
      });
      const follower = get(game, 'follower0001');
      const runner = get(game, 'runner000001');
      const roamer = get(game, 'roamer000001');
      const patroller = get(game, 'patroller001');
      const player3 = get(game, 'player000001');
      const visited = new Set<number>();
      let roamedFarthest = 0;
      for (let i = 0; i < 25 * 60; i++) {
        game.stepTick();
        corners.forEach(([x, , z], index) => {
          if (Math.hypot(patroller.position.x - x, patroller.position.z - z) < 1)
            visited.add(index);
        });
        roamedFarthest = Math.max(
          roamedFarthest,
          Math.hypot(roamer.position.x + 10, roamer.position.z + 10),
        );
        if (i === 9 * 60) {
          // After 8 s the follower stands near the player and has stopped.
          expect(follower.position.distanceTo(player3.position)).toBeLessThan(3.2);
          expect(navAgentRegistry.get(follower)?.moving).toBe(false);
        }
      }
      expect(runner.position.distanceTo(player3.position)).toBeGreaterThan(8);
      expect(roamedFarthest).toBeGreaterThan(0.8);
      expect(roamedFarthest).toBeLessThan(8);
      expect([...visited].sort()).toEqual([0, 1, 2]);
      game.dispose();
    },
  },
  {
    name: 'state blocks change and report the state, and the When-state hat reacts to it',
    covers: ['npc.setState', 'npc.state', 'npc.whenState'],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          watcher00001: npc('Watcher', [0, 0, 0], 'watcher', [
            component('npc', { startState: 'idle' }, 'watchernpc01'),
          ]),
        },
        scripts: {
          watcher: workspace(
            when(
              b('events.whenGameStarts'),
              b('control.wait', {}, { seconds: 0.5 }),
              b('npc.setState', { state: 'alarm' }),
            ),
            when(b('npc.whenState', { state: 'alarm' }), set(A, 1), set(B, b('npc.state'))),
            when(
              b('npc.whenState', { state: 'idle' }),
              b('variables.change', { variable: { id: A } }, { by: 10 }),
            ),
          ),
        },
      });
      run(game, 0.2);
      // The start state "idle" counts as entered at the start.
      expect(game.vars[A]).toBe(10);
      run(game, 1);
      expect(game.vars[A]).toBe(1);
      expect(game.vars[B]).toBe('alarm');
      game.dispose();
    },
  },
  {
    name: 'a guard sees inside its cone and behind no wall, and hears all around',
    covers: ['npc.sees', 'npc.hears'],
    run: () => {
      const wall = object('Wand', [0, 1.5, 12], [component('boxCollider', {}, 'wallcol00002')], {
        transform: { position: [0, 1.5, 12], rotation: [0, 0, 0], scale: [8, 3, 0.5] },
      });
      const game = launch({
        objects: {
          ground000001: ground,
          wall00000001: wall,
          ahead0000001: object('Vorne', [0, 0, 6], [], { tag: 'Ahead' }),
          behind000001: object('Hinten', [0, 0, -6], [], { tag: 'Behind' }),
          hidden000001: object('Versteckt', [0, 0, 16], [], { tag: 'Hidden' }),
          near00000001: object('Nah', [-1.5, 0, -1], [], { tag: 'Near' }),
          guard0000001: npc('Wache', [0, 0, 0], 'guard', [
            component('guard', { viewDistance: 20, hearingRadius: 3 }, 'guardcomp001'),
          ]),
        },
        scripts: {
          guard: workspace(
            when(
              b('events.everyFrame'),
              set(A, 0),
              b(
                'control.if',
                {},
                {
                  condition: b('npc.sees', { target: 'tag:Ahead' }),
                  then: [b('variables.change', { variable: { id: A } }, { by: 1 })],
                },
              ),
              b(
                'control.if',
                {},
                {
                  condition: b('npc.sees', { target: 'tag:Behind' }),
                  then: [b('variables.change', { variable: { id: A } }, { by: 10 })],
                },
              ),
              b(
                'control.if',
                {},
                {
                  condition: b('npc.sees', { target: 'tag:Hidden' }),
                  then: [b('variables.change', { variable: { id: A } }, { by: 100 })],
                },
              ),
              b(
                'control.if',
                {},
                {
                  condition: b('npc.hears', { target: 'tag:Near' }),
                  then: [b('variables.change', { variable: { id: A } }, { by: 1000 })],
                },
              ),
              b(
                'control.if',
                {},
                {
                  condition: b('npc.hears', { target: 'tag:Behind' }),
                  then: [b('variables.change', { variable: { id: A } }, { by: 10000 })],
                },
              ),
            ),
          ),
        },
      });
      run(game, 0.5);
      // Sees the one ahead (1), not the one behind, not the one behind the wall; hears the near one only.
      expect(game.vars[A]).toBe(1001);
      game.dispose();
    },
  },
  {
    name: 'messages reach tags, objects and everyone one tick later; timers run out and restart',
    covers: ['control.sendMessage', 'events.whenMessage', 'control.startTimer', 'events.whenTimer'],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          sender000001: scripted('Sender', [0, 0, 0], 'sender'),
          tagged000001: scripted('A', [2, 0, 0], 'tagged', { tag: 'Listener' }),
          direct000001: scripted('B', [4, 0, 0], 'direct'),
          other0000001: scripted('C', [6, 0, 0], 'other'),
        },
        scripts: {
          sender: workspace(
            when(
              b('events.whenGameStarts'),
              b('control.sendMessage', { message: 'hello', target: 'tag:Listener' }),
              b('control.sendMessage', { message: 'direct', target: 'object:direct000001' }),
              b('control.sendMessage', { message: 'everyone', target: 'all' }),
              b('control.startTimer', { name: 'boom' }, { seconds: 1.5 }),
            ),
            when(b('events.whenTimer', { name: 'boom' }), set(B, 'boom')),
            when(
              b('events.whenMessage', { message: 'everyone' }),
              b('variables.change', { variable: { id: A } }, { by: 1 }),
            ),
          ),
          tagged: workspace(
            when(
              b('events.whenMessage', { message: 'hello' }),
              b('variables.change', { variable: { id: A } }, { by: 10 }),
            ),
          ),
          direct: workspace(
            when(
              b('events.whenMessage', { message: 'direct' }),
              b('variables.change', { variable: { id: A } }, { by: 100 }),
            ),
            when(
              b('events.whenMessage', { message: 'hello' }),
              b('variables.change', { variable: { id: A } }, { by: 5000 }),
            ),
          ),
          other: workspace(
            when(
              b('events.whenMessage', { message: 'everyone' }),
              b('variables.change', { variable: { id: A } }, { by: 1000 }),
            ),
          ),
        },
      });
      game.stepTick();
      // Sent in the first tick, delivered in the next one.
      expect(game.vars[A] ?? 0).toBe(0);
      run(game, 0.1);
      // hello → tagged only (10); direct → B (100); everyone → sender and C (1 + 1000).
      expect(game.vars[A]).toBe(1111);
      expect(game.vars[B] ?? '').not.toBe('boom');
      run(game, 1.5);
      expect(game.vars[B]).toBe('boom');
      game.dispose();
    },
  },
  {
    name: 'for each object in a tag visits every object, "loop object" names the current one',
    covers: ['control.forEachObject'],
    run: () => {
      const coin = (x: number) => object('Coin', [x, 0, 0], [], { tag: 'Coin' });
      const game = launch({
        objects: {
          ground000001: ground,
          counter00001: scripted('Zaehler', [0, 0, 5], 'counter'),
          coin00000001: coin(1),
          coin00000002: coin(2),
          coin00000003: coin(3),
        },
        scripts: {
          counter: workspace(
            when(
              b('events.whenGameStarts'),
              b(
                'control.forEachObject',
                { target: 'tag:Coin' },
                {
                  body: [
                    b('variables.change', { variable: { id: A } }, { by: 1 }),
                    b('control.destroy', { target: 'loop' }),
                  ],
                },
              ),
            ),
          ),
        },
      });
      run(game, 0.2);
      expect(game.vars[A]).toBe(3);
      expect([...game.world.allObjects()].filter((o) => o.tag === 'Coin')).toHaveLength(0);
      game.dispose();
    },
  },
  {
    name: 'item blocks give, take, check and count items of an object',
    covers: ['items.add', 'items.remove', 'items.has', 'items.count'],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          player000001: player([4, 0, 0]),
          giver0000001: scripted('Geber', [0, 0, 0], 'giver'),
        },
        scripts: {
          giver: workspace(
            when(
              b('events.whenGameStarts'),
              b('items.add', { item: 'coin', target: 'tag:Player' }, { count: 5 }),
              b('items.add', { item: 'key', target: 'tag:Player' }, { count: 1 }),
              b('items.remove', { item: 'coin', target: 'tag:Player' }, { count: 2 }),
              set(A, b('items.count', { item: 'coin', target: 'tag:Player' })),
              b(
                'control.if',
                {},
                {
                  condition: b('items.has', { target: 'tag:Player', item: 'key' }),
                  then: [set(B, 'yes')],
                },
              ),
              // Taking more than there is changes nothing.
              b('items.remove', { item: 'coin', target: 'tag:Player' }, { count: 10 }),
            ),
          ),
        },
      });
      run(game, 0.2);
      expect(game.vars[A]).toBe(3);
      expect(game.vars[B]).toBe('yes');
      const inventory = peekInventory(get(game, 'player000001'));
      expect(inventory?.count('coin')).toBe(3);
      expect(inventory?.count('key')).toBe(1);
      game.dispose();
    },
  },
  {
    name: 'operate opens and closes doors and chests without a key, and the When-I-am hat reacts',
    covers: ['items.operate', 'items.whenThing'],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          player000001: player([0, 0, 6]),
          gate00000001: object(
            'Tor',
            [0, 1, 0],
            [
              component('door', { key: 'key' }, 'doorcomp0001'),
              component('blockScript', { script: 'gate' }, 'gatescr00001'),
            ],
          ),
          chest0000001: object(
            'Truhe',
            [3, 0, 0],
            [component('chest', { contents: 'coin:4', key: 'key' }, 'chestcomp001')],
          ),
          opener000001: scripted('Hebel', [6, 0, 0], 'opener'),
        },
        scripts: {
          gate: workspace(
            when(b('items.whenThing', { what: 'opened' }), set(A, 1)),
            when(b('items.whenThing', { what: 'closed' }), set(B, 'closed')),
          ),
          opener: workspace(
            when(
              b('events.whenGameStarts'),
              b('items.operate', { action: 'open', target: 'object:gate00000001' }),
              b('items.operate', { action: 'open', target: 'object:chest0000001' }),
              b('control.wait', {}, { seconds: 1 }),
              b('items.operate', { action: 'toggle', target: 'object:gate00000001' }),
            ),
          ),
        },
      });
      run(game, 0.5);
      // The blocks ignore the key requirement.
      expect(thingRegistry.get(get(game, 'gate00000001'))?.isOpen).toBe(true);
      expect(thingRegistry.get(get(game, 'chest0000001'))?.isOpen).toBe(true);
      expect(game.vars[A]).toBe(1);
      expect(peekInventory(get(game, 'player000001'))?.count('coin')).toBe(4);
      run(game, 1);
      expect(thingRegistry.get(get(game, 'gate00000001'))?.isOpen).toBe(false);
      expect(game.vars[B]).toBe('closed');
      game.dispose();
    },
  },
  {
    name: 'pick up takes a pickup object into the inventory and removes it',
    covers: ['items.pickUp'],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          coin00000001: object(
            'Muenze',
            [20, 0, 0],
            [
              component(
                'pickup',
                { item: 'gem', count: 2, mode: 'interact', sound: '' },
                'pickupcomp01',
              ),
            ],
          ),
          hero00000001: scripted('Held', [0, 0, 0], 'taker'),
        },
        scripts: {
          taker: workspace(
            when(b('events.whenGameStarts'), b('items.pickUp', { target: 'object:coin00000001' })),
          ),
        },
      });
      run(game, 0.3);
      expect(peekInventory(get(game, 'hero00000001'))?.count('gem')).toBe(2);
      expect(game.world.getObject('coin00000001')).toBeFalsy();
      game.dispose();
    },
  },
  {
    name: 'damage and heal change the hit points, and the hat fires when hurt and when defeated',
    covers: ['items.damage', 'items.heal', 'items.health', 'items.whenHealth'],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          dummy0000001: object(
            'Puppe',
            [0, 0, 0],
            [
              component(
                'health',
                { max: 100, invulnerable: 0, onDeath: 'nothing' },
                'healthcomp01',
              ),
              component('blockScript', { script: 'dummy' }, 'dummyscr0001'),
            ],
          ),
          hitter000001: scripted('Schlaeger', [4, 0, 0], 'hitter'),
        },
        scripts: {
          dummy: workspace(
            when(b('items.whenHealth', { phase: 'hurt' }), set(B, 'hurt')),
            when(b('items.whenHealth', { phase: 'died' }), set(B, 'dead')),
          ),
          hitter: workspace(
            when(
              b('events.whenGameStarts'),
              b('items.damage', { target: 'object:dummy0000001' }, { amount: 30 }),
              b('items.heal', { target: 'object:dummy0000001' }, { amount: 10 }),
              b('control.wait', {}, { seconds: 0.2 }),
              set(A, b('items.health', { target: 'object:dummy0000001' })),
              b('items.damage', { target: 'object:dummy0000001' }, { amount: 500 }),
            ),
          ),
        },
      });
      run(game, 0.1);
      expect(peekHealth(get(game, 'dummy0000001'))?.current).toBe(80);
      expect(game.vars[B]).toBe('hurt');
      run(game, 0.5);
      // 80 hit points were read before the deadly hit.
      expect(game.vars[A]).toBe(80);
      expect(peekHealth(get(game, 'dummy0000001'))?.current).toBe(0);
      expect(game.vars[B]).toBe('dead');
      game.dispose();
    },
  },
];
