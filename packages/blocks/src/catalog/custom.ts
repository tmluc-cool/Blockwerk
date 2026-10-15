import { defineBlock } from '../defineBlock';

/**
 * Custom blocks (SPEC 7.6). A definition is a block in a block script's workspace; its name is a
 * field, its parameters, return type and options live in the block's extra state. A call block
 * follows its definition: the editor gives it one input per parameter (`ARG0`, `ARG1` …). The
 * compiler reads definitions and calls itself (`toIR`), so `compile` is never used here.
 */

const notCompiled = (): string => {
  throw new Error('Custom blocks are compiled by the compiler, not by their definition.');
};

/** Name of the field that holds the name of a custom block. */
export const CUSTOM_NAME_FIELD = 'name';

/** Block types of the three kinds of definitions. */
export const CUSTOM_DEFINITIONS = [
  'custom.defineCommand',
  'custom.defineValue',
  'custom.defineCondition',
] as const;

/** Block types of the three kinds of calls. */
export const CUSTOM_CALLS = [
  'custom.callCommand',
  'custom.callValue',
  'custom.callCondition',
] as const;

export const defineCommand = defineBlock({
  id: 'custom.defineCommand',
  category: 'myBlocks',
  shape: 'hat',
  inputs: { name: { type: 'textField', default: 'mein Block' } },
  text: { de: 'Befehl {name}', en: 'command {name}' },
  keywords: { de: ['funktion', 'definieren', 'eigener'], en: ['function', 'define', 'custom'] },
  event: () => ({ type: 'define' }),
  docs: {
    de: 'Definiert einen eigenen Befehlsblock. Was darunter hängt, läuft, wenn der Block benutzt wird.',
    en: 'Defines a custom command block. What hangs below it runs when the block is used.',
  },
  since: 7,
});

export const defineValue = defineBlock({
  id: 'custom.defineValue',
  category: 'myBlocks',
  shape: 'hat',
  inputs: { name: { type: 'textField', default: 'mein Wert' } },
  text: { de: 'Wert {name}', en: 'value {name}' },
  keywords: { de: ['funktion', 'definieren', 'rückgabe'], en: ['function', 'define', 'return'] },
  event: () => ({ type: 'define' }),
  docs: {
    de: 'Definiert einen eigenen Wertblock. Mit „gib zurück“ legst du das Ergebnis fest.',
    en: 'Defines a custom value block. Use "return" to set the result.',
  },
  since: 7,
});

export const defineCondition = defineBlock({
  id: 'custom.defineCondition',
  category: 'myBlocks',
  shape: 'hat',
  inputs: { name: { type: 'textField', default: 'meine Bedingung' } },
  text: { de: 'Bedingung {name}', en: 'condition {name}' },
  keywords: { de: ['funktion', 'definieren', 'wahr'], en: ['function', 'define', 'true'] },
  event: () => ({ type: 'define' }),
  docs: {
    de: 'Definiert eine eigene Bedingung. Mit „gib zurück“ legst du fest, ob sie wahr ist.',
    en: 'Defines a custom condition. Use "return" to say whether it is true.',
  },
  since: 7,
});

export const callCommand = defineBlock({
  id: 'custom.callCommand',
  category: 'myBlocks',
  shape: 'stack',
  inputs: {},
  text: { de: 'eigener Befehl', en: 'custom command' },
  keywords: { de: ['funktion', 'aufrufen'], en: ['function', 'call'] },
  compile: notCompiled,
  docs: {
    de: 'Ruft einen eigenen Befehlsblock auf.',
    en: 'Calls a custom command block.',
  },
  since: 7,
  hidden: true,
});

export const callValue = defineBlock({
  id: 'custom.callValue',
  category: 'myBlocks',
  shape: 'reporter',
  output: 'any',
  inputs: {},
  text: { de: 'eigener Wert', en: 'custom value' },
  keywords: { de: ['funktion', 'aufrufen'], en: ['function', 'call'] },
  compile: notCompiled,
  docs: { de: 'Ruft einen eigenen Wertblock auf.', en: 'Calls a custom value block.' },
  since: 7,
  hidden: true,
});

export const callCondition = defineBlock({
  id: 'custom.callCondition',
  category: 'myBlocks',
  shape: 'boolean',
  output: 'boolean',
  inputs: {},
  text: { de: 'eigene Bedingung', en: 'custom condition' },
  keywords: { de: ['funktion', 'aufrufen'], en: ['function', 'call'] },
  compile: notCompiled,
  docs: { de: 'Ruft eine eigene Bedingung auf.', en: 'Calls a custom condition.' },
  since: 7,
  hidden: true,
});

export const returnValue = defineBlock({
  id: 'custom.return',
  category: 'myBlocks',
  shape: 'cap',
  inputs: { value: { type: 'any', default: '' } },
  text: { de: 'gib {value} zurück', en: 'return {value}' },
  keywords: { de: ['ergebnis', 'beenden'], en: ['result', 'result', 'exit'] },
  compile: notCompiled,
  docs: {
    de: 'Beendet den eigenen Block sofort. In einem Wert- oder Bedingungsblock ist der Eintrag das Ergebnis.',
    en: 'Ends the custom block at once. In a value or condition block the item is the result.',
  },
  since: 7,
});

export const parameter = defineBlock({
  id: 'custom.param',
  category: 'myBlocks',
  shape: 'reporter',
  output: 'any',
  inputs: { name: { type: 'textField', default: 'x' } },
  text: { de: 'Eingabe {name}', en: 'input {name}' },
  keywords: { de: ['parameter', 'argument'], en: ['parameter', 'argument'] },
  local: { field: 'name', role: 'param' },
  compile: (_args, meta) => meta.param('name'),
  docs: {
    de: 'Der Wert einer Eingabe des eigenen Blocks, in dem dieser Block liegt.',
    en: 'The value of an input of the custom block this block sits in.',
  },
  since: 7,
});
