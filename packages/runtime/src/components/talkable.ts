import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';

const talkableFields = {
  dialog: {
    type: 'asset',
    assetType: 'dialog',
    required: true,
    default: null,
    text: { de: 'Dialog', en: 'Dialog' },
  },
  name: {
    type: 'string',
    default: '',
    text: { de: 'Anzeigename (leer: Objektname)', en: 'Display Name (empty: object name)' },
  },
  radius: {
    type: 'number',
    default: 2.5,
    min: 0.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Reichweite', en: 'Reach' },
  },
  faceUser: {
    type: 'boolean',
    default: true,
    text: { de: 'Dreht sich zum Spieler', en: 'Turns to the Player' },
  },
} as const satisfies FieldDefinitions;

/** Talkable (SPEC 8.8): an NPC the player starts a dialog with using "Interact". */
export const talkable = defineComponent({
  type: 'talkable',
  category: 'gameplay',
  unique: true,
  unity: 'Dialogue trigger (custom component)',
  text: { de: 'Ansprechbar', en: 'Talkable' },
  docs: {
    de: 'Der Spieler kann das Objekt mit „Benutzen“ (E, Gamepad Y) ansprechen. Dann öffnet sich der gewählte Dialog aus dem Dialog-Editor; die Antworten starten „Wenn Dialogantwort …“ und können Gegenstände geben oder nehmen.',
    en: 'The player can talk to the object with "Interact" (E, gamepad Y). Then the chosen dialog from the Dialog editor opens; the answers start "when dialog answer …" and can give or take items.',
  },
  keywords: {
    de: ['sprechen', 'dialog', 'npc', 'quest', 'gespräch'],
    en: ['talk', 'dialogue', 'npc', 'quest', 'conversation'],
  },
  fields: talkableFields,
  create({ object, world }, initial) {
    let values = initial;
    const unregister = world.interactables.register({
      object,
      radius: () => values.radius,
      hint: () => (values.dialog ? { kind: 'talk', label: values.name || object.name } : null),
      use: (user) => {
        if (!values.dialog) return;
        if (values.faceUser) {
          const from = object.worldPosition();
          const to = user.worldPosition();
          object.object3d.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        }
        world.dialogRequests.push({ dialog: values.dialog, speaker: object, user });
      },
    });
    return {
      apply(next) {
        values = next;
      },
      destroy() {
        unregister();
      },
    };
  },
});
