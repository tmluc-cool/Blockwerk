import { describe, expect, it } from 'vitest';
import {
  defaultRegistry,
  ExpressionError,
  expressionToBlocks,
  isPlainNumber,
  looksLikeExpression,
  parseExpression,
} from '../src';
import type { BlockState, ExpressionScope } from '../src';

const scope: ExpressionScope = {
  variable: (name) =>
    ({ x: 'varxxxxxxxxx', Punkte: 'varpunkte0000', 'Anzahl Leben': 'varleben00000' })[name] ?? null,
  local: (name) => name === 'i',
  param: (name) => name === 'p',
};

/** Shows a block tree as a short text, e.g. `divide(var:x, 2)`. */
function show(block: BlockState | undefined): string {
  if (!block) return '';
  const id = block.type.replace(/^operators\./, '');
  if (block.type === 'variables.get') {
    return `var:${(block.fields?.['variable'] as { id: string }).id.slice(3, 9)}`;
  }
  if (block.type === 'locals.get') return `local:${String(block.fields?.['name'])}`;
  if (block.type === 'custom.param') return `param:${String(block.fields?.['name'])}`;
  const inputs = Object.values(block.inputs ?? {}).map((input) => {
    const inner = input.block ?? input.shadow;
    if (inner?.type === 'literal.number') return String(inner.fields?.['NUM']);
    if (inner?.type === 'literal.text') return JSON.stringify(inner.fields?.['TEXT']);
    return show(inner);
  });
  const fields = block.fields ? `[${Object.values(block.fields).join(',')}]` : '';
  return `${id}${fields}(${inputs.join(', ')})`;
}

function blocks(source: string): string {
  return show(expressionToBlocks(source, scope));
}

describe('parseExpression', () => {
  it('knows the precedence of the operators', () => {
    expect(blocks('x/2 + 10')).toBe('add(divide(var:xxxxxx, 2), 10)');
    expect(blocks('1 + 2 * 3')).toBe('add(1, multiply(2, 3))');
    expect(blocks('(1 + 2) * 3')).toBe('multiply(add(1, 2), 3)');
    expect(blocks('10 - 4 - 3')).toBe('subtract(subtract(10, 4), 3)');
    expect(blocks('x % 3')).toBe('mod(var:xxxxxx, 3)');
  });

  it('takes decimal numbers with a point or a comma and negative numbers', () => {
    expect(blocks('x * 2.5')).toBe('multiply(var:xxxxxx, 2.5)');
    expect(blocks('x * 2,5')).toBe('multiply(var:xxxxxx, 2.5)');
    expect(blocks('x + -3')).toBe('add(var:xxxxxx, -3)');
    expect(blocks('-x')).toBe('subtract(0, var:xxxxxx)');
  });

  it('builds comparisons and conditions', () => {
    expect(blocks('x > 3')).toBe('gt(var:xxxxxx, 3)');
    expect(blocks('x >= 3')).toBe('not(lt(var:xxxxxx, 3))');
    expect(blocks('x != 3')).toBe('not(eq(var:xxxxxx, 3))');
    expect(blocks('x == 3')).toBe('eq(var:xxxxxx, 3)');
    expect(blocks('x > 1 and x < 5')).toBe('and(gt(var:xxxxxx, 1), lt(var:xxxxxx, 5))');
    expect(blocks('x > 1 und nicht x > 5')).toBe('and(gt(var:xxxxxx, 1), not(gt(var:xxxxxx, 5)))');
  });

  it('resolves names to variables, local variables and inputs, also names with a space', () => {
    expect(blocks('i + p')).toBe('add(local:i, param:p)');
    expect(blocks('Punkte + 1')).toBe('add(var:punkte, 1)');
    expect(blocks('Anzahl Leben - 1 and x')).toBe('and(subtract(var:leben0, 1), var:xxxxxx)');
  });

  it('builds functions and text', () => {
    expect(blocks('abs(x)')).toBe('mathFunction[abs](var:xxxxxx)');
    expect(blocks('round(x / 3)')).toBe('round(divide(var:xxxxxx, 3))');
    expect(blocks('max(x, 4)')).toBe('max(var:xxxxxx, 4)');
    expect(blocks('clamp(x, 0, 10)')).toBe('clamp(var:xxxxxx, 0, 10)');
    expect(blocks('"Punkte: " & x')).toBe('join("Punkte: ", var:xxxxxx)');
  });

  it('every block it builds exists in the catalog', () => {
    const seen = new Set<string>();
    const walk = (block: BlockState | undefined): void => {
      if (!block) return;
      seen.add(block.type);
      for (const input of Object.values(block.inputs ?? {})) {
        walk(input.block);
        walk(input.shadow);
      }
    };
    for (const source of [
      'x/2 + 10 - 1 * 2 % 3',
      'x > 1 and x < 5 or not x = 4',
      'round(abs(x)) + min(1, 2) + max(1, 2) + clamp(x, 0, 1)',
      '"a" & "b"',
      'i + p',
    ]) {
      walk(expressionToBlocks(source, scope));
    }
    for (const type of seen) expect(defaultRegistry.get(type), type).toBeDefined();
  });

  it('reports problems with the position', () => {
    expect(() => parseExpression('x +')).toThrow(ExpressionError);
    expect(() => parseExpression('(1 + 2')).toThrow(ExpressionError);
    expect(() => parseExpression('1 $ 2')).toThrow(ExpressionError);
    expect(() => parseExpression('"offen')).toThrow(ExpressionError);
    expect(() => expressionToBlocks('unbekannt + 1', scope)).toThrow(ExpressionError);
    expect(() => expressionToBlocks('foo(1)', scope)).toThrow(ExpressionError);
    expect(() => expressionToBlocks('1 and 2', scope)).toThrow(ExpressionError);
  });
});

describe('what is an expression', () => {
  it('a plain number needs no blocks', () => {
    expect(isPlainNumber('42')).toBe(true);
    expect(isPlainNumber(' -3,5 ')).toBe(true);
    expect(isPlainNumber('x/2')).toBe(false);
  });

  it('operators and quotes make a typed text an expression, words alone do not', () => {
    expect(looksLikeExpression('x/2 + 10')).toBe(true);
    expect(looksLikeExpression('x > 3')).toBe(true);
    expect(looksLikeExpression('"hallo"')).toBe(true);
    expect(looksLikeExpression('wenn taste')).toBe(false);
    expect(looksLikeExpression('42')).toBe(false);
    expect(looksLikeExpression('')).toBe(false);
  });
});
