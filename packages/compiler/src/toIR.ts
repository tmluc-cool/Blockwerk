import { isFieldType } from '@blockwerk/blocks';
import type {
  BlockDefinition,
  BlockInput,
  BlockRegistry,
  FieldInput,
  ValueType,
} from '@blockwerk/blocks';
import { CompileError } from './diagnostics';
import type { Diagnostic } from './diagnostics';
import { CALL_KINDS, DEFINITION_KINDS, functionKey, signatureOf } from './functions';
import type { CustomParam, CustomSignature } from './functions';
import type { IRExpression, IRFunction, IRProgram, IRScript, IRStatement } from './ir';

/** A block in Blockly's JSON serialization (`Blockly.serialization.workspaces.save`). */
export interface SerializedBlock {
  readonly type: string;
  readonly id: string;
  readonly x?: number;
  readonly y?: number;
  readonly enabled?: boolean;
  readonly disabledReasons?: readonly string[];
  readonly fields?: Readonly<Record<string, unknown>>;
  /** Extra state of blocks whose shape depends on data (custom blocks). */
  readonly extraState?: unknown;
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

/** A variable of the block script, as stored in the block-script document. */
export interface ScriptVariable {
  readonly id: string;
  readonly name: string;
  readonly scope: 'object' | 'game';
  /** Type of the variable; used by the type check (missing means "anything"). */
  readonly type?: 'number' | 'string' | 'boolean' | 'list' | 'dictionary';
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
  /** Local variables that exist at the block being read (SPEC 7.4). */
  private locals = new Set<string>();

  /** The custom block whose body is being read (`null` inside a script). */
  private fn: CustomSignature | null = null;

  constructor(
    private readonly registry: BlockRegistry,
    private readonly variables: ReadonlyMap<string, ScriptVariable>,
    private readonly assetId: string,
    private readonly signatures: ReadonlyMap<string, CustomSignature>,
  ) {}

  /** Reads a custom block definition (`custom.define*`) and its body. */
  definition(block: SerializedBlock): IRFunction | null {
    const signature = signatureOf(block, this.assetId);
    if (!signature) return null;
    this.fn = signature;
    this.locals = new Set();
    const body = this.statements(block.next?.block);
    this.fn = null;
    return {
      id: signature.key,
      name: signature.name,
      params: signature.params.map((param) => param.name),
      paramTypes: signature.params.map((param) => param.type),
      returns: signature.returns,
      warp: signature.warp,
      body,
    };
  }

  /** The function and the argument values of a call block, or `null` if it cannot be resolved. */
  private call(block: SerializedBlock): { functionId: string; args: IRExpression[] } | null {
    const state = isRecord(block.extraState) ? block.extraState : {};
    const fn = typeof state['fn'] === 'string' ? state['fn'] : '';
    const library = typeof state['library'] === 'string' ? state['library'] : '';
    const signature = this.signatures.get(functionKey(library || this.assetId, fn));
    if (!signature || signature.kind !== CALL_KINDS[block.type]) {
      const label = typeof state['name'] === 'string' ? state['name'] : '';
      this.report('warning', 'unknownFunction', block.id, { name: label });
      return null;
    }
    const args = signature.params.map((param, index) =>
      this.callArgument(block, `ARG${index}`, param),
    );
    return { functionId: signature.key, args };
  }

  /** The value plugged into a parameter slot of a call, or the default of the parameter's type. */
  private callArgument(block: SerializedBlock, name: string, param: CustomParam): IRExpression {
    const connection = block.inputs?.[name];
    const plugged = connection?.block ?? connection?.shadow;
    const expression = plugged && !isDisabled(plugged) ? this.expression(plugged) : null;
    if (expression) {
      this.checkType(plugged?.id ?? block.id, param.type, expression);
      return expression;
    }
    switch (param.type) {
      case 'number':
        return { kind: 'literal', value: 0 };
      case 'boolean':
        return { kind: 'literal', value: false };
      case 'list':
        return { kind: 'block', blockId: block.id, type: 'data.newList', args: {} };
      case 'dictionary':
        return { kind: 'block', blockId: block.id, type: 'data.newDictionary', args: {} };
      case 'string':
      case 'any':
        return { kind: 'literal', value: '' };
    }
  }

  script(block: SerializedBlock): IRScript | null {
    const definition = this.definitionOf(block);
    if (!definition || definition.shape !== 'hat') return null;
    const fields: Record<string, number | string> = {};
    for (const [name, input] of Object.entries(definition.inputs)) {
      if (isField(input)) {
        const literal = this.fieldValue(block, name, input);
        if (literal === null) return null;
        fields[name] = literal;
      }
    }
    this.locals = new Set();
    return {
      id: block.id,
      event: definition.event(fields),
      body: this.statements(block.next?.block),
    };
  }

