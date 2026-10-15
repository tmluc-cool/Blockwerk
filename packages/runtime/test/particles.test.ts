import { Object3D, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARTICLE_PARAMS,
  Effects,
  emitterRegistry,
  Game,
  initPhysics,
  ParticleEmitter,
  PARTICLE_PRESET_NAMES,
  particleTemplateValues,
  setQuality,
  TICK_SECONDS,
} from '../src';
import { component, objectData, sceneData } from './helpers';

const STEP = TICK_SECONDS;

function run(emitter: ParticleEmitter, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / STEP); i++) emitter.step(STEP);
}

describe('ParticleEmitter', () => {
  it('emits at the given rate and lets particles die after their lifetime', () => {
    setQuality('high');
    const scene = new Scene();
    const source = new Object3D();
    scene.add(source);
    const emitter = new ParticleEmitter(source, scene, {
      ...DEFAULT_PARTICLE_PARAMS,
      rate: 60,
      lifetime: 1,
      lifetimeVariance: 0,
    });
    emitter.play();
    run(emitter, 0.5);
    expect(emitter.alive).toBeGreaterThan(25);
    expect(emitter.alive).toBeLessThan(35);
    emitter.stop();
    run(emitter, 1.2);
    expect(emitter.alive).toBe(0);
    expect(emitter.finished).toBe(true);
    emitter.dispose();
  });

  it('stops by itself after the duration when it does not loop, after a burst', () => {
    setQuality('high');
    const scene = new Scene();
    const source = new Object3D();
    const emitter = new ParticleEmitter(source, scene, {
      ...DEFAULT_PARTICLE_PARAMS,
      loop: false,
      duration: 0.5,
      rate: 0,
      burst: 10,
      lifetime: 5,
    });
    emitter.play();
    expect(emitter.alive).toBe(10);
    run(emitter, 0.6);
    expect(emitter.isPlaying).toBe(false);
    expect(emitter.alive).toBe(10);
    emitter.dispose();
  });

  it('shoots cone particles upwards inside the cone angle', () => {
    setQuality('high');
    const emitter = new ParticleEmitter(new Object3D(), new Scene(), {
      ...DEFAULT_PARTICLE_PARAMS,
      shape: 'cone',
      coneAngle: 20,
      shapeRadius: 0,
      speed: 4,
      speedVariance: 0,
      rate: 0,
      burst: 60,
      lifetime: 5,
    });
    emitter.play();
    emitter.step(0.5);
    const position = emitter.points.geometry.getAttribute('position');
    for (let i = 0; i < emitter.alive; i++) {
      const horizontal = Math.hypot(position.getX(i), position.getZ(i));
      expect(position.getY(i)).toBeGreaterThan(1);
      expect(Math.atan2(horizontal, position.getY(i))).toBeLessThan((21 * Math.PI) / 180);
    }
    emitter.dispose();
  });

  it('lets gravity pull particles down and a negative gravity let them rise', () => {
    setQuality('high');
    const heightAfter = (gravity: number): number => {
      const scene = new Scene();
      const emitter = new ParticleEmitter(new Object3D(), scene, {
        ...DEFAULT_PARTICLE_PARAMS,
        shape: 'point',
        speed: 0,
        gravity,
        rate: 0,
        burst: 1,
        lifetime: 2,
        lifetimeVariance: 0,
      });
      emitter.play();
      run(emitter, 0.5);
      const y = emitter.points.geometry.getAttribute('position').getY(0);
      emitter.dispose();
      return y;
    };
    expect(heightAfter(1)).toBeLessThan(-0.5);
    expect(heightAfter(-1)).toBeGreaterThan(0.5);
  });

  it('simulates in world space (stays behind) or in local space (follows the object)', () => {
    setQuality('high');
    const scene = new Scene();
    const source = new Object3D();
    scene.add(source);
    const make = (space: 'world' | 'local'): ParticleEmitter => {
      const emitter = new ParticleEmitter(source, scene, {
        ...DEFAULT_PARTICLE_PARAMS,
        shape: 'point',
        speed: 0,
        rate: 0,
        burst: 1,
        lifetime: 3,
        space,
      });
      emitter.play();
      emitter.step(STEP);
      return emitter;
    };
    const world = make('world');
    const local = make('local');
    source.position.set(10, 0, 0);
    source.updateMatrixWorld(true);
    world.step(STEP);
    local.step(STEP);
    expect(world.points.parent).toBe(scene);
    expect(local.points.parent).toBe(source);
    expect(world.points.geometry.getAttribute('position').getX(0)).toBeCloseTo(0, 3);
    const local0 = local.points.geometry.getAttribute('position').getX(0);
    expect(local0).toBeCloseTo(0, 3);
    local.points.updateWorldMatrix(true, false);
    expect(new Vector3().setFromMatrixPosition(local.points.matrixWorld).x).toBeCloseTo(10, 3);
    world.dispose();
    local.dispose();
  });

  it('draws fewer particles on a low graphics level', () => {
    const count = (level: 'low' | 'ultra'): number => {
      setQuality(level);
      const scene = new Scene();
      const emitter = new ParticleEmitter(new Object3D(), scene, {
        ...DEFAULT_PARTICLE_PARAMS,
        rate: 0,
        burst: 100,
        maxParticles: 1000,
      });
      emitter.play();
      const alive = emitter.alive;
      emitter.dispose();
      return alive;
    };
    expect(count('low')).toBeLessThan(count('ultra'));
    setQuality('high');
  });

  it('never holds more particles than the maximum', () => {
    setQuality('high');
    const emitter = new ParticleEmitter(new Object3D(), new Scene(), {
      ...DEFAULT_PARTICLE_PARAMS,
      rate: 5000,
      maxParticles: 50,
      lifetime: 10,
    });
    emitter.play();
    run(emitter, 1);
    expect(emitter.alive).toBeLessThanOrEqual(50);
    emitter.dispose();
  });
});

