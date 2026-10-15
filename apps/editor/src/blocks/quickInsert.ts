import {
  buildSearchIndex,
  defaultRegistry,
  ExpressionError,
  expressionToBlocks,
  isPlainNumber,
  looksLikeExpression,
  searchBlocks,
  toolboxBlock,
} from '@blockwerk/blocks';
import type { BlockSearchEntry, BlockState, ExpressionScope, Locale } from '@blockwerk/blocks';
import * as Blockly from 'blockly/core';
import { callState, currentCustomBlocks } from './customBlocks';
import type { FrameCustomBlock, FrameVariable } from './frameApi';
import { currentReferences } from './referenceField';
import { localsInScope, paramsInScope } from './scopedNameField';

/** What the quick insert needs to know about the editor. */
export interface QuickInsertContext {
  readonly workspace: Blockly.WorkspaceSvg;
  readonly locale: () => Locale;
  readonly variables: () => readonly FrameVariable[];
}

/** One line of the result list: a block to insert or an expression to build. */
interface Choice {
  readonly label: string;
  readonly state: () => BlockState;
}

/** Block JSON built here is checked by Blockly when it is loaded. */
function asState(state: unknown): Blockly.serialization.blocks.State {
  return state as Blockly.serialization.blocks.State;
}

/** The names an expression typed at a block may use. */
function scopeAt(
  block: Blockly.Block | null,
  variables: readonly FrameVariable[],
): ExpressionScope {
  const locals = block ? localsInScope(block) : [];
  const params = block ? paramsInScope(block) : [];
  return {
    variable: (name) =>
      variables.find((variable) => variable.name.toLowerCase() === name.toLowerCase())?.id ?? null,
    local: (name) => locals.includes(name),
    param: (name) => params.includes(name),
  };
}

// ------------------------------------------------------------------- toast

let toastTimer: number | undefined;

/** Shows a short message in the corner of the workspace (for expressions that do not parse). */
function toast(message: string): void {
  let element = document.getElementById('bw-toast');
  if (!element) {
    element = document.createElement('div');
    element.id = 'bw-toast';
    document.body.appendChild(element);
  }
  element.textContent = message;
  element.dataset['visible'] = 'true';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (element) element.dataset['visible'] = 'false';
  }, 4000);
}

// ------------------------------------------------------------------- number field

/**
 * The number inside a slot (`field_bw_number`). Typing an expression such as `x/2 + 10` instead
 * of a number builds the operator blocks and plugs them into the slot (SPEC 7.8).
 */
export class FieldExpressionNumber extends Blockly.FieldNumber {
  private static variables: () => readonly FrameVariable[] = () => [];

  /** Where the names in typed expressions come from (set by the frame). */
  static setVariableProvider(provider: () => readonly FrameVariable[]): void {
    FieldExpressionNumber.variables = provider;
  }

  protected override widgetDispose_(): void {
    const raw = this.htmlInput_?.value ?? '';
    super.widgetDispose_();
    if (raw.trim() !== '' && !isPlainNumber(raw)) {
      const block = this.getSourceBlock();
      // Blockly is still closing the editor; build the blocks right after.
      if (block) window.setTimeout(() => this.convert(block, raw), 0);
    }
  }

  private convert(block: Blockly.Block, raw: string): void {
    const target = block.outputConnection?.targetConnection;
    const workspace = block.workspace as Blockly.WorkspaceSvg;
    const parent = block.getParent();
    try {
      const state = expressionToBlocks(
        raw,
        scopeAt(parent ?? block, FieldExpressionNumber.variables()),
      );
      Blockly.Events.setGroup(true);
      try {
        const built = Blockly.serialization.blocks.append(
          asState(state),
          workspace,
        ) as Blockly.BlockSvg;
        if (target && built.outputConnection) target.connect(built.outputConnection);
        Blockly.common.setSelected(built);
      } finally {
        Blockly.Events.setGroup(false);
      }
    } catch (error) {
      toast(error instanceof ExpressionError ? `${raw}: ${error.message}` : String(error));
    }
  }

  static override fromJson(options: Blockly.FieldNumberFromJsonConfig): FieldExpressionNumber {
    return new FieldExpressionNumber(options.value, options.min, options.max, options.precision);
  }
}

