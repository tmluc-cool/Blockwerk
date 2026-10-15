import { defineComponent } from './defineComponent';
import type { FieldDefinitions, FieldValues } from './defineComponent';
import { ParticleEmitter } from '../effects/ParticleEmitter';
import {
  DEFAULT_PARTICLE_PARAMS,
  PARTICLE_PRESET_NAMES,
  PARTICLE_SHAPES,
} from '../effects/presets';
import type { ParticleParams } from '../effects/presets';
import type { GameObject } from '../world/GameObject';

/** The emitter of each particle-system component (for blocks and the editor). */
export const emitterRegistry = new WeakMap<GameObject, ParticleEmitter>();

const D = DEFAULT_PARTICLE_PARAMS;

const SHAPE_TEXT: Record<string, { de: string; en: string }> = {
  point: { de: 'Punkt', en: 'Point' },
  sphere: { de: 'Kugel', en: 'Sphere' },
  cone: { de: 'Kegel', en: 'Cone' },
  box: { de: 'Quader', en: 'Box' },
  circle: { de: 'Kreis', en: 'Circle' },
};

const PRESET_TEXT: Record<string, { de: string; en: string }> = {
  custom: { de: 'Eigene', en: 'Custom' },
  dust: { de: 'Staub', en: 'Dust' },
  sparks: { de: 'Funken', en: 'Sparks' },
  explosion: { de: 'Explosion', en: 'Explosion' },
  smoke: { de: 'Rauch', en: 'Smoke' },
  fire: { de: 'Feuer', en: 'Fire' },
  magic: { de: 'Magie', en: 'Magic' },
  rain: { de: 'Regen', en: 'Rain' },
  snow: { de: 'Schnee', en: 'Snow' },
  sparkle: { de: 'Glitzer', en: 'Sparkle' },
};

const fields = {
  preset: {
    type: 'enum',
    default: 'custom',
    options: ['custom', ...PARTICLE_PRESET_NAMES].map((value) => ({
      value,
      text: PRESET_TEXT[value] ?? { de: value, en: value },
    })),
    text: { de: 'Vorlage', en: 'Template' },
  },
  playOnAwake: {
    type: 'boolean',
    default: true,
    text: { de: 'Beim Start abspielen', en: 'Play On Awake' },
  },
  loop: { type: 'boolean', default: D.loop, text: { de: 'Wiederholen', en: 'Looping' } },
  duration: {
    type: 'number',
    default: D.duration,
    min: 0.05,
    step: 0.1,
    unit: 'seconds',
    text: { de: 'Dauer', en: 'Duration' },
  },
  space: {
    type: 'enum',
    default: D.space,
    options: [
      { value: 'world', text: { de: 'Welt', en: 'World' } },
      { value: 'local', text: { de: 'Lokal', en: 'Local' } },
    ],
    text: { de: 'Simulationsraum', en: 'Simulation Space' },
  },
  rate: {
    type: 'number',
    default: D.rate,
    min: 0,
    step: 1,
    group: 'emission',
    text: { de: 'Rate pro Sekunde', en: 'Rate over Time' },
  },
  burst: {
    type: 'number',
    default: D.burst,
    min: 0,
    step: 1,
    group: 'emission',
    text: { de: 'Stoss beim Start', en: 'Burst' },
  },
  maxParticles: {
    type: 'number',
    default: D.maxParticles,
    min: 1,
    step: 10,
    group: 'emission',
    text: { de: 'Max. Partikel', en: 'Max Particles' },
  },
  shape: {
    type: 'enum',
    default: D.shape,
    options: PARTICLE_SHAPES.map((value) => ({
      value,
      text: SHAPE_TEXT[value] ?? { de: value, en: value },
    })),
    group: 'shape',
    text: { de: 'Form', en: 'Shape' },
  },
  shapeRadius: {
    type: 'number',
    default: D.shapeRadius,
    min: 0,
    step: 0.05,
    unit: 'meters',
    group: 'shape',
    text: { de: 'Radius', en: 'Radius' },
  },
  coneAngle: {
    type: 'number',
    default: D.coneAngle,
    min: 0,
    max: 90,
    step: 1,
    unit: 'degrees',
    group: 'shape',
    text: { de: 'Kegelwinkel', en: 'Cone Angle' },
  },
  shapeSize: {
    type: 'vector3',
    default: D.shapeSize,
    unit: 'meters',
    group: 'shape',
    text: { de: 'Quadergrösse', en: 'Box Size' },
  },
  lifetime: {
    type: 'number',
    default: D.lifetime,
    min: 0.05,
    step: 0.1,
    unit: 'seconds',
    group: 'lifetime',
    text: { de: 'Lebensdauer', en: 'Start Lifetime' },
  },
  lifetimeVariance: {
    type: 'number',
    default: D.lifetimeVariance,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'lifetime',
    text: { de: 'Streuung', en: 'Variation' },
  },
  speed: {
    type: 'number',
    default: D.speed,
    step: 0.1,
    group: 'lifetime',
    text: { de: 'Startgeschwindigkeit', en: 'Start Speed' },
  },
  speedVariance: {
    type: 'number',
    default: D.speedVariance,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'lifetime',
    text: { de: 'Geschwindigkeits-Streuung', en: 'Speed Variation' },
  },
  startSize: {
    type: 'number',
    default: D.startSize,
    min: 0,
    step: 0.02,
    unit: 'meters',
    group: 'size',
    text: { de: 'Startgrösse', en: 'Start Size' },
  },
  endSize: {
    type: 'number',
    default: D.endSize,
    min: 0,
    step: 0.02,
    unit: 'meters',
    group: 'size',
    text: { de: 'Endgrösse', en: 'End Size' },
  },
  sizeVariance: {
    type: 'number',
    default: D.sizeVariance,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'size',
    text: { de: 'Grössen-Streuung', en: 'Size Variation' },
  },
  startColor: {
    type: 'color',
    default: D.startColor,
    group: 'color',
    text: { de: 'Startfarbe', en: 'Start Color' },
  },
  endColor: {
    type: 'color',
    default: D.endColor,
    group: 'color',
    text: { de: 'Endfarbe', en: 'End Color' },
  },
  startAlpha: {
    type: 'number',
    default: D.startAlpha,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'color',
    text: { de: 'Start-Deckkraft', en: 'Start Opacity' },
  },
  endAlpha: {
    type: 'number',
    default: D.endAlpha,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'color',
    text: { de: 'End-Deckkraft', en: 'End Opacity' },
  },
  additive: {
    type: 'boolean',
    default: D.additive,
    group: 'color',
    text: { de: 'Leuchtend', en: 'Additive Blend' },
  },
  gravity: {
    type: 'number',
    default: D.gravity,
    step: 0.1,
    group: 'forces',
    text: { de: 'Schwerkraft-Faktor', en: 'Gravity Modifier' },
  },
  drag: {
    type: 'number',
    default: D.drag,
    min: 0,
    step: 0.1,
    group: 'forces',
    text: { de: 'Luftwiderstand', en: 'Drag' },
  },
} as const satisfies FieldDefinitions;

