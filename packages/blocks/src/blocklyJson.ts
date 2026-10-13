import { getCategory } from './categories';
import { placeholdersOf } from './defineBlock';
import type { BlockDefinition, BlockInput, Locale, ValueType } from './types';

/** One argument of a Blockly JSON block definition. */
export interface BlocklyArgJson {
  readonly type: string;
  readonly name: string;
  readonly check?: string | readonly string[];
  readonly value?: number;
  readonly text?: string;
  readonly options?: readonly (readonly [string, string])[];
}

/** A block definition in Blockly's JSON format (`Blockly.defineBlocksWithJsonArray`). */
export interface BlocklyBlockJson {
  readonly type: string;
  readonly colour: string;
  readonly tooltip: string;
  readonly inputsInline: boolean;
  readonly previousStatement?: null;
  readonly nextStatement?: null;
  readonly output?: string;
  readonly [message: `message${number}`]: string;
  readonly [args: `args${number}`]: readonly BlocklyArgJson[];
}

const BLOCKLY_TYPES: Readonly<Record<ValueType, string>> = {
  number: 'Number',
  string: 'String',
  boolean: 'Boolean',
  list: 'List',
  dictionary: 'Dictionary',
  object: 'Object',
  asset: 'Asset',
  vector3: 'Vector3',
  color: 'Color',
};

/** Blockly connection check name for a value type. */
export function blocklyCheck(type: ValueType): string {
  return BLOCKLY_TYPES[type];
}

function argFor(name: string, input: BlockInput, locale: Locale): BlocklyArgJson {
  switch (input.type) {
    case 'number':
      return { type: 'input_value', name, check: ['Number', 'String'] };
    case 'string':
      return { type: 'input_value', name, check: ['String', 'Number'] };
    case 'boolean':
      return { type: 'input_value', name, check: 'Boolean' };
    case 'statement':
      return { type: 'input_statement', name };
    case 'numberField':
      return { type: 'field_number', name, value: input.default };
    case 'textField':
      return { type: 'field_input', name, text: input.default };
    case 'dropdown':
      return {
        type: 'field_dropdown',
        name,
        options: input.options.map((option) => [option.text[locale], option.value] as const),
      };
  }
}

/** Converts `{name}` placeholders to Blockly's `%1` syntax and escapes literal percent signs. */
function toBlocklyMessage(text: string, order: readonly string[]): string {
  return text
    .replace(/%/g, '%%')
    .replace(
      /\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
      (_match, name: string) => `%${order.indexOf(name) + 1}`,
    );
}

type ConnectionJson = Pick<BlocklyBlockJson, 'previousStatement' | 'nextStatement' | 'output'>;

function connectionsFor(definition: BlockDefinition): ConnectionJson {
  switch (definition.shape) {
    case 'hat':
      return { nextStatement: null };
    case 'stack':
    case 'c':
      return { previousStatement: null, nextStatement: null };
    case 'cap':
      return { previousStatement: null };
    case 'reporter':
    case 'boolean':
      return { output: blocklyCheck(definition.output) };
  }
}

/** Generates the Blockly JSON definition of a block in the given language. */
export function toBlocklyJson(definition: BlockDefinition, locale: Locale): BlocklyBlockJson {
  const text = definition.text[locale];
  const inline = placeholdersOf(text);
  const rows: { [key: `message${number}`]: string; [key: `args${number}`]: BlocklyArgJson[] } = {};
  let row = 1;
  for (const [name, input] of Object.entries(definition.inputs)) {
    if (input.type !== 'statement') continue;
    rows[`message${row}`] = '%1';
    rows[`args${row}`] = [argFor(name, input, locale)];
    row++;
  }
  return {
    type: definition.id,
    colour: getCategory(definition.category).color,
    tooltip: definition.docs[locale],
    inputsInline: true,
    message0: toBlocklyMessage(text, inline),
    args0: inline.map((name) => {
      const input = definition.inputs[name];
      if (!input) throw new Error(`Block "${definition.id}" has no input "${name}".`);
      return argFor(name, input, locale);
    }),
    ...rows,
    ...connectionsFor(definition),
  };
}
