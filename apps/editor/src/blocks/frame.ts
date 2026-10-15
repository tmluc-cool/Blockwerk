import './frame.css';
import { defaultRegistry, toolboxBlock, VARIABLES_FLYOUT } from '@blockwerk/blocks';
import type { AreaKind, Locale } from '@blockwerk/blocks';
import { registerFieldColour } from '@blockly/field-colour';
import * as Blockly from 'blockly/core';
import type { Theme } from '../state/settings';
import {
  createDefinitionBlock,
  refreshCalls,
  registerMyBlocksCategory,
  setCustomHooks,
  updateDefinitionBlock,
} from './customBlocks';
import {
  FieldExpressionNumber,
  installQuickInsert,
  registerExpressionNumberField,
} from './quickInsert';
import { registerScopedNameField } from './scopedNameField';
import { blocklyTheme, defineBlocks, toolboxFor } from './blocklySetup';
import type { BlockFrameController, BlockFrameOptions, FrameVariable } from './frameApi';
import {
  currentReferences,
  FieldReference,
  registerReferenceField,
  setReferences,
} from './referenceField';

const CREATE_VARIABLE = 'BW_CREATE_VARIABLE';
const EMPTY_WORKSPACE = '{"blocks":{"languageVersion":0,"blocks":[]}}';
const VARIABLE_BLOCKS = ['variables.set', 'variables.change', 'variables.show', 'variables.hide'];

registerFieldColour();
registerReferenceField();
registerScopedNameField();
registerExpressionNumberField();

