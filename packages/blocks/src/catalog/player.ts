import { defineBlock } from '../defineBlock';

export const setPlayerValue = defineBlock({
  id: 'player.setValue',
  category: 'player',
  shape: 'stack',
  inputs: {
    setting: {
      type: 'dropdown',
      default: 'walkSpeed',
      options: [
        { value: 'walkSpeed', text: { de: 'Laufgeschwindigkeit', en: 'walk speed' } },
        { value: 'runSpeed', text: { de: 'Renngeschwindigkeit', en: 'run speed' } },
        { value: 'jumpHeight', text: { de: 'Sprunghöhe', en: 'jump height' } },
      ],
    },
    value: { type: 'number', default: 3 },
  },
  text: { de: 'setze {setting} auf {value}', en: 'set {setting} to {value}' },
  keywords: { de: ['tempo', 'springen', 'laufen', 'rennen'], en: ['speed', 'jump', 'sprint'] },
  areas: ['player'],
  compile: ({ setting, value }) => `game.setControlValue(self, ${setting}, ${value});`,
  docs: {
    de: 'Ändert einen Wert der Steuerung dieses Objekts (Meter pro Sekunde bzw. Meter).',
    en: 'Changes a value of this object’s controller (meters per second, or meters).',
  },
  since: 3,
});

export const jump = defineBlock({
  id: 'player.jump',
  category: 'player',
  shape: 'stack',
  inputs: {},
  text: { de: 'springe', en: 'jump' },
  keywords: { de: ['hüpfen'], en: ['hop'] },
  areas: ['player'],
  compile: () => 'game.jump(self);',
  docs: {
    de: 'Lässt die Figur springen, als wäre die Sprungtaste gedrückt worden (mit Sprung-Puffer und Gnadenfrist).',
    en: 'Makes the character jump as if the jump button was pressed (with jump buffer and coyote time).',
  },
  since: 3,
});

export const crouch = defineBlock({
  id: 'player.crouch',
  category: 'player',
  shape: 'stack',
  inputs: {},
  text: { de: 'ducke dich', en: 'crouch' },
  keywords: { de: ['bücken'], en: ['duck', 'sneak'] },
  areas: ['player'],
  compile: () => 'game.crouch(self, true);',
  docs: {
    de: 'Duckt die Figur, bis „stehe auf“ folgt.',
    en: 'Crouches the character until "stand up" follows.',
  },
  since: 3,
});

export const standUp = defineBlock({
  id: 'player.standUp',
  category: 'player',
  shape: 'stack',
  inputs: {},
  text: { de: 'stehe auf', en: 'stand up' },
  keywords: { de: ['aufrichten'], en: ['uncrouch'] },
  areas: ['player'],
  compile: () => 'game.crouch(self, false);',
  docs: {
    de: 'Richtet die Figur wieder auf, sobald über ihr genug Platz ist.',
    en: 'Stands the character up as soon as there is room above.',
  },
  since: 3,
});

export const lockControls = defineBlock({
  id: 'player.lockControls',
  category: 'player',
  shape: 'stack',
  inputs: {
    state: {
      type: 'dropdown',
      default: 'lock',
      options: [
        { value: 'lock', text: { de: 'sperre', en: 'lock' } },
        { value: 'unlock', text: { de: 'gib frei', en: 'unlock' } },
      ],
    },
  },
  text: { de: '{state} Steuerung', en: '{state} controls' },
  keywords: { de: ['eingabe', 'zwischensequenz'], en: ['input', 'cutscene', 'freeze'] },
  areas: ['player'],
  compile: ({ state }) => `game.lockControls(self, ${state} === "lock");`,
  docs: {
    de: 'Sperrt die Eingabe der Figur (z. B. in einer Zwischensequenz) oder gibt sie wieder frei.',
    en: "Locks the character's input (for example in a cutscene) or releases it.",
  },
  since: 3,
});

export const teleport = defineBlock({
  id: 'player.teleport',
  category: 'player',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'teleportiere mich zu {target}', en: 'teleport me to {target}' },
  keywords: { de: ['checkpoint', 'zurücksetzen'], en: ['checkpoint', 'respawn'] },
  areas: ['player'],
  compile: ({ target }) => `game.teleport(self, ${target});`,
  docs: {
    de: 'Setzt die Figur an die Position eines Objekts (z. B. eines Checkpoints) und stoppt ihre Bewegung.',
    en: 'Puts the character at the position of an object (for example a checkpoint) and stops its movement.',
  },
  since: 3,
});

export const onGround = defineBlock({
  id: 'player.onGround',
  category: 'player',
  shape: 'boolean',
  output: 'boolean',
  inputs: {},
  text: { de: 'stehe ich auf dem Boden?', en: 'on the ground?' },
  keywords: { de: ['boden', 'luft'], en: ['grounded', 'floor'] },
  areas: ['player'],
  compile: () => 'game.onGround(self)',
  docs: {
    de: 'Wahr, solange die Figur auf dem Boden steht.',
    en: 'True while the character stands on the ground.',
  },
  since: 3,
});

export const isRunning = defineBlock({
  id: 'player.isRunning',
  category: 'player',
  shape: 'boolean',
  output: 'boolean',
  inputs: {},
  text: { de: 'renne ich?', en: 'running?' },
  keywords: { de: ['sprinten'], en: ['sprint'] },
  areas: ['player'],
  compile: () => 'game.isRunning(self)',
  docs: { de: 'Wahr, solange die Figur rennt.', en: 'True while the character is sprinting.' },
  since: 3,
});

export const moveSpeed = defineBlock({
  id: 'player.speed',
  category: 'player',
  shape: 'reporter',
  output: 'number',
  inputs: {},
  text: { de: 'Geschwindigkeit', en: 'speed' },
  keywords: { de: ['tempo'], en: ['velocity'] },
  areas: ['player'],
  compile: () => 'game.moveSpeed(self)',
  docs: {
    de: 'Waagrechte Geschwindigkeit der Figur in Metern pro Sekunde.',
    en: 'Horizontal speed of the character in meters per second.',
  },
  since: 3,
});
