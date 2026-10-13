import { defineBlock } from '../defineBlock';

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