/** Reads the particle settings out of the component values. */
function paramsOf(values: FieldValues<typeof fields>): ParticleParams {
  return {
    loop: values.loop,
    duration: values.duration,
    rate: values.rate,
    burst: values.burst,
    maxParticles: values.maxParticles,
    shape: values.shape as ParticleParams['shape'],
    shapeRadius: values.shapeRadius,
    coneAngle: values.coneAngle,
    shapeSize: values.shapeSize,
    lifetime: values.lifetime,
    lifetimeVariance: values.lifetimeVariance,
    speed: values.speed,
    speedVariance: values.speedVariance,
    startSize: values.startSize,
    endSize: values.endSize,
    sizeVariance: values.sizeVariance,
    startColor: values.startColor,
    endColor: values.endColor,
    startAlpha: values.startAlpha,
    endAlpha: values.endAlpha,
    gravity: values.gravity,
    drag: values.drag,
    additive: values.additive,
    space: values.space as ParticleParams['space'],
  };
}

/** Particle system (Unity: Particle System): emission, shape, lifetime, size, color, forces. */
export const particleSystem = defineComponent({
  type: 'particleSystem',
  category: 'rendering',
  unique: false,
  unity: 'Particle System',
  text: { de: 'Partikelsystem', en: 'Particle System' },
  docs: {
    de: 'Erzeugt viele kleine Teilchen für Staub, Feuer, Rauch, Funken und andere Effekte. Die Vorlage setzt alle Module auf einmal.',
    en: 'Creates many small particles for dust, fire, smoke, sparks and other effects. A template sets all modules at once.',
  },
  keywords: {
    de: ['effekt', 'feuer', 'rauch', 'staub', 'funken', 'regen', 'schnee'],
    en: ['effect', 'fire', 'smoke', 'dust', 'sparks', 'rain', 'snow', 'vfx'],
  },
  fields,
  create({ object, world }) {
    const emitter = new ParticleEmitter(object.object3d, world.scene, DEFAULT_PARTICLE_PARAMS);
    emitterRegistry.set(object, emitter);
    let enabled = true;
    let started = false;
    let playOnAwake = true;
    return {
      apply(values) {
        playOnAwake = values.playOnAwake;
        emitter.configure(paramsOf(values));
      },
      tick(stage, context) {
        if (stage !== 'animate') return;
        if (!started) {
          started = true;
          if (playOnAwake && enabled) emitter.play();
        }
        emitter.step(context.dt);
      },
      setEnabled(value) {
        enabled = value;
        emitter.points.visible = value;
        if (!value) emitter.stop();
        else if (started && playOnAwake) emitter.play();
      },
      destroy() {
        emitterRegistry.delete(object);
        emitter.dispose();
      },
    };
  },
});