  /** Static type of a value, `any` if it is not known (SPEC 7.3). */
  private typeOf(expression: IRExpression): ValueType {
    switch (expression.kind) {
      case 'literal':
        return typeof expression.value === 'number'
          ? 'number'
          : typeof expression.value === 'string'
            ? 'string'
            : 'boolean';
      case 'call':
        return this.signatures.get(expression.functionId)?.returns ?? 'any';
      case 'block': {
        if (expression.type === 'custom.param') {
          const name = expression.args['name'];
          const wanted = name?.kind === 'literal' ? String(name.value) : '';
          return this.fn?.params.find((param) => param.name === wanted)?.type ?? 'any';
        }
        if (expression.type === 'variables.get') {
          const field = expression.args['variable'];
          const id = field?.kind === 'literal' ? String(field.value) : '';
          return this.variables.get(id)?.type ?? 'any';
        }
        const definition = this.registry.get(expression.type);
        return definition && (definition.shape === 'reporter' || definition.shape === 'boolean')
          ? definition.output
          : 'any';
      }
      default:
        return 'any';
    }
  }

  /**
   * Checks a value against the type of the slot it is plugged into (SPEC 7.3: numbers and text
   * convert into each other, everything else has to fit). Only reports; the value still works.
   */
  private checkType(blockId: string, expected: ValueType, value: IRExpression): void {
    const actual = this.typeOf(value);
    if (expected === 'any' || actual === 'any' || actual === expected) return;
    const text = (type: ValueType): boolean => type === 'number' || type === 'string';
    if (text(expected) && text(actual)) return;
    this.report('warning', 'typeMismatch', blockId, { expected, actual });
  }

  /** The name a block with a local variable field refers to. */
  private localName(block: SerializedBlock, definition: BlockDefinition): string {
    const field = definition.local?.field;
    const raw = field ? block.fields?.[field] : undefined;
    return typeof raw === 'string' ? raw.trim() : '';
  }

  /** Whether a block that reads or writes a local variable names one that exists here. */
  private localKnown(block: SerializedBlock, definition: BlockDefinition): boolean {
    if (definition.local?.role === 'param') {
      const name = this.localName(block, definition);
      if (this.fn?.params.some((param) => param.name === name)) return true;
      this.report('warning', 'unknownParam', block.id, { name });
      return false;
    }
    if (definition.local?.role !== 'use') return true;
    const name = this.localName(block, definition);
    if (this.locals.has(name)) return true;
    this.report('warning', 'unknownLocal', block.id, { name });
    return false;
  }

  statements(first: SerializedBlock | undefined): IRStatement[] {
    const result: IRStatement[] = [];
    // Variables declared in a nested body end with it; the ones above stay visible inside.
    const outer = this.locals;
    this.locals = new Set(outer);
    for (let block = first; block; block = block.next?.block) {
      if (isDisabled(block)) continue;
      if (block.type === 'custom.return') {
        this.returnStatement(block, result);
        continue;
      }
      if (CALL_KINDS[block.type] === 'command') {
        const call = this.call(block);
        if (call) result.push({ kind: 'call', ...call, blockId: block.id });
        continue;
      }
      const definition = this.definitionOf(block);
      if (!definition) continue;
      if (definition.shape !== 'stack' && definition.shape !== 'cap' && definition.shape !== 'c') {
        this.report('error', 'notAStatement', block.id, { type: block.type });
        continue;
      }
      const args: Record<string, IRExpression> = {};
      const substacks: Record<string, IRStatement[]> = {};
      let valid = this.localKnown(block, definition);
      for (const [name, input] of Object.entries(definition.inputs)) {
        if (input.type === 'statement') {
          const local = definition.local;
          if (local?.role === 'loop' && local.substack === name) {
            const here = this.locals;
            this.locals = new Set(here).add(this.localName(block, definition));
            substacks[name] = this.statements(block.inputs?.[name]?.block);
            this.locals = here;
          } else {
            substacks[name] = this.statements(block.inputs?.[name]?.block);
          }
        } else {
          const arg = this.argument(block, name, input);
          if (arg === null) valid = false;
          else args[name] = arg;
        }
      }
      if (definition.local?.role === 'declare') this.locals.add(this.localName(block, definition));
      if (valid)
        result.push({ kind: 'block', blockId: block.id, type: block.type, args, substacks });
    }
    this.locals = outer;
    return result;
  }

  /** "return": ends a custom block; in value and condition blocks it carries the result. */
  private returnStatement(block: SerializedBlock, into: IRStatement[]): void {
    if (!this.fn) {
      this.report('warning', 'returnOutside', block.id, {});
      return;
    }
    const value =
      this.fn.kind === 'command'
        ? null
        : this.argument(block, 'value', { type: 'any', default: '' });
    if (value && this.fn.returns) this.checkType(block.id, this.fn.returns, value);
    into.push({ kind: 'return', value, blockId: block.id });
  }

