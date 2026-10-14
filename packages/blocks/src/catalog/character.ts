import { defineBlock } from '../defineBlock';
import type { DropdownOption } from '../types';

/** Attachment points of a character's skeleton (Character component "Attachments"). */
const POINT_OPTIONS: readonly DropdownOption[] = [
  { value: 'rightHand', text: { de: 'rechte Hand', en: 'right hand' } },
  { value: 'leftHand', text: { de: 'linke Hand', en: 'left hand' } },
  { value: 'back', text: { de: 'Rücken', en: 'back' } },
  { value: 'head', text: { de: 'Kopf', en: 'head' } },
  { value: 'hip', text: { de: 'Hüfte', en: 'hip' } },
];

const ABILITY_OPTIONS: readonly DropdownOption[] = [
  { value: 'doubleJump', text: { de: 'Doppelsprung', en: 'double jump' } },
  { value: 'roll', text: { de: 'Rolle', en: 'roll' } },
  { value: 'glide', text: { de: 'Gleiten', en: 'glide' } },
  { value: 'stamina', text: { de: 'Ausdauer', en: 'stamina' } },
];

const PROFILE_OPTIONS: readonly DropdownOption[] = [
  { value: 'arcade', text: { de: 'Arcade', en: 'arcade' } },
  { value: 'realistic', text: { de: 'Realistisch', en: 'realistic' } },
  { value: 'agile', text: { de: 'Flink', en: 'agile' } },
  { value: 'heavy', text: { de: 'Schwer', en: 'heavy' } },
  { value: 'floating', text: { de: 'Schwebend', en: 'floating' } },
];

export const attachItem = defineBlock({
  id: 'character.attach',
  category: 'character',
  shape: 'stack',
  inputs: {
    item: { type: 'textField', default: 'library:kaykit-adventurers/sword-1handed' },
    point: { type: 'dropdown', default: 'rightHand', options: POINT_OPTIONS },
  },
  text: { de: 'hänge {item} an {point}', en: 'attach {item} to {point}' },
  keywords: { de: ['schwert', 'ausrüsten', 'halten'], en: ['sword', 'equip', 'hold'] },
  areas: ['player', 'npc'],
  compile: ({ item, point }) => `game.attach(self, ${item}, ${point});`,
  docs: {
    de: 'Hängt einen Gegenstand (ein Modell, z. B. aus der Bibliothek) an einen Halte-Punkt der Figur. Was dort hing, wird ersetzt.',
    en: 'Attaches an item (a model, for example from the library) to an attachment point of the character. Whatever hung there is replaced.',
  },
  since: 3,
});

export const detachItem = defineBlock({
  id: 'character.detach',
  category: 'character',
  shape: 'stack',
  inputs: { point: { type: 'dropdown', default: 'rightHand', options: POINT_OPTIONS } },
  text: { de: 'lege ab, was an {point} hängt', en: 'put away what hangs on {point}' },
  keywords: { de: ['wegstecken', 'ablegen'], en: ['unequip', 'drop'] },
  areas: ['player', 'npc'],
  compile: ({ point }) => `game.detach(self, ${point});`,
  docs: {
    de: 'Nimmt den Gegenstand ab, der an diesem Halte-Punkt hängt.',
    en: 'Takes off the item that hangs on this attachment point.',
  },
  since: 3,
});

export const switchPart = defineBlock({
  id: 'character.switchPart',
  category: 'character',
  shape: 'stack',
  inputs: {
    from: { type: 'textField', default: 'Hat' },
    to: { type: 'textField', default: 'Helmet' },
  },
  text: { de: 'wechsle Teil {from} zu {to}', en: 'switch part {from} to {to}' },
  keywords: { de: ['hut', 'helm', 'umziehen'], en: ['hat', 'helmet', 'outfit'] },
  areas: ['player', 'npc'],
  compile: ({ from, to }) => `game.switchPart(self, ${from}, ${to});`,
  docs: {
    de: 'Versteckt ein Teil des Modells und zeigt dafür ein anderes (Namen der Teile stehen im Figuren-Studio).',
    en: 'Hides one part of the model and shows another instead (the part names are listed in the Character Studio).',
  },
  since: 3,
});

export const setPartColor = defineBlock({
  id: 'character.setPartColor',
  category: 'character',
  shape: 'stack',
  inputs: {
    part: { type: 'textField', default: 'Body' },
    color: { type: 'colorField', default: '#d64b4b' },
  },
  text: {
    de: 'setze Farbe von Teil {part} auf {color}',
    en: 'set color of part {part} to {color}',
  },
  keywords: { de: ['färben', 'anstrich', 'kleidung'], en: ['tint', 'paint', 'clothes'] },
  areas: ['player', 'npc'],
  compile: ({ part, color }) => `game.setPartColor(self, ${part}, ${color});`,
  docs: {
    de: 'Färbt ein Teil des Modells ein (z. B. für Spieler 2).',
    en: 'Tints one part of the model (for example for player 2).',
  },
  since: 3,
});

