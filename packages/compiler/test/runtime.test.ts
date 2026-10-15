import { BLOCK_CATALOG } from '@blockwerk/blocks';
import type { SceneObjectData, VariableData } from '@blockwerk/project';
import { Game, GameObject, initPhysics, loadScriptModule } from '@blockwerk/runtime';
import type { GameApi, GameLogEntry, ScriptAsset } from '@blockwerk/runtime';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileBlockScript } from '../src';
import { b, get, set, workspace } from './dsl';
import type { TestBlock } from './dsl';
import { loadFixture } from './fixtures';
import { phase3Cases } from './phase3Cases';
import { phase4Cases } from './phase4Cases';

/**
 * Runtime tests: compiled blocks run in a real {@link Game}. Every catalog block must be
 * covered by at least one case (`covers`).
 */
interface RuntimeCase {
  readonly name: string;
  readonly covers: readonly string[];
  readonly run: () => void;
}

const SCORE = 'varscore0000';
const SPEED = 'varspeed0000';
const TEXT = 'vartext00000';

const VARIABLES: VariableData[] = [
  { id: SCORE, name: 'Punkte', type: 'number', scope: 'game', default: 0, inspector: false },
  {
    id: SPEED,
    name: 'Geschwindigkeit',
    type: 'number',
    scope: 'object',
    default: 1,
    inspector: true,
  },
  { id: TEXT, name: 'Text', type: 'string', scope: 'object', default: '', inspector: false },
];

function objectData(overrides: Partial<SceneObjectData>): SceneObjectData {
  return {
    name: 'Object',
    parent: null,
    order: 0,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: false,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [],
    ...overrides,
  };
}

function scriptComponent(id: string, asset: string, variables: Record<string, number> = {}) {
  return { id, type: 'blockScript', enabled: true, values: { script: asset, variables } };
}

function compileAsset(assetId: string, source: unknown, variables: VariableData[]): ScriptAsset {
  const result = compileBlockScript(source, { assetName: assetId, variables });
  expect(result.diagnostics).toEqual([]);
  const sourceUrl = `blockwerk://test/${assetId}.js`;
  return {
    assetId,
    module: loadScriptModule(result.code, sourceUrl),
    variables,
    lineToBlock: result.lineToBlock,
    sourceUrl,
  };
}

interface PlayOptions {
  /** Scripts of further objects by object ID. */
  readonly others?: Readonly<Record<string, unknown>>;
  /** Extra copies of the player with their own speed. */
  readonly copies?: readonly number[];
  readonly speed?: number;
  /** Further script assets by asset ID (e.g. used inside prefabs). */
  readonly assets?: Readonly<Record<string, unknown>>;
  /** Prefabs for "create [prefab] at", by asset ID. */
  readonly prefabs?: Readonly<
    Record<string, { root: string; objects: Record<string, SceneObjectData> }>
  >;
}

interface Playing {
  readonly game: Game;
  readonly player: GameObject;
  readonly log: GameLogEntry[];
  object(id: string): GameObject | undefined;
  ticks(count: number): void;
}

/**
 * Starts a game with a player cube at the origin running `source`, a target sphere 10 m
 * ahead (+Z) and a collectible sphere 2 m ahead.
 */