describe('templates', () => {
  it('has a template for every name with settings for all modules', () => {
    for (const name of PARTICLE_PRESET_NAMES) {
      const values = particleTemplateValues(name);
      expect(values, name).not.toBeNull();
      expect(Object.keys(values ?? {}).sort()).toEqual(Object.keys(DEFAULT_PARTICLE_PARAMS).sort());
    }
    expect(particleTemplateValues('custom')).toBeNull();
  });

  it('plays one-shot templates once and removes them, rain and fire keep running', () => {
    setQuality('high');
    const scene = new Scene();
    const effects = new Effects(scene);
    effects.spawn('explosion', new Vector3(0, 1, 0));
    effects.spawn('fire', new Vector3(2, 0, 0));
    expect(effects.active).toBe(2);
    for (let i = 0; i < 180; i++) effects.update(STEP);
    expect(effects.active).toBe(1);
    effects.clear();
    expect(effects.active).toBe(0);
    expect(scene.children).toHaveLength(0);
  });
});

describe('particle system component', () => {
  const object = objectData({
    name: 'Fire',
    components: [component('particleSystem', { preset: 'fire', rate: 100 }, 'ps0000000001')],
  });

  it('starts on its own in play mode and follows the field values', async () => {
    await initPhysics();
    setQuality('high');
    const game = new Game(sceneData({ fire0000001: object }), { scripts: () => null });
    const emitter = emitterRegistry.get(game.world.objects.get('fire0000001') as never);
    expect(emitter).toBeDefined();
    for (let i = 0; i < 30; i++) game.stepTick();
    expect(emitter?.alive).toBeGreaterThan(10);
    expect(emitter?.isPlaying).toBe(true);
    game.dispose();
  });

  it('does not play when "play on awake" is off', async () => {
    await initPhysics();
    setQuality('high');
    const idle = objectData({
      components: [component('particleSystem', { playOnAwake: false })],
    });
    const game = new Game(sceneData({ idle00000001: idle }), { scripts: () => null });
    for (let i = 0; i < 30; i++) game.stepTick();
    const emitter = emitterRegistry.get(game.world.objects.get('idle00000001') as never);
    expect(emitter?.alive).toBe(0);
    game.dispose();
  });
});
