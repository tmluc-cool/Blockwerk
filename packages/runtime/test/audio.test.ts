import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObjectData } from '@blockwerk/project';
import {
  audioSourceRegistry,
  AudioEngine,
  Game,
  initPhysics,
  RecordingAudioContext,
  setAudioSource,
  SYNTH_RATE,
  synthesize,
  TerrainData,
  setTerrainSource,
} from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

function makeEngine(): { engine: AudioEngine; context: RecordingAudioContext } {
  const context = new RecordingAudioContext();
  const engine = new AudioEngine({ createContext: () => context as unknown as AudioContext });
  return { engine, context };
}

/** Lets the sound that loads in the background start. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('AudioEngine', () => {
  it('plays a built-in sound once at the right length, evenly everywhere', async () => {
    const { engine, context } = makeEngine();
    engine.play('jump');
    await flush();
    const source = context.sources[0];
    expect(source?.started).toBe(true);
    expect(source?.loop).toBe(false);
    expect(source?.buffer?.length).toBe(synthesize('jump').length);
    expect(source?.buffer?.sampleRate).toBe(SYNTH_RATE);
    // Not a 3D sound: no panner on the way.
    expect(source?.panner).toBeNull();
    expect(engine.activeSounds).toBe(1);
    source?.finish();
    expect(engine.activeSounds).toBe(0);
    engine.dispose();
  });

  it('makes 3D sounds with a linear fade from the minimum to the maximum distance', async () => {
    const { engine, context } = makeEngine();
    engine.play('explosion', {
      position: new Vector3(4, 1, -2),
      minDistance: 2,
      maxDistance: 40,
    });
    await flush();
    const panner = context.sources[0]?.panner;
    expect(panner?.distanceModel).toBe('linear');
    expect(panner?.refDistance).toBe(2);
    expect(panner?.maxDistance).toBe(40);
    expect(panner?.positionX.value).toBe(4);
    expect(panner?.positionZ.value).toBe(-2);
    const handle = engine.play('hit', { position: new Vector3(0, 0, 0) });
    await flush();
    handle.setPosition(new Vector3(9, 0, 3));
    expect(context.sources[1]?.panner?.positionX.value).toBe(9);
    engine.dispose();
  });

  it('follows the listener', () => {
    const { engine, context } = makeEngine();
    engine.resume();
    engine.setListener(new Vector3(1, 2, 3), new Vector3(0, 0, -1), new Vector3(0, 1, 0));
    expect(context.listener.positionX.value).toBe(1);
    expect(context.listener.positionY.value).toBe(2);
    expect(context.listener.forwardZ.value).toBe(-1);
    expect(context.listener.upY.value).toBe(1);
    engine.dispose();
  });

  it('has separate volumes for music, effects and voices, and a mute', async () => {
    const { engine, context } = makeEngine();
    engine.setVolume('effects', 0.5);
    engine.setVolume('voices', 0.25);
    engine.play('click', { bus: 'effects' });
    engine.play('hurt', { bus: 'voices' });
    await flush();
    expect(context.sources[0]?.gainProduct).toBeCloseTo(0.5);
    expect(context.sources[1]?.gainProduct).toBeCloseTo(0.25);
    engine.setVolume('master', 0.5);
    expect(context.sources[0]?.gainProduct).toBeCloseTo(0.25);
    engine.setMuted(true);
    expect(context.sources[0]?.gainProduct).toBe(0);
    engine.setMuted(false);
    expect(engine.volume('music')).toBeCloseTo(0.6);
    engine.setVolume('music', 7);
    expect(engine.volume('music')).toBe(1);
    engine.dispose();
  });

  it('loops music and fades from one piece to the next', async () => {
    const { engine, context } = makeEngine();
    engine.playMusic('music-calm', 0);
    await flush();
    expect(engine.currentMusic).toBe('music-calm');
    expect(context.sources[0]?.loop).toBe(true);
    // The same piece again does nothing.
    engine.playMusic('music-calm', 0);
    expect(context.sources).toHaveLength(1);
    engine.crossfadeMusic('music-adventure', 2);
    await flush();
    expect(engine.currentMusic).toBe('music-adventure');
    expect(context.sources).toHaveLength(2);
    // The old piece fades out, the new one starts quiet.
    expect(context.sources[0]?.stopped).toBe(true);
    engine.stopAll();
    expect(engine.currentMusic).toBeNull();
    engine.dispose();
  });

  it('decodes sound files of the project and plays nothing for missing ones', async () => {
    const { engine, context } = makeEngine();
    setAudioSource((id) => (id === 'abcdefghijkl' ? new Uint8Array(2048).buffer : null));
    engine.play('audio:abcdefghijkl');
    engine.play('audio:missing00000');
    await flush();
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.buffer?.length).toBe(2048);
    engine.dispose();
    setAudioSource(() => null);
  });

  it('does nothing, and does not fail, without audio', () => {
    const engine = new AudioEngine({ createContext: () => null });
    expect(engine.available).toBe(false);
    const handle = engine.play('jump', { position: new Vector3() });
    handle.stop();
    engine.playMusic('music-calm');
    engine.updateWeather('rain', 1, 5);
    engine.setListener(new Vector3(), new Vector3(0, 0, 1), new Vector3(0, 1, 0));
    engine.stopAll();
    expect(engine.activeSounds).toBe(0);
  });

  it('plays rain and wind sounds that follow the weather', async () => {
    const { engine, context } = makeEngine();
    engine.updateWeather('rain', 1, 8);
    await flush();
    const loops = context.playing.filter((source) => source.loop);
    expect(loops).toHaveLength(2);
    expect(engine.played).toEqual(expect.arrayContaining(['ambient-rain', 'ambient-wind']));
    engine.updateWeather('clear', 0, 0);
    await flush();
    expect(context.playing.filter((source) => source.loop).length).toBe(0);
    engine.dispose();
  });
});

describe('audio source component and character sounds', () => {
  const ground = objectData({
    name: 'Ground',
    transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [80, 1, 80] },
    components: [component('boxCollider', {}, 'groundcoll01')],
  });
  const hero = (position: [number, number, number], extra = {}): SceneObjectData =>
    objectData({
      name: 'Hero',
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component('characterController', {}, 'herocctrl001'),
        component('thirdPersonControl', {}, 'herocontrol1'),
        ...(Object.keys(extra).length ? [component('character', extra, 'herochar0001')] : []),
      ],
    });

  it('plays a 3D sound at the object and moves it along', async () => {
    const { engine, context } = makeEngine();
    const speaker = objectData({
      name: 'Radio',
      transform: { position: [5, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component('audioSource', { sound: 'builtin:music-calm', loop: true }, 'radiosource01'),
      ],
    });
    const game = new Game(sceneData({ radio0000001: speaker }), {
      scripts: () => null,
      audio: engine,
    });
    game.stepTick();
    await flush();
    const source = context.sources[0];
    expect(source?.loop).toBe(true);
    expect(source?.panner?.positionX.value).toBe(5);
    game.world.getObject('radio0000001')?.object3d.position.set(-7, 1, 0);
    game.stepTick();
    expect(source?.panner?.positionX.value).toBe(-7);
    const state = game.world.getObject('radio0000001');
    expect(state && audioSourceRegistry.get(state)?.playing).toBe(true);
    game.dispose();
    expect(source?.stopped).toBe(true);
  });

  it('does not play on its own when "play on awake" is off', async () => {
    const { engine, context } = makeEngine();
    const quiet = objectData({
      components: [
        component('audioSource', { sound: 'builtin:click', playOnAwake: false }, 'quietsource01'),
      ],
    });
    const game = new Game(sceneData({ quiet0000001: quiet }), {
      scripts: () => null,
      audio: engine,
    });
    game.stepTick();
    await flush();
    expect(context.sources).toHaveLength(0);
    game.dispose();
  });

  it('hears from the audio listener object instead of the camera', async () => {
    const { engine, context } = makeEngine();
    const ears = objectData({
      name: 'Ears',
      transform: { position: [3, 4, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [component('audioListener', {}, 'earscomponent1')],
    });
    const game = new Game(sceneData({ ears00000001: ears }), {
      scripts: () => null,
      audio: engine,
    });
    game.stepTick();
    // The context starts with the first sound (or when the browser allows it); the pose waits.
    engine.resume();
    expect(context.listener.positionX.value).toBe(3);
    expect(context.listener.positionY.value).toBe(4);
    expect(context.listener.forwardZ.value).toBeCloseTo(1);
    game.dispose();
  });

  it('plays footsteps by stride, jump and landing from the sound set, and respects "none"', async () => {
    const { engine } = makeEngine();
    const game = new Game(sceneData({ ground000001: ground, hero00000001: hero([0, 0, 0]) }), {
      scripts: () => null,
      audio: engine,
      random: () => 0.5,
    });
    for (let i = 0; i < 20; i++) game.stepTick();
    expect(engine.played.filter((id) => id.startsWith('footstep'))).toHaveLength(0);
    game.input.keyEvent('w', true, 'KeyW');
    for (let i = 0; i < 180; i++) game.stepTick();
    game.input.keyEvent('w', false, 'KeyW');
    const steps = engine.played.filter((id) => id.startsWith('footstep'));
    expect(steps.length).toBeGreaterThanOrEqual(3);
    game.input.keyEvent(' ', true, 'Space');
    for (let i = 0; i < 90; i++) game.stepTick();
    expect(engine.played).toContain('jump');
    expect(engine.played).toContain('land');
    game.dispose();

    const custom = makeEngine().engine;
    const silent = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: hero([0, 0, 0], { sounds: 'footstep=none;jump=builtin:coin' }),
      }),
      { scripts: () => null, audio: custom },
    );
    silent.input.keyEvent('w', true, 'KeyW');
    silent.input.keyEvent(' ', true, 'Space');
    for (let i = 0; i < 120; i++) silent.stepTick();
    expect(custom.played.filter((id) => id.startsWith('footstep'))).toHaveLength(0);
    expect(custom.played).toContain('builtin:coin');
    silent.dispose();
  });

  it('steps differently on the layer the terrain is painted with', async () => {
    const terrain = new TerrainData(33, 60);
    for (let i = 0; i < 6; i++) {
      terrain.apply({ tool: 'paint', x: 0, z: 0, radius: 100, strength: 1, layer: 2 });
    }
    setTerrainSource((id) => (id === 'terrain000001' ? terrain : null));
    const { engine } = makeEngine();
    const game = new Game(
      sceneData({
        land00000001: objectData({
          name: 'Land',
          components: [
            component('terrain', { terrain: 'terrain000001', grass: false }, 'terraincomp1'),
          ],
        }),
        hero00000001: hero([0, 0.2, 0]),
      }),
      { scripts: () => null, audio: engine },
    );
    game.input.keyEvent('w', true, 'KeyW');
    for (let i = 0; i < 200; i++) game.stepTick();
    expect(engine.played).toContain('footstep-stone');
    expect(engine.played).not.toContain('footstep-grass');
    game.dispose();
    setTerrainSource(() => null);
  });
});
