import { defineBlock } from '../defineBlock';
import { EASING_OPTIONS } from './options';

export const move = defineBlock({
  id: 'motion.move',
  category: 'motion',
  shape: 'stack',
  inputs: {
    meters: { type: 'number', default: 1 },
    direction: {
      type: 'dropdown',
      default: 'forward',
      options: [
        { value: 'forward', text: { de: 'vorwärts', en: 'forward' } },
        { value: 'backward', text: { de: 'rückwärts', en: 'backward' } },
        { value: 'left', text: { de: 'links', en: 'left' } },
        { value: 'right', text: { de: 'rechts', en: 'right' } },
        { value: 'up', text: { de: 'hoch', en: 'up' } },
        { value: 'down', text: { de: 'runter', en: 'down' } },
      ],
    },
  },
  text: { de: 'gehe {meters} Meter {direction}', en: 'move {meters} m {direction}' },
  keywords: { de: ['laufen', 'bewegen', 'vor', 'schritt'], en: ['walk', 'step', 'translate'] },
  areas: ['player', 'npc'],
  compile: ({ meters, direction }) => `self.move(${direction}, ${meters});`,
  docs: {
    de: 'Bewegt das Objekt in Blickrichtung, zur Seite oder nach oben und unten.',
    en: 'Moves the object along its facing direction, sideways, or up and down.',
  },
  since: 1,
});

export const goToXYZ = defineBlock({
  id: 'motion.goToXYZ',
  category: 'motion',
  shape: 'stack',
  inputs: {
    x: { type: 'number', default: 0 },
    y: { type: 'number', default: 0 },
    z: { type: 'number', default: 0 },
  },
  text: { de: 'gehe zu x: {x} y: {y} z: {z}', en: 'go to x: {x} y: {y} z: {z}' },
  keywords: { de: ['position', 'teleport'], en: ['position', 'teleport'] },
  compile: ({ x, y, z }) => `self.setPosition(${x}, ${y}, ${z});`,
  docs: { de: 'Setzt die Position (in Metern).', en: 'Sets the position (in meters).' },
  since: 1,
});

export const goToObject = defineBlock({
  id: 'motion.goToObject',
  category: 'motion',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'objectOrMouse', default: 'mouse' } },
  text: { de: 'gehe zu {target}', en: 'go to {target}' },
  keywords: { de: ['position', 'teleport'], en: ['position', 'teleport'] },
  compile: ({ target }) => `game.goTo(self, ${target});`,
  docs: {
    de: 'Springt an die Position eines Objekts oder des Mauszeigers.',
    en: 'Jumps to the position of an object or the mouse pointer.',
  },
  since: 1,
});

export const glideToObject = defineBlock({
  id: 'motion.glideToObject',
  category: 'motion',
  shape: 'stack',
  inputs: {
    seconds: { type: 'number', default: 1 },
    target: { type: 'reference', source: 'objectOrMouse', default: 'mouse' },
    easing: { type: 'dropdown', options: EASING_OPTIONS, default: 'smooth' },
  },
  text: {
    de: 'bewege dich in {seconds} s zu {target} {easing}',
    en: 'glide {seconds} s to {target} {easing}',
  },
  keywords: { de: ['gleiten', 'fliegen'], en: ['move', 'tween'] },
  compile: ({ seconds, target, easing }) =>
    `yield* game.glideTo(self, ${target}, ${seconds}, ${easing});`,
  docs: {
    de: 'Bewegt das Objekt in der angegebenen Zeit zu einem Objekt oder zum Mauszeiger.',
    en: 'Moves the object to an object or the mouse pointer in the given time.',
  },
  since: 1,
});

export const glideToXYZ = defineBlock({
  id: 'motion.glideToXYZ',
  category: 'motion',
  shape: 'stack',
  inputs: {
    seconds: { type: 'number', default: 1 },
    x: { type: 'number', default: 0 },
    y: { type: 'number', default: 0 },
    z: { type: 'number', default: 0 },
    easing: { type: 'dropdown', options: EASING_OPTIONS, default: 'smooth' },
  },
  text: {
    de: 'bewege dich in {seconds} s zu x: {x} y: {y} z: {z} {easing}',
    en: 'glide {seconds} s to x: {x} y: {y} z: {z} {easing}',
  },
  keywords: { de: ['gleiten', 'fliegen'], en: ['move', 'tween'] },
  compile: ({ seconds, x, y, z, easing }) =>
    `yield* game.glideTo(self, [${x}, ${y}, ${z}], ${seconds}, ${easing});`,
  docs: {
    de: 'Bewegt das Objekt in der angegebenen Zeit zu einer Position.',
    en: 'Moves the object to a position in the given time.',
  },
  since: 1,
});

export const turn = defineBlock({
  id: 'motion.turn',
  category: 'motion',
  shape: 'stack',
  inputs: {
    degrees: { type: 'number', default: 15 },
    direction: {
      type: 'dropdown',
      default: 'right',
      options: [
        { value: 'right', text: { de: 'rechts', en: 'right' } },
        { value: 'left', text: { de: 'links', en: 'left' } },
        { value: 'up', text: { de: 'hoch', en: 'up' } },
        { value: 'down', text: { de: 'runter', en: 'down' } },
      ],
    },
  },
  text: {
    de: 'drehe dich um {degrees} Grad {direction}',
    en: 'turn {direction} {degrees} degrees',
  },
  keywords: { de: ['drehen', 'rotieren'], en: ['rotate', 'spin'] },
  areas: ['player', 'npc'],
  compile: ({ degrees, direction }) => `self.turn(${direction}, ${degrees});`,
  docs: {
    de: 'Dreht das Objekt nach links, rechts, oben oder unten.',
    en: 'Turns the object left, right, up or down.',
  },
  since: 1,
});

