import { GameSettings } from '@blockwerk/runtime';
import type { SettingsValues } from '@blockwerk/runtime';

const KEY = 'blockwerk.settings';

/** The player's settings of the editor's Game view, kept in the browser (volumes, keys …). */
export const gameSettings = new GameSettings({
  load: () => {
    try {
      const text = localStorage.getItem(KEY);
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return null;
    }
  },
  save: (values: SettingsValues) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch {
      // Storage may be blocked (private window); the settings then last for this session.
    }
  },
});
