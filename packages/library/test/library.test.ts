import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { globBase, globToRegExp } from '../scripts/glob';
import {
  displayNames,
  libraryEntrySchema,
  libraryIndexSchema,
  slug,
  sourceDescriptionSchema,
  words,
} from '../src';

const SOURCES = join(import.meta.dirname, '..', 'sources');

describe('naming', () => {
  it('splits file names into words and slugs', () => {
    expect(words('building_home_A-blue2.gltf')).toEqual(['building', 'home', 'a', 'blue', '2']);
    expect(words('TreeLarge.glb')).toEqual(['tree', 'large']);
    expect(slug('Building_Home_A.glb')).toBe('building-home-a');
  });

  it('builds German and English display names', () => {
    expect(displayNames('tree_large_B.glb', { tree: 'baum', large: 'gross' })).toEqual({
      de: 'Baum Gross B',
      en: 'Tree Large B',
    });
    expect(displayNames('hex_tree.glb', { tree: 'baum' }, ['hex'])).toEqual({
      de: 'Baum',
      en: 'Tree',
    });
    // Dropping every word would leave nothing: keep them.
    expect(displayNames('hex.glb', {}, ['hex']).en).toBe('Hex');
  });
});

describe('glob', () => {
  it('matches paths', () => {
    const pattern = globToRegExp('Assets/gltf/**/*.gltf');
    expect(pattern.test('Assets/gltf/trees/tree.gltf')).toBe(true);
    expect(pattern.test('Assets/gltf/tree.gltf')).toBe(true);
    expect(pattern.test('Assets/fbx/tree.fbx')).toBe(false);
    expect(globToRegExp('a/b?.glb').test('a/b1.glb')).toBe(true);
    expect(globBase('Assets/gltf/**/*.gltf')).toBe('Assets/gltf/');
  });
});

describe('source descriptions', () => {
  const files = readdirSync(SOURCES).filter(
    (name) => name.endsWith('.json') && name !== 'words.json',
  );

  it('are valid, pinned and CC0', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = sourceDescriptionSchema.parse(
        JSON.parse(readFileSync(join(SOURCES, file), 'utf8')),
      );
      expect(`${source.id}.json`).toBe(file);
      expect(source.license).toBe('CC0-1.0');
    }
  });

  it('has a German word for every dictionary entry', () => {
    const dictionary = JSON.parse(readFileSync(join(SOURCES, 'words.json'), 'utf8')) as Record<
      string,
      string
    >;
    for (const [english, german] of Object.entries(dictionary)) {
      expect(english).toBe(english.toLowerCase());
      expect(german.length).toBeGreaterThan(0);
    }
  });
});

describe('index entries', () => {
  it('reject non-CC0 licenses and bad IDs', () => {
    const entry = {
      id: 'kaykit-forest/tree-a',
      name: { de: 'Baum A', en: 'Tree A' },
      category: 'nature',
      tags: [],
      source: 'kaykit-forest',
      license: 'CC0-1.0',
      author: 'Kay Lousberg',
      file: 'models/kaykit-forest/tree-a.glb',
      preview: 'previews/kaykit-forest/tree-a.png',
      triangles: 100,
      size: [1, 2, 1],
      collider: { type: 'none' },
      animations: [],
      hash: '0123456789abcdef',
    };
    expect(libraryEntrySchema.safeParse(entry).success).toBe(true);
    expect(libraryEntrySchema.safeParse({ ...entry, license: 'CC-BY-4.0' }).success).toBe(false);
    expect(libraryEntrySchema.safeParse({ ...entry, id: 'Tree A' }).success).toBe(false);
  });
});

describe('built library', () => {
  const root = join(import.meta.dirname, '..', '..', '..', 'library');
  let index: unknown = null;
  try {
    index = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
  } catch {
    // Not built (`pnpm assets:fetch` was not run).
  }

  it.skipIf(index === null)('has a valid index with unique IDs and existing files', () => {
    const { entries } = libraryIndexSchema.parse(index);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    const files = new Set(
      readdirSync(root, { recursive: true, encoding: 'utf8' }).map((path) =>
        path.split('\\').join('/'),
      ),
    );
    for (const entry of entries) {
      expect(files.has(entry.file), entry.file).toBe(true);
      expect(files.has(entry.preview), entry.preview).toBe(true);
    }
  });
});
