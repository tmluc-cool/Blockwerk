import { defineBlock } from '../defineBlock';

const SLOTS = [
  { value: '1', text: { de: '1', en: '1' } },
  { value: '2', text: { de: '2', en: '2' } },
  { value: '3', text: { de: '3', en: '3' } },
] as const;

export const saveGame = defineBlock({
  id: 'saves.save',
  category: 'scenes',
  shape: 'stack',
  inputs: { slot: { type: 'dropdown', default: '1', options: SLOTS } },
  text: { de: 'speichere Spiel in Platz {slot}', en: 'save game to slot {slot}' },
  keywords: {
    de: ['spielstand', 'speichern', 'sichern'],
    en: ['savegame', 'save', 'store', 'checkpoint'],
  },
  compile: ({ slot }) => `game.saveGame(game.num(${slot}));`,
  docs: {
    de: 'Speichert die aktuelle Szene, alle Variablen, die als „wird gespeichert“ markiert sind, und Position, Inventar, Leben und Ausdauer der Spieler in einen von drei Plätzen. Gegner, Türen und Truhen werden nicht gespeichert.',
    en: 'Saves the current scene, all variables marked "saved", and the players\' position, inventory, health and stamina into one of three slots. Enemies, doors and chests are not saved.',
  },
  since: 6,
});

export const loadGame = defineBlock({
  id: 'saves.load',
  category: 'scenes',
  shape: 'stack',
  inputs: { slot: { type: 'dropdown', default: '1', options: SLOTS } },
  text: { de: 'lade Spiel aus Platz {slot}', en: 'load game from slot {slot}' },
  keywords: {
    de: ['spielstand', 'laden', 'fortsetzen'],
    en: ['savegame', 'load', 'continue', 'resume'],
  },
  compile: ({ slot }) => `game.loadGame(game.num(${slot}));`,
  docs: {
    de: 'Setzt das Spiel an der gespeicherten Stelle fort (mit Ladebildschirm). Ist der Platz leer, zeigt das Spiel einen Hinweis und nichts passiert.',
    en: 'Continues the game at the saved place (with a loading screen). If the slot is empty the game shows a notice and nothing happens.',
  },
  since: 6,
});

export const slotUsed = defineBlock({
  id: 'saves.slotUsed',
  category: 'scenes',
  shape: 'boolean',
  output: 'boolean',
  inputs: { slot: { type: 'dropdown', default: '1', options: SLOTS } },
  text: { de: 'Platz {slot} ist belegt?', en: 'slot {slot} is used?' },
  keywords: { de: ['spielstand', 'vorhanden'], en: ['savegame', 'exists', 'empty'] },
  compile: ({ slot }) => `game.slotUsed(game.num(${slot}))`,
  docs: {
    de: 'Wahr, wenn in diesem Platz ein Spielstand liegt (zum Beispiel für „Fortsetzen“ im Hauptmenü).',
    en: 'True if this slot holds a save (for a "Continue" in the main menu, say).',
  },
  since: 6,
});
