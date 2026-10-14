import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';

/** Settings of the abilities an object has; the controls read them every tick. */
export interface AbilityConfig {
  doubleJump?: { readonly height: number; readonly jumps: number };
  roll?: { readonly speed: number; readonly seconds: number; readonly cooldown: number };
  glide?: { readonly fallSpeed: number };
  stamina?: {
    readonly max: number;
    readonly drain: number;
    readonly regen: number;
    readonly delay: number;
  };
}

/** Abilities by object (set by the ability components, read by the controls). */
export const abilityRegistry = new WeakMap<object, AbilityConfig>();

/** Names of the abilities (block "ability [name]"). */
export const ABILITY_NAMES = ['doubleJump', 'roll', 'glide', 'stamina'] as const;
export type AbilityName = (typeof ABILITY_NAMES)[number];

/** Defines an ability component: it only publishes its settings while enabled. */
function defineAbility<const F extends FieldDefinitions>(options: {
  type: AbilityName;
  text: { de: string; en: string };
  docs: { de: string; en: string };
  keywords: { de: string[]; en: string[] };
  fields: F;
  config: (values: never) => AbilityConfig[AbilityName];
}) {
  return defineComponent({
    type: options.type,
    category: 'gameplay',
    unique: true,
    text: options.text,
    docs: options.docs,
    keywords: options.keywords,
    fields: options.fields,
    create({ object }) {
      let enabled = true;
      let config: AbilityConfig[AbilityName] = undefined;
      const publish = (): void => {
        const current = { ...(abilityRegistry.get(object) ?? {}) } as Record<string, unknown>;
        if (enabled && config) current[options.type] = config;
        else delete current[options.type];
        abilityRegistry.set(object, current as AbilityConfig);
      };
      return {
        apply(values) {
          config = options.config(values as never);
          publish();
        },
        setEnabled(value) {
          enabled = value;
          publish();
        },
        destroy() {
          enabled = false;
          publish();
        },
      };
    },
  });
}

/** Doppelsprung: further jumps in the air. */
export const doubleJump = defineAbility({
  type: 'doubleJump',
  text: { de: 'Doppelsprung', en: 'Double Jump' },
  docs: {
    de: 'Fähigkeit: Springen in der Luft. Die Sprungtaste löst den zweiten Sprung aus.',
    en: 'Ability: jump again in the air. The jump button triggers the second jump.',
  },
  keywords: { de: ['springen', 'luft', 'fähigkeit'], en: ['jump', 'air', 'ability'] },
  fields: {
    height: {
      type: 'number',
      default: 1,
      min: 0,
      step: 0.1,
      unit: 'meters',
      text: { de: 'Höhe des zweiten Sprungs', en: 'Second Jump Height' },
    },
    jumps: {
      type: 'number',
      default: 1,
      min: 1,
      max: 5,
      step: 1,
      text: { de: 'Zusätzliche Sprünge', en: 'Extra Jumps' },
    },
  },
  config: (values: { height: number; jumps: number }) => ({
    height: values.height,
    jumps: Math.round(values.jumps),
  }),
});

/** Rollen: a quick roll in the facing direction (Action "Roll"). */
export const roll = defineAbility({
  type: 'roll',
  text: { de: 'Rollen', en: 'Roll' },
  docs: {
    de: 'Fähigkeit: Ausweichrolle in Blickrichtung mit der Aktion „Rollen“ (Taste Q, Gamepad RB). Währenddessen ist die Figur geduckt und nicht steuerbar.',
    en: 'Ability: a dodge roll in the facing direction with the "Roll" action (Q key, gamepad RB). The character is low and cannot steer while rolling.',
  },
  keywords: { de: ['ausweichen', 'fähigkeit'], en: ['dodge', 'ability'] },
  fields: {
    speed: {
      type: 'number',
      default: 6,
      min: 0,
      step: 0.5,
      text: { de: 'Tempo (m/s)', en: 'Speed' },
    },
    seconds: {
      type: 'number',
      default: 0.55,
      min: 0.1,
      step: 0.05,
      unit: 'seconds',
      text: { de: 'Dauer', en: 'Duration' },
    },
    cooldown: {
      type: 'number',
      default: 0.4,
      min: 0,
      step: 0.1,
      unit: 'seconds',
      text: { de: 'Pause danach', en: 'Cooldown' },
    },
  },
  config: (values: { speed: number; seconds: number; cooldown: number }) => ({ ...values }),
});

/** Gleiten: slow fall while the jump button is held in the air. */
export const glide = defineAbility({
  type: 'glide',
  text: { de: 'Gleiten', en: 'Glide' },
  docs: {
    de: 'Fähigkeit: Sprungtaste in der Luft gedrückt halten, solange die Figur fällt, bremst den Fall.',
    en: 'Ability: holding the jump button in the air while falling slows the fall.',
  },
  keywords: { de: ['segeln', 'fallen', 'fähigkeit'], en: ['float', 'fall', 'ability'] },
  fields: {
    fallSpeed: {
      type: 'number',
      default: 1.5,
      min: 0.1,
      step: 0.1,
      text: { de: 'Fallgeschwindigkeit (m/s)', en: 'Fall Speed' },
    },
  },
  config: (values: { fallSpeed: number }) => ({ fallSpeed: values.fallSpeed }),
});

/** Ausdauer: sprinting uses stamina. */
export const stamina = defineAbility({
  type: 'stamina',
  text: { de: 'Ausdauer', en: 'Stamina' },
  docs: {
    de: 'Fähigkeit: Rennen verbraucht Ausdauer, die sich in Ruhe wieder auffüllt. Ohne Ausdauer geht die Figur nur.',
    en: 'Ability: sprinting uses stamina, which refills when resting. Without stamina the character only walks.',
  },
  keywords: { de: ['rennen', 'sprinten', 'fähigkeit'], en: ['sprint', 'energy', 'ability'] },
  fields: {
    max: {
      type: 'number',
      default: 5,
      min: 0.5,
      step: 0.5,
      unit: 'seconds',
      text: { de: 'Maximale Ausdauer (s Rennen)', en: 'Maximum (seconds of sprinting)' },
    },
    drain: {
      type: 'number',
      default: 1,
      min: 0,
      step: 0.1,
      text: { de: 'Verbrauch pro Sekunde', en: 'Drain per Second' },
    },
    regen: {
      type: 'number',
      default: 0.8,
      min: 0,
      step: 0.1,
      text: { de: 'Auffüllen pro Sekunde', en: 'Refill per Second' },
    },
    delay: {
      type: 'number',
      default: 0.8,
      min: 0,
      step: 0.1,
      unit: 'seconds',
      text: { de: 'Pause vor dem Auffüllen', en: 'Delay before Refill' },
    },
  },
  config: (values: { max: number; drain: number; regen: number; delay: number }) => ({
    ...values,
  }),
});
