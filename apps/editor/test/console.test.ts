import { describe, expect, it } from 'vitest';
import { visibleRows } from '../src/state/console';
import type { ConsoleEntry } from '../src/state/console';

const entry = (
  id: number,
  level: ConsoleEntry['level'],
  key: ConsoleEntry['key'],
): ConsoleEntry => ({
  id,
  level,
  key,
  time: 0,
});

describe('visibleRows', () => {
  const entries = [
    entry(1, 'info', 'console.editorStarted'),
    entry(2, 'warning', 'layout.popoutFailed'),
    entry(3, 'info', 'console.editorStarted'),
  ];

  it('filters by level', () => {
    const rows = visibleRows(entries, { info: false, warning: true, error: true }, false);
    expect(rows.map((row) => row.entry.id)).toEqual([2]);
  });

  it('collapses identical messages and counts them', () => {
    const rows = visibleRows(entries, { info: true, warning: true, error: true }, true);
    expect(rows.map((row) => [row.entry.id, row.count])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });
});
