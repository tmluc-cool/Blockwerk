import { defineBlock } from '../defineBlock';

export const loadScene = defineBlock({
  id: 'scenes.load',
  category: 'scenes',
  shape: 'cap',
  inputs: {
    scene: { type: 'reference', source: 'scene', default: 'scene:' },
    spawn: { type: 'textField', default: '' },
  },
  text: {
    de: 'lade Szene {scene} mit Ladebildschirm, Startpunkt {spawn}',
    en: 'load scene {scene} with loading screen, spawn point {spawn}',
  },
  keywords: {
    de: ['level', 'wechseln', 'karte', 'höhle', 'laden'],
    en: ['level', 'change', 'map', 'cave', 'load', 'travel'],
  },
  compile: ({ scene, spawn }) => `game.loadScene(self, ${scene}, ${spawn});\nreturn;`,
  docs: {
    de: 'Wechselt zu einer anderen Szene und zeigt dabei einen Ladebildschirm. Gegenstände, Leben und Spielvariablen des Spielers bleiben erhalten. Der Spieler erscheint am Objekt mit dem Tag „Spawn“ und diesem Namen (leer: am ersten).',
    en: 'Changes to another scene and shows a loading screen. The player\'s items, health and the game variables are kept. The player appears at the object tagged "Spawn" with this name (empty: the first one).',
  },
  since: 5,
});

export const restartScene = defineBlock({
  id: 'scenes.restart',
  category: 'scenes',
  shape: 'cap',
  inputs: {},
  text: { de: 'starte Szene neu', en: 'restart scene' },
  keywords: { de: ['neustart', 'zurücksetzen'], en: ['reset', 'reload', 'retry'] },
  compile: () => 'game.restartScene();\nreturn;',
  docs: {
    de: 'Lädt die aktuelle Szene noch einmal mit Ladebildschirm; Spielstand der Szene geht verloren, Gegenstände und Variablen bleiben.',
    en: 'Loads the current scene again with a loading screen; the scene state is lost, items and variables stay.',
  },
  since: 5,
});
