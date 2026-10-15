import {
  AudioEngine,
  currentQuality,
  emitterRegistry,
  RecordingAudioContext,
  setQuality,
} from '@blockwerk/runtime';
import type { Fog } from 'three';
import { expect } from 'vitest';
import { b, set, workspace } from './dsl';
import { A, ground, get, hero, launch, object, run, when } from './phase3Cases';
import type { RuntimeCase } from './phase3Cases';
import { component } from './phase3Cases';

/** Runtime cases of the phase 4 blocks (environment, sound, effects). */
export const phase4Cases: RuntimeCase[] = [
  {
    name: 'environment blocks set the time, weather, wind, fog, sun and lamps',
    covers: [
      'environment.setTimeOfDay',
      'environment.setTimeSpeed',
      'environment.timeOfDay',
      'environment.setWeather',
      'environment.setWind',
      'environment.setFogDensity',
      'environment.setSunBrightness',
      'environment.setLight',
      'environment.setLightColor',
      'environment.setGraphicsLevel',
    ],
    run: () => {
      const before = currentQuality();
      const lamp = object(
        'Lamp',
        [0, 3, 0],
        [component('light', { lightType: 'point' }, 'lamplight000')],
      );
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'hero'), lamp00000001: lamp },
        scripts: {
          hero: workspace(
            when(
              b('events.whenGameStarts'),
              b('environment.setTimeOfDay', {}, { hours: 21.5 }),
              b('environment.setTimeSpeed', {}, { factor: 720 }),
              b('environment.setWeather', { weather: 'rain' }, { seconds: 5 }),
              b('environment.setWind', {}, { speed: 6, direction: 90 }),
              b('environment.setFogDensity', {}, { percent: 30 }),
              b('environment.setSunBrightness', {}, { percent: 0 }),
              b('environment.setLight', { target: 'object:lamp00000001', state: 'off' }),
              b('environment.setLightColor', { target: 'object:lamp00000001', color: '#ff0000' }),
              b('environment.setGraphicsLevel', { level: 'medium' }),
            ),
            when(b('events.everyFrame'), set(A, b('environment.timeOfDay'))),
          ),
        },
      });
      run(game, 0.5);
      const environment = game.world.environment;
      // 720 times real time is 0.2 hours per second.
      expect(environment.timeOfDay).toBeGreaterThan(21.55);
      expect(environment.timeOfDay).toBeLessThan(21.7);
      expect(game.vars[A]).toBeCloseTo(environment.timeOfDay ?? 0, 1);
      expect(game.weather()).toBe('rain');
      expect(environment.weather.state.windSpeed).toBe(6);
      expect(environment.weather.state.windDirection).toBe(90);
      expect((game.world.scene.fog as Fog).far).toBeLessThan(1000);
      expect(environment.sun.intensity).toBe(0);
      const light = get(game, 'lamp00000001').findComponent('light');
      expect(light?.enabled).toBe(false);
      expect(light?.values['color']).toBe('#ff0000');
      expect(currentQuality()).toBe('medium');
      game.dispose();
      setQuality(before);
    },
  },
  {
    name: 'effect blocks play one-shot effects and start and stop particle systems',
    covers: ['effects.spawn', 'effects.start', 'effects.stop'],
    run: () => {
      const fire = object(
        'Fire',
        [3, 0, 0],
        [component('particleSystem', { preset: 'fire', playOnAwake: false }, 'firesystem001')],
      );
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'hero'), fire00000001: fire },
        scripts: {
          hero: workspace(
            when(
              b('events.whenGameStarts'),
              b('effects.spawn', { effect: 'explosion', at: 'self' }),
              b('effects.start', { target: 'object:fire00000001' }),
            ),
            when(
              b('events.whenKey', { key: 'F', mode: 'pressed' }),
              b('effects.stop', { target: 'object:fire00000001' }),
            ),
          ),
        },
      });
      const emitter = emitterRegistry.get(get(game, 'fire00000001'));
      if (!emitter) throw new Error('no emitter');
      run(game, 0.3);
      expect(game.world.effects.active).toBe(1);
      expect(emitter.isPlaying).toBe(true);
      expect(emitter.alive).toBeGreaterThan(0);
      game.input.keyEvent('f', true, 'KeyF');
      run(game, 0.1);
      expect(emitter.isPlaying).toBe(false);
      // The explosion plays once and removes itself.
      run(game, 3);
      expect(game.world.effects.active).toBe(0);
      expect(emitter.alive).toBe(0);
      game.dispose();
    },
  },
  {
    name: 'sound blocks play 3D and everywhere sounds, music with fades, volumes and stop',
    covers: [
      'sound.play',
      'sound.playMusic',
      'sound.crossfadeMusic',
      'sound.stopAll',
      'sound.setVolume',
    ],
    run: async () => {
      const context = new RecordingAudioContext();
      const audio = new AudioEngine({ createContext: () => context as unknown as AudioContext });
      const speaker = object('Speaker', [6, 1, 0], []);
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'hero'), speaker00001: speaker },
        audio,
        scripts: {
          hero: workspace(
            when(
              b('events.whenGameStarts'),
              b('sound.setVolume', { channel: 'music' }, { percent: 40 }),
              b('sound.play', { sound: 'builtin:coin', where: 'everywhere' }),
              b('sound.playMusic', { sound: 'builtin:music-calm' }),
            ),
            when(
              b('events.whenKey', { key: 'F', mode: 'pressed' }),
              b('sound.crossfadeMusic', { sound: 'builtin:music-adventure' }, { seconds: 2 }),
              b('sound.play', { sound: 'builtin:explosion', where: 'here' }),
            ),
            when(b('events.whenKey', { key: 'G', mode: 'pressed' }), b('sound.stopAll')),
          ),
        },
      });
      run(game, 0.2);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(audio.volume('music')).toBeCloseTo(0.4);
      expect(audio.played).toEqual(expect.arrayContaining(['builtin:coin', 'builtin:music-calm']));
      const coin = context.sources[0];
      // "everywhere": no 3D panner.
      expect(coin?.panner).toBeNull();
      expect(audio.currentMusic).toBe('builtin:music-calm');
      game.input.keyEvent('f', true, 'KeyF');
      run(game, 0.2);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(audio.currentMusic).toBe('builtin:music-adventure');
      const explosion = context.sources.find((source) => source.panner !== null);
      // "here": a 3D sound at the hero's place.
      expect(explosion?.panner?.positionX.value).toBeCloseTo(0, 1);
      game.input.keyEvent('g', true, 'KeyG');
      run(game, 0.2);
      expect(audio.currentMusic).toBeNull();
      expect(context.playing).toHaveLength(0);
      game.dispose();
    },
  },
];