export const lookAt = defineBlock({
  id: 'motion.lookAt',
  category: 'motion',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'objectOrMouse', default: 'mouse' } },
  text: { de: 'schaue zu {target}', en: 'look at {target}' },
  keywords: { de: ['richtung', 'drehen'], en: ['face', 'point towards'] },
  areas: ['npc'],
  compile: ({ target }) => `game.lookAt(self, ${target});`,
  docs: {
    de: 'Dreht das Objekt waagrecht zu einem Objekt oder zum Mauszeiger.',
    en: 'Turns the object horizontally towards an object or the mouse pointer.',
  },
  since: 1,
});

export const setRotation = defineBlock({
  id: 'motion.setRotation',
  category: 'motion',
  shape: 'stack',
  inputs: {
    x: { type: 'number', default: 0 },
    y: { type: 'number', default: 0 },
    z: { type: 'number', default: 0 },
  },
  text: {
    de: 'setze Drehung auf x: {x} y: {y} z: {z}',
    en: 'set rotation to x: {x} y: {y} z: {z}',
  },
  keywords: { de: ['winkel', 'rotation'], en: ['angle', 'rotation'] },
  compile: ({ x, y, z }) => `self.setRotationDegrees(${x}, ${y}, ${z});`,
  docs: {
    de: 'Setzt die Drehung in Grad (wie im Inspektor).',
    en: 'Sets the rotation in degrees (as in the inspector).',
  },
  since: 1,
});

export const setScale = defineBlock({
  id: 'motion.setScale',
  category: 'motion',
  shape: 'stack',
  inputs: {
    x: { type: 'number', default: 1 },
    y: { type: 'number', default: 1 },
    z: { type: 'number', default: 1 },
  },
  text: {
    de: 'setze Skalierung auf x: {x} y: {y} z: {z}',
    en: 'set scale to x: {x} y: {y} z: {z}',
  },
  keywords: { de: ['grösse', 'skalieren'], en: ['size', 'scale'] },
  compile: ({ x, y, z }) => `self.setScale(${x}, ${y}, ${z});`,
  docs: {
    de: 'Setzt die Skalierung (wie im Inspektor).',
    en: 'Sets the scale (as in the inspector).',
  },
  since: 1,
});

export const position = defineBlock({
  id: 'motion.position',
  category: 'motion',
  shape: 'reporter',
  output: 'number',
  inputs: {
    axis: {
      type: 'dropdown',
      default: 'x',
      options: [
        { value: 'x', text: { de: 'x', en: 'x' } },
        { value: 'y', text: { de: 'y', en: 'y' } },
        { value: 'z', text: { de: 'z', en: 'z' } },
      ],
    },
  },
  text: { de: '{axis}-Position', en: '{axis} position' },
  keywords: { de: ['ort', 'koordinate'], en: ['coordinate', 'location'] },
  compile: ({ axis }) => `game.propertyOf(self, "self", ${axis})`,
  docs: {
    de: 'Die Position des Objekts in der Welt (Meter).',
    en: "The object's position in the world (meters).",
  },
  since: 1,
});

export const heading = defineBlock({
  id: 'motion.heading',
  category: 'motion',
  shape: 'reporter',
  output: 'number',
  inputs: {},
  text: { de: 'Blickrichtung', en: 'heading' },
  keywords: { de: ['richtung', 'winkel'], en: ['direction', 'angle'] },
  compile: () => 'self.heading',
  docs: {
    de: 'Blickrichtung in Grad: 0 schaut nach +Z, 90 nach +X.',
    en: 'Heading in degrees: 0 faces +Z, 90 faces +X.',
  },
  since: 1,
});

export const propertyOf = defineBlock({
  id: 'motion.propertyOf',
  category: 'motion',
  shape: 'reporter',
  output: 'number',
  inputs: {
    property: {
      type: 'dropdown',
      default: 'x',
      options: [
        { value: 'x', text: { de: 'x-Position', en: 'x position' } },
        { value: 'y', text: { de: 'y-Position', en: 'y position' } },
        { value: 'z', text: { de: 'z-Position', en: 'z position' } },
        { value: 'heading', text: { de: 'Blickrichtung', en: 'heading' } },
        { value: 'size', text: { de: 'Grösse', en: 'size' } },
      ],
    },
    target: { type: 'reference', source: 'object', default: 'self' },
  },
  text: { de: '{property} von {target}', en: '{property} of {target}' },
  keywords: { de: ['eigenschaft', 'position'], en: ['attribute', 'position'] },
  compile: ({ property, target }) => `game.propertyOf(self, ${target}, ${property})`,
  docs: { de: 'Eine Eigenschaft eines anderen Objekts.', en: 'A property of another object.' },
  since: 1,
});