let numberRegistered = false;

/** Registers the expression number field with Blockly (once per page). */
export function registerExpressionNumberField(): void {
  if (numberRegistered) return;
  numberRegistered = true;
  Blockly.fieldRegistry.register('field_bw_number', FieldExpressionNumber);
}

// ------------------------------------------------------------------- insertion

/** Visible top-left corner of the workspace, in workspace coordinates. */
function corner(workspace: Blockly.WorkspaceSvg): { x: number; y: number } {
  const metrics = workspace.getMetrics();
  const scale = workspace.scale || 1;
  const stagger = (workspace.getTopBlocks(false).length % 6) * 24;
  return {
    x: (metrics.viewLeft + 64) / scale + stagger,
    y: (metrics.viewTop + 64) / scale + stagger,
  };
}

/** The first value slot at or below a block that can take the new block. */
function freeSlot(root: Blockly.Block, output: Blockly.Connection): Blockly.Connection | null {
  for (const block of [root, ...root.getDescendants(true)]) {
    if (block.isShadow()) continue;
    for (const input of block.inputList) {
      const connection = input.connection;
      if (!connection || connection.type !== Blockly.ConnectionType.INPUT_VALUE) continue;
      const current = connection.targetBlock();
      if (current && !current.isShadow()) continue;
      if (connection.getConnectionChecker().canConnect(connection, output, false))
        return connection;
    }
  }
  return null;
}

/** Puts a new block where the user is working: below or into the selected block, or free. */
function place(workspace: Blockly.WorkspaceSvg, block: Blockly.BlockSvg): void {
  const selected = Blockly.common.getSelected() as Blockly.BlockSvg | null;
  let placed = false;
  if (selected && selected.workspace === workspace && !selected.isShadow()) {
    if (block.outputConnection) {
      const slot = freeSlot(selected, block.outputConnection);
      if (slot) {
        slot.connect(block.outputConnection);
        placed = true;
      }
    } else if (block.previousConnection) {
      // A C block that is still empty takes the new block inside.
      const body = selected.inputList.find(
        (input) => input.connection?.type === Blockly.ConnectionType.NEXT_STATEMENT,
      );
      if (body?.connection && !body.connection.targetBlock()) {
        body.connection.connect(block.previousConnection);
        placed = true;
      } else if (selected.nextConnection) {
        selected.nextConnection.connect(block.previousConnection);
        placed = true;
      }
    }
  }
  if (!placed) {
    const at = corner(workspace);
    block.moveBy(at.x - block.getRelativeToSurfaceXY().x, at.y - block.getRelativeToSurfaceXY().y);
  }
}

/** Starts editing the first text or number field of a block (so the next typing fills it). */
function editFirstField(block: Blockly.BlockSvg): void {
  for (const candidate of [block, ...block.getDescendants(true)]) {
    for (const input of candidate.inputList) {
      for (const field of input.fieldRow) {
        if (
          (field instanceof Blockly.FieldTextInput || field instanceof Blockly.FieldNumber) &&
          field.isClickable()
        ) {
          field.showEditor();
          return;
        }
      }
    }
  }
}

/** Creates a block from its JSON and puts it in place. */
function insert(workspace: Blockly.WorkspaceSvg, state: BlockState): Blockly.BlockSvg {
  Blockly.Events.setGroup(true);
  try {
    const block = Blockly.serialization.blocks.append(
      asState(state),
      workspace,
    ) as Blockly.BlockSvg;
    place(workspace, block);
    Blockly.common.setSelected(block);
    return block;
  } finally {
    Blockly.Events.setGroup(false);
  }
}

// ------------------------------------------------------------------- search

function paramLabel(custom: FrameCustomBlock): string {
  return custom.params.length === 0
    ? custom.name
    : `${custom.name} (${custom.params.map((p) => p.name).join(', ')})`;
}

