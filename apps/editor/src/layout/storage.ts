import type { SerializedDockview } from 'dockview-react';

const CURRENT_KEY = 'blockwerk.layout.current';
const NAMED_KEY = 'blockwerk.layouts';

/** A layout saved by the user under a name. */
export interface NamedLayout {
  readonly name: string;
  readonly layout: SerializedDockview;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function isSerializedLayout(value: unknown): value is SerializedDockview {
  return typeof value === 'object' && value !== null && 'grid' in value && 'panels' in value;
}

/** The layout of the last session, if one was saved. */
export function loadCurrentLayout(): SerializedDockview | null {
  const value = readJson(CURRENT_KEY);
  return isSerializedLayout(value) ? value : null;
}

/** Remembers the current layout for the next start. */
export function saveCurrentLayout(layout: SerializedDockview): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(layout));
  } catch {
    // Storage full or unavailable: the layout simply is not remembered.
  }
}

/** Forgets the remembered layout. */
export function clearCurrentLayout(): void {
  localStorage.removeItem(CURRENT_KEY);
}

/** All layouts saved under a name, sorted by name. */
export function loadNamedLayouts(): NamedLayout[] {
  const value = readJson(NAMED_KEY);
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is NamedLayout =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as NamedLayout).name === 'string' &&
        isSerializedLayout((item as NamedLayout).layout),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Saves (or replaces) a named layout and returns the new list. */
export function saveNamedLayout(name: string, layout: SerializedDockview): NamedLayout[] {
  const layouts = loadNamedLayouts().filter((item) => item.name !== name);
  layouts.push({ name, layout });
  layouts.sort((a, b) => a.name.localeCompare(b.name));
  localStorage.setItem(NAMED_KEY, JSON.stringify(layouts));
  return layouts;
}

/** Deletes a named layout and returns the new list. */
export function deleteNamedLayout(name: string): NamedLayout[] {
  const layouts = loadNamedLayouts().filter((item) => item.name !== name);
  localStorage.setItem(NAMED_KEY, JSON.stringify(layouts));
  return layouts;
}
