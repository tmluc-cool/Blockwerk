import { defineBlock } from '../defineBlock';
import type { DropdownOption } from '../types';

const EFFECT_OPTIONS: readonly DropdownOption[] = [
  { value: 'dust', text: { de: 'Staub', en: 'dust' } },
  { value: 'sparks', text: { de: 'Funken', en: 'sparks' } },
  { value: 'explosion', text: { de: 'Explosion', en: 'explosion' } },
  { value: 'smoke', text: { de: 'Rauch', en: 'smoke' } },
  { value: 'fire', text: { de: 'Feuer', en: 'fire' } },
  { value: 'magic', text: { de: 'Magie', en: 'magic' } },
  { value: 'rain', text: { de: 'Regen', en: 'rain' } },
  { value: 'snow', text: { de: 'Schnee', en: 'snow' } },
  { value: 'sparkle', text: { de: 'Glitzer', en: 'sparkle' } },
];

export const spawnEffect = defineBlock({
  id: 'effects.spawn',
  category: 'effects',
  shape: 'stack',
  inputs: {
    effect: { type: 'dropdown', default: 'dust', options: EFFECT_OPTIONS },
    at: { type: 'reference', source: 'object', default: 'self' },
  },
  text: { de: 'erzeuge Effekt {effect} bei {at}', en: 'create effect {effect} at {at}' },
  keywords: {
    de: ['partikel', 'staub', 'funken', 'explosion', 'feuer', 'rauch'],
    en: ['particles', 'dust', 'sparks', 'explosion', 'fire', 'smoke', 'vfx'],
  },
  compile: ({ effect, at }) => `game.spawnEffect(self, ${effect}, ${at});`,
  docs: {
    de: 'Spielt einen Effekt an der Stelle eines Objekts ab. Staub, Funken, Explosion und Glitzer spielen einmal und verschwinden; Rauch, Feuer, Magie, Regen und Schnee laufen weiter.',
    en: 'Plays an effect at the position of an object. Dust, sparks, explosion and sparkle play once and vanish; smoke, fire, magic, rain and snow keep running.',
  },
  since: 4,
});

export const startParticles = defineBlock({
  id: 'effects.start',
  category: 'effects',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'starte Partikelsystem {target}', en: 'start particle system {target}' },
  keywords: { de: ['partikel', 'effekt', 'abspielen'], en: ['particles', 'effect', 'play'] },
  compile: ({ target }) => `game.startParticles(self, ${target});`,
  docs: {
    de: 'Startet das Partikelsystem eines Objekts (Unity: ParticleSystem.Play).',
    en: 'Starts the particle system of an object (Unity: ParticleSystem.Play).',
  },
  since: 4,
});

export const stopParticles = defineBlock({
  id: 'effects.stop',
  category: 'effects',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'stoppe Partikelsystem {target}', en: 'stop particle system {target}' },
  keywords: { de: ['partikel', 'effekt', 'anhalten'], en: ['particles', 'effect', 'halt'] },
  compile: ({ target }) => `game.stopParticles(self, ${target});`,
  docs: {
    de: 'Stoppt das Partikelsystem eines Objekts. Teilchen, die schon fliegen, verblassen noch (Unity: ParticleSystem.Stop).',
    en: 'Stops the particle system of an object. Particles already flying still fade out (Unity: ParticleSystem.Stop).',
  },
  since: 4,
});
