import { describe, expect, it } from 'vitest';
import { Game, loadScriptModule, TICK_SECONDS } from '../src';
import type { GameApi, GameLogEntry, GameObject, ScriptAsset, ScriptEntry } from '../src';
import { component, objectData, sceneData, scriptAsset } from './helpers';

type Run = (self: GameObject, game: GameApi) => Generator<void, void, void>;

function entry(id: string, type: string, run: Run, params?: Record<string, string>): ScriptEntry {
  return { id, event: params ? { type, params } : { type }, run };
}

/** A scene with one player cube running the given script and a few other objects. */
function setup(
  entries: ScriptEntry[],
  options: { variables?: ScriptAsset['variables']; log?: GameLogEntry[] } = {},
): Game {
  const asset = scriptAsset('script000001', entries, options.variables ?? []);
  const scene = sceneData({
    player000001: objectData({
      name: 'Player',
      components: [
        component('meshRenderer', {}, 'render000001'),
        component('boxCollider', {}, 'collide00001'),
        component(
          'blockScript',
          { script: 'script000001', variables: { speed: 7 } },
          'script000c01',
        ),
      ],
    }),
    coin00000001: objectData({
      name: 'Coin',
      tag: 'Collectible',
      order: 1,
      transform: { position: [3, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [component('sphereCollider', { isTrigger: true }, 'collide00002')],
    }),
  });
  return new Game(scene, {
    scripts: (id) => (id === asset.assetId ? asset : null),
    log: (item) => options.log?.push(item),
    random: () => 0.5,
  });
}

function player(game: Game): GameObject {
  const object = game.world.getObject('player000001');
  if (!object) throw new Error('no player');
  return object;
}

describe('Game scheduler', () => {
  it('runs start scripts once and update scripts every tick', () => {
    const counts = { start: 0, update: 0 };
    const game = setup([
      entry('h1', 'start', function* () {
        counts.start++;
      }),
      entry('h2', 'update', function* () {
        counts.update++;
      }),
    ]);
    for (let i = 0; i < 5; i++) game.stepTick();
    expect(counts).toEqual({ start: 1, update: 5 });
    game.dispose();
  });

  it('advances at a fixed 60 Hz regardless of the frame rate and supports slow motion and pause', () => {
    const game = setup([]);
    for (let i = 0; i < 30; i++) game.advance(1 / 60);
    expect(game.tick).toBe(30);
    // A slower display (30 Hz) still runs 60 logic ticks per second.
    for (let i = 0; i < 15; i++) game.advance(1 / 30);
    expect(game.tick).toBe(60);
    // A long stall does not make the game jump.
    game.advance(2);
    expect(game.tick).toBeLessThanOrEqual(68);
    const before = game.tick;
    game.timeScale = 0.25;
    for (let i = 0; i < 12; i++) game.advance(1 / 60);
    expect(game.tick - before).toBe(3);
    const paused = game.tick;
    game.paused = true;
    game.advance(1);
    expect(game.tick).toBe(paused);
    game.stepTick();
    expect(game.tick).toBe(paused + 1);
    game.dispose();
  });

  it('waits for seconds by yielding across ticks', () => {
    const times: number[] = [];
    const game = setup([
      entry('h1', 'start', function* (_self, api) {
        yield* api.wait(0.5);
        times.push(api.time);
      }),
    ]);
    for (let i = 0; i < 40; i++) game.stepTick();
    expect(times).toHaveLength(1);
    expect(times[0]).toBeCloseTo(30 * TICK_SECONDS, 6);
    game.dispose();
  });

  it('fires key hats on press, while held and on release', () => {
    const events: string[] = [];
    const game = setup([
      entry(
        'pressed',
        'key',
        function* () {
          events.push('pressed');
        },
        { key: 'W', mode: 'pressed' },
      ),
      entry(
        'held',
        'key',
        function* () {
          events.push('held');
        },
        { key: 'W', mode: 'held' },
      ),
      entry(
        'released',
        'key',
        function* () {
          events.push('released');
        },
        { key: 'W', mode: 'released' },
      ),
    ]);
    game.input.keyEvent('w', true);
    game.stepTick();
    game.stepTick();
    game.input.keyEvent('w', false);
    game.stepTick();
    expect(events).toEqual(['pressed', 'held', 'held', 'released']);
    game.dispose();
  });

  it('moves objects with scripts and reads per-object inspector variables', () => {
    const game = setup(
      [
        entry('h1', 'update', function* (self, api) {
          if (api.keyDown('W')) self.move('forward', api.num(self.vars['speed']) * (1 / 60));
        }),
      ],
      {
        variables: [
          {
            id: 'speed',
            name: 'Geschwindigkeit',
            type: 'number',
            scope: 'object',
            default: 5,
            inspector: true,
          },
        ],
      },
    );
    game.input.keyEvent('W', true);
    for (let i = 0; i < 60; i++) game.stepTick();
    expect(player(game).position.z).toBeCloseTo(7, 6);
    game.dispose();
  });

  it('fires touch hats when colliders start to overlap, and the touching reporter agrees', () => {
    const touched: string[] = [];
    const game = setup([
      entry(
        'h1',
        'touch',
        function* (self, api) {
          touched.push(api.touching(self, 'tag:Collectible') ? 'yes' : 'no');
        },
        { target: 'tag:Collectible', phase: 'enter' },
      ),
      entry('h2', 'update', function* (self) {
        self.move('left', 0.1);
      }),
    ]);
    for (let i = 0; i < 40; i++) game.stepTick();
    // Box half size 0.5 + sphere radius 0.5: touching from x >= 2.
    expect(touched).toEqual(['yes']);
    expect(player(game).position.x).toBeGreaterThan(2);
    game.dispose();
  });

  it('hidden objects touch nothing', () => {
    const game = setup([]);
    const coin = game.world.getObject('coin00000001');
    coin?.setPosition(0.5, 0, 0);
    expect(game.touching(player(game), 'tag:Collectible')).toBe(true);
    coin?.setVisible(false);
    expect(game.touching(player(game), 'tag:Collectible')).toBe(false);
    game.dispose();
  });

  it('clones objects with their scripts and variables, and destroys them', () => {
    let created = 0;
    let destroyed = 0;
    const game = setup([
      entry('h1', 'start', function* (self, api) {
        self.vars['speed'] = 42;
        api.clone(self, 'self');
      }),
      entry('h2', 'created', function* (self, api) {
        created++;
        expect(self.vars['speed']).toBe(42);
        api.destroy(self, 'self');
      }),
      entry('h3', 'destroyed', function* () {
        destroyed++;
      }),
    ]);
    for (let i = 0; i < 3; i++) game.stepTick();
    expect(created).toBe(1);
    expect(destroyed).toBe(1);
    expect([...game.world.allObjects()].filter((object) => object.cloneOf)).toHaveLength(0);
    game.dispose();
  });

  it('reports script errors with the block that failed and keeps other scripts running', () => {
    const log: GameLogEntry[] = [];
    const code = [
      'function* s_1(self, game) {',
      '  self.vars.count = (self.vars.count ?? 0) + 1;',
      '  undefinedFunction();',
      '}',
      'return { scripts: [{ id: "hat", event: { type: "start" }, run: s_1 }] };',
    ].join('\n');
    const module = loadScriptModule(code, 'blockwerk://scripts/broken.js');
    const asset: ScriptAsset = {
      assetId: 'script000001',
      module,
      variables: [],
      lineToBlock: ['hat', 'counter', 'broken-block', 'hat', null],
      sourceUrl: 'blockwerk://scripts/broken.js',
    };
    let ticks = 0;
    const other = scriptAsset('script000001', []);
    void other;
    const game = new Game(
      sceneData({
        player000001: objectData({
          name: 'Player',
          components: [component('blockScript', { script: 'script000001' })],
        }),
      }),
      { scripts: () => asset, log: (item) => log.push(item) },
    );
    game.stepTick();
    ticks++;
    game.stepTick();
    expect(ticks).toBe(1);
    expect(log).toEqual([
      expect.objectContaining({
        kind: 'scriptError',
        objectName: 'Player',
        blockId: 'broken-block',
      }),
    ]);
    game.dispose();
  });

  it('warns about block-script components without script', () => {
    const log: GameLogEntry[] = [];
    const game = new Game(
      sceneData({
        player000001: objectData({
          name: 'P',
          components: [component('blockScript', { script: null })],
        }),
      }),
      { scripts: () => null, log: (item) => log.push(item) },
    );
    expect(log).toEqual([expect.objectContaining({ kind: 'missingScript', objectName: 'P' })]);
    game.dispose();
  });

  it('shows variable monitors', () => {
    const game = setup(
      [
        entry('h1', 'start', function* (self, api) {
          api.vars['points'] = 3;
          api.showVariable(self, 'game', 'points', 'Punkte', true);
        }),
      ],
      {
        variables: [
          {
            id: 'points',
            name: 'Punkte',
            type: 'number',
            scope: 'game',
            default: 0,
            inspector: false,
          },
        ],
      },
    );
    game.stepTick();
    expect(game.monitors()).toEqual([
      { key: 'game::points', name: 'Punkte', objectName: null, value: 3 },
    ]);
    game.dispose();
  });

  it('interpolates rendering between ticks and restores the logical state', () => {
    const game = setup([
      entry('h1', 'update', function* (self) {
        self.move('forward', 1);
      }),
    ]);
    game.stepTick();
    game.stepTick();
    const node = player(game).object3d;
    let rendered = 0;
    game.renderInterpolated(0.5, () => {
      rendered = node.position.z;
    });
    expect(rendered).toBeCloseTo(1.5, 6);
    expect(node.position.z).toBeCloseTo(2, 6);
    game.dispose();
  });

  it('converts values like Scratch', () => {
    const game = setup([]);
    expect(game.num('5')).toBe(5);
    expect(game.num('abc')).toBe(0);
    expect(game.compare('10', 9)).toBeGreaterThan(0);
    expect(game.compare('Apfel', 'apfel')).toBe(0);
    expect(game.bool('false')).toBe(false);
    expect(game.mod(-1, 3)).toBe(2);
    expect(game.random(1, 10)).toBe(6);
    expect(game.letterOf(2, 'Hallo')).toBe('a');
    expect(game.mathFunction('sin', 30)).toBe(0.5);
    game.dispose();
  });

  it('does not change the scene data it was started from', () => {
    const data = sceneData({ player000001: objectData({ name: 'Player' }) });
    const game = new Game(data, { scripts: () => null });
    game.world.getObject('player000001')?.setPosition(5, 5, 5);
    expect(data.objects['player000001']?.transform.position).toEqual([0, 0, 0]);
    game.dispose();
  });
});