function play(source: unknown, options: PlayOptions = {}): Playing {
  const assets = new Map<string, ScriptAsset>();
  assets.set('script000001', compileAsset('script000001', source, VARIABLES));
  const objects: Record<string, SceneObjectData> = {
    player000001: objectData({
      name: 'Player',
      components: [
        { id: 'render000001', type: 'meshRenderer', enabled: true, values: {} },
        { id: 'collide00001', type: 'boxCollider', enabled: true, values: {} },
        scriptComponent('scriptc00001', 'script000001', { [SPEED]: options.speed ?? 2 }),
      ],
    }),
    target000001: objectData({
      name: 'Target',
      tag: 'Ziel',
      order: 1,
      transform: { position: [0, 0, 10], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [{ id: 'collide00002', type: 'sphereCollider', enabled: true, values: {} }],
    }),
    coin00000001: objectData({
      name: 'Coin',
      tag: 'Einsammelbar',
      order: 2,
      transform: { position: [0, 0, 2], rotation: [0, 0, 0], scale: [0.5, 0.5, 0.5] },
      components: [
        { id: 'collide00003', type: 'sphereCollider', enabled: true, values: { isTrigger: true } },
      ],
    }),
  };
  (options.copies ?? []).forEach((speed, index) => {
    objects[`copy0000000${index}`] = objectData({
      name: `Copy ${index}`,
      order: 10 + index,
      transform: { position: [5 * (index + 1), 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [scriptComponent(`copyscript0${index}`, 'script000001', { [SPEED]: speed })],
    });
  });
  for (const [objectId, other] of Object.entries(options.others ?? {})) {
    const assetId = `asset${objectId.slice(0, 7)}`;
    assets.set(assetId, compileAsset(assetId, other, VARIABLES));
    const data = objects[objectId];
    if (!data) throw new Error(`unknown object ${objectId}`);
    objects[objectId] = {
      ...data,
      components: [...data.components, scriptComponent(`sc${objectId.slice(0, 10)}`, assetId)],
    };
  }
  for (const [assetId, other] of Object.entries(options.assets ?? {})) {
    assets.set(assetId, compileAsset(assetId, other, VARIABLES));
  }
  const log: GameLogEntry[] = [];
  let clones = 0;
  const game = new Game(
    {
      formatVersion: 1,
      environment: { ambientIntensity: 0.3, fog: { enabled: false, near: 10, far: 100 } },
      objects,
    },
    {
      scripts: (id) => assets.get(id) ?? null,
      log: (entry) => log.push(entry),
      random: () => 0.5,
      createId: () => `clone${String(++clones).padStart(7, '0')}`,
      prefabs: (id) => options.prefabs?.[id] ?? null,
    },
  );
  const player = game.world.getObject('player000001');
  if (!player) throw new Error('no player');
  return {
    game,
    player,
    log,
    object: (id) => game.world.getObject(id),
    ticks: (count) => {
      for (let i = 0; i < count; i++) game.stepTick();
    },
  };
}

/** Runs blocks under "when game starts" for some ticks. */
function start(blocks: readonly TestBlock[], ticks = 1, options: PlayOptions = {}): Playing {
  const playing = play(workspace([b('events.whenGameStarts'), ...blocks]), options);
  playing.ticks(ticks);
  return playing;
}

const target = 'object:target000001';

const cases: RuntimeCase[] = [
  {
    name: 'start script moves the object forward along its facing direction',
    covers: ['events.whenGameStarts', 'motion.move', 'literal.number'],
    run: () => {
      const { workspace: source } = loadFixture('move-forward.blocks.json');
      const module = loadScriptModule(compileBlockScript(source, { assetName: 'test' }).code);
      expect(module.scripts.map((script) => script.event)).toEqual([{ type: 'start' }]);
      const hero = new GameObject({ id: 'hero', name: 'Hero' });
      hero.object3d.rotation.y = Math.PI / 2;
      const script = module.scripts[0];
      if (!script) throw new Error('no script');
      const iterator = script.run(hero, {} as GameApi);
      while (!iterator.next().done);
      // 2.5 m forward, then 1 m back = 1.5 m along local +Z, which is world +X after the turn.
      expect(hero.position.x).toBeCloseTo(1.5, 6);
      expect(hero.position.z).toBeCloseTo(0, 6);
    },
  },
  {
    name: 'the same script on a second object with another speed runs independently',
    covers: ['events.everyFrame', 'variables.get'],
    run: () => {
      const { ticks, player, object } = play(
        workspace([
          b('events.everyFrame'),
          b('motion.move', { direction: 'forward' }, { meters: get(SPEED) }),
        ]),
        { speed: 2, copies: [5] },
      );
      ticks(3);
      expect(player.position.z).toBeCloseTo(6, 6);
      expect(object('copy00000000')?.position.z).toBeCloseTo(15, 6);
    },
  },
  {
    name: 'key hats fire when a key is pressed, held and released',
    covers: ['events.whenKey', 'looks.hide', 'looks.show'],
    run: () => {
      const { game, ticks, player } = play(
        workspace(
          [
            b('events.whenKey', { key: 'W', mode: 'held' }),
            b('motion.move', { direction: 'forward' }, { meters: 1 }),
          ],
          [b('events.whenKey', { key: 'Space', mode: 'pressed' }), b('looks.hide')],
          [b('events.whenKey', { key: 'Space', mode: 'released' }), b('looks.show')],
        ),
      );
      ticks(1);
      game.input.keyEvent('w', true);
      ticks(3);
      game.input.keyEvent('w', false);
      ticks(2);
      expect(player.position.z).toBeCloseTo(3, 6);
      game.input.keyEvent(' ', true);
      ticks(1);
      expect(player.visible).toBe(false);
      ticks(5);
      expect(player.visible).toBe(false);
      game.input.keyEvent(' ', false);
      ticks(1);
      expect(player.visible).toBe(true);
    },
  },
  {
    name: 'clicking an object runs its click scripts',
    covers: ['events.whenClicked', 'looks.setColor'],
    run: () => {
      const { game, ticks, player } = play(
        workspace([b('events.whenClicked'), b('looks.setColor', { color: '#33AA55' })]),
      );
      ticks(1);
      expect(player.findComponent('meshRenderer')?.values['color']).not.toBe('#33aa55');
      game.click('player000001');
      ticks(1);
      expect(player.findComponent('meshRenderer')?.values['color']).toBe('#33aa55');
    },
  },
  {
    name: 'a collectible counts a point and destroys itself when the player touches it',
    covers: ['events.whenTouching', 'variables.change', 'control.destroy', 'events.whenDestroyed'],
    run: () => {
      const { game, ticks, object } = play(
        workspace([
          b('events.everyFrame'),
          b('motion.move', { direction: 'forward' }, { meters: 0.1 }),
        ]),
        {
          others: {
            coin00000001: workspace(
              [
                b('events.whenTouching', { target: 'object:player000001', phase: 'enter' }),
                b('variables.change', { variable: { id: SCORE } }, { by: 1 }),
                b('control.destroy', { target: 'self' }),
                // Never reached: destroying itself ends the script.
                b('variables.change', { variable: { id: SCORE } }, { by: 100 }),
              ],
              [b('events.whenDestroyed'), set(TEXT, 'weg')],
            ),
          },
        },
      );
      ticks(5);
      expect(object('coin00000001')).toBeDefined();
      ticks(20);
      expect(game.vars[SCORE]).toBe(1);
      expect(object('coin00000001')).toBeUndefined();
    },
  },
  {
    name: 'destroying another object removes it',
    covers: ['control.destroy'],
    run: () => {
      const { object } = start([b('control.destroy', { target })], 2);
      expect(object('target000001')).toBeUndefined();
    },
  },
  {
    name: 'clones run their "when I am created" scripts',
    covers: ['control.clone', 'events.whenCreated'],
    run: () => {
      const { game, ticks } = play(
        workspace(
          [b('events.whenGameStarts'), b('control.clone', { target: 'self' })],
          [b('events.whenCreated'), b('motion.move', { direction: 'right' }, { meters: 3 })],
        ),
      );
      ticks(2);
      const clones = [...game.world.allObjects()].filter((item) => item.cloneOf === 'player000001');
      expect(clones).toHaveLength(1);
      expect(clones[0]?.position.x).toBeCloseTo(-3, 6);
      expect(game.world.getObject('player000001')?.position.x).toBe(0);
    },
  },
  {
    name: 'prefabs are created at an object and run their own scripts',
    covers: ['control.spawnPrefab'],
    run: () => {
      const { game, ticks, log } = play(
        workspace([
          b('events.whenGameStarts'),
          b('control.spawnPrefab', { prefab: 'prefab:laterne00001', at: 'object:target000001' }),
          b('control.spawnPrefab', { prefab: 'prefab:fehlt0000001', at: 'self' }),
        ]),
        {
          assets: {
            lampscript01: workspace([
              b('events.whenCreated'),
              b('motion.move', { direction: 'up' }, { meters: 2 }),
            ]),
          },
          prefabs: {
            laterne00001: {
              root: 'lanternroot1',
              objects: {
                lanternroot1: objectData({
                  name: 'Laterne',
                  components: [scriptComponent('lampscriptc1', 'lampscript01')],
                }),
                lanternlamp1: objectData({
                  name: 'Lampe',
                  parent: 'lanternroot1',
                  transform: { position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
                }),
              },
            },
          },
        },
      );
      ticks(2);
      const lantern = [...game.world.allObjects()].find((item) => item.name === 'Laterne');
      expect(lantern?.worldPosition().toArray()).toEqual([0, 2, 10]);
      expect(lantern?.children.map((child) => child.name)).toEqual(['Lampe']);
      expect(lantern?.children[0]?.worldPosition().y).toBeCloseTo(5, 6);
      expect(log.some((entry) => entry.kind === 'missingPrefab')).toBe(true);
    },
  },
  {
    name: 'loops, waits and conditions run frame by frame',
    covers: [
      'control.repeat',
      'control.wait',
      'control.repeatUntil',
      'control.waitUntil',
      'control.forever',
      'control.ifElse',
      'control.stop',
      'sensing.mouseDown',
      'operators.gt',
      'operators.lt',
      'literal.text',
    ],
    run: () => {
      const change = (by: number): TestBlock =>
        b('variables.change', { variable: { id: SCORE } }, { by });
      const { game, ticks, player } = start(
        [
          b('control.repeat', {}, { times: 3, body: [change(1)] }),
          b('control.wait', {}, { seconds: 0.5 }),
          set(TEXT, 'gewartet'),
          b(
            'control.repeatUntil',
            {},
            {
              condition: b('operators.gt', {}, { a: get(SCORE), b: '5' }),
              body: [change(1)],
            },
          ),
          b('control.waitUntil', {}, { condition: b('sensing.mouseDown') }),
          set(TEXT, 'geklickt'),
          b(
            'control.forever',
            {},
            {
              body: [
                b(
                  'control.ifElse',
                  {},
                  {
                    condition: b('operators.lt', {}, { a: get(SCORE), b: '10' }),
                    then: [change(1)],
                    else: [b('control.stop', { what: 'thisScript' })],
                  },
                ),
              ],
            },
          ),
        ],
        3,
      );
      expect(game.vars[SCORE]).toBe(3);
      ticks(20);
      expect(player.vars[TEXT]).toBe('');
      ticks(20);
      expect(player.vars[TEXT]).toBe('gewartet');
      expect(game.vars[SCORE]).toBe(6);
      ticks(5);
      expect(player.vars[TEXT]).toBe('gewartet');
      game.input.mouseDown = true;
      ticks(1);
      expect(player.vars[TEXT]).toBe('geklickt');
      ticks(10);
      expect(game.vars[SCORE]).toBe(10);
      expect(game.runningScripts()).toEqual([]);
    },
  },
  {
    name: '"if" runs its body only when the condition holds and "stop all" ends every script',
    covers: ['control.if', 'control.stop', 'sensing.keyPressed'],
    run: () => {
      const { game, ticks } = play(
        workspace(
          [
            b('events.whenGameStarts'),
            b(
              'control.forever',
              {},
              {
                body: [
                  b(
                    'control.if',
                    {},
                    {
                      condition: b('sensing.keyPressed', { key: 'A' }),
                      then: [b('variables.change', { variable: { id: SCORE } }, { by: 1 })],
                    },
                  ),
                ],
              },
            ),
          ],
          [b('events.whenClicked'), b('control.stop', { what: 'all' })],
        ),
      );
      ticks(3);
      expect(game.vars[SCORE]).toBe(0);
      game.input.keyEvent('a', true);
      ticks(3);
      expect(game.vars[SCORE]).toBe(3);
      game.click('player000001');
      ticks(3);
      expect(game.vars[SCORE]).toBe(4);
      expect(game.runningScripts()).toEqual([]);
    },
  },
  {
    name: 'position, rotation and scale blocks',
    covers: [
      'motion.goToXYZ',
      'motion.turn',
      'motion.setRotation',
      'motion.setScale',
      'motion.position',
      'motion.heading',
    ],
    run: () => {
      const { player } = start([
        b('motion.goToXYZ', {}, { x: 1, y: 2, z: -3 }),
        set(
          TEXT,
          b(
            'operators.join',
            {},
            { a: b('motion.position', { axis: 'y' }), b: b('motion.position', { axis: 'z' }) },
          ),
        ),
        b('motion.setRotation', {}, { x: 0, y: 45, z: 0 }),
        b('motion.turn', { direction: 'left' }, { degrees: 15 }),
        set(SPEED, b('motion.heading')),
        b('motion.turn', { direction: 'down' }, { degrees: 10 }),
        b('motion.setScale', {}, { x: 2, y: 3, z: 4 }),
      ]);
      expect(player.vars[TEXT]).toBe('2-3');
      expect(player.vars[SPEED]).toBeCloseTo(60, 6);
      expect(player.position.toArray()).toEqual([1, 2, -3]);
      const [x, y] = player.getRotationDegrees();
      expect(x).toBeCloseTo(10, 6);
      expect(y).toBeCloseTo(60, 6);
      expect(player.object3d.scale.toArray()).toEqual([2, 3, 4]);
    },
  },
  {
    name: 'go to, look at and properties of other objects',
    covers: ['motion.goToObject', 'motion.lookAt', 'motion.propertyOf', 'sensing.distanceTo'],
    run: () => {
      const { player } = start([
        set(SPEED, b('sensing.distanceTo', { target })),
        b('motion.goToXYZ', {}, { x: 10, y: 0, z: 10 }),
        b('motion.lookAt', { target }),
        set(TEXT, b('motion.propertyOf', { property: 'z', target })),
        b('motion.goToObject', { target }),
      ]);
      expect(player.vars[SPEED]).toBeCloseTo(10, 6);
      // Looking from (10, 0, 10) at (0, 0, 10) means facing -X, a heading of 270°.
      expect(player.heading).toBeCloseTo(270, 6);
      expect(player.vars[TEXT]).toBe(10);
      expect(player.position.toArray()).toEqual([0, 0, 10]);
    },
  },
  {
    name: 'glide blocks move over time',
    covers: ['motion.glideToXYZ', 'motion.glideToObject'],
    run: () => {
      const { ticks, player } = start(
        [
          b('motion.glideToXYZ', { easing: 'linear' }, { seconds: 0.5, x: 0, y: 0, z: 5 }),
          b('motion.glideToObject', { target, easing: 'smooth' }, { seconds: 1 }),
        ],
        15,
      );
      expect(player.position.z).toBeCloseTo(2.5, 6);
      ticks(15);
      expect(player.position.z).toBeCloseTo(5, 6);
      ticks(30);
      expect(player.position.z).toBeGreaterThan(5);
      expect(player.position.z).toBeLessThan(10);
      ticks(30);
      expect(player.position.z).toBeCloseTo(10, 6);
    },
  },
  {
    name: 'looks blocks change size, visibility and active state',
    covers: ['looks.setSize', 'looks.setActive', 'looks.hide'],
    run: () => {
      const { player, object, ticks } = start([
        b('looks.setSize', {}, { percent: 150 }),
        b('looks.setActive', { action: 'deactivate', target }),
        b('looks.hide'),
      ]);
      expect(player.object3d.scale.x).toBeCloseTo(1.5, 6);
      expect(object('target000001')?.activeInHierarchy).toBe(false);
      expect(player.visible).toBe(false);
      const again = start([
        b('looks.setActive', { action: 'deactivate', target }),
        b('looks.setActive', { action: 'activate', target }),
      ]);
      expect(again.object('target000001')?.activeInHierarchy).toBe(true);
      ticks(1);
    },
  },
  {
    name: 'sensing blocks read touches, mouse, timer and random numbers',
    covers: [
      'sensing.touching',
      'sensing.mouseX',
      'sensing.mouseY',
      'sensing.timer',
      'sensing.resetTimer',
      'sensing.random',
    ],
    run: () => {
      const { game, ticks, player } = play(
        workspace(
          [
            b('events.everyFrame'),
            b(
              'control.if',
              {},
              {
                condition: b('sensing.touching', { target: 'tag:Einsammelbar' }),
                then: [set(SCORE, 'berührt')],
              },
            ),
          ],
          [
            b('events.whenClicked'),
            set(SPEED, b('sensing.timer')),
            b('sensing.resetTimer'),
            set(TEXT, b('sensing.timer')),
          ],
          [
            b('events.whenKey', { key: 'R', mode: 'pressed' }),
            set(SPEED, b('sensing.random', {}, { from: 1, to: 10 })),
            set(TEXT, b('operators.join', {}, { a: b('sensing.mouseX'), b: b('sensing.mouseY') })),
          ],
        ),
      );
      ticks(30);
      expect(game.vars[SCORE]).toBe(0);
      player.setPosition(0, 0, 2);
      ticks(1);
      expect(game.vars[SCORE]).toBe('berührt');
      game.click('player000001');
      ticks(1);
      expect(player.vars[SPEED]).toBeCloseTo(31 / 60, 6);
      expect(player.vars[TEXT]).toBe(0);
      game.setPointer(12, -4, 0, 0, 1);
      game.input.keyEvent('r', true);
      ticks(1);
      expect(player.vars[SPEED]).toBe(6);
      expect(player.vars[TEXT]).toBe('12-4');
    },
  },
  {
    name: 'operators compute like Scratch',
    covers: [
      'operators.add',
      'operators.subtract',
      'operators.multiply',
      'operators.divide',
      'operators.mod',
      'operators.round',
      'operators.mathFunction',
      'operators.min',
      'operators.max',
      'operators.clamp',
      'operators.lerp',
      'operators.lt',
      'operators.eq',
      'operators.gt',
      'operators.and',
      'operators.or',
      'operators.not',
      'operators.join',
      'operators.length',
      'operators.letterOf',
      'operators.contains',
      'variables.set',
    ],
    run: () => {
      const op = (
        type: string,
        inputs: Record<string, number | string | TestBlock>,
        fields = {},
      ): TestBlock => b(`operators.${type}`, fields, inputs);
      const t = b('operators.eq', {}, { a: 'x', b: 'x' });
      const f = b('operators.eq', {}, { a: 'x', b: 'y' });
      const checks: [TestBlock, number | string | boolean][] = [
        [op('add', { a: 2, b: 3 }), 5],
        [op('subtract', { a: 2, b: 5 }), -3],
        [op('multiply', { a: 4, b: 2.5 }), 10],
        [op('divide', { a: 7, b: 2 }), 3.5],
        [op('mod', { a: -7, b: 3 }), 2],
        [op('round', { value: 2.5 }), 3],
        [op('mathFunction', { value: 16 }, { fn: 'sqrt' }), 4],
        [op('mathFunction', { value: -3 }, { fn: 'abs' }), 3],
        [op('mathFunction', { value: 90 }, { fn: 'sin' }), 1],
        [op('min', { a: 4, b: 2 }), 2],
        [op('max', { a: 4, b: 2 }), 4],
        [op('clamp', { value: 15, low: 0, high: 10 }), 10],
        [op('lerp', { a: 0, b: 10, t: 0.25 }), 2.5],
        [op('lt', { a: '9', b: '10' }), true],
        [op('lt', { a: 'b', b: 'a' }), false],
        [op('eq', { a: 'a', b: 'A' }), true],
        [op('eq', { a: '1.0', b: '1' }), true],
        [op('gt', { a: '10', b: '9' }), true],
        [op('and', { a: t, b: f }), false],
        [op('or', { a: f, b: t }), true],
        [op('not', { value: f }), true],
        [op('not', {}), true],
        [op('join', { a: 'Ap', b: 'fel' }), 'Apfel'],
        [op('join', { a: 3, b: 4 }), '34'],
        [op('length', { text: 'Apfel' }), 5],
        [op('letterOf', { index: 2, text: 'Hallo' }), 'a'],
        [op('letterOf', { index: 9, text: 'Hallo' }), ''],
        [op('contains', { text: 'Apfel', part: 'PF' }), true],
        // A text reporter in a number slot is converted.
        [op('add', { a: op('join', { a: '1', b: '2' }), b: 1 }), 13],
        [op('add', { a: op('join', { a: 'x', b: '' }), b: 1 }), 1],
      ];
      const variables: VariableData[] = checks.map((_check, index) => ({
        id: `result${String(index).padStart(6, '0')}`,
        name: `r${index}`,
        type: 'number',
        scope: 'game',
        default: 0,
        inspector: false,
      }));
      const source = workspace([
        b('events.whenGameStarts'),
        ...checks.map(([block], index) => set(variables[index]?.id ?? '', block)),
      ]);
      const asset = compileAsset('script000001', source, variables);
      const game = new Game(
        {
          formatVersion: 1,
          environment: { ambientIntensity: 0.3, fog: { enabled: false, near: 10, far: 100 } },
          objects: {
            player000001: objectData({
              components: [scriptComponent('scriptc00001', 'script000001')],
            }),
          },
        },
        { scripts: () => asset },
      );
      game.stepTick();
      checks.forEach(([, expected], index) => {
        const value = game.vars[variables[index]?.id ?? ''];
        if (typeof expected === 'number') expect(value, `check ${index}`).toBeCloseTo(expected, 9);
        else expect(value, `check ${index}`).toBe(expected);
      });
    },
  },
  {
    name: 'variable displays can be shown and hidden',
    covers: ['variables.show', 'variables.hide', 'variables.set', 'variables.change'],
    run: () => {
      const { game, ticks } = play(
        workspace(
          [
            b('events.whenGameStarts'),
            set(SCORE, 7),
            b('variables.show', { variable: { id: SCORE } }),
            b('variables.show', { variable: { id: SPEED } }),
          ],
          [
            b('events.whenClicked'),
            b('variables.change', { variable: { id: SPEED } }, { by: 0.5 }),
            b('variables.hide', { variable: { id: SCORE } }),
          ],
        ),
        { speed: 3 },
      );
      ticks(1);
      expect(
        game.monitors().map((monitor) => [monitor.name, monitor.objectName, monitor.value]),
      ).toEqual([
        ['Punkte', null, 7],
        ['Geschwindigkeit', 'Player', 3],
      ]);
      game.click('player000001');
      ticks(1);
      expect(game.monitors().map((monitor) => [monitor.name, monitor.value])).toEqual([
        ['Geschwindigkeit', 3.5],
      ]);
    },
  },
];

const allCases = [...cases, ...phase3Cases, ...phase4Cases];

beforeAll(async () => {
  await initPhysics();
});

describe('runtime tests', () => {
  for (const testCase of allCases) {
    it(testCase.name, testCase.run);
  }

  it('cover every block of the catalog', () => {
    const covered = new Set(allCases.flatMap((testCase) => testCase.covers));
    const missing = BLOCK_CATALOG.map((block) => block.id).filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });
});
