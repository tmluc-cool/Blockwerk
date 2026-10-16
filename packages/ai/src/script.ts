import { blocklyCheck } from '@blockwerk/blocks';
import type { BlockDefinition, BlockInput, BlockRegistry, Locale } from '@blockwerk/blocks';
import { CompileError, compileBlockScript } from '@blockwerk/compiler';
import type { VariableData } from '@blockwerk/project';

/** A value in an input of a block: a literal or another block. */
export type ScriptValue = string | number | boolean | ScriptNode;

/** One block of a proposed script, as the model writes it (and as the preview reads it). */
export interface ScriptNode {
  /** Block ID from the catalog, such as `motion.move`. */
  readonly block: string;
  /** Values of the fields written on the block (dropdowns, numbers, texts, references, variables). */
  readonly fields?: Readonly<Record<string, string | number | boolean>>;
  /** Blocks and literals plugged into the round and pointed slots. */
  readonly inputs?: Readonly<Record<string, ScriptValue>>;
  /** The bodies of C-shaped blocks (`then`, `else`, `body` …). */
  readonly bodies?: Readonly<Record<string, readonly ScriptNode[]>>;
}

/** A variable the proposal declares. */
export interface ScriptVariable {
  readonly name: string;
  readonly type: 'number' | 'string' | 'boolean';
  readonly scope: 'object' | 'game';
  readonly default?: number | string | boolean;
}

/** A proposed block script: stacks of blocks, each stack starting with a hat block. */
export interface ScriptProposal {
  readonly name: string;
  /** One or two sentences about what the script does (shown with the preview). */
  readonly summary?: string;
  readonly variables?: readonly ScriptVariable[];
  readonly stacks: readonly (readonly ScriptNode[])[];
  /** ID of the object the script goes on (from the project summary); empty: the selected one. */
  readonly attachTo?: string;
}

/** What a script proposal is checked against. */
export interface ScriptContext {
  readonly registry: BlockRegistry;
  /** IDs of the objects of the scene (for `object:<id>` references). */
  readonly objectIds: ReadonlySet<string>;
  /** Tags that exist; `Player` and `Untagged` always do. */
  readonly tags: ReadonlySet<string>;
  /** Asset IDs by kind, for references such as `prefab:<id>`. */
  readonly assets: {
    readonly prefab: ReadonlySet<string>;
    readonly dialog: ReadonlySet<string>;
    readonly scene: ReadonlySet<string>;
    readonly ui: ReadonlySet<string>;
    readonly audio: ReadonlySet<string>;
  };
  /** Game variables the project already has (shared by all scripts, one ID in all of them). */
  readonly gameVariables: readonly VariableData[];
  /** The variables of the script that is being tidied up: declared again by name, they keep their ID. */
  readonly ownVariables?: readonly VariableData[];
}

/** Limits that keep a proposal reviewable. */
export const SCRIPT_LIMITS = { stacks: 6, blocks: 80, depth: 8 } as const;

