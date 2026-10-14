import { defineBlock } from '../defineBlock';

/** Shadow block behind every number slot. */
export const numberLiteral = defineBlock({
  id: 'literal.number',
  category: 'operators',
  shape: 'reporter',
  output: 'number',
  inputs: { NUM: { type: 'numberField', default: 0 } },
  text: { de: '{NUM}', en: '{NUM}' },
  compile: ({ NUM }) => NUM,
  docs: { de: 'Eine Zahl.', en: 'A number.' },
  since: 1,
  hidden: true,
});

/** Shadow block behind every text slot. */
export const textLiteral = defineBlock({
  id: 'literal.text',
  category: 'operators',
  shape: 'reporter',
  output: 'string',
  inputs: { TEXT: { type: 'textField', default: '' } },
  text: { de: '{TEXT}', en: '{TEXT}' },
  compile: ({ TEXT }) => TEXT,
  docs: { de: 'Ein Text.', en: 'A text.' },
  since: 1,
  hidden: true,
});
