import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';
import { createStateLabel } from '../npc/label';
import { npcStateOf } from '../npc/state';

const fields = {
  startState: {
    type: 'string',
    default: 'patrol',
    text: { de: 'Start-Zustand', en: 'Start State' },
  },
  showState: {
    type: 'boolean',
    default: true,
    text: { de: 'Zustand im Spiel anzeigen', en: 'Show State in Play Mode' },
  },
  labelHeight: {
    type: 'number',
    default: 2.3,
    min: 0.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Höhe der Anzeige', en: 'Label Height' },
  },
} as const satisfies FieldDefinitions;

/**
 * NPC (Unity: a simple state machine): gives an object a state such as `patrol` or `chase`.
 * Behavior components (Wander, Patrol, Follow, Flee, Attack …) run only in their state; blocks
 * read and change it. In play mode the state is drawn above the NPC.
 */
export const npc = defineComponent({
  type: 'npc',
  category: 'gameplay',
  unique: true,
  unity: 'Animator (state machine)',
  text: { de: 'NPC', en: 'NPC' },
  docs: {
    de: 'Gibt dem Objekt einen Zustand (zum Beispiel „patrol“ oder „chase“). Die Verhaltens-Komponenten (Wandern, Patrouille, Folgen, Fliehen, Angreifen …) laufen nur in ihrem Zustand, Wachen wechseln ihn, wenn sie jemanden sehen. Im Spiel steht der Zustand über dem NPC; mit den Blöcken „Wenn Zustand“ und „wechsle Zustand“ baust du eigenes Verhalten.',
    en: 'Gives the object a state (for example "patrol" or "chase"). The behavior components (Wander, Patrol, Follow, Flee, Attack …) run only in their state, and Guards change it when they notice someone. In play mode the state is drawn above the NPC; the blocks "When state" and "change state" build your own behavior.',
  },
  keywords: {
    de: ['zustand', 'ki', 'gegner', 'zombie', 'wache', 'verhalten'],
    en: ['state', 'ai', 'enemy', 'zombie', 'guard', 'behavior', 'fsm'],
  },
  fields,
  create({ object, world }, initial) {
    let values = initial;
    const state = npcStateOf(object);
    state.change(values.startState);
    const label = createStateLabel();
    if (label) {
      label.sprite.position.set(0, values.labelHeight, 0);
      object.object3d.add(label.sprite);
    }
    return {
      tick(stage) {
        if (stage !== 'animate' || !label) return;
        const visible = world.showNpcStates && values.showState && state.show;
        label.sprite.visible = visible;
        if (!visible) return;
        label.setText(state.current);
        // Billboards keep their size when the object is scaled.
        const scale = object.object3d.scale;
        label.sprite.scale.set(1.6 / (scale.x || 1), 0.4 / (scale.y || 1), 1);
      },
      apply(next) {
        values = next;
        label?.sprite.position.set(0, next.labelHeight, 0);
      },
      destroy() {
        label?.dispose();
      },
    };
  },
});