/** The result of checking a script proposal. */
export type ScriptCheck =
  | {
      readonly ok: true;
      readonly proposal: ScriptProposal;
      /** The variables of the script as the project stores them (IDs made up). */
      readonly variables: VariableData[];
      /** The Blockly workspace of the script. */
      readonly workspace: Record<string, unknown>;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

const REFERENCE_PREFIXES = ['prefab', 'dialog', 'scene', 'ui', 'audio'] as const;

function isNode(value: unknown): value is ScriptNode {
  return (
    typeof value === 'object' && value !== null && typeof (value as ScriptNode).block === 'string'
  );
}

function describe(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** Whether a value block of type `output` fits into a socket of type `socket`. */
function fits(socket: BlockInput['type'], output: string | null): boolean {
  const check =
    socket === 'any'
      ? null
      : blocklyCheck(socket === 'string' ? 'string' : socket === 'boolean' ? 'boolean' : 'number');
  if (check === null || output === null) return true;
  if (check === 'Boolean') return output === 'Boolean';
  return output === 'Number' || output === 'String';
}

interface Walk {
  readonly errors: string[];
  blocks: number;
  readonly ctx: ScriptContext;
  readonly variables: ReadonlyMap<string, ScriptVariable>;
}

function referenceProblem(value: string, ctx: ScriptContext): string | null {
  if (['self', 'any', 'all', 'loop', 'mouse', 'origin'].includes(value)) return null;
  const colon = value.indexOf(':');
  const kind = colon < 0 ? value : value.slice(0, colon);
  const rest = colon < 0 ? '' : value.slice(colon + 1);
  if (kind === 'object') {
    return ctx.objectIds.has(rest)
      ? null
      : `no object with the ID "${rest}" (use an ID from the project summary)`;
  }
  if (kind === 'tag') {
    return rest === '' || rest === 'Player' || rest === 'Untagged' || ctx.tags.has(rest)
      ? null
      : `the tag "${rest}" does not exist (tags: ${[...ctx.tags, 'Player'].join(', ')})`;
  }
  if (kind === 'builtin')
    return /^[a-z-]+$/.test(rest) ? null : `"${value}" is not a built-in sound`;
  if ((REFERENCE_PREFIXES as readonly string[]).includes(kind)) {
    const set = ctx.assets[kind as (typeof REFERENCE_PREFIXES)[number]];
    return rest === '' || set.has(rest) ? null : `no ${kind} with the ID "${rest}"`;
  }
  return `"${value}" is not a valid reference (self, any, all, loop, mouse, origin, object:<id>, tag:<name>, prefab:<id>, dialog:<id>, scene:<id>, ui:<id>, builtin:<sound>, audio:<id>)`;
}

function checkField(
  where: string,
  name: string,
  input: BlockInput,
  value: unknown,
  walk: Walk,
): void {
  const at = `${where}.${name}`;
  switch (input.type) {
    case 'dropdown': {
      const known = input.options.map((option) => option.value);
      if (typeof value !== 'string' || !known.includes(value)) {
        walk.errors.push(`${at}: ${describe(value)} is not one of ${known.join(', ')}`);
      }
      return;
    }
    case 'numberField':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        walk.errors.push(`${at}: needs a number, got ${describe(value)}`);
      }
      return;
    case 'textField':
      if (typeof value !== 'string' && typeof value !== 'number') {
        walk.errors.push(`${at}: needs a text, got ${describe(value)}`);
      }
      return;
    case 'reference': {
      if (typeof value !== 'string') {
        walk.errors.push(`${at}: needs a reference text, got ${describe(value)}`);
        return;
      }
      const problem = referenceProblem(value, walk.ctx);
      if (problem) walk.errors.push(`${at}: ${problem}`);
      return;
    }
    case 'variable':
      if (typeof value !== 'string' || !walk.variables.has(value)) {
        walk.errors.push(`${at}: the variable ${describe(value)} is not declared in "variables"`);
      }
      return;
    case 'colorField':
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
        walk.errors.push(`${at}: needs a color like #ff8800, got ${describe(value)}`);
      }
      return;
    default:
      walk.errors.push(`${at}: is a slot, not a field`);
  }
}

function checkValue(
  where: string,
  name: string,
  socket: BlockInput,
  value: unknown,
  walk: Walk,
  depth: number,
): void {
  const at = `${where}.inputs.${name}`;
  if (isNode(value)) {
    const definition = walk.ctx.registry.get(value.block);
    if (!definition || (definition.shape !== 'reporter' && definition.shape !== 'boolean')) {
      checkNode(at, value, walk, depth + 1, 'value');
      return;
    }
    checkNode(at, value, walk, depth + 1, 'value');
    if (!fits(socket.type, blocklyCheck(definition.output))) {
      walk.errors.push(
        `${at}: ${value.block} gives ${definition.output} but the slot needs ${socket.type}`,
      );
    }
    return;
  }
  if (socket.type === 'boolean') {
    walk.errors.push(`${at}: needs a condition block, got the literal ${describe(value)}`);
    return;
  }
  if (socket.type === 'number') {
    const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof number !== 'number' || !Number.isFinite(number)) {
      walk.errors.push(`${at}: needs a number, got ${describe(value)}`);
    }
    return;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    walk.errors.push(`${at}: needs a text or a number, got ${describe(value)}`);
  }
}

