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
  readonly source?: string;
  readonly variable?: null;
  readonly colour?: string;
  /** `field_bw_local`: whether the name is picked from locals (`use`) or parameters (`param`). */
  readonly role?: string;
}

/** A block definition in Blockly's JSON format (`Blockly.defineBlocksWithJsonArray`). */
export interface BlocklyBlockJson {
  readonly type: string;
  readonly colour: string;
  readonly tooltip: string;
  readonly inputsInline: boolean;
  readonly previousStatement?: null;
  readonly nextStatement?: null;
  readonly output?: string | null;
  readonly [message: `message${number}`]: string;
  readonly [args: `args${number}`]: readonly BlocklyArgJson[];
}

const BLOCKLY_TYPES: Readonly<Record<ValueType, string | null>> = {
  any: null,
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

/** Blockly connection check name for a value type (`null` accepts everything). */
export function blocklyCheck(type: ValueType): string | null {
  return BLOCKLY_TYPES[type];
}

function argFor(name: string, input: BlockInput, locale: Locale): BlocklyArgJson {
  switch (input.type) {
    case 'any':
      return { type: 'input_value', name };
    case 'reference':
      return { type: 'field_bw_reference', name, source: input.source, text: input.default };
    case 'variable':
      return { type: 'field_variable', name, variable: null };
    case 'colorField':
      return { type: 'field_colour', name, colour: input.default };
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
      return {
        type: input.multiline ? 'field_multilinetext' : 'field_input',
        name,
        text: input.default,
      };
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
      return { previousStatement: null, nextStatement: null };
    case 'c':
      return definition.terminal
        ? { previousStatement: null }
        : { previousStatement: null, nextStatement: null };
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
    if (input.label) {
      rows[`message${row}`] = input.label[locale].replace(/%/g, '%%');
      rows[`args${row}`] = [];
      row++;
    }
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
      if (definition.id === 'literal.number' && input.type === 'numberField') {
        // The number in a slot also takes an expression such as "x/2 + 10" (SPEC 7.8).
        return { type: 'field_bw_number', name, value: input.default };
      }
      const local = definition.local;
      if (input.type === 'textField' && local && local.field === name && local.role !== 'declare') {
        // Names of local variables and parameters are picked from what exists at the block.
        return { type: 'field_bw_local', name, text: input.default, role: local.role };
      }
      return argFor(name, input, locale);
    }),
    ...rows,
    ...connectionsFor(definition),
  };
}
