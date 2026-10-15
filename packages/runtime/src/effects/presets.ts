import type { JsonValue, Vec3 } from '@blockwerk/project';

/** Shapes particles are emitted from (Unity: Shape module). */
export const PARTICLE_SHAPES = ['point', 'sphere', 'cone', 'box', 'circle'] as const;
export type ParticleShape = (typeof PARTICLE_SHAPES)[number];

/** All settings of a particle system (the modules of the inspector). */
export interface ParticleParams {
  /** Keep emitting after `duration` seconds. */
  loop: boolean;
  /** Seconds the emitter runs when it does not loop. */
  duration: number;
  /** Particles per second. */
  rate: number;
  /** Particles shot out at once when emission starts. */
  burst: number;
  maxParticles: number;
  shape: ParticleShape;
  /** Radius of sphere, cone base and circle in meters. */
  shapeRadius: number;
  /** Opening angle of the cone in degrees. */
  coneAngle: number;
  /** Size of the box shape in meters. */
  shapeSize: Vec3;
  /** Seconds a particle lives. */
  lifetime: number;
  /** Random share (0..1) by which lifetime varies. */
  lifetimeVariance: number;
  /** Start speed in m/s along the emitter's up axis (negative: downwards). */
  speed: number;
  speedVariance: number;
  startSize: number;
  /** Size at the end of the lifetime. */
  endSize: number;
  sizeVariance: number;
  startColor: string;
  endColor: string;
  startAlpha: number;
  endAlpha: number;
  /** Multiplier of gravity (1 = falls like a stone, negative = rises). */
  gravity: number;
  /** Air drag per second (0 = none). */
  drag: number;
  /** Glowing blend (fire, magic) instead of normal blend (dust, smoke). */
  additive: boolean;
  /** `world`: particles stay where they were emitted; `local`: they follow the object. */
  space: 'world' | 'local';
}

/** Settings of a new particle system. */
export const DEFAULT_PARTICLE_PARAMS: ParticleParams = {
  loop: true,
  duration: 5,
  rate: 20,
  burst: 0,
  maxParticles: 500,
  shape: 'cone',
  shapeRadius: 0.3,
  coneAngle: 25,
  shapeSize: [1, 1, 1],
  lifetime: 1.5,
  lifetimeVariance: 0.3,
  speed: 2,
  speedVariance: 0.3,
  startSize: 0.2,
  endSize: 0,
  sizeVariance: 0.3,
  startColor: '#ffffff',
  endColor: '#ffffff',
  startAlpha: 1,
  endAlpha: 0,
  gravity: 0,
  drag: 0,
  additive: false,
  space: 'world',
};

/** Names of the effect templates (SPEC 8.16). */
export const PARTICLE_PRESET_NAMES = [
  'dust',
  'sparks',
  'explosion',
  'smoke',
  'fire',
  'magic',
  'rain',
  'snow',
  'sparkle',
] as const;
export type ParticlePresetName = (typeof PARTICLE_PRESET_NAMES)[number];

/** Whether a text names an effect template. */
export function isParticlePreset(value: string): value is ParticlePresetName {
  return (PARTICLE_PRESET_NAMES as readonly string[]).includes(value);
}

function preset(changes: Partial<ParticleParams>): ParticleParams {
  return { ...DEFAULT_PARTICLE_PARAMS, ...changes };
}

/**
 * Effect templates. One-shot effects (dust, sparks, explosion, sparkle) have `loop: false`, a
 * burst and no rate; the others run until stopped.
 */
