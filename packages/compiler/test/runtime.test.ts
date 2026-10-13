import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_CATALOG } from '@blockwerk/blocks';
import { GameObject, loadScriptModule } from '@blockwerk/runtime';
import type { GameApi } from '@blockwerk/runtime';
import { describe, expect, it } from 'vitest';
import { compileBlockScript } from '../src';

/**
 * Runtime tests: compiled blocks are executed against the real runtime. Every catalog block
 * must be covered by at least one case (`covers`).
 */
interface RuntimeCase {
  readonly name: string;
  readonly covers: readonly string[];
  readonly run: () => void;
}

const game = {} as GameApi;

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'golden', name), 'utf8'));
}

function runToEnd(iterator: Generator<void, void, void>, maxSteps = 1000): void {
  for (let step = 0; step < maxSteps; step++) {
    if (iterator.next().done) return;
  }
  throw new Error('script did not finish');
}

const cases: RuntimeCase[] = [
  {
    name: 'start script moves the object forward along its facing direction',
    covers: ['events.whenGameStarts', 'motion.moveForward', 'literal.number'],
    run: () => {
      const result = compileBlockScript(loadFixture('move-forward.blocks.json'), {
        assetName: 'test',
      });
      const module = loadScriptModule(result.code);
      expect(module.scripts.map((script) => script.event)).toEqual([{ type: 'start' }]);

      const hero = new GameObject({ id: 'hero', name: 'Hero' });
      hero.object3d.rotation.y = Math.PI / 2;
      const script = module.scripts[0];
      if (!script) throw new Error('no script');
      runToEnd(script.run(hero, game));
      // 2.5 m forward, then 1 m back = 1.5 m along local +Z, which is world +X after the turn.
      expect(hero.position.x).toBeCloseTo(1.5, 6);
      expect(hero.position.z).toBeCloseTo(0, 6);
    },
  },
  {
    name: 'two objects with the same script move independently',
    covers: ['motion.moveForward'],
    run: () => {
      const module = loadScriptModule(
        compileBlockScript(loadFixture('move-forward.blocks.json'), { assetName: 'test' }).code,
      );
      const script = module.scripts[0];
      if (!script) throw new Error('no script');
      const a = new GameObject({ id: 'a', name: 'A' });
      const b = new GameObject({ id: 'b', name: 'B' });
      runToEnd(script.run(a, game));
      expect(a.position.z).toBeCloseTo(1.5, 6);
      expect(b.position.z).toBe(0);
    },
  },
];

describe('runtime tests', () => {
  for (const testCase of cases) {
    it(testCase.name, testCase.run);
  }

  it('cover every block of the catalog', () => {
    const covered = new Set(cases.flatMap((testCase) => testCase.covers));
    const missing = BLOCK_CATALOG.map((block) => block.id).filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });
});
