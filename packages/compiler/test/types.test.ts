import { describe, expect, it } from 'vitest';
import { compileBlockScript } from '../src';
import { b, call, define, get, param, set, workspace } from './dsl';
import { A, B, DICT, LIST, VARIABLES, when } from './phase3Cases';

function compile(source: unknown) {
  return compileBlockScript(source, { assetName: 'test', variables: VARIABLES });
}

const start = b('events.whenGameStarts');

function types(result: ReturnType<typeof compile>): string[] {
  return result.diagnostics
    .filter((item) => item.code === 'typeMismatch')
    .map((item) => `${item.params['expected']}<-${item.params['actual']}`);
}

describe('type check', () => {
  it('numbers and text convert into each other without a note', () => {
    const result = compile(
      workspace(
        when(
          start,
          set(B, b('operators.join', {}, { a: 1, b: 2 })),
          b('control.wait', {}, { seconds: b('operators.join', {}, { a: 1, b: 2 }) }),
        ),
      ),
    );
    expect(types(result)).toEqual([]);
  });

  it('a list or a dictionary in a number slot is reported', () => {
    const result = compile(
      workspace(
        when(
          start,
          b('control.wait', {}, { seconds: get(LIST) }),
          b('control.wait', {}, { seconds: b('data.newDictionary') }),
          b('control.wait', {}, { seconds: get(DICT) }),
          b('control.wait', {}, { seconds: get(A) }),
        ),
      ),
    );
    expect(types(result)).toEqual(['number<-list', 'number<-dictionary', 'number<-dictionary']);
  });

  it('a condition slot only takes conditions', () => {
    const result = compile(
      workspace(
        when(
          start,
          b('control.if', {}, { condition: b('operators.add', {}, { a: 1, b: 1 }), then: [] }),
        ),
      ),
    );
    expect(types(result)).toEqual(['boolean<-number']);
  });

  it('arguments of a custom block are checked against the type of the input', () => {
    const result = compile(
      workspace(when(start, call('Command', 'def-x', [get(LIST), get(A), b('data.newList')])), [
        define('Command', 'x', 'def-x', {
          params: [
            { name: 'n', type: 'number' },
            { name: 'm', type: 'number' },
            { name: 'l', type: 'list' },
          ],
        }),
      ]),
    );
    expect(types(result)).toEqual(['number<-list']);
  });

  it('the value of "return" is checked against the result type', () => {
    const result = compile(
      workspace(
        [
          define('Value', 'zahl', 'def-n', { returns: 'number' }),
          b('custom.return', {}, { value: b('data.newList') }),
        ],
        [
          define('Value', 'text', 'def-t', { returns: 'string' }),
          b('custom.return', {}, { value: param('nothing') }),
        ],
      ),
    );
    expect(types(result)).toEqual(['number<-list']);
    // "param('nothing')" is not a parameter of the block
    expect(result.diagnostics.some((item) => item.code === 'unknownParam')).toBe(true);
  });

  it('calls of a missing custom block and a "return" outside of one are reported and skipped', () => {
    const result = compile(
      workspace(when(start, call('Command', 'nope', []), b('custom.return'), set(A, 1))),
    );
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'unknownFunction',
      'returnOutside',
    ]);
    expect(result.code).toContain('game.vars["varaaaaaaaaa"] = 1;');
  });

  it('code that cannot be read is reported with the reason and the block is skipped', () => {
    const result = compile(
      workspace(
        when(
          start,
          b('code.run', { code: 'self.position.y += ;' }),
          b('code.run', { code: 'self.position.y += 1;' }),
          set(A, b('code.value', { code: '1 +' })),
        ),
      ),
    );
    expect(result.diagnostics.map((item) => item.code)).toEqual(['codeSyntax', 'codeSyntax']);
    expect(result.diagnostics[0]?.params['message']).toBeTruthy();
    expect(result.code).toContain('self.position.y += 1;');
    expect(result.code).not.toContain('+= ;');
  });
});