/** Creates the Blockly workspace in this page and connects it to the editor. */
function mount(options: BlockFrameOptions): BlockFrameController {
  const host = document.getElementById('blockly');
  if (!host) throw new Error('Block frame has no #blockly element.');
  let locale: Locale = options.locale;
  let theme: Theme = options.theme;
  let area: AreaKind | null = options.area;
  let state = options.state;
  let variables: readonly FrameVariable[] = options.variables;
  let workspace: Blockly.WorkspaceSvg | null = null;
  let loading = false;
  let customJson = JSON.stringify(options.customBlocks);
  let running: Blockly.BlockSvg[] = [];
  let removeQuickInsert: (() => void) | null = null;
  FieldExpressionNumber.setVariableProvider(() => variables);
  setReferences(options.references);
  setCustomHooks({
    customBlocks: options.customBlocks,
    onEditBlock: options.onEditBlock,
    onGoToDefinition: options.onGoToDefinition,
    askName: options.askName,
    onFindUsages: options.onFindUsages,
  });

  const save = (): void => {
    if (!workspace || loading || state === null) return;
    const json = Blockly.serialization.workspaces.save(workspace) as Record<string, unknown>;
    // Variables are kept by the editor next to the workspace (with type and scope).
    Reflect.deleteProperty(json, 'variables');
    state = JSON.stringify(json);
    options.onChange(state);
  };

  const reportVariables = (): void => {
    if (!workspace || loading) return;
    const current = workspace
      .getVariableMap()
      .getAllVariables()
      .map((variable) => ({ id: variable.getId(), name: variable.getName() }));
    variables = current;
    options.onVariablesChange(current);
  };

  const syncVariables = (): void => {
    if (!workspace) return;
    const map = workspace.getVariableMap();
    const wasLoading = loading;
    loading = true;
    try {
      for (const variable of variables) {
        const existing = map.getVariableById(variable.id);
        if (!existing) map.createVariable(variable.name, '', variable.id);
        else if (existing.getName() !== variable.name) map.renameVariable(existing, variable.name);
      }
      for (const existing of map.getAllVariables()) {
        if (!variables.some((variable) => variable.id === existing.getId()))
          map.deleteVariable(existing);
      }
    } finally {
      loading = wasLoading;
    }
    workspace.refreshToolboxSelection();
  };

  const variablesFlyout = (): Blockly.utils.toolbox.FlyoutItemInfoArray => {
    const labels = currentReferences().labels;
    const items: Blockly.utils.toolbox.FlyoutItemInfoArray = [
      { kind: 'button', text: labels.createVariable, callbackkey: CREATE_VARIABLE },
    ];
    const first = variables[0];
    if (!first) {
      items.push({ kind: 'label', text: labels.noVariables });
      return items;
    }
    for (const variable of variables) {
      items.push({
        kind: 'block',
        type: 'variables.get',
        fields: { variable: { id: variable.id } },
      });
    }
    for (const type of VARIABLE_BLOCKS) {
      const definition = defaultRegistry.get(type);
      if (!definition) continue;
      items.push({ ...toolboxBlock(definition), fields: { variable: { id: first.id } } });
    }
    return items;
  };

  const loadState = (): void => {
    if (!workspace) return;
    loading = true;
    try {
      workspace.clear();
      syncVariables();
      Blockly.serialization.workspaces.load(
        JSON.parse(state ?? EMPTY_WORKSPACE) as object,
        workspace,
        {
          recordUndo: false,
        },
      );
      syncVariables();
      workspace.clearUndo();
    } finally {
      loading = false;
    }
    document.body.dataset['empty'] = state === null ? 'true' : 'false';
    // Calls follow the definitions as they are now (they may have changed in another script).
    if (refreshCalls(workspace)) save();
  };

  const create = (): void => {
    defineBlocks(locale);
    document.body.dataset['theme'] = theme;
    document.documentElement.lang = locale;
    const created = Blockly.inject(host, {
      toolbox: toolboxFor(locale, area),
      renderer: 'zelos',
      media: 'blockly-media/',
      theme: blocklyTheme(theme),
      trashcan: true,
      sounds: false,
      readOnly: false,
      grid: { spacing: 24, length: 2, colour: '#4a4f5a', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    created.registerToolboxCategoryCallback(VARIABLES_FLYOUT, variablesFlyout);
    created.registerButtonCallback(CREATE_VARIABLE, () => options.onCreateVariable());
    registerMyBlocksCategory(created, () => options.onMakeBlock());
    workspace = created;
    removeQuickInsert = installQuickInsert({
      workspace: created,
      locale: () => locale,
      variables: () => variables,
    });
    loadState();
    created.addChangeListener((event: Blockly.Events.Abstract) => {
      if (loading) return;
      if (
        event.type === Blockly.Events.VAR_CREATE ||
        event.type === Blockly.Events.VAR_RENAME ||
        event.type === Blockly.Events.VAR_DELETE
      ) {
        reportVariables();
      }
      if (!event.isUiEvent) save();
    });
  };

  const destroy = (): void => {
    removeQuickInsert?.();
    removeQuickInsert = null;
    if (!workspace) return;
    workspace.dispose();
    workspace = null;
    running = [];
  };

  const onResize = (): void => {
    if (workspace) Blockly.svgResize(workspace);
  };
  const onKeyDown = (event: KeyboardEvent): void => options.onKeyDown(event);
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  create();

  return {
    setLocale(next) {
      if (next === locale) return;
      // Blocks get their texts when they are created, so the workspace is rebuilt.
      destroy();
      locale = next;
      create();
    },
    setTheme(next) {
      theme = next;
      document.body.dataset['theme'] = next;
      workspace?.setTheme(blocklyTheme(next));
    },
    setArea(next) {
      area = next;
      workspace?.updateToolbox(toolboxFor(locale, next));
    },
    load(next, nextVariables) {
      state = next;
      variables = nextVariables;
      loadState();
    },
    setVariables(next) {
      variables = next;
      syncVariables();
    },
    setReferences(next) {
      setReferences(next);
      for (const block of workspace?.getAllBlocks(false) ?? []) {
        for (const input of block.inputList) {
          for (const field of input.fieldRow) if (field instanceof FieldReference) field.refresh();
        }
      }
      workspace?.refreshToolboxSelection();
    },
    setCustomBlocks(blocks) {
      const json = JSON.stringify(blocks);
      if (json === customJson) return;
      customJson = json;
      setCustomHooks({ customBlocks: blocks });
      if (workspace && refreshCalls(workspace)) save();
      workspace?.refreshToolboxSelection();
    },
    createDefinition(spec) {
      if (workspace) createDefinitionBlock(workspace, spec);
    },
    updateDefinition(blockId, spec) {
      if (!workspace) return;
      updateDefinitionBlock(workspace, blockId, spec);
      save();
    },
    setRunning(hatIds) {
      for (const block of running) block.removeClass('bw-running');
      running = [];
      for (const id of hatIds) {
        const hat = workspace?.getBlockById(id);
        if (!hat) continue;
        for (const block of hat.getDescendants(false)) {
          block.addClass('bw-running');
          running.push(block);
        }
      }
    },
    reveal(blockId) {
      const block = workspace?.getBlockById(blockId);
      if (!workspace || !block) return;
      workspace.centerOnBlock(blockId);
      Blockly.common.setSelected(block);
    },
    dispose() {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      destroy();
    },
  };
}

window.blockwerkBlockFrame = { mount };
