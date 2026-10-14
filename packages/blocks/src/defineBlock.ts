import { LOCALES } from './types';
import type { BlockDefinition, BlockInputs } from './types';

/** Thrown when a block definition is inconsistent. */
export class BlockDefinitionError extends Error {
  override readonly name = 'BlockDefinitionError';
}

const ID_PATTERN = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;
const PLACEHOLDER_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Returns the input names referenced by `{name}` placeholders in a block text, in order. */
export function placeholdersOf(text: string): string[] {
  return Array.from(text.matchAll(PLACEHOLDER_PATTERN), (match) => match[1] ?? '');
}

/**
 * Defines a block. This is the single source for all block definitions: Blockly definitions,
 * compiler mapping, palette, search index and documentation are generated from it.
 * Validates the definition and returns it unchanged.
 */
export function defineBlock<const I extends BlockInputs>(
  definition: BlockDefinition<I>,
): BlockDefinition<I> {
  const fail = (message: string): never => {
    throw new BlockDefinitionError(`Block "${definition.id}": ${message}`);
  };
  if (!ID_PATTERN.test(definition.id)) {
    fail('id must look like "category.blockName".');
  }
  if (!Number.isInteger(definition.since) || definition.since < 1) {
    fail('since must be a positive integer.');
  }
  const inputNames = Object.keys(definition.inputs);
  const inlineNames = inputNames.filter((name) => definition.inputs[name]?.type !== 'statement');
  for (const locale of LOCALES) {
    const text = definition.text[locale];
    if (!text.trim()) fail(`text.${locale} is empty.`);
    if (!definition.docs[locale].trim()) fail(`docs.${locale} is empty.`);
    const used = placeholdersOf(text);
    for (const name of used) {
      if (!inlineNames.includes(name)) {
        fail(`text.${locale} references unknown or statement input "${name}".`);
      }
    }
    for (const name of inlineNames) {
      const count = used.filter((usedName) => usedName === name).length;
      if (count !== 1) fail(`text.${locale} must contain {${name}} exactly once.`);
    }
  }
  for (const [name, input] of Object.entries(definition.inputs)) {
    if (input.type === 'dropdown') {
      if (input.options.length === 0) fail(`dropdown "${name}" has no options.`);
      if (!input.options.some((option) => option.value === input.default)) {
        fail(`dropdown "${name}" default is not one of its options.`);
      }
    }
    if (definition.shape === 'hat' && !isFieldType(input.type)) {
      fail(`hat blocks may only have fields, "${name}" is a socket.`);
    }
    if (input.type === 'statement' && definition.shape !== 'c') {
      fail(`only C blocks may have statement inputs ("${name}").`);
    }
  }
  if (
    definition.shape === 'c' &&
    !inputNames.some((name) => definition.inputs[name]?.type === 'statement')
  ) {
    fail('C blocks need at least one statement input.');
  }
  return definition;
}

/** Whether an input type is edited directly on the block. */
export function isFieldType(type: BlockInputs[string]['type']): boolean {
  return (
    type === 'numberField' ||
    type === 'textField' ||
    type === 'dropdown' ||
    type === 'reference' ||
    type === 'variable' ||
    type === 'colorField'
  );
}