function checkNode(
  where: string,
  node: ScriptNode,
  walk: Walk,
  depth: number,
  position: 'hat' | 'stack' | 'value',
): BlockDefinition | undefined {
  const definition = walk.ctx.registry.get(node.block);
  walk.blocks += 1;
  if (!definition || definition.hidden) {
    walk.errors.push(`${where}: the block "${node.block}" does not exist`);
    return undefined;
  }
  if (definition.code) walk.errors.push(`${where}: Code blocks are not allowed (${node.block})`);
  if (node.block.startsWith('custom.')) {
    walk.errors.push(`${where}: custom blocks are not allowed (${node.block})`);
  }
  if (depth > SCRIPT_LIMITS.depth)
    walk.errors.push(`${where}: nested deeper than ${SCRIPT_LIMITS.depth} levels`);
  const shape = definition.shape;
  if (position === 'hat' && shape !== 'hat') {
    walk.errors.push(
      `${where}: a script must start with an event (hat) block, ${node.block} is a ${shape} block`,
    );
  } else if (position === 'stack' && shape !== 'stack' && shape !== 'c' && shape !== 'cap') {
    walk.errors.push(`${where}: ${node.block} is a ${shape} block and cannot sit in a stack`);
  } else if (position === 'value' && shape !== 'reporter' && shape !== 'boolean') {
    walk.errors.push(`${where}: ${node.block} is a ${shape} block and cannot go into a slot`);
  }
  for (const part of ['fields', 'inputs', 'bodies'] as const) {
    const value = (node as unknown as Record<string, unknown>)[part];
    if (
      value !== undefined &&
      (typeof value !== 'object' || value === null || Array.isArray(value))
    ) {
      walk.errors.push(`${where}: "${part}" must be an object`);
      return definition;
    }
  }
  const fieldValues = node.fields ?? {};
  const socketValues = node.inputs ?? {};
  const bodies = node.bodies ?? {};
  for (const key of Object.keys(fieldValues)) {
    if (!(key in definition.inputs))
      walk.errors.push(`${where}: ${node.block} has no field "${key}"`);
  }
  for (const key of Object.keys(socketValues)) {
    if (!(key in definition.inputs))
      walk.errors.push(`${where}: ${node.block} has no input "${key}"`);
  }
  for (const key of Object.keys(bodies)) {
    if (definition.inputs[key]?.type !== 'statement') {
      walk.errors.push(`${where}: ${node.block} has no body "${key}"`);
    }
  }
  for (const [name, input] of Object.entries(definition.inputs)) {
    switch (input.type) {
      case 'number':
      case 'string':
      case 'any':
      case 'boolean': {
        const value = socketValues[name];
        if (value === undefined) {
          if (input.type === 'boolean')
            walk.errors.push(`${where}: ${node.block} needs a condition in "${name}"`);
          break;
        }
        checkValue(where, name, input, value, walk, depth);
        break;
      }
      case 'statement': {
        const body = bodies[name];
        if (body === undefined) break;
        if (!Array.isArray(body)) {
          walk.errors.push(`${where}.bodies.${name}: needs a list of blocks`);
          break;
        }
        checkStack(`${where}.bodies.${name}`, body, walk, depth + 1, false);
        break;
      }
      default: {
        if (name in fieldValues) checkField(where, name, input, fieldValues[name], walk);
        else if (input.type === 'variable') {
          walk.errors.push(
            `${where}: ${node.block} needs the field "${name}" (a declared variable)`,
          );
        }
      }
    }
  }
  return definition;
}

function checkStack(
  where: string,
  stack: readonly ScriptNode[],
  walk: Walk,
  depth: number,
  startsWithHat: boolean,
): void {
  if (stack.length === 0) walk.errors.push(`${where}: is empty`);
  stack.forEach((node, index) => {
    const at = `${where}[${index}]`;
    if (!isNode(node)) {
      walk.errors.push(`${at}: needs an object with a "block" text`);
      return;
    }
    const definition = checkNode(
      at,
      node,
      walk,
      depth,
      startsWithHat && index === 0 ? 'hat' : 'stack',
    );
    const last = index === stack.length - 1;
    if (
      definition &&
      !last &&
      (definition.shape === 'cap' || (definition.shape === 'c' && definition.terminal))
    ) {
      walk.errors.push(`${at}: ${node.block} ends the script, nothing can follow it`);
    }
  });
}

