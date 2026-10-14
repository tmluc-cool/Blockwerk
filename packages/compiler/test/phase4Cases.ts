import { currentQuality, setQuality } from '@blockwerk/runtime';
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
];
