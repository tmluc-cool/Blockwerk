import { defineComponent } from './defineComponent';

/**
 * Block Script (Unity: MonoBehaviour). References a block-script asset; the values of its
 * inspector variables are stored per object in the component data under `variables`.
 * The scripts run in play mode (see `Game`).
 */
export const blockScript = defineComponent({
  type: 'blockScript',
  category: 'logic',
  unity: 'MonoBehaviour (C# script)',
  text: { de: 'Block-Skript', en: 'Block Script' },
  docs: {
    de: 'Führt die Blöcke eines Block-Skripts für dieses Objekt aus.',
    en: 'Runs the blocks of a block script for this object.',
  },
  keywords: { de: ['skript', 'blöcke', 'logik'], en: ['script', 'blocks', 'logic'] },
  fields: {
    script: {
      type: 'asset',
      default: null,
      assetType: 'blockScript',
      text: { de: 'Skript', en: 'Script' },
    },
  },
  create() {
    return {
      apply() {
        // Scripts are started by the game in play mode.
      },
      destroy() {
        // Nothing to clean up.
      },
    };
  },
});