/** Whether a value looks like a script proposal at all (before any detail is checked). */
function shapeErrors(input: unknown): string[] {
  if (typeof input !== 'object' || input === null) return ['the answer is not an object'];
  const proposal = input as Partial<ScriptProposal>;
  const errors: string[] = [];
  if (typeof proposal.name !== 'string' || proposal.name.trim() === '')
    errors.push('"name" is missing');
  if (!Array.isArray(proposal.stacks) || proposal.stacks.length === 0) {
    errors.push('"stacks" must list at least one stack of blocks');
  } else if (proposal.stacks.length > SCRIPT_LIMITS.stacks) {
    errors.push(`at most ${SCRIPT_LIMITS.stacks} stacks are allowed`);
  } else if (proposal.stacks.some((stack) => !Array.isArray(stack))) {
    errors.push('every entry of "stacks" must be a list of blocks');
  }
  return errors;
}

/** A 12-character ID like the editor's (`[a-z0-9]`). */
function makeId(random: () => number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let index = 0; index < 12; index += 1)
    id += alphabet[Math.floor(random() * alphabet.length)];
  return id;
}

interface BuildState {
  readonly registry: BlockRegistry;
  readonly variableIds: ReadonlyMap<string, string>;
  readonly random: () => number;
}

interface WorkspaceBlock {
  type: string;
  id: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: WorkspaceBlock; shadow?: WorkspaceBlock }>;
  next?: { block: WorkspaceBlock };
}

function buildNode(node: ScriptNode, state: BuildState): WorkspaceBlock {
  const definition = state.registry.get(node.block);
  const block: WorkspaceBlock = { type: node.block, id: makeId(state.random) };
  const fields: Record<string, unknown> = {};
  const inputs: Record<string, { block?: WorkspaceBlock; shadow?: WorkspaceBlock }> = {};
  for (const [name, input] of Object.entries(definition?.inputs ?? {})) {
    if (input.type === 'variable') {
      const variable = node.fields?.[name];
      const id = typeof variable === 'string' ? state.variableIds.get(variable) : undefined;
      if (id) fields[name] = { id };
    } else if (input.type === 'statement') {
      const body = node.bodies?.[name];
      if (body && body.length > 0) inputs[name] = { block: buildStack(body, state) };
    } else if (
      input.type === 'number' ||
      input.type === 'string' ||
      input.type === 'any' ||
      input.type === 'boolean'
    ) {
      const value = node.inputs?.[name];
      if (value === undefined) continue;
      if (isNode(value)) inputs[name] = { block: buildNode(value, state) };
      else if (input.type === 'number' || (input.type === 'any' && typeof value === 'number')) {
        const number = typeof value === 'number' ? value : Number(value);
        inputs[name] = {
          shadow: { type: 'literal.number', id: makeId(state.random), fields: { NUM: number } },
        };
      } else {
        inputs[name] = {
          shadow: {
            type: 'literal.text',
            id: makeId(state.random),
            fields: { TEXT: String(value) },
          },
        };
      }
    } else if (node.fields && name in node.fields) {
      fields[name] = node.fields[name];
    }
  }
  if (Object.keys(fields).length > 0) block.fields = fields;
  if (Object.keys(inputs).length > 0) block.inputs = inputs;
  return block;
}

function buildStack(stack: readonly ScriptNode[], state: BuildState): WorkspaceBlock {
  const blocks = stack.map((node) => buildNode(node, state));
  for (let index = blocks.length - 2; index >= 0; index -= 1) {
    const block = blocks[index];
    const following = blocks[index + 1];
    if (block && following) block.next = { block: following };
  }
  return blocks[0] as WorkspaceBlock;
}

/**
 * Checks a script proposal against the block catalog and the project, and builds the Blockly
 * workspace and the variables from it. The result is compiled once: what the compiler refuses
 * (types, locals, empty places) is an error too, so a valid proposal always compiles.
 * `random` makes the IDs (default `Math.random`).
 */
