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
