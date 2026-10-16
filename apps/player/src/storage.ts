import { GameSettings, parseSave } from '@blockwerk/runtime';
import type { SaveStorage, SettingsValues } from '@blockwerk/runtime';
import type { SaveData } from '@blockwerk/project';

/** Save slots of a game in the browser's local storage, keyed by the name of the game. */
export class LocalSaveStorage implements SaveStorage {
  constructor(private readonly game: string) {}

  private key(slot: number): string {
    return `blockwerk.${this.game}.save.${slot}`;
  }

  read(slot: number): SaveData | null {
    try {
      return parseSave(localStorage.getItem(this.key(slot)));
    } catch {
      return null;
    }
  }

  write(slot: number, data: SaveData): void {
    try {
      localStorage.setItem(this.key(slot), JSON.stringify(data));
    } catch {
      // Storage may be full or blocked; the game then reports that it could not save.
    }
  }

  remove(slot: number): void {
    try {
      localStorage.removeItem(this.key(slot));
    } catch {
      // Nothing to remove.
    }
  }
}

/** The key under which a game keeps the player's settings. */
export function settingsKey(game: string): string {
  return `blockwerk.${game}.settings`;
}

/** The player's settings (volumes, mouse, keys, graphics), kept in local storage per game. */
export function createSettings(game: string): GameSettings {
  const key = settingsKey(game);
  return new GameSettings({
    load: () => {
      try {
        const text = localStorage.getItem(key);
        return text ? (JSON.parse(text) as unknown) : null;
      } catch {
        return null;
      }
    },
    save: (values: SettingsValues) => {
      try {
        localStorage.setItem(key, JSON.stringify(values));
      } catch {
        // Storage may be blocked; the settings then last until the game closes.
      }
    },
  });
}