  private expression(block: SerializedBlock): IRExpression | null {
    if (CALL_KINDS[block.type] === 'value' || CALL_KINDS[block.type] === 'condition') {
      const call = this.call(block);
      return call ? { kind: 'call', ...call, blockId: block.id } : null;
    }
    const definition = this.definitionOf(block);
    if (!definition) return null;
    if (definition.shape !== 'reporter' && definition.shape !== 'boolean') {
      this.report('error', 'notAValue', block.id, { type: block.type });
      return null;
    }
    if (!this.localKnown(block, definition)) return null;
    const args: Record<string, IRExpression> = {};
    for (const [name, input] of Object.entries(definition.inputs)) {
      if (input.type === 'statement') continue;
      const arg = this.argument(block, name, input);
      if (arg === null) return null;
      args[name] = arg;
    }
    return { kind: 'block', blockId: block.id, type: block.type, args };
  }

  private argument(
    block: SerializedBlock,
    name: string,
    input: Exclude<BlockInput, { type: 'statement' }>,
  ): IRExpression | null {
    if (isField(input)) {
      const value = this.fieldValue(block, name, input);
      return value === null ? null : { kind: 'literal', value };
    }
    const connection = block.inputs?.[name];
    const plugged = connection?.block ?? connection?.shadow;
    const expression = plugged && !isDisabled(plugged) ? this.expression(plugged) : null;
    if (expression) {
      this.checkType(plugged?.id ?? block.id, input.type, expression);
      return expression;
    }
    switch (input.type) {
      case 'number':
        return { kind: 'literal', value: input.default };
      case 'string':
      case 'any':
        return { kind: 'literal', value: input.default };
      case 'boolean':
        return { kind: 'literal', value: false };
    }
  }

  /** The literal value of a field, or `null` if the block cannot be compiled. */
  private fieldValue(
    block: SerializedBlock,
    name: string,
    input: FieldInput,
  ): number | string | null {
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
      case 'reference': {
        const value = typeof raw === 'string' ? raw : input.default;
        if (!REFERENCE_PATTERN.test(value)) {
          this.report('warning', 'invalidField', block.id, { field: name });
          return input.default;
        }
        return value;
      }
      case 'colorField': {
        const value = typeof raw === 'string' ? raw.toLowerCase() : input.default;
        if (!COLOR_PATTERN.test(value)) {
          this.report('warning', 'invalidField', block.id, { field: name });
          return input.default;
        }
        return value;
      }
      case 'variable': {
        // Blockly stores variable fields as `{ id }`; plain strings are accepted too.
        const id = isRecord(raw) ? raw['id'] : raw;
        if (typeof id !== 'string' || !this.variables.has(id)) {
          this.report('error', 'unknownVariable', block.id, {
            field: name,
            variable: typeof id === 'string' ? id : '',
          });
          return null;
        }
        return id;
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

const REFERENCE_PATTERN =
  /^(?:self|any|all|loop|mouse|origin|object:.+|tag:.*|prefab:[a-z0-9]*|dialog:[a-z0-9]*|scene:[a-z0-9]*|ui:[a-z0-9]*|builtin:[a-z-]+|audio:[a-z0-9]*)$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;

function isField(input: BlockInput): input is FieldInput {
  return isFieldType(input.type);
}

/** Options of {@link workspaceToIR}. */
export interface WorkspaceToIROptions {
  /** ID of the block-script asset (part of the keys of its custom blocks). */
  readonly assetId?: string;
  /** Custom blocks this script may call, besides its own (project-wide ones of other scripts). */
  readonly signatures?: ReadonlyMap<string, CustomSignature>;
}

/** Signatures of the custom blocks a workspace defines. */
export function workspaceSignatures(workspace: unknown, assetId: string): CustomSignature[] {
  const result: CustomSignature[] = [];
  for (const block of parseWorkspace(workspace).blocks?.blocks ?? []) {
    if (isDisabled(block)) continue;
    const signature = signatureOf(block, assetId);
    if (signature) result.push(signature);
  }
  return result;
}

/**
 * Converts a serialized Blockly workspace to IR. Every enabled hat block becomes a script and
 * every definition block a function; loose blocks without a hat are ignored (as in Scratch).
 * Unknown blocks and blocks that use unknown variables are skipped and reported as diagnostics.
 */
export function workspaceToIR(
  workspace: unknown,
  registry: BlockRegistry,
  variables: readonly ScriptVariable[] = [],
  options: WorkspaceToIROptions = {},
): IRResult {
  const parsed = parseWorkspace(workspace);
  const assetId = options.assetId ?? 'script';
  const signatures = new Map(options.signatures ?? []);
  for (const signature of workspaceSignatures(workspace, assetId)) {
    signatures.set(signature.key, signature);
  }
  const builder = new IRBuilder(
    registry,
    new Map(variables.map((variable) => [variable.id, variable])),
    assetId,
    signatures,
  );
  const scripts: IRScript[] = [];
  const functions: IRFunction[] = [];
  for (const block of parsed.blocks?.blocks ?? []) {
    if (isDisabled(block)) continue;
    if (DEFINITION_KINDS[block.type]) {
      const fn = builder.definition(block);
      if (fn) functions.push(fn);
      continue;
    }
    const script = builder.script(block);
    if (script) scripts.push(script);
  }
  return { program: { scripts, functions }, diagnostics: builder.diagnostics };
}
