import { defineBlock } from '../defineBlock';

export const startDialog = defineBlock({
  id: 'dialog.start',
  category: 'npc',
  shape: 'stack',
  inputs: { dialog: { type: 'reference', source: 'dialog', default: 'dialog:' } },
  text: { de: 'starte Dialog {dialog}', en: 'start dialog {dialog}' },
  keywords: {
    de: ['gespräch', 'sprechen', 'unterhaltung', 'quest'],
    en: ['conversation', 'talk', 'speak', 'quest', 'dialogue'],
  },
  areas: ['npc'],
  compile: ({ dialog }) => `yield* game.startDialog(self, ${dialog});`,
  docs: {
    de: 'Zeigt einen Dialog (aus dem Dialog-Editor) und wartet, bis das Gespräch zu Ende ist. Der Spieler kann sich währenddessen nicht bewegen.',
    en: 'Shows a dialog (from the Dialog editor) and waits until the conversation is over. The player cannot move meanwhile.',
  },
  since: 5,
});

export const whenAnswer = defineBlock({
  id: 'dialog.whenAnswer',
  category: 'npc',
  shape: 'hat',
  inputs: { answer: { type: 'textField', default: 'ja' } },
  text: { de: 'Wenn Dialogantwort {answer}', en: 'when dialog answer {answer}' },
  keywords: {
    de: ['antwort', 'gespräch', 'auswahl', 'quest'],
    en: ['answer', 'choice', 'dialogue', 'quest', 'reply'],
  },
  areas: ['npc'],
  event: ({ answer }) => ({ type: 'dialogAnswer', params: { answer } }),
  docs: {
    de: 'Startet das Skript, wenn der Spieler im Dialog die Antwort mit dieser Kennung wählt. Die Kennung steht im Dialog-Editor an der Antwort.',
    en: 'Runs the script when the player picks the answer with this ID in a dialog. The ID is shown on the answer in the Dialog editor.',
  },
  since: 5,
});
