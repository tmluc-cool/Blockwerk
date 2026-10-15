import { describe, expect, it } from 'vitest';
import { compileBlockScript } from '../src';
import { b, get, set, workspace } from './dsl';
import { A, LIST, VARIABLES, when } from './phase3Cases';

function compile(source: unknown) {
  return compileBlockScript(source, { assetName: 'test', variables: VARIABLES });
}

const start = b('events.whenGameStarts');

describe('local variables (scope)', () => {
  it('a local that is used above its declaration is reported and the block is skipped', () => {
    const result = compile(
      workspace(
        when(
          start,
          b('locals.set', { name: 'y' }, { value: 1 }),
          b('locals.declare', { name: 'y' }, { value: 0 }),
        ),
      ),
    );
    expect(result.diagnostics.map((item) => [item.code, item.params['name']])).toEqual([
      ['unknownLocal', 'y'],
    ]);
    expect(result.code).toContain('var l_y = 0;');
    expect(result.code).not.toContain('l_y = 1');
  });

  it('a loop variable only exists inside its loop', () => {
    const result = compile(
      workspace(
        when(
          start,
          b('data.forEachItem', { name: 'x' }, { list: get(LIST), body: [set(A, 1)] }),
          set(A, b('locals.get', { name: 'x' })),
        ),
      ),
    );
    expect(result.diagnostics.map((item) => item.code)).toEqual(['unknownLocal']);
  });

  it('a local declared in a body is gone after the body, one above stays visible inside', () => {
    const result = compile(
      workspace(
        when(
          start,
          b('locals.declare', { name: 'outer' }, { value: 1 }),
          b(
            'control.if',
            {},
            {
              condition: b('operators.eq', {}, { a: 1, b: 1 }),
              then: [
                b(
                  'locals.declare',
                  { name: 'inner' },
                  { value: b('locals.get', { name: 'outer' }) },
                ),
              ],
            },
          ),
          set(A, b('locals.get', { name: 'inner' })),
        ),
      ),
    );
    expect(result.diagnostics.map((item) => [item.code, item.params['name']])).toEqual([
      ['unknownLocal', 'inner'],
    ]);
  });
});
