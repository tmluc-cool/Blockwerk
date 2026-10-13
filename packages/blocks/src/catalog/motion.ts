import { defineBlock } from '../defineBlock';

export const moveForward = defineBlock({
  id: 'motion.moveForward',
  category: 'motion',
  shape: 'stack',
  inputs: { meters: { type: 'number', default: 1 } },
  text: { de: 'gehe {meters} Meter vorwärts', en: 'move {meters} m forward' },
  keywords: { de: ['laufen', 'bewegen', 'vor'], en: ['walk', 'move'] },
  areas: ['player', 'npc'],
  compile: ({ meters }) => `self.moveLocal(0, 0, ${meters});`,
  docs: {
    de: 'Bewegt das Objekt in Blickrichtung.',
    en: 'Moves the object along its facing direction.',
  },
  since: 1,
});