export function checkScript(
  input: unknown,
  ctx: ScriptContext,
  random: () => number = Math.random,
): ScriptCheck {
  const errors = shapeErrors(input);
  if (errors.length > 0) return { ok: false, errors };
  const proposal = input as ScriptProposal;
  const declared = new Map<string, ScriptVariable>();
  const variableErrors: string[] = [];
  for (const variable of proposal.variables ?? []) {
    if (typeof variable?.name !== 'string' || variable.name.trim() === '') {
      variableErrors.push('a variable has no name');
      continue;
    }
    if (!['number', 'string', 'boolean'].includes(variable.type)) {
      variableErrors.push(`the variable "${variable.name}" needs type number, string or boolean`);
    }
    declared.set(variable.name, {
      ...variable,
      scope: variable.scope === 'game' ? 'game' : 'object',
    });
  }
  // Game variables the project already has can be used without declaring them again.
  const known = new Map(declared);
  for (const existing of ctx.gameVariables) {
    if (
      !known.has(existing.name) &&
      (existing.type === 'number' || existing.type === 'string' || existing.type === 'boolean')
    ) {
      known.set(existing.name, { name: existing.name, type: existing.type, scope: 'game' });
    }
  }
  const walk: Walk = { errors: [...variableErrors], blocks: 0, ctx, variables: known };
  proposal.stacks.forEach((stack, index) => {
    checkStack(`stacks[${index}]`, stack, walk, 1, true);
  });
  if (walk.blocks > SCRIPT_LIMITS.blocks) {
    walk.errors.push(
      `the script has ${walk.blocks} blocks, at most ${SCRIPT_LIMITS.blocks} are allowed`,
    );
  }
  if (walk.errors.length > 0) return { ok: false, errors: walk.errors.slice(0, 20) };

  const variableIds = new Map<string, string>();
  const variables: VariableData[] = [];
  for (const variable of declared.values()) {
    // A variable that exists already (in the script being tidied, or a game variable of the
    // project) keeps its ID, so values stored in the scene and in saves stay valid.
    const existing =
      ctx.ownVariables?.find((own) => own.name === variable.name && own.scope === variable.scope) ??
      (variable.scope === 'game'
        ? ctx.gameVariables.find((own) => own.name === variable.name)
        : undefined);
    if (existing) {
      variableIds.set(variable.name, existing.id);
      variables.push(existing);
      continue;
    }
    const id = makeId(random);
    variableIds.set(variable.name, id);
    variables.push({
      id,
      name: variable.name,
      type: variable.type,
      scope: variable.scope,
      default:
        variable.default ??
        (variable.type === 'number' ? 0 : variable.type === 'boolean' ? false : ''),
      inspector: false,
    });
  }
  for (const existing of ctx.gameVariables) {
    if (!variableIds.has(existing.name)) variableIds.set(existing.name, existing.id);
  }
  const state: BuildState = { registry: ctx.registry, variableIds, random };
  const tops = proposal.stacks.map((stack, index) => {
    const top = buildStack(stack, state);
    top.x = 40;
    top.y = 40 + index * 260;
    return top;
  });
  const workspace = { blocks: { languageVersion: 0, blocks: tops } };
  // Game variables the script uses without having declared them are declared in the script too.
  const usedIds = new Set(
    [...JSON.stringify(workspace).matchAll(/"variable":\{"id":"([a-z0-9]+)"\}/g)].map(
      (match) => match[1],
    ),
  );
  for (const existing of ctx.gameVariables) {
    if (usedIds.has(existing.id) && !variables.some((variable) => variable.id === existing.id)) {
      variables.push(existing);
    }
  }
  try {
    const result = compileBlockScript(workspace, {
      assetName: proposal.name,
      variables,
      registry: ctx.registry,
    });
    const failed = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
    if (failed.length > 0) {
      return {
        ok: false,
        errors: failed
          .slice(0, 10)
          .map(
            (diagnostic) =>
              `the compiler refuses the script: ${diagnostic.code} ${JSON.stringify(diagnostic.params)}`,
          ),
      };
    }
  } catch (error) {
    const message =
      error instanceof CompileError || error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`the compiler refuses the script: ${message}`] };
  }
  return { ok: true, proposal, variables, workspace };
}

