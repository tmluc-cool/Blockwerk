import { saveSchema } from '@blockwerk/project';
import type { SaveData } from '@blockwerk/project';

/** Where save slots are kept (SPEC 8.14): the browser keeps them locally, the desktop export in files. */
export interface SaveStorage {
  /** The slot's save, or `null` if it is empty or damaged. */
  read(slot: number): SaveData | null;
  write(slot: number, data: SaveData): void;
  remove(slot: number): void;
}

/** Slots live in memory only (tests, and games without a place to write to). */
export class MemorySaveStorage implements SaveStorage {
  private readonly slots = new Map<number, string>();

  read(slot: number): SaveData | null {
    return parseSave(this.slots.get(slot));
  }

  write(slot: number, data: SaveData): void {
    this.slots.set(slot, JSON.stringify(data));
  }

  remove(slot: number): void {
    this.slots.delete(slot);
  }
}

/** Reads the text of a save; damaged or foreign data gives `null` instead of a crash. */
export function parseSave(text: string | null | undefined): SaveData | null {
  if (!text) return null;
  try {
    const parsed = saveSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The number of slots a game offers. */
export const SAVE_SLOTS = 3;
