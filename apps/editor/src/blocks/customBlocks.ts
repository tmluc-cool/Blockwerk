import { defaultRegistry, getCategory, MY_BLOCKS_FLYOUT, toolboxBlock } from '@blockwerk/blocks';
import type { Locale } from '@blockwerk/blocks';
import * as Blockly from 'blockly/core';
import type { BlockFrameOptions, CustomBlockSpec, FrameCustomBlock, FrameParam } from './frameApi';
import { currentReferences } from './referenceField';
import { DEFINITION_TYPES, localsInScope, paramsInScope } from './scopedNameField';
import type { DefinitionBlock } from './scopedNameField';

/** Name of the palette button that opens the "Make a block" dialog. */
const MAKE_BLOCK = 'BW_MAKE_BLOCK';

type Kind = FrameCustomBlock['kind'];

const CALL_TYPES: Readonly<Record<Kind, string>> = {
  command: 'custom.callCommand',
  value: 'custom.callValue',
  condition: 'custom.callCondition',
};

const DEFINITION_BY_KIND: Readonly<Record<Kind, string>> = {
  command: 'custom.defineCommand',
  value: 'custom.defineValue',
  condition: 'custom.defineCondition',
};

const KIND_OF_CALL: Readonly<Record<string, Kind>> = {
  'custom.callCommand': 'command',
  'custom.callValue': 'value',
  'custom.callCondition': 'condition',
};

const KIND_OF_DEFINITION: Readonly<Record<string, Kind>> = {
  'custom.defineCommand': 'command',
  'custom.defineValue': 'value',
  'custom.defineCondition': 'condition',
};

/** What the frame provides to the custom block code. */
interface Hooks {
  customBlocks: readonly FrameCustomBlock[];
  onEditBlock: BlockFrameOptions['onEditBlock'];
  onGoToDefinition: BlockFrameOptions['onGoToDefinition'];
  askName: BlockFrameOptions['askName'];
  onFindUsages: BlockFrameOptions['onFindUsages'];
}

let hooks: Hooks = {
  customBlocks: [],
  onEditBlock: () => undefined,
  onGoToDefinition: () => undefined,
  askName: () => Promise.resolve(null),
  onFindUsages: () => undefined,
};

/** Connects the custom block code to the editor (called once per mount). */
export function setCustomHooks(next: Partial<Hooks>): void {
  hooks = { ...hooks, ...next };
}

/** The custom blocks the palette and the calls know about. */
export function currentCustomBlocks(): readonly FrameCustomBlock[] {
  return hooks.customBlocks;
}

/** Blockly connection check of a parameter or result type (`null` accepts everything). */
function checkOf(type: string): string | string[] | null {
  switch (type) {
    case 'number':
    case 'string':
      return ['Number', 'String'];
    case 'boolean':
      return 'Boolean';
    case 'list':
      return 'List';
    case 'dictionary':
      return 'Dictionary';
    default:
      return null;
  }
}

/** State a call block saves: which definition it calls and a snapshot of how it looks. */
interface CallState {
  fn: string;
  library: string;
  name: string;
  params: FrameParam[];
}

type CallBlock = Blockly.Block & { bwState?: CallState };

