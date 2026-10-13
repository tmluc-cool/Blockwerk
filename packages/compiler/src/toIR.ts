import type { BlockDefinition, BlockInput, BlockRegistry, FieldInput } from '@blockwerk/blocks';
import { CompileError } from './diagnostics';
import type { Diagnostic } from './diagnostics';
import type { IRExpression, IRProgram, IRScript, IRStatement } from './ir';

/** A block in Blockly's JSON serialization (`Blockly.serialization.workspaces.save`). */
export interface SerializedBlock {
  readonly type: string;
  readonly id: string;
  readonly x?: number;
  readonly y?: number;
  readonly enabled?: boolean;
  readonly disabledReasons?: readonly string[];
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly inputs?: Readonly<Record<string, SerializedConnection>>;
  readonly next?: SerializedConnection;
}

/** What is plugged into an input or the next connection. */
export interface SerializedConnection {
  readonly shadow?: SerializedBlock;
  readonly block?: SerializedBlock;
}

/** A workspace in Blockly's JSON serialization. */
export interface SerializedWorkspace {
  readonly blocks?: {
    readonly languageVersion?: number;
    readonly blocks?: readonly SerializedBlock[];
  };
}

/** Result of converting a workspace to IR. */
export interface IRResult {
  readonly program: IRProgram;
  readonly diagnostics: readonly Diagnostic[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertBlock(value: unknown, path: string): asserts value is SerializedBlock {
  if (!isRecord(value)) throw new CompileError(`${path} is not a block object.`);
  if (typeof value['type'] !== 'string') throw new CompileError(`${path}.type is missing.`);
  if (typeof value['id'] !== 'string' || value['id'] === '') {
    throw new CompileError(`${path}.id is missing (blocks need stable IDs).`);
  }
  if (value['fields'] !== undefined && !isRecord(value['fields'])) {
    throw new CompileError(`${path}.fields is not an object.`);
  }
  const inputs = value['inputs'];
  if (inputs !== undefined) {
    if (!isRecord(inputs)) throw new CompileError(`${path}.inputs is not an object.`);
    for (const [name, connection] of Object.entries(inputs)) {
      assertConnection(connection, `${path}.inputs.${name}`);
    }
  }
  if (value['next'] !== undefined) assertConnection(value['next'], `${path}.next`);
}

function assertConnection(value: unknown, path: string): asserts value is SerializedConnection {
  if (!isRecord(value)) throw new CompileError(`${path} is not a connection object.`);
  if (value['shadow'] !== undefined) assertBlock(value['shadow'], `${path}.shadow`);
  if (value['block'] !== undefined) assertBlock(value['block'], `${path}.block`);
}

/** Validates the outer shape of a serialized workspace. Throws {@link CompileError}. */
export function parseWorkspace(value: unknown): SerializedWorkspace {
  if (!isRecord(value)) throw new CompileError('Workspace is not an object.');
  const blocks = value['blocks'];
  if (blocks === undefined) return {};
  if (!isRecord(blocks)) throw new CompileError('workspace.blocks is not an object.');
  const list = blocks['blocks'];
  if (list === undefined) return { blocks: {} };
  if (!Array.isArray(list)) throw new CompileError('workspace.blocks.blocks is not an array.');
  list.forEach((block, index) => assertBlock(block, `blocks[${index}]`));
  return value as SerializedWorkspace;
}

function isDisabled(block: SerializedBlock): boolean {
  return block.enabled === false || (block.disabledReasons?.length ?? 0) > 0;
}

class IRBuilder {
  readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly registry: BlockRegistry) {}

  script(block: SerializedBlock): IRScript | null {
    const definition = this.definitionOf(block);
    if (!definition || definition.shape !== 'hat') return null;
    const fields: Record<string, number | string> = {};
    for (const [name, input] of Object.entries(definition.inputs)) {
      if (isField(input)) {
        const literal = this.fieldValue(block, name, input);
        fields[name] = typeof literal === 'number' ? literal : String(literal);
      }
    }
    return {
      id: block.id,
      event: definition.event(fields),
      body: this.statements(block.next?.block),
    };
  }

  statements(first: SerializedBlock | undefined): IRStatement[] {
    const result: IRStatement[] = [];
    for (let block = first; block; block = block.next?.block) {
      if (isDisabled(block)) continue;
      const definition = this.definitionOf(block);
      if (!definition) continue;
      if (definition.shape !== 'stack' && definition.shape !== 'cap' && definition.shape !== 'c') {
        this.report('error', 'notAStatement', block.id, { type: block.type });
        continue;
      }
      const args: Record<string, IRExpression> = {};
      const substacks: Record<string, IRStatement[]> = {};
      for (const [name, input] of Object.entries(definition.inputs)) {
        if (input.type === 'statement') {
          substacks[name] = this.statements(block.inputs?.[name]?.block);
        } else {
          args[name] = this.argument(block, name, input);
        }
      }
      result.push({ kind: 'block', blockId: block.id, type: block.type, args, substacks });
    }
    return result;
  }

  private expression(block: SerializedBlock): IRExpression | null {
    const definition = this.definitionOf(block);
    if (!definition) return null;
    if (definition.shape !== 'reporter' && definition.shape !== 'boolean') {
      this.report('error', 'notAValue', block.id, { type: block.type });
      return null;
    }
    const args: Record<string, IRExpression> = {};
    for (const [name, input] of Object.entries(definition.inputs)) {
      if (input.type !== 'statement') args[name] = this.argument(block, name, input);
    }
    return { kind: 'block', blockId: block.id, type: block.type, args };
  }

  private argument(
    block: SerializedBlock,
    name: string,
    input: Exclude<BlockInput, { type: 'statement' }>,
  ): IRExpression {
    if (isField(input)) {
      return { kind: 'literal', value: this.fieldValue(block, name, input) };
    }
    const connection = block.inputs?.[name];
    const plugged = connection?.block ?? connection?.shadow;
    const expression = plugged && !isDisabled(plugged) ? this.expression(plugged) : null;
    if (expression) return expression;
    switch (input.type) {
      case 'number':
        return { kind: 'literal', value: input.default };
      case 'string':
        return { kind: 'literal', value: input.default };
      case 'boolean':
        return { kind: 'literal', value: false };
    }
  }

  private fieldValue(block: SerializedBlock, name: string, input: FieldInput): number | string {
    const raw = block.fields?.[name];
    switch (input.type) {
      case 'numberField': {
        const value = typeof raw === 'number' ? raw : Number(raw);
        if (raw === undefined || !Number.isFinite(value)) {
          if (raw !== undefined) this.report('warning', 'invalidField', block.id, { field: name });
          return input.default;
        }
        return value;
      }
      case 'textField':
        return raw === undefined ? input.default : String(raw);
      case 'dropdown': {
        const value = String(raw ?? input.default);
        if (!input.options.some((option) => option.value === value)) {
          this.report('warning', 'invalidField', block.id, { field: name });
          return input.default;
        }
        return value;
      }
    }
  }

  private definitionOf(block: SerializedBlock): BlockDefinition | undefined {
    const definition = this.registry.get(block.type);
    if (!definition) this.report('error', 'unknownBlock', block.id, { type: block.type });
    return definition;
  }

  private report(
    severity: Diagnostic['severity'],
    code: Diagnostic['code'],
    blockId: string,
    params: Record<string, string>,
  ): void {
    this.diagnostics.push({ severity, code, blockId, params });
  }
}

function isField(input: BlockInput): input is FieldInput {
  return input.type === 'numberField' || input.type === 'textField' || input.type === 'dropdown';
}

/**
 * Converts a serialized Blockly workspace to IR. Every enabled hat block becomes a script;
 * loose blocks without a hat are ignored (as in Scratch). Unknown blocks are skipped and
 * reported as diagnostics.
 */
export function workspaceToIR(workspace: unknown, registry: BlockRegistry): IRResult {
  const parsed = parseWorkspace(workspace);
  const builder = new IRBuilder(registry);
  const scripts: IRScript[] = [];
  for (const block of parsed.blocks?.blocks ?? []) {
    if (isDisabled(block)) continue;
    const script = builder.script(block);
    if (script) scripts.push(script);
  }
  return { program: { scripts, functions: [] }, diagnostics: builder.diagnostics };
}
