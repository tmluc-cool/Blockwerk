import { Scene } from 'three';
import type { Fog } from 'three';
import { describe, expect, it } from 'vitest';
import { Environment, Game, initPhysics, TICK_SECONDS, weatherLook, World } from '../src';
import { component, objectData, sceneData } from './helpers';

function makeEnvironment(): { environment: Environment; scene: Scene } {
  const environment = new Environment({ groundSize: 0 });
  const scene = new Scene();
  environment.addTo(scene);
  return { environment, scene };
}

describe('day cycle', () => {
  it('puts the sun high at noon, on the horizon at 6 and 18, and below it at night', () => {
    const { environment } = makeEnvironment();
    environment.setSunLight('#ffffff', 5);
    const height = (hours: number): number => {
      environment.setTimeOfDay(hours);
      return environment.getSunDirection().y;
    };
    expect(height(12)).toBeGreaterThan(0.9);
    expect(Math.abs(height(6))).toBeLessThan(0.02);
    expect(Math.abs(height(18))).toBeLessThan(0.02);
    expect(height(0)).toBeLessThan(-0.9);
    // The sun rises in the east (+X) and sets in the west.
    environment.setTimeOfDay(8);
    expect(environment.getSunDirection().x).toBeGreaterThan(0);
    environment.setTimeOfDay(16);
    expect(environment.getSunDirection().x).toBeLessThan(0);
    environment.dispose();
  });

  it('lets the sun go out and the moon and stars come out at night', () => {
    const { environment, scene } = makeEnvironment();
    environment.setSunLight('#ffffff', 5);
    environment.setTimeOfDay(12);
    const noon = {
      sun: environment.sun.intensity,
      moon: environment.moon.intensity,
      stars: environment.stars.visible,
      ambient: scene.environmentIntensity,
    };
    environment.setTimeOfDay(0);
    expect(noon.sun).toBeCloseTo(5, 1);
    expect(noon.moon).toBe(0);
    expect(noon.stars).toBe(false);
    expect(environment.sun.intensity).toBe(0);
    expect(environment.moon.intensity).toBeGreaterThan(0.3);
    expect(environment.stars.visible).toBe(true);
    expect(scene.environmentIntensity).toBeLessThan(noon.ambient * 0.4);
    // The fog is dark at night and bright by day.
    const fog = scene.fog as Fog;
    environment.setTimeOfDay(12);
    const dayFog = fog.color.getHex();
    environment.setTimeOfDay(0);
    expect(fog.color.getHex()).not.toBe(dayFog);
    expect(fog.color.r + fog.color.g + fog.color.b).toBeLessThan(0.3);
    environment.dispose();
  });

  it('warms the sun near the horizon', () => {
    const { environment } = makeEnvironment();
    environment.setSunLight('#ffffff', 5);
    environment.setTimeOfDay(12);
    const noon = environment.sun.color.clone();
    environment.setTimeOfDay(6.4);
    expect(environment.sun.color.r).toBeGreaterThan(environment.sun.color.b);
    expect(environment.sun.color.b).toBeLessThan(noon.b);
    environment.dispose();
  });

  it('runs on with the game time and stands still when the day length is 0', () => {
    const { environment } = makeEnvironment();
    environment.setClock({ timeOfDay: 6, dayLength: 120, sunAzimuth: 0 });
    for (let i = 0; i < 60 / TICK_SECONDS; i++) environment.advance(TICK_SECONDS);
    expect(environment.timeOfDay).toBeCloseTo(18, 1);
    environment.setClock({ timeOfDay: 9, dayLength: 0, sunAzimuth: 0 });
    environment.advance(1000);
    expect(environment.timeOfDay).toBe(9);
    environment.setClock(null);
    expect(environment.timeOfDay).toBeNull();
    expect(environment.clockDriven).toBe(false);
    environment.dispose();
  });

  it('wraps the hour of the day', () => {
    const { environment } = makeEnvironment();
    environment.setTimeOfDay(25);
    expect(environment.timeOfDay).toBe(1);
    environment.setTimeOfDay(-2);
    expect(environment.timeOfDay).toBe(22);
    environment.dispose();
  });
});

