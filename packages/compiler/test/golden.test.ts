import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_CATALOG } from '@blockwerk/blocks';
import { describe, expect, it } from 'vitest';
import { compileBlockScript } from '../src';

/**
 * Golden tests: every `*.blocks.json` in `golden/` is compiled and compared with the
 * matching `*.expected.js`. Run with `UPDATE_GOLDEN=1` to rewrite the expected files.
 */
const goldenDir = join(import.meta.dirname, 'golden');
const fixtures = readdirSync(goldenDir).filter((file) => file.endsWith('.blocks.json'));

function collectTypes(value: unknown, types: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, types);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'type' && typeof item === 'string') types.add(item);
      collectTypes(item, types);
    }
  }
}

describe('golden tests', () => {
  for (const fixture of fixtures) {
    it(fixture, () => {
      const workspace: unknown = JSON.parse(readFileSync(join(goldenDir, fixture), 'utf8'));
      const result = compileBlockScript(workspace, { assetName: fixture.replace('.json', '') });
      expect(result.diagnostics).toEqual([]);
      const expectedPath = join(goldenDir, fixture.replace('.blocks.json', '.expected.js'));
      if (process.env['UPDATE_GOLDEN'] === '1') writeFileSync(expectedPath, result.code);
      expect(existsSync(expectedPath), `missing ${expectedPath}, run with UPDATE_GOLDEN=1`).toBe(
        true,
      );
      expect(result.code).toBe(readFileSync(expectedPath, 'utf8'));
    });
  }

  it('cover every block of the catalog', () => {
    const covered = new Set<string>();
    for (const fixture of fixtures) {
      collectTypes(JSON.parse(readFileSync(join(goldenDir, fixture), 'utf8')), covered);
    }
    const missing = BLOCK_CATALOG.map((block) => block.id).filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });
});
