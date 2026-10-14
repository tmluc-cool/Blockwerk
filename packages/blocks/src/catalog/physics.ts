import { defineBlock } from '../defineBlock';

export const push = defineBlock({
  id: 'physics.push',
  category: 'physics',
  shape: 'stack',
  inputs: {
    force: { type: 'number', default: 5 },
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
  text: {
    de: 'stoße mich an mit Kraft {force} {direction}',
    en: 'push me with force {force} {direction}',
  },
  keywords: { de: ['impuls', 'schubsen', 'schleudern'], en: ['impulse', 'launch', 'knock'] },
  areas: ['items'],
  compile: ({ force, direction }) => `game.push(self, ${force}, ${direction});`,
  docs: {
    de: 'Gibt dem Objekt einen Stoß (Impuls) in Blickrichtung oder zur Seite. Braucht einen Rigidbody.',
    en: 'Gives the object a push (impulse) along its facing direction or sideways. Needs a Rigidbody.',
  },
  since: 3,
});

export const setVelocity = defineBlock({
  id: 'physics.setVelocity',
  category: 'physics',
  shape: 'stack',
  inputs: {
    x: { type: 'number', default: 0 },
    y: { type: 'number', default: 5 },
    z: { type: 'number', default: 0 },
  },
  text: {
    de: 'setze Geschwindigkeit auf x: {x} y: {y} z: {z}',
    en: 'set velocity to x: {x} y: {y} z: {z}',
  },
  keywords: { de: ['tempo', 'schleudern'], en: ['speed', 'launch'] },
  areas: ['items'],
  compile: ({ x, y, z }) => `game.setVelocity(self, ${x}, ${y}, ${z});`,
  docs: {
    de: 'Setzt die Geschwindigkeit des Rigidbodys in Metern pro Sekunde (Weltkoordinaten).',
    en: 'Sets the velocity of the Rigidbody in meters per second (world coordinates).',
  },
  since: 3,
});

export const setGravity = defineBlock({
  id: 'physics.setGravity',
  category: 'physics',
  shape: 'stack',
  inputs: { value: { type: 'number', default: 9.81 } },
  text: { de: 'setze Schwerkraft auf {value}', en: 'set gravity to {value}' },
  keywords: { de: ['fallen', 'mond'], en: ['fall', 'moon'] },
  areas: ['items', 'environment'],
  compile: ({ value }) => `game.setGravity(${value});`,
  docs: {
    de: 'Setzt die Schwerkraft der ganzen Szene in Metern pro Sekunde zum Quadrat (Erde: 9,81, Mond: 1,62).',
    en: 'Sets the gravity of the whole scene in meters per second squared (Earth: 9.81, Moon: 1.62).',
  },
  since: 3,
});

export const setBodyType = defineBlock({
  id: 'physics.setBodyType',
  category: 'physics',
  shape: 'stack',
  inputs: {
    type: {
      type: 'dropdown',
      default: 'dynamic',
      options: [
        { value: 'static', text: { de: 'statisch', en: 'static' } },
        { value: 'dynamic', text: { de: 'dynamisch', en: 'dynamic' } },
        { value: 'kinematic', text: { de: 'kinematisch', en: 'kinematic' } },
      ],
    },
  },
  text: { de: 'mache mich {type}', en: 'make me {type}' },
  keywords: { de: ['rigidbody', 'fest', 'beweglich'], en: ['rigidbody', 'fixed', 'movable'] },
  areas: ['items'],
  compile: ({ type }) => `game.setBodyType(self, ${type});`,
  docs: {
    de: 'Macht das Objekt fest (statisch), von der Physik bewegt (dynamisch) oder nur per Skript bewegt (kinematisch).',
    en: 'Makes the object fixed (static), moved by physics (dynamic) or moved by scripts only (kinematic).',
  },
  since: 3,
});

export const whatIsAhead = defineBlock({
  id: 'physics.whatIsAhead',
  category: 'physics',
  shape: 'reporter',
  output: 'string',
  inputs: { meters: { type: 'number', default: 3 } },
  text: { de: 'was ist vor mir in {meters} Meter?', en: 'what is ahead within {meters} m?' },
  keywords: { de: ['raycast', 'strahl', 'sehen'], en: ['raycast', 'look', 'ray'] },
  areas: ['items', 'player', 'npc'],
  compile: ({ meters }) => `game.whatIsAhead(self, ${meters})`,
  docs: {
    de: 'Name des Objekts direkt vor dem Objekt innerhalb der Strecke, oder leer, wenn nichts da ist (Raycast).',
    en: 'Name of the object straight ahead within the distance, or empty if there is nothing (raycast).',
  },
  since: 3,
});

export const distanceAhead = defineBlock({
  id: 'physics.distanceAhead',
  category: 'physics',
  shape: 'reporter',
  output: 'number',
  inputs: { meters: { type: 'number', default: 10 } },
  text: { de: 'Abstand voraus bis {meters} Meter', en: 'distance ahead up to {meters} m' },
  keywords: { de: ['raycast', 'wand'], en: ['raycast', 'wall'] },
  areas: ['items', 'player', 'npc'],
  compile: ({ meters }) => `game.distanceAhead(self, ${meters})`,
  docs: {
    de: 'Abstand zum nächsten Hindernis direkt voraus in Metern, höchstens die angegebene Strecke.',
    en: 'Distance to the nearest obstacle straight ahead in meters, at most the given distance.',
  },
  since: 3,
});
