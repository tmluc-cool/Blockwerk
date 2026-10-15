import { beforeAll, describe, expect, it } from 'vitest';
import {
  bindingsFor,
  DEFAULT_SETTINGS,
  Game,
  GameSettings,
  initPhysics,
  MemorySaveStorage,
  parseSave,
  peekHealth,
  peekInventory,
  sanitizeSettings,
} from '../src';
import type { CompiledScriptModule, ScriptAsset } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

describe('settings', () => {
  it('fall back to the defaults for missing, wrong and out-of-range values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const cleaned = sanitizeSettings({
      musicVolume: 500,
      mouseSensitivity: -4,
      graphicsLevel: 'ludicrous',
      fullscreen: 'yes',
      bindings: { 1: { jump: ['KeyJ'], attack: 'nope' } },
    });
    expect(cleaned.musicVolume).toBe(100);
    expect(cleaned.mouseSensitivity).toBe(0.2);
    expect(cleaned.graphicsLevel).toBeNull();
    expect(cleaned.fullscreen).toBe(false);
    expect(cleaned.bindings).toEqual({ 1: { jump: ['KeyJ'] } });
  });

  it('are stored on every change and read back by the next game', () => {
    let stored: unknown = null;
    const storage = { load: () => stored, save: (values: unknown) => (stored = values) };
    const settings = new GameSettings(storage);
    const seen: string[] = [];
    settings.onChange((key) => seen.push(key));
    settings.set('mouseSensitivity', 2);
    settings.setBinding(1, 'jump', ['KeyJ']);
    expect(seen).toEqual(['mouseSensitivity', 'bindings']);
    const again = new GameSettings(storage);
    expect(again.get('mouseSensitivity')).toBe(2);
    expect(bindingsFor(1, again.get('bindings')[1]).buttons.jump).toEqual(['KeyJ']);
    // Other actions keep their keys; an empty list puts the default back.
    expect(bindingsFor(1, again.get('bindings')[1]).buttons.interact).toEqual(['KeyE']);
    again.setBinding(1, 'jump', []);
    expect(bindingsFor(1, again.get('bindings')[1]).buttons.jump).toEqual(['Space']);
  });

  it('are applied by the game: volumes, mouse sensitivity and keys', () => {
    const settings = new GameSettings();
    const game = new Game(sceneData({}), { scripts: () => null, settings });
    settings.set('musicVolume', 30);
    settings.set('masterVolume', 50);
    settings.set('mouseSensitivity', 2.5);
    settings.setBinding(1, 'interact', ['KeyU']);
    expect(game.audio.volume('music')).toBeCloseTo(0.3);
    expect(game.audio.volume('master')).toBeCloseTo(0.5);
    expect(game.players[1].sensitivity).toBe(2.5);
    game.input.keyEvent('u', true, 'KeyU');
    game.stepTick();
    expect(game.players[1].isHeld('interact')).toBe(true);
    game.dispose();
  });
});

const saved = (assetId: string, id: string, saved: boolean): ScriptAsset => ({
  assetId,
  module: { scripts: [] } as CompiledScriptModule,
  variables: [{ id, name: id, type: 'number', scope: 'game', default: 0, inspector: false, saved }],
  lineToBlock: [],
  sourceUrl: `test://${assetId}`,
});

describe('save slots', () => {
  const hero = (x: number, z: number) =>
    objectData({
      name: 'Held',
      tag: 'Player',
      transform: { position: [x, 0, z], rotation: [0, 90, 0], scale: [1, 1, 1] },
      components: [
        component('characterController', {}, 'heroccontr01'),
        component('thirdPersonControl', {}, 'herocontrol1'),
        component('health', { max: 80 }, 'healthcomp001'),
        component('blockScript', { script: 'quest' }, 'questscr0001'),
        component('blockScript', { script: 'noise' }, 'noisescr0001'),
      ],
    });
  const make = (
    storage: MemorySaveStorage,
    options: Partial<ConstructorParameters<typeof Game>[1]> = {},
  ) =>
    new Game(sceneData({ hero000001: hero(0, 0) }), {
      scripts: (id) =>
        id === 'quest' ? saved(id, 'questvar', true) : saved(id, 'noisevar', false),
      saves: storage,
      sceneId: 'scene0000001',
      sceneName: 'Dorf',
      random: () => 0.5,
      ...options,
    });

  it('stores the scene, only the saved variables, and the player', () => {
    const storage = new MemorySaveStorage();
    const game = make(storage);
    game.vars['questvar'] = 2;
    game.vars['noisevar'] = 99;
    const player = game.world.getObject('hero000001');
    if (!player) throw new Error('no player');
    player.setWorldPosition(player.worldPosition().set(4, 0, -7));
    peekInventory(player);
    game.addItem(player, 'self', 'Schlüssel', 2);
    game.damageObject(player, 'self', 30);
    expect(game.saveGame(2)).toBe(true);
    const data = storage.read(2);
    expect(data?.scene).toBe('scene0000001');
    expect(data?.sceneName).toBe('Dorf');
    expect(data?.vars).toEqual({ questvar: 2 });
    expect(data?.players[0]).toMatchObject({
      position: [4, 0, -7],
      items: { Schlüssel: 2 },
      health: { current: 50, max: 80 },
    });
    expect(data?.players[0]?.yaw).toBeCloseTo(90);
    expect(game.slotUsed(2)).toBe(true);
    expect(game.slotUsed(1)).toBe(false);
    game.dispose();
  });

  it('loading asks for the saved scene; a game built with the save has everything back', () => {
    const storage = new MemorySaveStorage();
    const first = make(storage);
    first.vars['questvar'] = 2;
    const player = first.world.getObject('hero000001');
    if (!player) throw new Error('no player');
    player.setWorldPosition(player.worldPosition().set(4, 0, -7));
    first.addItem(player, 'self', 'Schlüssel', 1);
    first.saveGame(1);
    first.dispose();

    const second = make(storage);
    expect(second.loadGame(1)).toBe(true);
    const request = second.takeSceneRequest();
    expect(request?.scene).toBe('scene0000001');
    expect(request?.save?.vars).toEqual({ questvar: 2 });
    second.dispose();

    const third = make(storage, { save: request?.save });
    const restored = third.world.getObject('hero000001');
    expect(third.vars['questvar']).toBe(2);
    expect(restored?.worldPosition().x).toBeCloseTo(4);
    expect(restored?.worldPosition().z).toBeCloseTo(-7);
    expect(restored && peekInventory(restored)?.count('Schlüssel')).toBe(1);
    expect(restored && peekHealth(restored)?.max).toBe(80);
    third.dispose();
  });

  it('an empty or damaged slot does not load and says so', () => {
    const storage = new MemorySaveStorage();
    const game = make(storage);
    expect(game.loadGame(3)).toBe(false);
    expect(game.notice?.key).toBe('noSave');
    expect(game.takeSceneRequest()).toBeNull();
    expect(parseSave('{"formatVersion":1,"slot":9}')).toBeNull();
    expect(parseSave('not json')).toBeNull();
    game.dispose();
  });

  it('the pause freezes the logic ticks but not stepping by hand', () => {
    const game = make(new MemorySaveStorage());
    game.advance(0.1);
    const ticks = game.tick;
    expect(ticks).toBeGreaterThan(0);
    game.setGamePaused(true);
    game.advance(0.5);
    expect(game.tick).toBe(ticks);
    game.setGamePaused(false);
    game.advance(0.1);
    expect(game.tick).toBeGreaterThan(ticks);
    game.dispose();
  });
});
