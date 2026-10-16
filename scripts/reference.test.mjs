import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_UNITY, defaultRegistry } from '../packages/blocks/src/index.ts';
import { COMPONENTS } from '../packages/runtime/src/index.ts';
import { buildReference } from './reference.ts';

const root = join(import.meta.dirname, '..', 'docs', 'reference');

describe('generated reference (SPEC phase 11)', () => {
  it('names the Unity counterpart of every block, and only of existing blocks', () => {
    const visible = defaultRegistry
      .all()
      .filter((block) => !block.hidden)
      .map((block) => block.id);
    expect(visible.filter((id) => !(id in BLOCK_UNITY))).toEqual([]);
    expect(Object.keys(BLOCK_UNITY).filter((id) => !visible.includes(id))).toEqual([]);
  });

  it('names the Unity counterpart of every component', () => {
    expect(COMPONENTS.filter((component) => !component.unity).map((c) => c.type)).toEqual([]);
  });

  it('has a section for every block and component in both languages', () => {
    const files = buildReference();
    for (const locale of ['en', 'de']) {
      const blocks = files.get(`${locale}/blocks.md`) ?? '';
      const components = files.get(`${locale}/components.md`) ?? '';
      for (const block of defaultRegistry.all().filter((b) => !b.hidden)) {
        expect(blocks).toContain(`\`${block.id}\``);
      }
      for (const component of COMPONENTS) expect(components).toContain(`\`${component.type}\``);
      expect(blocks).not.toMatch(/undefined|\[object/);
    }
  });

  it('is up to date: run `pnpm docs:reference` after changing a block or a component', () => {
    for (const [path, text] of buildReference()) {
      expect(readFileSync(join(root, path), 'utf8'), path).toBe(text);
    }
  });
});
