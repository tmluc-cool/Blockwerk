import type { LibraryEntry } from '@blockwerk/library';
import { describe, expect, it } from 'vitest';
import { matchScore, NO_FILTER, normalize, searchLibrary } from '../src/library/search';

function entry(
  id: string,
  de: string,
  en: string,
  extra: Partial<LibraryEntry> = {},
): LibraryEntry {
  return {
    id: `test/${id}`,
    name: { de, en },
    category: 'nature',
    tags: [],
    source: 'test',
    license: 'CC0-1.0',
    author: 'Test',
    file: `models/test/${id}.glb`,
    preview: `previews/test/${id}.png`,
    triangles: 100,
    size: [1, 1, 1],
    collider: { type: 'none' },
    animations: [],
    hash: '0',
    ...extra,
  };
}

const ENTRIES = [
  entry('tree-large', 'Baum Gross', 'Tree Large', { tags: ['wald', 'forest'] }),
  entry('tree-small', 'Baum Klein', 'Tree Small', { triangles: 5000 }),
  entry('fountain', 'Brunnen', 'Fountain', { category: 'buildings' }),
  entry('fence', 'Zaun', 'Fence', { category: 'buildings' }),
  entry('knight', 'Ritter', 'Knight', { category: 'characters', animations: ['Idle'] }),
  entry('cafe', 'Café Tisch', 'Cafe Table', { category: 'interior' }),
];

const lists = { favorites: ['test/fence'], recent: ['test/knight', 'test/fountain'] };

describe('asset library search', () => {
  it('normalizes accents and ß', () => {
    expect(normalize('Café Straße')).toBe('cafe strasse');
  });

  it('finds entries in German and English, by tag, with typos of left-out letters', () => {
    const names = (query: string) =>
      searchLibrary(ENTRIES, { ...NO_FILTER, query }, lists, 'de').map((item) => item.name.de);
    expect(names('baum')).toEqual(['Baum Gross', 'Baum Klein']);
    expect(names('tree')).toEqual(['Baum Gross', 'Baum Klein']);
    expect(names('wald')).toEqual(['Baum Gross']);
    expect(names('brnnen')).toEqual(['Brunnen']);
    expect(names('cafe')).toEqual(['Café Tisch']);
    expect(names('baum klein')).toEqual(['Baum Klein']);
    expect(names('xyz')).toEqual([]);
  });

  it('ranks word starts above inner matches', () => {
    expect(matchScore(ENTRIES[0] as LibraryEntry, 'gross')).toBeGreaterThan(
      matchScore(ENTRIES[0] as LibraryEntry, 'ross'),
    );
  });

  it('filters by category, animation, triangle count, favorites and recent', () => {
    const ids = (filter: Partial<typeof NO_FILTER>) =>
      searchLibrary(ENTRIES, { ...NO_FILTER, ...filter }, lists, 'en').map((item) => item.id);
    expect(ids({ category: 'buildings' })).toEqual(['test/fence', 'test/fountain']);
    expect(ids({ animatedOnly: true })).toEqual(['test/knight']);
    expect(ids({ maxTriangles: 1000, category: 'nature' })).toEqual(['test/tree-large']);
    expect(ids({ category: 'favorites' })).toEqual(['test/fence']);
    expect(ids({ category: 'recent' })).toEqual(['test/knight', 'test/fountain']);
  });
});