/** The text of a block with its values filled in, e.g. `move 10 steps` (for outlines and prompts). */
function blockText(node: ScriptNode, registry: BlockRegistry, locale: Locale): string {
  const definition = registry.get(node.block);
  if (!definition) return node.block;
  return definition.text[locale].replace(/\{(\w+)\}/g, (_match, name: string) => {
    const input = definition.inputs[name];
    const field = node.fields?.[name];
    const value = node.inputs?.[name];
    if (value !== undefined) {
      return isNode(value) ? `(${blockText(value, registry, locale)})` : String(value);
    }
    if (field !== undefined) return String(field);
    if (input && 'default' in input) return String(input.default);
    return '…';
  });
}

/** A script as readable lines, indented by nesting: the preview before the user applies it. */
export function outlineScript(
  stacks: readonly (readonly ScriptNode[])[],
  registry: BlockRegistry,
  locale: Locale,
): string[] {
  const lines: string[] = [];
  const walkStack = (stack: readonly ScriptNode[], indent: number): void => {
    for (const node of stack) {
      lines.push(`${'  '.repeat(indent)}${blockText(node, registry, locale)}`);
      const definition = registry.get(node.block);
      for (const [name, input] of Object.entries(definition?.inputs ?? {})) {
        if (input.type !== 'statement') continue;
        const body = node.bodies?.[name];
        if (!body) continue;
        const label = input.label?.[locale];
        if (label) lines.push(`${'  '.repeat(indent)}${label}`);
        walkStack(body, indent + 1);
      }
    }
  };
  stacks.forEach((stack, index) => {
    if (index > 0) lines.push('');
    walkStack(stack, 0);
  });
  return lines;
}

interface WorkspaceBlockIn {
  readonly type?: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly inputs?: Readonly<
    Record<string, { readonly block?: WorkspaceBlockIn; readonly shadow?: WorkspaceBlockIn }>
  >;
  readonly next?: { readonly block?: WorkspaceBlockIn };
}

/**
 * Reads a saved workspace back into the proposal format (what the model sees of an existing
 * script, and what the outline of an existing script shows). Variables are named by their names.
 */
export function scriptFromWorkspace(
  workspace: unknown,
  registry: BlockRegistry,
  variables: readonly Pick<VariableData, 'id' | 'name'>[],
): ScriptNode[][] {
  const names = new Map(variables.map((variable) => [variable.id, variable.name]));
  const tops =
    (workspace as { blocks?: { blocks?: WorkspaceBlockIn[] } } | null)?.blocks?.blocks ?? [];
  const toNode = (block: WorkspaceBlockIn): ScriptNode => {
    const type = block.type ?? 'unknown';
    const definition = registry.get(type);
    const fields: Record<string, string | number | boolean> = {};
    const inputs: Record<string, ScriptValue> = {};
    const bodies: Record<string, ScriptNode[]> = {};
    for (const [name, value] of Object.entries(block.fields ?? {})) {
      const variable = value as { id?: string } | null;
      if (typeof value === 'object' && value !== null && 'id' in value) {
        fields[name] = names.get(variable?.id ?? '') ?? String(variable?.id);
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        fields[name] = value;
      }
    }
    for (const [name, connection] of Object.entries(block.inputs ?? {})) {
      const input = definition?.inputs[name];
      if (input?.type === 'statement') {
        bodies[name] = chainOf(connection.block);
        continue;
      }
      const plugged = connection.block ?? connection.shadow;
      if (!plugged) continue;
      if (plugged.type === 'literal.number') inputs[name] = Number(plugged.fields?.['NUM'] ?? 0);
      else if (plugged.type === 'literal.text')
        inputs[name] = String(plugged.fields?.['TEXT'] ?? '');
      else inputs[name] = toNode(plugged);
    }
    return {
      block: type,
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
      ...(Object.keys(inputs).length > 0 ? { inputs } : {}),
      ...(Object.keys(bodies).length > 0 ? { bodies } : {}),
    };
  };
  const chainOf = (first: WorkspaceBlockIn | undefined): ScriptNode[] => {
    const nodes: ScriptNode[] = [];
    for (let block = first; block; block = block.next?.block) nodes.push(toNode(block));
    return nodes;
  };
  return tops.map((top) => chainOf(top));
}
