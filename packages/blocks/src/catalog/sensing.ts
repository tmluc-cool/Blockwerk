import { defineBlock } from '../defineBlock';
import { KEY_OPTIONS } from './options';

export const keyPressed = defineBlock({
  id: 'sensing.keyPressed',
  category: 'sensing',
  shape: 'boolean',
  output: 'boolean',
  inputs: { key: { type: 'dropdown', options: KEY_OPTIONS, default: 'Space' } },
  text: { de: 'Taste {key} gedrückt?', en: 'key {key} pressed?' },
  keywords: { de: ['tastatur'], en: ['keyboard', 'down'] },
  areas: ['player'],
  compile: ({ key }) => `game.keyDown(${key})`,
  docs: { de: 'Wahr, solange die Taste gedrückt ist.', en: 'True while the key is held down.' },
  since: 1,
});

export const touching = defineBlock({
  id: 'sensing.touching',
  category: 'sensing',
  shape: 'boolean',
  output: 'boolean',
  inputs: { target: { type: 'reference', source: 'touchTarget', default: 'any' } },
  text: { de: 'berühre ich {target}?', en: 'touching {target}?' },
  keywords: { de: ['kollision', 'berührung'], en: ['collision', 'overlap'] },
  compile: ({ target }) => `game.touching(self, ${target})`,
  docs: {
    de: 'Wahr, wenn die Collider dieses Objekts das Objekt oder ein Objekt mit dem Tag berühren.',
    en: "True if this object's colliders touch the object or an object with the tag.",
  },
  since: 1,
});

export const distanceTo = defineBlock({
  id: 'sensing.distanceTo',
  category: 'sensing',
  shape: 'reporter',
  output: 'number',
  inputs: { target: { type: 'reference', source: 'objectOrMouse', default: 'mouse' } },
  text: { de: 'Abstand zu {target}', en: 'distance to {target}' },
  keywords: { de: ['entfernung', 'nähe'], en: ['range', 'near'] },
  compile: ({ target }) => `game.distanceTo(self, ${target})`,
  docs: { de: 'Abstand in Metern.', en: 'Distance in meters.' },
  since: 1,
});

export const mouseX = defineBlock({
  id: 'sensing.mouseX',
  category: 'sensing',
  shape: 'reporter',
  output: 'number',
  inputs: {},
  text: { de: 'Maus x', en: 'mouse x' },
  keywords: { de: ['zeiger'], en: ['pointer', 'cursor'] },
  compile: () => 'game.mouseX',
  docs: {
    de: 'Waagrechte Mausposition in der Spielansicht, in Pixeln ab der Mitte (rechts positiv).',
    en: 'Horizontal mouse position in the game view, in pixels from the center (right is positive).',
  },
  since: 1,
});

export const mouseY = defineBlock({
  id: 'sensing.mouseY',
  category: 'sensing',
  shape: 'reporter',
  output: 'number',
  inputs: {},
  text: { de: 'Maus y', en: 'mouse y' },
  keywords: { de: ['zeiger'], en: ['pointer', 'cursor'] },
  compile: () => 'game.mouseY',
  docs: {
    de: 'Senkrechte Mausposition in der Spielansicht, in Pixeln ab der Mitte (oben positiv).',
    en: 'Vertical mouse position in the game view, in pixels from the center (up is positive).',
  },
  since: 1,
});

export const mouseDown = defineBlock({
  id: 'sensing.mouseDown',
  category: 'sensing',
  shape: 'boolean',
  output: 'boolean',
  inputs: {},
  text: { de: 'Maustaste gedrückt?', en: 'mouse down?' },
  keywords: { de: ['klick'], en: ['click', 'button'] },
  compile: () => 'game.mouseDown',
  docs: {
    de: 'Wahr, solange die Maustaste gedrückt ist.',
    en: 'True while the mouse button is held.',
  },
  since: 1,
});

export const timer = defineBlock({
  id: 'sensing.timer',
  category: 'sensing',
  shape: 'reporter',
  output: 'number',
  inputs: {},
  text: { de: 'Stoppuhr', en: 'timer' },
  keywords: { de: ['zeit', 'sekunden'], en: ['time', 'seconds', 'stopwatch'] },
  compile: () => 'game.timer',
  docs: {
    de: 'Sekunden seit Spielstart oder seit dem letzten Zurücksetzen.',
    en: 'Seconds since the game started or since the last reset.',
  },
  since: 1,
});

export const resetTimer = defineBlock({
  id: 'sensing.resetTimer',
  category: 'sensing',
  shape: 'stack',
  inputs: {},
  text: { de: 'setze Stoppuhr zurück', en: 'reset timer' },
  keywords: { de: ['zeit', 'null'], en: ['time', 'zero', 'stopwatch'] },
  compile: () => 'game.resetTimer();',
  docs: { de: 'Setzt die Stoppuhr auf 0.', en: 'Sets the timer to 0.' },
  since: 1,
});

export const random = defineBlock({
  id: 'sensing.random',
  category: 'sensing',
  shape: 'reporter',
  output: 'number',
  inputs: { from: { type: 'number', default: 1 }, to: { type: 'number', default: 10 } },
  text: { de: 'Zufallszahl von {from} bis {to}', en: 'pick random {from} to {to}' },
  keywords: { de: ['zufall', 'würfel'], en: ['random', 'dice'] },
  compile: ({ from, to }) => `game.random(${from}, ${to})`,
  docs: {
    de: 'Eine Zufallszahl. Sind beide Grenzen ganze Zahlen, ist auch das Ergebnis ganz.',
    en: 'A random number. If both limits are whole numbers, so is the result.',
  },
  since: 1,
});