export const PARTICLE_PRESETS: Readonly<Record<ParticlePresetName, ParticleParams>> = {
  dust: preset({
    loop: false,
    duration: 0.2,
    rate: 0,
    burst: 14,
    shape: 'circle',
    shapeRadius: 0.35,
    lifetime: 0.7,
    speed: 1.4,
    startSize: 0.22,
    endSize: 0.5,
    startColor: '#b8a98c',
    endColor: '#cfc3ab',
    startAlpha: 0.55,
    endAlpha: 0,
    gravity: -0.05,
    drag: 2.2,
    coneAngle: 70,
  }),
  sparks: preset({
    loop: false,
    duration: 0.2,
    rate: 0,
    burst: 24,
    shape: 'cone',
    coneAngle: 55,
    shapeRadius: 0.02,
    lifetime: 0.6,
    speed: 4.5,
    speedVariance: 0.5,
    startSize: 0.06,
    endSize: 0.01,
    startColor: '#ffe08a',
    endColor: '#ff6a1a',
    gravity: 1,
    additive: true,
  }),
  explosion: preset({
    loop: false,
    duration: 0.3,
    rate: 0,
    burst: 90,
    shape: 'sphere',
    shapeRadius: 0.2,
    lifetime: 0.9,
    speed: 6,
    speedVariance: 0.5,
    startSize: 0.45,
    endSize: 0.1,
    startColor: '#ffd36a',
    endColor: '#e2501c',
    startAlpha: 1,
    endAlpha: 0,
    gravity: 0.2,
    drag: 2.5,
    additive: true,
    maxParticles: 200,
  }),
  smoke: preset({
    rate: 12,
    shape: 'circle',
    shapeRadius: 0.2,
    coneAngle: 10,
    lifetime: 3,
    speed: 0.8,
    startSize: 0.4,
    endSize: 1.6,
    startColor: '#6e6e72',
    endColor: '#2e2e32',
    startAlpha: 0.5,
    endAlpha: 0,
    gravity: -0.1,
    drag: 0.3,
  }),
  fire: preset({
    rate: 40,
    shape: 'circle',
    shapeRadius: 0.18,
    coneAngle: 12,
    lifetime: 0.9,
    speed: 1.4,
    startSize: 0.35,
    endSize: 0.05,
    startColor: '#ffb23a',
    endColor: '#e4301a',
    startAlpha: 0.9,
    endAlpha: 0,
    gravity: -0.3,
    additive: true,
    space: 'world',
  }),
  magic: preset({
    rate: 30,
    shape: 'sphere',
    shapeRadius: 0.5,
    lifetime: 1.6,
    speed: 0.5,
    startSize: 0.12,
    endSize: 0.02,
    startColor: '#9c7bff',
    endColor: '#58e1ff',
    startAlpha: 1,
    endAlpha: 0,
    gravity: -0.1,
    additive: true,
  }),
  rain: preset({
    rate: 220,
    maxParticles: 800,
    shape: 'box',
    shapeSize: [12, 0.1, 12],
    coneAngle: 0,
    lifetime: 1.1,
    speed: -9,
    speedVariance: 0.1,
    startSize: 0.05,
    endSize: 0.05,
    startColor: '#9fb8d6',
    endColor: '#9fb8d6',
    startAlpha: 0.7,
    endAlpha: 0.6,
    gravity: 0,
  }),
  snow: preset({
    rate: 120,
    maxParticles: 900,
    shape: 'box',
    shapeSize: [12, 0.1, 12],
    coneAngle: 0,
    lifetime: 6,
    speed: -0.6,
    speedVariance: 0.4,
    startSize: 0.07,
    endSize: 0.07,
    startColor: '#ffffff',
    endColor: '#ffffff',
    startAlpha: 0.9,
    endAlpha: 0.8,
    gravity: 0,
  }),
  sparkle: preset({
    loop: false,
    duration: 0.2,
    rate: 0,
    burst: 18,
    shape: 'sphere',
    shapeRadius: 0.25,
    lifetime: 0.8,
    speed: 1.2,
    startSize: 0.14,
    endSize: 0,
    startColor: '#fff2a0',
    endColor: '#ffd23a',
    gravity: -0.2,
    drag: 1.5,
    additive: true,
  }),
};

/** The component values a template sets (all modules), or `null` for "custom". */
export function particleTemplateValues(name: string): Record<string, JsonValue> | null {
  if (!isParticlePreset(name)) return null;
  return { ...PARTICLE_PRESETS[name] } as unknown as Record<string, JsonValue>;
}