function sameState(a: CallState | undefined, b: CallState): boolean {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

/** Gives a call block the inputs of its custom block: one value slot per parameter. */
function applyCallShape(block: CallBlock, state: CallState): void {
  block.bwState = state;
  const head = block.getField('LABEL');
  if (head) head.setValue(state.name);
  const events = Blockly.Events.isEnabled();
  if (events) Blockly.Events.disable();
  try {
    state.params.forEach((param, index) => {
      const name = `ARG${index}`;
      let input = block.getInput(name);
      if (!input) {
        input = block.appendValueInput(name);
        input.appendField(new Blockly.FieldLabel(param.name), `${name}_LABEL`);
      } else {
        block.getField(`${name}_LABEL`)?.setValue(param.name);
      }
      input.setCheck(checkOf(param.type));
    });
    for (let index = state.params.length; block.getInput(`ARG${index}`); index++) {
      block.removeInput(`ARG${index}`, true);
    }
  } finally {
    if (events) Blockly.Events.enable();
  }
}

function callExtra(block: CallBlock): CallState | undefined {
  return block.bwState;
}

/** Whether a custom block exists for a call: its own or a project-wide one. */
function definitionOf(state: CallState): FrameCustomBlock | undefined {
  return hooks.customBlocks.find(
    (custom) => custom.fn === state.fn && custom.library === state.library,
  );
}

function stateOf(custom: FrameCustomBlock): CallState {
  return {
    fn: custom.fn,
    library: custom.library,
    name: custom.name,
    params: custom.params.map((param) => ({ ...param })),
  };
}

/** Updates the shape of every call to the current definitions. Returns whether anything changed. */
export function refreshCalls(workspace: Blockly.Workspace): boolean {
  let changed = false;
  for (const block of workspace.getAllBlocks(false)) {
    if (!KIND_OF_CALL[block.type]) continue;
    const call = block as CallBlock;
    const state = callExtra(call);
    if (!state) continue;
    const definition = definitionOf(state);
    if (!definition) {
      (call as Blockly.BlockSvg).setWarningText?.(currentReferences().labels.missingBlock);
      continue;
    }
    (call as Blockly.BlockSvg).setWarningText?.(null);
    const next = stateOf(definition);
    if (sameState(state, next)) continue;
    applyCallShape(call, next);
    changed = true;
  }
  return changed;
}

/** The text shown behind the name of a definition: its inputs. */
function summaryOf(params: readonly FrameParam[]): string {
  return params.length === 0 ? '' : `(${params.map((param) => param.name).join(', ')})`;
}

/** What a definition block saves next to its name. */
interface DefinitionState {
  params: FrameParam[];
  returns: string;
  warp: boolean;
  scope: 'script' | 'project';
}

type DefinitionHolder = DefinitionBlock & { bwDefinition?: DefinitionState };

function applyDefinition(block: DefinitionHolder, state: DefinitionState): void {
  block.bwDefinition = state;
  block.bwParams = state.params;
  block.getField('SUMMARY')?.setValue(summaryOf(state.params));
  if (block.type === 'custom.defineValue') block.setTooltip(`→ ${state.returns}`);
}

function normalizeDefinition(state: unknown): DefinitionState {
  const raw = (typeof state === 'object' && state !== null ? state : {}) as Record<string, unknown>;
  const params: FrameParam[] = [];
  if (Array.isArray(raw['params'])) {
    for (const item of raw['params'] as unknown[]) {
      if (typeof item !== 'object' || item === null) continue;
      const entry = item as Record<string, unknown>;
      if (typeof entry['name'] === 'string' && entry['name'] !== '') {
        params.push({
          name: entry['name'],
          type: typeof entry['type'] === 'string' ? entry['type'] : 'any',
        });
      }
    }
  }
  return {
    params,
    returns: typeof raw['returns'] === 'string' ? raw['returns'] : 'any',
    warp: raw['warp'] === true,
    scope: raw['scope'] === 'project' ? 'project' : 'script',
  };
}

/** The spec of a definition block, as the "Edit custom block" dialog shows it. */
function specOf(block: DefinitionHolder): CustomBlockSpec {
  const state = block.bwDefinition ?? normalizeDefinition({});
  return {
    kind: KIND_OF_DEFINITION[block.type] ?? 'command',
    name: String(block.getFieldValue('name') ?? ''),
    params: state.params,
    returns: state.returns,
    warp: state.warp,
    scope: state.scope,
  };
}

function definitionExtra(spec: CustomBlockSpec): DefinitionState {
  return {
    params: spec.params.map((param) => ({ ...param })),
    returns: spec.kind === 'value' ? spec.returns : spec.kind === 'condition' ? 'boolean' : 'any',
    warp: spec.warp,
    scope: spec.scope,
  };
}

/** Defines the Blockly blocks of custom blocks (definitions and calls). Call after `defineBlocks`. */
export function registerCustomBlocks(locale: Locale): void {
  for (const [kind, type] of Object.entries(DEFINITION_BY_KIND) as [Kind, string][]) {
    const definition = defaultRegistry.get(type);
    if (!definition) continue;
    const prefix = definition.text[locale].split('{name}')[0] ?? '';
    const defaultName = definition.inputs['name'];
    Reflect.deleteProperty(Blockly.Blocks, type);
    Blockly.Blocks[type] = {
      init(this: DefinitionHolder) {
        this.appendDummyInput()
          .appendField(prefix.trim())
          .appendField(
            new Blockly.FieldTextInput(
              defaultName?.type === 'textField' ? defaultName.default : '',
            ),
            'name',
          )
          .appendField(new Blockly.FieldLabel(''), 'SUMMARY');
        this.setNextStatement(true);
        this.setColour(getCategory('myBlocks').color);
        this.setTooltip(definition.docs[locale]);
        this.bwDefinition = normalizeDefinition({
          returns: kind === 'condition' ? 'boolean' : 'any',
        });
        this.bwParams = [];
      },
      saveExtraState(this: DefinitionHolder): DefinitionState {
        return this.bwDefinition ?? normalizeDefinition({});
      },
      loadExtraState(this: DefinitionHolder, state: unknown) {
        applyDefinition(this, normalizeDefinition(state));
      },
    };
  }
  for (const [kind, type] of Object.entries(CALL_TYPES) as [Kind, string][]) {
    const definition = defaultRegistry.get(type);
    Reflect.deleteProperty(Blockly.Blocks, type);
    Blockly.Blocks[type] = {
      init(this: CallBlock) {
        this.appendDummyInput().appendField(new Blockly.FieldLabel(''), 'LABEL');
        this.setInputsInline(true);
        this.setColour(getCategory('myBlocks').color);
        this.setTooltip(definition?.docs[locale] ?? '');
        if (kind === 'command') {
          this.setPreviousStatement(true);
          this.setNextStatement(true);
        } else {
          this.setOutput(true, kind === 'condition' ? 'Boolean' : null);
        }
      },
      saveExtraState(this: CallBlock): CallState {
        return this.bwState ?? { fn: '', library: '', name: '', params: [] };
      },
      loadExtraState(this: CallBlock, state: unknown) {
        const raw = (typeof state === 'object' && state !== null ? state : {}) as Record<
          string,
          unknown
        >;
        const next: CallState = {
          fn: typeof raw['fn'] === 'string' ? raw['fn'] : '',
          library: typeof raw['library'] === 'string' ? raw['library'] : '',
          name: typeof raw['name'] === 'string' ? raw['name'] : '',
          params: normalizeDefinition({ params: raw['params'] }).params,
        };
        applyCallShape(this, next);
      },
    };
  }
  registerContextMenu();
}

/** Block JSON of a call of a custom block, with a default value in every slot. */
export function callState(custom: FrameCustomBlock): {
  type: string;
  extraState: CallState;
  inputs: Record<string, { shadow: { type: string; fields: Record<string, unknown> } }>;
} {
  const inputs: Record<string, { shadow: { type: string; fields: Record<string, unknown> } }> = {};
  custom.params.forEach((param, index) => {
    if (param.type === 'number') {
      inputs[`ARG${index}`] = { shadow: { type: 'literal.number', fields: { NUM: 0 } } };
    } else if (param.type === 'string') {
      inputs[`ARG${index}`] = { shadow: { type: 'literal.text', fields: { TEXT: '' } } };
    }
  });
  return { type: CALL_TYPES[custom.kind], extraState: stateOf(custom), inputs };
}

/** Block info for the palette: a call of a custom block with a default value in every slot. */
function callInfo(custom: FrameCustomBlock): Blockly.utils.toolbox.BlockInfo {
  const inputs: Record<string, unknown> = {};
  custom.params.forEach((param, index) => {
    if (param.type === 'number') {
      inputs[`ARG${index}`] = { shadow: { type: 'literal.number', fields: { NUM: 0 } } };
    } else if (param.type === 'string') {
      inputs[`ARG${index}`] = { shadow: { type: 'literal.text', fields: { TEXT: '' } } };
    }
  });
  return {
    kind: 'block',
    type: CALL_TYPES[custom.kind],
    extraState: stateOf(custom),
    inputs,
  } as Blockly.utils.toolbox.BlockInfo;
}

/** The contents of the "My Blocks" palette category. */
export function myBlocksFlyout(): Blockly.utils.toolbox.FlyoutItemInfoArray {
  const labels = currentReferences().labels;
  const items: Blockly.utils.toolbox.FlyoutItemInfoArray = [
    { kind: 'button', text: labels.makeBlock, callbackkey: MAKE_BLOCK },
  ];
  for (const custom of hooks.customBlocks) items.push(callInfo(custom));
  for (const id of ['custom.return', 'custom.param']) {
    const definition = defaultRegistry.get(id);
    if (definition) items.push(toolboxBlock(definition));
  }
  return items;
}

/** Registers the palette callbacks of the "My Blocks" category. */
export function registerMyBlocksCategory(
  workspace: Blockly.WorkspaceSvg,
  onMakeBlock: () => void,
): void {
  workspace.registerToolboxCategoryCallback(MY_BLOCKS_FLYOUT, myBlocksFlyout);
  workspace.registerButtonCallback(MAKE_BLOCK, onMakeBlock);
}

/** Visible top-left corner of the workspace, in workspace coordinates. */
function visibleCorner(workspace: Blockly.WorkspaceSvg): { x: number; y: number } {
  const metrics = workspace.getMetrics();
  const scale = workspace.scale || 1;
  return { x: (metrics.viewLeft + 48) / scale, y: (metrics.viewTop + 48) / scale };
}

/** Adds a definition block for a spec to the workspace. */
export function createDefinitionBlock(
  workspace: Blockly.WorkspaceSvg,
  spec: CustomBlockSpec,
): Blockly.BlockSvg {
  const corner = visibleCorner(workspace);
  const block = Blockly.serialization.blocks.append(
    {
      type: DEFINITION_BY_KIND[spec.kind],
      x: corner.x,
      y: corner.y,
      fields: { name: spec.name },
      extraState: definitionExtra(spec),
    },
    workspace,
  ) as Blockly.BlockSvg;
  // A value or condition block starts with the block that gives the result.
  if (spec.kind !== 'command') {
    const result = Blockly.serialization.blocks.append(
      { type: 'custom.return', x: corner.x, y: corner.y + 60 },
      workspace,
    ) as Blockly.BlockSvg;
    block.nextConnection?.connect(result.previousConnection as Blockly.Connection);
  }
  return block;
}

/** Applies an edited spec to a definition block. */
export function updateDefinitionBlock(
  workspace: Blockly.WorkspaceSvg,
  blockId: string,
  spec: CustomBlockSpec,
): void {
  const block = workspace.getBlockById(blockId) as DefinitionHolder | null;
  if (!block) return;
  Blockly.Events.setGroup(true);
  try {
    block.setFieldValue(spec.name, 'name');
    applyDefinition(block, definitionExtra(spec));
  } finally {
    Blockly.Events.setGroup(false);
  }
}

// ------------------------------------------------------------------- context menu

let menuRegistered = false;

function registerContextMenu(): void {
  if (menuRegistered) return;
  menuRegistered = true;
  const registry = Blockly.ContextMenuRegistry.registry;
  const scopeType = Blockly.ContextMenuRegistry.ScopeType.BLOCK;
  registry.register({
    id: 'bw_edit_custom_block',
    scopeType,
    weight: 1,
    displayText: () => currentReferences().labels.editBlock,
    preconditionFn: (scope) =>
      scope.block && DEFINITION_TYPES.includes(scope.block.type) ? 'enabled' : 'hidden',
    callback: (scope) => {
      const block = scope.block as DefinitionHolder | undefined;
      if (block) hooks.onEditBlock(block.id, specOf(block));
    },
  });
  registry.register({
    id: 'bw_go_to_definition',
    scopeType,
    weight: 2,
    displayText: () => currentReferences().labels.goToDefinition,
    preconditionFn: (scope) =>
      scope.block && KIND_OF_CALL[scope.block.type] ? 'enabled' : 'hidden',
    callback: (scope) => {
      const state = scope.block ? callExtra(scope.block as CallBlock) : undefined;
      if (state) hooks.onGoToDefinition(state.library, state.fn);
    },
  });
  registry.register({
    id: 'bw_find_usages',
    scopeType,
    weight: 2.5,
    displayText: () => currentReferences().labels.findUsages,
    preconditionFn: (scope) => (scope.block && usageName(scope.block) ? 'enabled' : 'hidden'),
    callback: (scope) => {
      const name = scope.block ? usageName(scope.block) : null;
      if (name) hooks.onFindUsages(name);
    },
  });
  registry.register({
    id: 'bw_extract_custom_block',
    scopeType,
    weight: 3,
    displayText: () => currentReferences().labels.extractBlock,
    preconditionFn: (scope) => {
      const block = scope.block;
      if (!block || block.isShadow()) return 'hidden';
      if (DEFINITION_TYPES.includes(block.type) || block.type.startsWith('literal.'))
        return 'hidden';
      return canExtract(block) ? 'enabled' : 'disabled';
    },
    callback: (scope) => {
      if (scope.block) void extractAsCustomBlock(scope.block as Blockly.BlockSvg);
    },
  });
}

/** The name a block stands for that the project search can look up: variable, block, message. */
function usageName(block: Blockly.Block): string | null {
  if (KIND_OF_DEFINITION[block.type]) return String(block.getFieldValue('name') ?? '') || null;
  if (KIND_OF_CALL[block.type]) return (block as CallBlock).bwState?.name || null;
  if (block.type === 'events.whenMessage' || block.type === 'control.sendMessage') {
    return String(block.getFieldValue('message') ?? '') || null;
  }
  const variable = block.getField('variable');
  if (variable) return variable.getText() || null;
  return null;
}

// ------------------------------------------------------------------- extract

type Json = Record<string, unknown>;

/** Block JSON built here is checked by Blockly when it is loaded. */
function asState(json: Json): Blockly.serialization.blocks.State {
  return json as unknown as Blockly.serialization.blocks.State;
}

function isStatement(block: Blockly.Block): boolean {
  return block.previousConnection !== null || block.nextConnection !== null;
}

/** A selection can be extracted unless it contains "return" (it would change meaning). */
function canExtract(block: Blockly.Block): boolean {
  const blocks = [block, ...block.getDescendants(false)];
  if (isStatement(block)) {
    for (let next = block.getNextBlock(); next; next = next.getNextBlock()) {
      blocks.push(next, ...next.getDescendants(false));
    }
  }
  return !blocks.some((item) => item.type === 'custom.return');
}

/** Names used, declared and written by a serialized stack of blocks. */
function scan(
  json: Json | undefined,
  read: Set<string>,
  written: Set<string>,
  declared: Set<string>,
  params: Set<string>,
): void {
  if (!json) return;
  const fields = (json['fields'] ?? {}) as Record<string, unknown>;
  const name = typeof fields['name'] === 'string' ? fields['name'] : '';
  switch (json['type']) {
    case 'locals.get':
      read.add(name);
      break;
    case 'locals.set':
    case 'locals.change':
      read.add(name);
      written.add(name);
      break;
    case 'locals.declare':
    case 'data.forEachItem':
      declared.add(name);
      break;
    case 'custom.param':
      params.add(name);
      break;
  }
  const inputs = (json['inputs'] ?? {}) as Record<string, { block?: Json; shadow?: Json }>;
  for (const input of Object.values(inputs)) {
    scan(input.block, read, written, declared, params);
    scan(input.shadow, read, written, declared, params);
  }
  const next = json['next'] as { block?: Json } | undefined;
  scan(next?.block, read, written, declared, params);
}

/** Turns reads of free locals that are never written into reads of parameters. */
function rewriteReads(json: Json | undefined, names: ReadonlySet<string>): void {
  if (!json) return;
  const fields = (json['fields'] ?? {}) as Record<string, unknown>;
  if (
    json['type'] === 'locals.get' &&
    typeof fields['name'] === 'string' &&
    names.has(fields['name'])
  ) {
    json['type'] = 'custom.param';
  }
  const inputs = (json['inputs'] ?? {}) as Record<string, { block?: Json; shadow?: Json }>;
  for (const input of Object.values(inputs)) {
    rewriteReads(input.block, names);
    rewriteReads(input.shadow, names);
  }
  const next = json['next'] as { block?: Json } | undefined;
  rewriteReads(next?.block, names);
}

/**
 * "Extract as custom block": the block (and, for commands, the blocks below it) become a new
 * custom block of this script; the selection is replaced by a call. Local variables the part
 * uses but does not declare, and inputs of the custom block it sits in, become inputs.
 */
export async function extractAsCustomBlock(block: Blockly.BlockSvg): Promise<void> {
  const workspace = block.workspace as Blockly.WorkspaceSvg;
  const name = (await hooks.askName())?.trim();
  if (!name) return;
  const statement = isStatement(block);
  const state = Blockly.serialization.blocks.save(block, {
    addCoordinates: false,
    addInputBlocks: true,
    addNextBlocks: statement,
  }) as Json | null;
  if (!state) return;
  const read = new Set<string>();
  const written = new Set<string>();
  const declared = new Set<string>();
  const used = new Set<string>();
  scan(state, read, written, declared, used);
  const freeLocals = [...read].filter((local) => !declared.has(local));
  const outerParams = paramsInScope(block);
  const readOnly = new Set(freeLocals.filter((local) => !written.has(local)));
  rewriteReads(state, readOnly);
  const parameterNames = [
    ...new Set([...used].filter((param) => outerParams.includes(param)).concat(freeLocals)),
  ];
  const params: FrameParam[] = parameterNames.map((param) => ({ name: param, type: 'any' }));
  const kind: Kind = statement ? 'command' : 'value';
  // Free locals that are written get a local of their own, filled from the input.
  let body: Json | undefined = state;
  if (statement) {
    for (const local of [...written].filter((item) => freeLocals.includes(item)).reverse()) {
      body = {
        type: 'locals.declare',
        fields: { name: local },
        inputs: {
          value: { block: { type: 'custom.param', fields: { name: local } } },
        },
        next: { block: body },
      };
    }
  }
  const spec: CustomBlockSpec = {
    kind,
    name,
    params,
    returns: 'any',
    warp: false,
    scope: 'script',
  };
  Blockly.Events.setGroup(true);
  try {
    const target = statement
      ? block.previousConnection?.targetConnection
      : block.outputConnection?.targetConnection;
    const origin = block.getRelativeToSurfaceXY();
    const corner = visibleCorner(workspace);
    const definition = Blockly.serialization.blocks.append(
      asState({
        type: DEFINITION_BY_KIND[kind],
        x: corner.x,
        y: corner.y,
        fields: { name },
        extraState: definitionExtra(spec),
        next: {
          block: statement ? body : { type: 'custom.return', inputs: { value: { block: state } } },
        },
      }),
      workspace,
    ) as Blockly.BlockSvg;
    const args: Record<string, unknown> = {};
    parameterNames.forEach((param, index) => {
      args[`ARG${index}`] = {
        block: {
          type: freeLocals.includes(param) ? 'locals.get' : 'custom.param',
          fields: { name: param },
        },
      };
    });
    const call = Blockly.serialization.blocks.append(
      asState({
        type: CALL_TYPES[kind],
        x: origin.x,
        y: origin.y,
        extraState: { fn: definition.id, library: '', name, params },
        inputs: args,
      }),
      workspace,
    ) as Blockly.BlockSvg;
    block.dispose(false);
    if (target) {
      target.connect(
        statement
          ? (call.previousConnection as Blockly.Connection)
          : (call.outputConnection as Blockly.Connection),
      );
    }
  } finally {
    Blockly.Events.setGroup(false);
  }
}

/** Number of definitions in a workspace (used by tests through the frame). */
export function definitionCount(workspace: Blockly.Workspace): number {
  return workspace.getAllBlocks(false).filter((block) => DEFINITION_TYPES.includes(block.type))
    .length;
}

export { localsInScope };
