import { defineBlock } from '../defineBlock';
import { KEY_OPTIONS } from './options';

export const whenGameStarts = defineBlock({
  id: 'events.whenGameStarts',
  category: 'events',
  shape: 'hat',
  inputs: {},
  text: { de: 'Wenn Spiel startet', en: 'when game starts' },
  keywords: { de: ['start', 'beginn', 'anfang'], en: ['start', 'begin', 'awake'] },
  event: () => ({ type: 'start' }),
  docs: {
    de: 'Startet das Skript einmal, wenn das Spiel beginnt (Unity: Start).',
    en: 'Runs the script once when the game starts (Unity: Start).',
  },
  since: 1,
});

export const everyFrame = defineBlock({
  id: 'events.everyFrame',
  category: 'events',
  shape: 'hat',
  inputs: {},
  text: { de: 'Jeden Frame', en: 'every frame' },
  keywords: { de: ['immer', 'bild', 'update'], en: ['update', 'tick', 'always'] },
  event: () => ({ type: 'update' }),
  docs: {
    de: 'Startet das Skript in jedem Frame (60-mal pro Sekunde), wenn es nicht noch läuft (Unity: Update).',
    en: 'Runs the script every frame (60 times per second) unless it is still running (Unity: Update).',
  },
  since: 1,
});

export const whenKey = defineBlock({
  id: 'events.whenKey',
  category: 'events',
  shape: 'hat',
  inputs: {
    key: { type: 'dropdown', options: KEY_OPTIONS, default: 'Space' },
    mode: {
      type: 'dropdown',
      default: 'pressed',
      options: [
        { value: 'pressed', text: { de: 'gedrückt', en: 'pressed' } },
        { value: 'held', text: { de: 'gehalten', en: 'held' } },
        { value: 'released', text: { de: 'losgelassen', en: 'released' } },
      ],
    },
  },
  text: { de: 'Wenn Taste {key} {mode}', en: 'when {key} key {mode}' },
  keywords: { de: ['tastatur', 'drücken'], en: ['keyboard', 'press'] },
  areas: ['player'],
  event: ({ key, mode }) => ({ type: 'key', params: { key, mode } }),
  docs: {
    de: 'Startet das Skript, wenn die Taste gedrückt wird, solange sie gehalten wird oder wenn sie losgelassen wird.',
    en: 'Runs the script when the key goes down, while it is held, or when it is released.',
  },
  since: 1,
});

export const whenClicked = defineBlock({
  id: 'events.whenClicked',
  category: 'events',
  shape: 'hat',
  inputs: {},
  text: { de: 'Wenn dieses Objekt angeklickt wird', en: 'when this object clicked' },
  keywords: { de: ['maus', 'klick'], en: ['mouse', 'click'] },
  event: () => ({ type: 'click' }),
  docs: {
    de: 'Startet das Skript, wenn das Objekt in der Spielansicht angeklickt wird.',
    en: 'Runs the script when the object is clicked in the game view.',
  },
  since: 1,
});

export const whenTouching = defineBlock({
  id: 'events.whenTouching',
  category: 'events',
  shape: 'hat',
  inputs: {
    target: { type: 'reference', source: 'touchTarget', default: 'any' },
    phase: {
      type: 'dropdown',
      default: 'enter',
      options: [
        { value: 'enter', text: { de: 'beginne zu berühren', en: 'start touching' } },
        { value: 'stay', text: { de: 'berühre', en: 'touch' } },
        { value: 'exit', text: { de: 'aufhöre zu berühren', en: 'stop touching' } },
      ],
    },
  },
  text: { de: 'Wenn ich {target} {phase}', en: 'when I {phase} {target}' },
  keywords: { de: ['kollision', 'treffen', 'berührung'], en: ['collision', 'hit', 'trigger'] },
  areas: ['player', 'items'],
  event: ({ target, phase }) => ({ type: 'touch', params: { target, phase } }),
  docs: {
    de: 'Startet das Skript, wenn die Collider dieses Objekts ein Objekt oder ein Objekt mit dem Tag berühren (Unity: OnTriggerEnter/Stay/Exit).',
    en: "Runs the script when this object's colliders touch an object or an object with the tag (Unity: OnTriggerEnter/Stay/Exit).",
  },
  since: 1,
});

export const whenCreated = defineBlock({
  id: 'events.whenCreated',
  category: 'events',
  shape: 'hat',
  inputs: {},
  text: { de: 'Wenn ich erstellt werde', en: 'when I am created' },
  keywords: { de: ['kopie', 'klon'], en: ['clone', 'spawn'] },
  event: () => ({ type: 'created' }),
  docs: {
    de: 'Startet das Skript in einer neu erzeugten Kopie dieses Objekts.',
    en: 'Runs the script in a newly created clone of this object.',
  },
  since: 1,
});

export const whenDestroyed = defineBlock({
  id: 'events.whenDestroyed',
  category: 'events',
  shape: 'hat',
  inputs: {},
  text: { de: 'Wenn ich zerstört werde', en: 'when I am destroyed' },
  keywords: { de: ['löschen', 'entfernen'], en: ['delete', 'remove'] },
  event: () => ({ type: 'destroyed' }),
  docs: {
    de: 'Läuft kurz bevor das Objekt zerstört wird (Unity: OnDestroy).',
    en: 'Runs right before the object is destroyed (Unity: OnDestroy).',
  },
  since: 1,
});
