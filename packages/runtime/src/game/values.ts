import type { VariableValue } from '../world/GameObject';

/** Copies a variable value; lists and dictionaries are copied deeply, so objects never share one. */
export function cloneValue(value: VariableValue): VariableValue {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, VariableValue> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = cloneValue(item);
    return copy;
  }
  return value;
}

/** Text form of any value: lists and dictionaries as JSON, the rest like Scratch. */
export function valueToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

/** Whether two values are equal the Scratch way: numbers by value, text without case. */
export function sameValue(a: unknown, b: unknown): boolean {
  const numeric = (value: unknown): value is number | string =>
    (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
    !Number.isNaN(Number(value));
  if (numeric(a) && numeric(b)) return Number(a) === Number(b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  return valueToText(a).toLowerCase() === valueToText(b).toLowerCase();
}

/** Position of an index of a list, 1-based, `-1` if it is outside. */
function slot(list: readonly unknown[], index: number): number {
  const position = Math.floor(Number.isNaN(index) ? 0 : index);
  return position >= 1 && position <= list.length ? position - 1 : -1;
}

/** The list functions of the data blocks; they ignore values that are not lists. */
export const listOps = {
  add(list: unknown, item: VariableValue): void {
    if (Array.isArray(list)) list.push(item);
  },
  insert(list: unknown, index: number, item: VariableValue): void {
    if (!Array.isArray(list)) return;
    const position = Math.floor(Number.isNaN(index) ? 1 : index);
    list.splice(Math.min(Math.max(position, 1), list.length + 1) - 1, 0, item);
  },
  removeAt(list: unknown, index: number): void {
    if (!Array.isArray(list)) return;
    const position = slot(list, index);
    if (position >= 0) list.splice(position, 1);
  },
  set(list: unknown, index: number, item: VariableValue): void {
    if (!Array.isArray(list)) return;
    const position = slot(list, index);
    if (position >= 0) list[position] = item;
  },
  clear(list: unknown): void {
    if (Array.isArray(list)) list.length = 0;
  },
  get(list: unknown, index: number): VariableValue {
    if (!Array.isArray(list)) return '';
    const position = slot(list, index);
    return position >= 0 ? (list[position] as VariableValue) : '';
  },
  length(list: unknown): number {
    return Array.isArray(list) ? list.length : 0;
  },
  indexOf(list: unknown, item: unknown): number {
    if (!Array.isArray(list)) return 0;
    return list.findIndex((entry) => sameValue(entry, item)) + 1;
  },
  join(list: unknown, separator: string): string {
    return Array.isArray(list) ? list.map(valueToText).join(separator) : '';
  },
  /** What "for each" walks through: a copy of a list, or the keys of a dictionary. */
  items(value: unknown): VariableValue[] {
    if (Array.isArray(value)) return [...value] as VariableValue[];
    if (typeof value === 'object' && value !== null) return Object.keys(value);
    return [];
  },
};

function isDictionary(value: unknown): value is Record<string, VariableValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The dictionary functions of the data blocks; they ignore values that are not dictionaries. */
export const dictOps = {
  set(dictionary: unknown, key: string, value: VariableValue): void {
    if (isDictionary(dictionary) && key !== '__proto__') dictionary[key] = value;
  },
  remove(dictionary: unknown, key: string): void {
    if (isDictionary(dictionary)) Reflect.deleteProperty(dictionary, key);
  },
  get(dictionary: unknown, key: string): VariableValue {
    if (!isDictionary(dictionary) || !Object.hasOwn(dictionary, key)) return '';
    return dictionary[key] ?? '';
  },
  has(dictionary: unknown, key: string): boolean {
    return isDictionary(dictionary) && Object.hasOwn(dictionary, key);
  },
  keys(dictionary: unknown): string[] {
    return isDictionary(dictionary) ? Object.keys(dictionary) : [];
  },
  size(dictionary: unknown): number {
    return isDictionary(dictionary) ? Object.keys(dictionary).length : 0;
  },
};
