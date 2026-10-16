import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { libraryIndexSchema } from '@blockwerk/library';
import type { LibraryEntry } from '@blockwerk/library';

/** The built asset library (`pnpm assets:fetch`), or `null` where it was not built. */
export function loadLibrary(): readonly LibraryEntry[] | null {
  try {
    const path = join(import.meta.dirname, '..', '..', '..', 'library', 'index.json');
    return libraryIndexSchema.parse(JSON.parse(readFileSync(path, 'utf8'))).entries;
  } catch {
    return null;
  }
}

/** A small library of three models, for tests that do not need the real one. */
export function smallLibrary(): readonly LibraryEntry[] {
  const entry = (id: string, en: string, size: [number, number, number]): LibraryEntry => ({
    id,
    name: { de: en, en },
    category: 'buildings',
    tags: [],
    source: id.split('/')[0] ?? '',
    license: 'CC0-1.0',
    author: 'Test',
    file: `models/${id}.glb`,
    preview: `previews/${id}.png`,
    triangles: 100,
    size,
    collider: { type: 'none' },
    animations: [],
    hash: 'x',
  });
  return [
    entry('town/house', 'House', [4, 4, 4]),
    entry('town/well', 'Well', [1.5, 2, 1.5]),
    entry('town/tree', 'Tree', [2, 5, 2]),
  ];
}
