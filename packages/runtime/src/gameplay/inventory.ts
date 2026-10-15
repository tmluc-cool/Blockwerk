import type { GameObject } from '../world/GameObject';

/**
 * What a player (or anyone) carries (SPEC 8.13): item names with counts. Items are plain names, so
 * "Schlüssel" in a chest, in a dialog condition and in a block are the same thing.
 */
export class Inventory {
  private readonly items = new Map<string, number>();
  private listeners = new Set<() => void>();
  /** Counts every change, so views redraw. */
  revision = 0;

  /** Adds items (a negative count is ignored). */
  add(name: string, count = 1): void {
    const n = Math.floor(count);
    if (!name || n <= 0) return;
    this.items.set(name, (this.items.get(name) ?? 0) + n);
    this.changed();
  }

  /** Takes items away. Returns `false` (and takes nothing) if there are not enough. */
  remove(name: string, count = 1): boolean {
    const n = Math.floor(count);
    if (n <= 0) return true;
    const have = this.items.get(name) ?? 0;
    if (have < n) return false;
    if (have === n) this.items.delete(name);
    else this.items.set(name, have - n);
    this.changed();
    return true;
  }

  /** How many of an item. */
  count(name: string): number {
    return this.items.get(name) ?? 0;
  }

  /** Whether there are at least `count` of an item. */
  has(name: string, count = 1): boolean {
    return this.count(name) >= count;
  }

  /** All items with counts, in the order they were first added. */
  entries(): [string, number][] {
    return [...this.items];
  }

  /** Empties the inventory. */
  clear(): void {
    if (this.items.size === 0) return;
    this.items.clear();
    this.changed();
  }

  /** The contents as plain data (scene change, saving). */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.items);
  }

  /** Replaces the contents with a snapshot. */
  restore(data: Readonly<Record<string, number>>): void {
    this.items.clear();
    for (const [name, count] of Object.entries(data)) {
      if (count > 0) this.items.set(name, count);
    }
    this.changed();
  }

  /** Calls `listener` after every change; returns a function that removes it. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    this.revision += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

const inventories = new WeakMap<GameObject, Inventory>();

/** The inventory of an object, created when first needed (no component required). */
export function inventoryOf(object: GameObject): Inventory {
  let inventory = inventories.get(object);
  if (!inventory) {
    inventory = new Inventory();
    inventories.set(object, inventory);
  }
  return inventory;
}

/** The inventory of an object if it has one. */
export function peekInventory(object: GameObject): Inventory | undefined {
  return inventories.get(object);
}

/** Parses `Key:1, Coin:5` into item entries (no count means 1). */
export function parseItems(text: string): [string, number][] {
  const result: [string, number][] = [];
  for (const part of text.split(/[,;\n]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.lastIndexOf(':');
    const count = colon > 0 ? Number(trimmed.slice(colon + 1)) : Number.NaN;
    if (colon > 0 && Number.isFinite(count) && count > 0) {
      result.push([trimmed.slice(0, colon).trim(), Math.floor(count)]);
    } else {
      result.push([trimmed, 1]);
    }
  }
  return result;
}
