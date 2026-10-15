import * as Blockly from 'blockly/core';

/** The parameters (`name`, `type`) of the custom block a definition block stands for. */
export interface DefinitionParam {
  readonly name: string;
  readonly type: string;
}

/** A definition block of a custom block carries its parameters for the name pickers. */
export type DefinitionBlock = Blockly.Block & { bwParams?: readonly DefinitionParam[] };

/** Block types of the definitions of custom blocks. */
export const DEFINITION_TYPES: readonly string[] = [
  'custom.defineCommand',
  'custom.defineValue',
  'custom.defineCondition',
];

/** Names of the local variables that exist at a block (SPEC 7.4), nearest first. */
export function localsInScope(block: Blockly.Block): string[] {
  const names: string[] = [];
  let current: Blockly.Block | null = block;
  while (current) {
    const parent: Blockly.Block | null = current.getParent();
    if (!parent) break;
    if (parent.type === 'data.forEachItem') {
      // The loop variable exists inside the loop's body only.
      const body = parent.getInput('body')?.connection?.targetBlock();
      if (body === current) names.push(String(parent.getFieldValue('name') ?? ''));
    } else if (parent.type === 'locals.declare' && parent.getNextBlock() === current) {
      names.push(String(parent.getFieldValue('name') ?? ''));
    }
    current = parent;
  }
  return names.filter((name) => name !== '');
}

/** Names of the parameters of the custom block a block sits in (empty outside of one). */
export function paramsInScope(block: Blockly.Block): string[] {
  const root = block.getRootBlock() as DefinitionBlock;
  if (!DEFINITION_TYPES.includes(root.type)) return [];
  return (root.bwParams ?? []).map((param) => param.name);
}

/**
 * Name of a local variable or a parameter (`field_bw_local`), picked from what exists at the
 * block. A saved name that no longer exists stays in the list (marked by the compiler instead).
 */
export class FieldScopedName extends Blockly.FieldDropdown {
  constructor(
    private readonly role: string,
    value: string,
  ) {
    super(function (this: Blockly.FieldDropdown): Blockly.MenuOption[] {
      return (this as FieldScopedName).options();
    });
    this.setValue(value);
  }

  private options(): Blockly.MenuOption[] {
    const block = this.getSourceBlock();
    const names = block
      ? this.role === 'param'
        ? paramsInScope(block)
        : localsInScope(block)
      : [];
    const unique = [...new Set(names)];
    const current = this.getValue();
    if (current && !unique.includes(current)) unique.push(current);
    if (unique.length === 0) unique.push('?');
    return unique.map((name) => [name, name]);
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null;
  }

  static override fromJson(
    options: Blockly.FieldDropdownFromJsonConfig & { role?: string; text?: string },
  ): FieldScopedName {
    return new FieldScopedName(options.role ?? 'use', options.text ?? '');
  }
}

let registered = false;

/** Registers the field type with Blockly (once per page). */
export function registerScopedNameField(): void {
  if (registered) return;
  registered = true;
  Blockly.fieldRegistry.register('field_bw_local', FieldScopedName);
}