describe('weather', () => {
  it('dims the sun, shortens the view and greys the fog in rain', () => {
    const { environment, scene } = makeEnvironment();
    environment.setFog(true, 60, 600);
    environment.setSunLight('#ffffff', 5);
    environment.setTimeOfDay(12);
    const fog = scene.fog as Fog;
    const clear = { sun: environment.sun.intensity, far: fog.far };
    environment.setWeather({ type: 'rain', intensity: 1, windSpeed: 4, windDirection: 90 }, true);
    expect(environment.sun.intensity).toBeLessThan(clear.sun * 0.6);
    expect(fog.far).toBeLessThan(clear.far * 0.6);
    environment.setWeather({ type: 'clear', intensity: 0, windSpeed: 0, windDirection: 0 }, true);
    expect(fog.far).toBeCloseTo(clear.far, 3);
    environment.dispose();
  });

  it('fades rain in over time and draws fewer drops on lower levels', () => {
    const { environment } = makeEnvironment();
    environment.setWeather({ type: 'rain', intensity: 1, windSpeed: 0, windDirection: 0 });
    expect(environment.weather.shownIntensity).toBe(0);
    for (let i = 0; i < 40; i++) environment.weather.update(0.1, null);
    expect(environment.weather.shownIntensity).toBe(1);
    environment.weather.setDensity(1);
    environment.weather.update(0.1, null);
    const all = environment.weather.drawnParticles();
    environment.weather.setDensity(0.4);
    environment.weather.update(0.1, null);
    expect(environment.weather.drawnParticles()).toBeCloseTo(all * 0.4, -1);
    expect(all).toBeGreaterThan(1000);
    // Switching to snow fades the rain out first.
    environment.setWeather({ type: 'snow', intensity: 0.5, windSpeed: 0, windDirection: 0 });
    environment.weather.update(0.5, null);
    expect(environment.weather.current().type).toBe('rain');
    for (let i = 0; i < 80; i++) environment.weather.update(0.1, null);
    expect(environment.weather.current().type).toBe('snow');
    expect(environment.weather.shownIntensity).toBeCloseTo(0.5, 2);
    environment.dispose();
  });

  it('has a look that grows with the intensity', () => {
    expect(weatherLook({ type: 'clear', intensity: 1, windSpeed: 0, windDirection: 0 }).sun).toBe(
      1,
    );
    const light = weatherLook({ type: 'rain', intensity: 0.3, windSpeed: 0, windDirection: 0 });
    const heavy = weatherLook({ type: 'rain', intensity: 1, windSpeed: 0, windDirection: 0 });
    expect(heavy.sun).toBeLessThan(light.sun);
    expect(heavy.visibility).toBeLessThan(light.visibility);
    expect(heavy.clouds).toBeGreaterThan(light.clouds);
  });
});

describe('scene environment', () => {
  const sun = objectData({
    name: 'Sun',
    transform: { position: [0, 0, 0], rotation: [50, 0, 0], scale: [1, 1, 1] },
    components: [component('light', { intensity: 3 }, 'sun000000001')],
  });

  it('is driven by the sky settings of the scene, not by the rotation of the sun object', () => {
    const data = sceneData({ sun00000001: sun });
    const clocked = new World({
      ...data,
      environment: {
        ...data.environment,
        sky: { timeOfDay: 0, dayLength: 0, sunAzimuth: 0 },
        weather: { type: 'rain', intensity: 1, windSpeed: 0, windDirection: 0 },
      },
    });
    clocked.updateSun();
    expect(clocked.environment.getSunDirection().y).toBeLessThan(-0.9);
    expect(clocked.environment.weather.current().type).toBe('rain');
    const plain = new World(data);
    plain.updateSun();
    // Without sky settings the sun object places the sun, as before.
    expect(plain.environment.getSunDirection().y).toBeGreaterThan(0.5);
    expect(plain.environment.weather.current().type).toBe('clear');
    clocked.dispose();
    plain.dispose();
  });

  it('changes while the game runs: time of day, weather and the day length', async () => {
    await initPhysics();
    const game = new Game(sceneData({ sun00000001: sun }), { scripts: () => null });
    game.setTimeOfDay(21);
    expect(game.timeOfDay()).toBe(21);
    game.setWeather('snow', 5);
    expect(game.weather()).toBe('snow');
    expect(game.world.environment.weather.state.intensity).toBeCloseTo(0.85, 5);
    game.setWeather('hail', 5);
    expect(game.weather()).toBe('snow');
    // A time speed of 3600 makes a game second an hour.
    game.setTimeSpeed(3600);
    for (let i = 0; i < 60; i++) game.stepTick();
    expect(game.timeOfDay()).toBeCloseTo(22, 1);
    game.setFogDensity(100);
    expect((game.world.scene.fog as Fog).far).toBeLessThan(100);
    game.setFogDensity(0);
    expect(game.world.scene.fog).toBeNull();
    game.setSunBrightness(0);
    expect(game.world.environment.sun.intensity).toBe(0);
    game.setGraphicsLevel('low');
    expect(game.graphicsLevel()).toBe('low');
    game.setGraphicsLevel('high');
    game.dispose();
  });
});
