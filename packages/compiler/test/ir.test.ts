import { defaultRegistry } from '@blockwerk/blocks';
import { GameObject, loadScriptModule } from '@blockwerk/runtime';
import { describe, expect, it } from 'vitest';
import { CodegenError, CompileError, compileBlockScript, generateCode, literal } from '../src';
import type { IRProgram } from '../src';

describe('IR functions and local variables', () => {
  // Equivalent of: define (double (x)) { local y = x; return y + y }  -- built directly as IR,
  // because the editor gets blocks for this in phase 7.
  const program: IRProgram = {
    functions: [
      {
        id: 'fn-move-twice',
        params: ['meters'],
        returns: 'number',
        warp: false,
        body: [
          { kind: 'declareLocal', name: 'distance', value: { kind: 'param', name: 'meters' } },
          {
            kind: 'block',
            blockId: 'b1',
            type: 'motion.moveForward',
            args: { meters: { kind: 'local', name: 'distance' } },
            substacks: {},
          },
          { kind: 'setLocal', name: 'distance', value: { kind: 'literal', value: 3 } },
          {
            kind: 'block',
            blockId: 'b2',
            type: 'motion.moveForward',
            args: { meters: { kind: 'local', name: 'distance' } },
            substacks: {},
          },
          { kind: 'return', value: { kind: 'local', name: 'distance' } },
        ],
      },
    ],
    scripts: [
      {
        id: 'hat',
        event: { type: 'start' },
        body: [
          {
            kind: 'declareLocal',
            name: 'größe',
            value: {
              kind: 'call',
              functionId: 'fn-move-twice',
              args: [{ kind: 'literal', value: 2 }],
            },
          },
          { kind: 'call', functionId: 'fn-move-twice', args: [{ kind: 'local', name: 'größe' }] },
        ],
      },
    ],
  };

  it('generates runnable code for calls, parameters, locals and return values', () => {
    const generated = generateCode(program, defaultRegistry, { assetName: 'ir-test' });
    expect(generated.code).toContain('function* f_');
    expect(generated.code).toContain('return l_distance;');
    expect(generated.code).toMatch(
      /let l_gr__e_[0-9a-f]{4} = \(yield\* f_[0-9a-f]{8}\(self, game, 2\)\);/,
    );
    const module = loadScriptModule(generated.code);
    const hero = new GameObject({ id: 'hero', name: 'Hero' });
    const script = module.scripts[0];
    if (!script) throw new Error('no script');
    const iterator = script.run(hero, { tick: 0 });
    expect(iterator.next().done).toBe(true);
    // First call: 2 + 3 = 5 m, returns 3. Second call with 3: 3 + 3 = 6 m. Total 11 m.
    expect(hero.position.z).toBeCloseTo(11, 6);
  });

  it('maps every generated line of a block to its block id', () => {
    const generated = generateCode(program, defaultRegistry, { assetName: 'ir-test' });
    const lines = generated.code.split('\n');
    expect(generated.lineToBlock).toHaveLength(lines.length);
    const index = lines.findIndex((line) => line.includes('self.moveLocal(0, 0, l_distance)'));
    expect(generated.lineToBlock[index]).toBe('b1');
  });

  it('rejects calls to unknown functions', () => {
    const broken: IRProgram = {
      functions: [],
      scripts: [
        {
          id: 'h',
          event: { type: 'start' },
          body: [{ kind: 'call', functionId: 'nope', args: [] }],
        },
      ],
    };
    expect(() => generateCode(broken, defaultRegistry, { assetName: 'x' })).toThrow(CodegenError);
  });
});

describe('compileBlockScript', () => {
  it('reports unknown blocks and skips them', () => {
    const result = compileBlockScript(
      {
        blocks: {
          blocks: [
            {
              type: 'events.whenGameStarts',
              id: 'h',
              next: { block: { type: 'magic.unknown', id: 'u' } },
            },
          ],
        },
      },
      { assetName: 'x' },
    );
    expect(result.diagnostics).toEqual([
      { severity: 'error', code: 'unknownBlock', blockId: 'u', params: { type: 'magic.unknown' } },
    ]);
    expect(result.program.scripts[0]?.body).toEqual([]);
  });

  it('uses the default value when a number slot is empty', () => {
    const result = compileBlockScript(
      {
        blocks: {
          blocks: [
            {
              type: 'events.whenGameStarts',
              id: 'h',
              next: { block: { type: 'motion.moveForward', id: 'm' } },
            },
          ],
        },
      },
      { assetName: 'x' },
    );
    expect(result.code).toContain('self.moveLocal(0, 0, 1);');
  });

  it('skips disabled blocks', () => {
    const result = compileBlockScript(
      {
        blocks: {
          blocks: [
            {
              type: 'events.whenGameStarts',
              id: 'h',
              next: {
                block: {
                  type: 'motion.moveForward',
                  id: 'm',
                  disabledReasons: ['MANUALLY_DISABLED'],
                },
              },
            },
          ],
        },
      },
      { assetName: 'x' },
    );
    expect(result.code).not.toContain('moveLocal');
  });

  it('compiles an empty workspace', () => {
    const result = compileBlockScript({}, { assetName: 'x' });
    expect(loadScriptModule(result.code).scripts).toEqual([]);
  });

  it('throws on malformed input', () => {
    expect(() => compileBlockScript(42, { assetName: 'x' })).toThrow(CompileError);
    expect(() =>
      compileBlockScript({ blocks: { blocks: [{ type: 'x' }] } }, { assetName: 'x' }),
    ).toThrow(/id is missing/);
  });
});

describe('literal', () => {
  it('writes numbers, strings and booleans as JavaScript', () => {
    expect(literal(2.5)).toBe('2.5');
    expect(literal(Number.NaN)).toBe('0');
    expect(literal(-0)).toBe('0');
    expect(literal('a "b"')).toBe('"a \\"b\\""');
    expect(literal(true)).toBe('true');
  });
});