export const setProfile = defineBlock({
  id: 'character.setProfile',
  category: 'character',
  shape: 'stack',
  inputs: { profile: { type: 'dropdown', default: 'arcade', options: PROFILE_OPTIONS } },
  text: { de: 'wechsle Bewegungs-Profil zu {profile}', en: 'switch movement profile to {profile}' },
  keywords: { de: ['gefühl', 'steuerung'], en: ['feel', 'controls'] },
  areas: ['player'],
  compile: ({ profile }) => `game.setProfile(self, ${profile});`,
  docs: {
    de: 'Setzt Tempo, Sprung, Beschleunigung und Schwerkraft der Figur auf die Werte des Profils.',
    en: "Sets the character's speed, jump, acceleration and gravity to the values of the profile.",
  },
  since: 3,
});

export const setAbility = defineBlock({
  id: 'character.setAbility',
  category: 'character',
  shape: 'stack',
  inputs: {
    state: {
      type: 'dropdown',
      default: 'on',
      options: [
        { value: 'on', text: { de: 'aktiviere', en: 'enable' } },
        { value: 'off', text: { de: 'deaktiviere', en: 'disable' } },
      ],
    },
    ability: { type: 'dropdown', default: 'doubleJump', options: ABILITY_OPTIONS },
  },
  text: { de: '{state} Fähigkeit {ability}', en: '{state} ability {ability}' },
  keywords: { de: ['power-up', 'freischalten'], en: ['power-up', 'unlock'] },
  areas: ['player'],
  compile: ({ state, ability }) => `game.enableAbility(self, ${ability}, ${state} === "on");`,
  docs: {
    de: 'Schaltet eine Fähigkeit der Figur an oder aus (sie muss als Komponente an der Figur hängen).',
    en: 'Turns an ability of the character on or off (it has to be a component on the character).',
  },
  since: 3,
});

export const hasAbility = defineBlock({
  id: 'character.hasAbility',
  category: 'character',
  shape: 'boolean',
  output: 'boolean',
  inputs: { ability: { type: 'dropdown', default: 'doubleJump', options: ABILITY_OPTIONS } },
  text: { de: 'habe ich Fähigkeit {ability}?', en: 'do I have ability {ability}?' },
  keywords: { de: ['kann'], en: ['can'] },
  areas: ['player'],
  compile: ({ ability }) => `game.hasAbility(self, ${ability})`,
  docs: {
    de: 'Wahr, wenn die Fähigkeit an der Figur hängt und eingeschaltet ist.',
    en: 'True if the character has the ability and it is turned on.',
  },
  since: 3,
});

export const setStamina = defineBlock({
  id: 'character.setStamina',
  category: 'character',
  shape: 'stack',
  inputs: { percent: { type: 'number', default: 100 } },
  text: { de: 'setze Ausdauer auf {percent} %', en: 'set stamina to {percent} %' },
  keywords: { de: ['energie', 'erholen'], en: ['energy', 'refill'] },
  areas: ['player'],
  compile: ({ percent }) => `game.setStamina(self, ${percent});`,
  docs: {
    de: 'Setzt die Ausdauer der Figur auf einen Prozentwert (0 bis 100).',
    en: "Sets the character's stamina to a percentage (0 to 100).",
  },
  since: 3,
});

export const stamina = defineBlock({
  id: 'character.stamina',
  category: 'character',
  shape: 'reporter',
  output: 'number',
  inputs: {},
  text: { de: 'Ausdauer in %', en: 'stamina in %' },
  keywords: { de: ['energie'], en: ['energy'] },
  areas: ['player'],
  compile: () => 'game.staminaPercent(self)',
  docs: {
    de: 'Die Ausdauer der Figur in Prozent (100 ohne die Fähigkeit Ausdauer).',
    en: "The character's stamina in percent (100 without the stamina ability).",
  },
  since: 3,
});

export const whenAbility = defineBlock({
  id: 'events.whenAbility',
  category: 'events',
  shape: 'hat',
  inputs: {
    ability: {
      type: 'dropdown',
      default: 'roll',
      options: [
        { value: 'roll', text: { de: 'rolle', en: 'roll' } },
        { value: 'glide', text: { de: 'gleite', en: 'glide' } },
        { value: 'doubleJump', text: { de: 'doppelspringe', en: 'double jump' } },
      ],
    },
    phase: {
      type: 'dropdown',
      default: 'started',
      options: [
        { value: 'started', text: { de: 'beginne', en: 'start' } },
        { value: 'ended', text: { de: 'höre auf', en: 'stop' } },
      ],
    },
  },
  text: { de: 'Wenn ich {ability}: {phase}', en: 'when I {ability}: {phase}' },
  keywords: { de: ['rolle', 'gleiten', 'fähigkeit'], en: ['roll', 'glide', 'ability'] },
  areas: ['player'],
  event: ({ ability, phase }) => ({ type: 'ability', params: { ability, phase } }),
  docs: {
    de: 'Startet das Skript, wenn die Figur eine Fähigkeit benutzt (Rolle, Gleiten, Doppelsprung) oder damit aufhört.',
    en: 'Runs the script when the character uses an ability (roll, glide, double jump) or stops using it.',
  },
  since: 3,
});
