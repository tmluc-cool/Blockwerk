import { describe, expect, it } from 'vitest';
import { BlockDefinitionError, defineBlock } from '../src';

const base = {
  category: 'motion',
  docs: { de: 'Hilfe.', en: 'Help.' },
  since: 1,
} as const;

describe('defineBlock', () => {
  it('accepts a valid definition and returns it unchanged', () => {
    const definition = defineBlock({
      ...base,
      id: 'motion.turn',
      shape: 'stack',
      inputs: { degrees: { type: 'number', default: 15 } },
      text: { de: 'drehe dich um {degrees} Grad', en: 'turn {degrees} degrees' },
      compile: ({ degrees }) => `self.turn(${degrees});`,
    });
    expect(definition.id).toBe('motion.turn');
  });

  it('rejects malformed ids', () => {
    expect(() =>
      defineBlock({
        ...base,
        id: 'NoCategory',
        shape: 'stack',
        inputs: {},
        text: { de: 'x', en: 'x' },
        compile: () => '',
      }),
    ).toThrow(BlockDefinitionError);
  });

  it('requires every input exactly once in every language', () => {
    expect(() =>
      defineBlock({
        ...base,
        id: 'motion.broken',
        shape: 'stack',
        inputs: { meters: { type: 'number', default: 1 } },
        text: { de: 'gehe {meters} Meter', en: 'move forward' },
        compile: () => '',
      }),
    ).toThrow(/text\.en must contain \{meters\}/);
  });

  it('rejects placeholders without input', () => {
    expect(() =>
      defineBlock({
        ...base,
        id: 'motion.broken',
        shape: 'stack',
        inputs: {},
        text: { de: 'gehe {meters}', en: 'move {meters}' },
        compile: () => '',
      }),
    ).toThrow(/unknown or statement input/);
  });

  it('rejects sockets on hat blocks', () => {
    expect(() =>
      defineBlock({
        ...base,
        id: 'events.broken',
        category: 'events',
        shape: 'hat',
        inputs: { value: { type: 'number', default: 1 } },
        text: { de: 'wenn {value}', en: 'when {value}' },
        event: () => ({ type: 'x' }),
      }),
    ).toThrow(/only have fields/);
  });

  it('requires a body input on C blocks', () => {
    expect(() =>
      defineBlock({
        ...base,
        id: 'control.loop',
        category: 'control',
        shape: 'c',
        inputs: {},
        text: { de: 'für immer', en: 'forever' },
        compile: () => '',
      }),
    ).toThrow(/statement input/);
  });

  it('rejects dropdown defaults that are not an option', () => {
    expect(() =>
      defineBlock({
        ...base,
        id: 'motion.pick',
        shape: 'stack',
        inputs: {
          side: {
            type: 'dropdown',
            default: 'up',
            options: [{ value: 'left', text: { de: 'links', en: 'left' } }],
          },
        },
        text: { de: 'gehe {side}', en: 'go {side}' },
        compile: () => '',
      }),
    ).toThrow(/default is not one of its options/);
  });
});