/** All choices for a typed text. */
function choicesFor(query: string, context: QuickInsertContext): Choice[] {
  const locale = context.locale();
  const text = query.trim();
  const choices: Choice[] = [];
  if (looksLikeExpression(text)) {
    choices.push({
      label: `= ${text}`,
      state: () =>
        expressionToBlocks(
          text,
          scopeAt(Blockly.common.getSelected() as Blockly.Block | null, context.variables()),
        ),
    });
  }
  const index: BlockSearchEntry[] = buildSearchIndex(defaultRegistry, locale).filter(
    (entry) => !entry.id.startsWith('literal.') && !entry.id.startsWith('custom.'),
  );
  const extra = new Map<string, () => BlockState>();
  for (const variable of context.variables()) {
    const label = variable.name;
    const words = label
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const add = (id: string, entryLabel: string, state: () => BlockState): void => {
      index.push({ id, label: entryLabel, terms: words });
      extra.set(id, state);
    };
    add(`get:${variable.id}`, label, () => ({
      type: 'variables.get',
      fields: { variable: { id: variable.id } },
    }));
    for (const type of ['variables.set', 'variables.change']) {
      const definition = defaultRegistry.get(type);
      if (!definition) continue;
      const entryLabel = definition.text[locale]
        .replace('{variable}', variable.name)
        .replace(/\{[^}]+\}/g, '( )');
      add(`${type}:${variable.id}`, entryLabel, () => ({
        ...(toolboxBlock(definition) as BlockState),
        fields: { variable: { id: variable.id } },
      }));
    }
  }
  currentCustomBlocks().forEach((custom, position) => {
    const words = custom.name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const id = `call:${position}`;
    index.push({ id, label: paramLabel(custom), terms: words });
    extra.set(id, () => callState(custom));
  });
  for (const entry of searchBlocks(index, text).slice(0, 8)) {
    const make = extra.get(entry.id);
    if (make) {
      choices.push({ label: entry.label, state: make });
      continue;
    }
    const definition = defaultRegistry.get(entry.id);
    if (definition) {
      choices.push({ label: entry.label, state: () => toolboxBlock(definition) as BlockState });
    }
  }
  return choices;
}

// ------------------------------------------------------------------- popup

/** Installs "type to find a block" on a workspace (SPEC 7.8). Returns the remover. */
export function installQuickInsert(context: QuickInsertContext): () => void {
  const { workspace } = context;
  let box: HTMLDivElement | null = null;
  let choices: Choice[] = [];
  let selected = 0;
  /** The block that was selected when the popup opened (closing the popup moves the focus). */
  let before: Blockly.ISelectable | null = null;

  const close = (): void => {
    box?.remove();
    box = null;
    workspace.markFocused();
  };

  const draw = (list: HTMLElement): void => {
    list.replaceChildren(
      ...choices.map((choice, position) => {
        const item = document.createElement('li');
        item.textContent = choice.label;
        item.dataset['selected'] = String(position === selected);
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
          apply(position);
        });
        return item;
      }),
    );
  };

  const apply = (position: number): void => {
    const choice = choices[position];
    if (!choice) return;
    let state: BlockState;
    try {
      state = choice.state();
    } catch (error) {
      toast(error instanceof ExpressionError ? error.message : String(error));
      return;
    }
    close();
    if (before) Blockly.common.setSelected(before);
    const block = insert(workspace, state);
    editFirstField(block);
  };

  const open = (first: string): void => {
    before = Blockly.common.getSelected();
    box = document.createElement('div');
    box.className = 'bw-quick';
    box.dataset['testid'] = 'quick-insert';
    const input = document.createElement('input');
    input.placeholder = currentReferences().labels.quickInsert;
    input.dataset['testid'] = 'quick-insert-input';
    const list = document.createElement('ul');
    box.append(input, list);
    document.body.appendChild(box);
    const update = (): void => {
      choices = choicesFor(input.value, context);
      selected = 0;
      draw(list);
    };
    input.addEventListener('input', update);
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (choices.length > 0) {
          selected =
            (selected + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
          draw(list);
        }
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        apply(selected);
      }
    });
    input.addEventListener('blur', () => window.setTimeout(() => box && close(), 150));
    input.value = first;
    input.focus();
    update();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (box || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (event.key === ' ') return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    )
      return;
    if (Blockly.WidgetDiv.isVisible() || Blockly.DropDownDiv.isVisible()) return;
    event.preventDefault();
    open(event.key);
  };
  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    box?.remove();
    box = null;
  };
}
