import { create } from 'zustand';
import type { TranslationKey, TranslationParams } from '../i18n';

/** Severity of a console entry (Unity: Log, Warning, Error). */
export type LogLevel = 'info' | 'warning' | 'error';

/** Where a click on a console entry jumps to (Unity: double-click opens the script line). */
export interface ConsoleLink {
  readonly objectId?: string;
  readonly assetId?: string;
  readonly blockId?: string;
}

/** One console entry. Messages are stored as translation keys so they follow language changes. */
export interface ConsoleEntry {
  readonly id: number;
  readonly level: LogLevel;
  readonly key: TranslationKey;
  readonly params?: TranslationParams;
  readonly link?: ConsoleLink;
  readonly time: number;
}

interface ConsoleState {
  entries: ConsoleEntry[];
  collapse: boolean;
  errorPause: boolean;
  show: Record<LogLevel, boolean>;
  log: (
    level: LogLevel,
    key: TranslationKey,
    params?: TranslationParams,
    link?: ConsoleLink,
  ) => void;
  clear: () => void;
  toggleCollapse: () => void;
  toggleErrorPause: () => void;
  toggleLevel: (level: LogLevel) => void;
}

let nextId = 1;

/** Oldest entries are dropped beyond this count. */
const MAX_ENTRIES = 1000;

/** Editor console (Unity: Console window). */
export const useConsole = create<ConsoleState>()((set) => ({
  entries: [],
  collapse: false,
  errorPause: false,
  show: { info: true, warning: true, error: true },
  log: (level, key, params, link) =>
    set((state) => ({
      entries: [
        ...state.entries.slice(-(MAX_ENTRIES - 1)),
        {
          id: nextId++,
          level,
          key,
          ...(params ? { params } : {}),
          ...(link ? { link } : {}),
          time: Date.now(),
        },
      ],
    })),
  clear: () => set({ entries: [] }),
  toggleCollapse: () => set((state) => ({ collapse: !state.collapse })),
  toggleErrorPause: () => set((state) => ({ errorPause: !state.errorPause })),
  toggleLevel: (level) =>
    set((state) => ({ show: { ...state.show, [level]: !state.show[level] } })),
}));

/** A console row after collapsing identical messages. */
export interface ConsoleRow {
  readonly entry: ConsoleEntry;
  readonly count: number;
}

/** Applies filters and the "Collapse" option to console entries. */
export function visibleRows(
  entries: readonly ConsoleEntry[],
  show: Readonly<Record<LogLevel, boolean>>,
  collapse: boolean,
): ConsoleRow[] {
  const filtered = entries.filter((entry) => show[entry.level]);
  if (!collapse) return filtered.map((entry) => ({ entry, count: 1 }));
  const rows = new Map<string, ConsoleRow>();
  for (const entry of filtered) {
    const signature = `${entry.level}|${entry.key}|${JSON.stringify(entry.params ?? {})}|${JSON.stringify(entry.link ?? {})}`;
    const existing = rows.get(signature);
    rows.set(signature, { entry: existing?.entry ?? entry, count: (existing?.count ?? 0) + 1 });
  }
  return Array.from(rows.values());
}
