import { parseSave } from '@blockwerk/runtime';
import type { SaveStorage } from '@blockwerk/runtime';
import type { SaveData } from '@blockwerk/project';

/** Save slots of a project in the browser's local storage (SPEC 8.14). */
export class LocalSaveStorage implements SaveStorage {
  constructor(private readonly project: string) {}

  private key(slot: number): string {
    return `blockwerk.saves.${this.project}.${slot}`;
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
      // Storage may be full or blocked; the game shows no "saved" then only if the read fails later.
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
