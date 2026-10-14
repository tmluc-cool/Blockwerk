import { defineBlock } from '../defineBlock';

export const setColor = defineBlock({
  id: 'looks.setColor',
  category: 'looks',
  shape: 'stack',
  inputs: { color: { type: 'colorField', default: '#e04040' } },
  text: { de: 'setze Farbe auf {color}', en: 'set color to {color}' },
  keywords: { de: ['material', 'färben'], en: ['material', 'tint', 'colour'] },
  compile: ({ color }) => `game.setColor(self, ${color});`,
  docs: {
    de: 'Ändert die Farbe des Materials im Modell-Renderer.',
    en: 'Changes the material color of the mesh renderer.',
  },
  since: 1,
});

export const show = defineBlock({
  id: 'looks.show',
  category: 'looks',
  shape: 'stack',
  inputs: {},
  text: { de: 'zeige dich', en: 'show' },
  keywords: { de: ['sichtbar', 'anzeigen'], en: ['visible', 'appear'] },
  compile: () => 'game.setVisible(self, true);',
  docs: { de: 'Macht das Objekt sichtbar.', en: 'Makes the object visible.' },
  since: 1,
});

export const hide = defineBlock({
  id: 'looks.hide',
  category: 'looks',
  shape: 'stack',
  inputs: {},
  text: { de: 'verstecke dich', en: 'hide' },
  keywords: { de: ['unsichtbar', 'ausblenden'], en: ['invisible', 'disappear'] },
  compile: () => 'game.setVisible(self, false);',
  docs: {
    de: 'Macht das Objekt unsichtbar. Unsichtbare Objekte berühren nichts.',
    en: 'Makes the object invisible. Invisible objects touch nothing.',
  },
  since: 1,
});

export const setSize = defineBlock({
  id: 'looks.setSize',
  category: 'looks',
  shape: 'stack',
  inputs: { percent: { type: 'number', default: 100 } },
  text: { de: 'setze Grösse auf {percent} %', en: 'set size to {percent} %' },
  keywords: { de: ['skalieren', 'grösser', 'kleiner'], en: ['scale', 'bigger', 'smaller'] },
  compile: ({ percent }) => `game.setSizePercent(self, ${percent});`,
  docs: {
    de: 'Setzt die Grösse in Prozent der Skalierung aus der Szene.',
    en: 'Sets the size in percent of the scale from the scene.',
  },
  since: 1,
});

export const setActive = defineBlock({
  id: 'looks.setActive',
  category: 'looks',
  shape: 'stack',
  inputs: {
    action: {
      type: 'dropdown',
      default: 'deactivate',
      options: [
        { value: 'activate', text: { de: 'aktiviere', en: 'activate' } },
        { value: 'deactivate', text: { de: 'deaktiviere', en: 'deactivate' } },
      ],
    },
    target: { type: 'reference', source: 'object', default: 'self' },
  },
  text: { de: '{action} {target}', en: '{action} {target}' },
  keywords: { de: ['einschalten', 'ausschalten', 'aktiv'], en: ['enable', 'disable', 'active'] },
  compile: ({ action, target }) =>
    `game.setActive(self, ${target}, ${action === '"activate"' ? 'true' : 'false'});`,
  docs: {
    de: 'Aktiviert oder deaktiviert ein Objekt samt Kindern (Unity: SetActive). Deaktivierte Objekte sind unsichtbar und ihre Skripte pausieren.',
    en: 'Activates or deactivates an object and its children (Unity: SetActive). Inactive objects are invisible and their scripts pause.',
  },
  since: 1,
});

export const playAnimation = defineBlock({
  id: 'looks.playAnimation',
  category: 'looks',
  shape: 'stack',
  inputs: {
    name: { type: 'string', default: 'wave' },
    mode: {
      type: 'dropdown',
      default: 'once',
      options: [
        { value: 'once', text: { de: 'einmal', en: 'once' } },
        { value: 'loop', text: { de: 'in Schleife', en: 'looping' } },
      ],
    },
    fade: { type: 'number', default: 0.2 },
  },
  text: {
    de: 'spiele Animation {name} {mode} mit Überblendung {fade} s',
    en: 'play animation {name} {mode} with fade {fade} s',
  },
  keywords: { de: ['winken', 'tanzen', 'angriff'], en: ['wave', 'dance', 'attack', 'clip'] },
  areas: ['player', 'npc'],
  compile: ({ name, mode, fade }) =>
    `game.playAnimation(self, game.str(${name}), ${mode}, ${fade});`,
  docs: {
    de: 'Spielt eine Animation des Modells ab. Der Name ist ein Standardzustand (wave, cheer, attack, hit, death, interact …) oder ein Clip-Name. Danach übernimmt die Steuerung wieder.',
    en: 'Plays an animation of the model. The name is a standard state (wave, cheer, attack, hit, death, interact …) or a clip name. Afterwards the controller takes over again.',
  },
  since: 3,
});
