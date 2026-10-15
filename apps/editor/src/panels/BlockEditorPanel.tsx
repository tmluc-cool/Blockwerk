import {
  assetDisplayName,
  createId,
  renameGameVariable,
  sharedGameVariables,
  updateGameVariable,
  adoptGameVariable,
  VARIABLE_TYPES,
} from '@blockwerk/project';
import type { BlockScriptData, SceneData, VariableData } from '@blockwerk/project';
import { BUILTIN_SOUNDS } from '@blockwerk/runtime';
import type { IDockviewPanelProps } from 'dockview-react';
import { Code2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { compileProject, workspaceSignatures } from '@blockwerk/compiler';
import type {
  BlockFrameController,
  CustomBlockSpec,
  FrameCustomBlock,
  FrameReferences,
  FrameVariable,
} from '../blocks/frameApi';
import { createAssetWithPrompt } from '../chrome/menus';
import { hierarchyOrder } from '../document/sceneOps';
import { objectName } from '../scene/worlds';
import { openSearch } from '../navigation';
import { handleShortcut } from '../shortcuts';
import { editCustomBlock, prompt } from '../state/dialogs';
import { BUILT_IN_TAGS, updateBlockScript, useDocument } from '../state/document';
import { activeObjectId, paletteArea, useEditor } from '../state/editor';
import { currentGame, usePlay } from '../state/play';
import { t as translateNow, useSettings, useT } from '../state/settings';
import type { TranslationKey } from '../i18n';

type ScriptEntry = { id: string; data: BlockScriptData; name: string };

/** Scripts that ran within this many ticks still glow (a quarter second). */
const GLOW_TICKS = 15;

function openScriptEntry(): ScriptEntry | null {
  const { project } = useDocument.getState();
  const assetId = useEditor.getState().openScript?.assetId;
  const entry = assetId ? project?.assetOfType(assetId, 'blockScript') : undefined;
  return entry ? { id: entry.id, data: entry.data, name: assetDisplayName(entry.path) } : null;
}

function workspaceJson(entry: ScriptEntry | null): string | null {
  return entry ? JSON.stringify(entry.data.workspace) : null;
}

function frameVariables(entry: ScriptEntry | null): FrameVariable[] {
  return (entry?.data.variables ?? []).map((variable) => ({
    id: variable.id,
    name: variable.name,
  }));
}

/** Objects and tags of the scene for scene reference dropdowns. */
function references(scene: SceneData | null): FrameReferences {
  const t = translateNow;
  const project = useDocument.getState().project;
  const objects = scene
    ? hierarchyOrder(scene)
        .map((id) => ({ id, object: scene.objects[id] }))
        .filter((entry) => entry.object && !entry.object.area)
        .map((entry) => ({
          id: entry.id,
          name: entry.object ? objectName(entry.object, entry.id) : '',
        }))
    : [];
  const tags = new Set<string>([
    ...BUILT_IN_TAGS.filter((tag) => tag !== 'Untagged'),
    ...(project?.tagsAndLayers.tags ?? []),
  ]);
  for (const object of Object.values(scene?.objects ?? {}))
    if (object.tag !== 'Untagged') tags.add(object.tag);
  const prefabs = (project?.assetsOfType('prefab') ?? []).map((asset) => ({
    id: asset.id,
    name: assetDisplayName(asset.path),
  }));
  const dialogs = (project?.assetsOfType('dialog') ?? []).map((asset) => ({
    id: asset.id,
    name: assetDisplayName(asset.path),
  }));
  const scenes = (project?.assetsOfType('scene') ?? []).map((asset) => ({
    id: asset.id,
    name: assetDisplayName(asset.path),
  }));
  const uis = (project?.assetsOfType('ui') ?? []).map((asset) => ({
    id: asset.id,
    name: assetDisplayName(asset.path),
  }));
  const sounds = [
    ...BUILTIN_SOUNDS.map((name) => ({
      value: `builtin:${name}`,
      name: t(`sound.builtin.${name}` as TranslationKey),
    })),
    ...(project?.assetsOfType('audio') ?? []).map((asset) => ({
      value: `audio:${asset.id}`,
      name: assetDisplayName(asset.path),
    })),
  ];
  return {
    objects,
    tags: [...tags].sort(),
    prefabs,
    dialogs,
    scenes,
    uis,
    sounds,
    labels: {
      self: t('reference.self'),
      any: t('reference.any'),
      mouse: t('reference.mouse'),
      origin: t('reference.origin'),
      all: t('reference.all'),
      loop: t('reference.loop'),
      tag: t('reference.tag'),
      missing: t('reference.missing'),
      choosePrefab: t('reference.choosePrefab'),
      chooseDialog: t('reference.chooseDialog'),
      chooseScene: t('reference.chooseScene'),
      chooseUi: t('reference.chooseUi'),
      createVariable: t('blockEditor.createVariable'),
      noVariables: t('blockEditor.noVariables'),
      makeBlock: t('blocks.makeBlock'),
      editBlock: t('blocks.editBlock'),
      goToDefinition: t('blocks.goToDefinition'),
      findUsages: t('blocks.findUsages'),
      extractBlock: t('blocks.extractBlock'),
      missingBlock: t('blocks.missingBlock'),
      noInput: t('blocks.noInput'),
      quickInsert: t('blocks.quickInsert'),
    },
  };
}

/**
 * The custom blocks the script can call: everything it defines itself and the blocks other
 * scripts offer to the whole project (SPEC 7.6).
 */
function customBlocksFor(entry: ScriptEntry | null): FrameCustomBlock[] {
  const { project } = useDocument.getState();
  if (!entry || !project) return [];
  const result: FrameCustomBlock[] = [];
  for (const script of project.assetsOfType('blockScript')) {
    const own = script.id === entry.id;
    for (const signature of workspaceSignatures(script.data.workspace, script.id)) {
      if (!own && signature.scope !== 'project') continue;
      result.push({
        fn: signature.blockId,
        library: own ? '' : script.id,
        name: signature.name,
        kind: signature.kind,
        params: signature.params.map((param) => ({ name: param.name, type: param.type })),
        returns: signature.returns ?? 'any',
      });
    }
  }
  return result;
}

/** A blank spec for "Make a block". */
function newBlockSpec(): CustomBlockSpec {
  return { kind: 'command', name: '', params: [], returns: 'any', warp: false, scope: 'script' };
}

function activeAreaKind() {
  const { activeAreaId } = useEditor.getState();
  return paletteArea(useDocument.getState().scene?.objects[activeAreaId]?.area);
}

function setVariables(entry: ScriptEntry, variables: VariableData[]): void {
  updateBlockScript(entry.id, { ...entry.data, variables });
}

/** All block scripts of the project. */
function allScripts(): { id: string; data: BlockScriptData }[] {
  const { project } = useDocument.getState();
  return (project?.assetsOfType('blockScript') ?? []).map((entry) => ({
    id: entry.id,
    data: entry.data,
  }));
}

/** Applies the new data of several scripts (a game variable lives in all of them). */
function applyToScripts(changed: Map<string, BlockScriptData>): void {
  for (const [id, data] of changed) updateBlockScript(id, data);
}

/** Asks for a name and adds a variable to the open script. */
function createVariable(): void {
  const entry = openScriptEntry();
  if (!entry) return;
  void prompt(translateNow('blockEditor.variableName')).then((name) => {
    const current = openScriptEntry();
    if (!current || !name?.trim()) return;
    setVariables(current, [
      ...current.data.variables,
      {
        id: createId(),
        name: name.trim(),
        type: 'number',
        scope: 'object',
        default: 0,
        inspector: false,
      },
    ]);
  });
}

/** The start value of a variable of a type. */
function defaultFor(type: VariableData['type']): VariableData['default'] {
  switch (type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'list':
      return [];
    case 'dictionary':
      return {};
    case 'string':
      return '';
  }
}

function VariablesPanel({ entry, disabled }: { entry: ScriptEntry; disabled: boolean }) {
  const t = useT();
  const update = (id: string, change: Partial<VariableData>): void => {
    const current = entry.data.variables.find((variable) => variable.id === id);
    if (!current) return;
    const next = { ...current, ...change };
    // Keep the default value in the variable's type.
    if (change.type) next.default = defaultFor(change.type);
    if (next.scope === 'game' || next.type === 'list' || next.type === 'dictionary')
      next.inspector = false;
    if (current.scope === 'game' && next.scope === 'game') {
      // A game variable is one variable for the whole project: every script that declares it
      // changes with it ("Rename everywhere").
      const scripts = allScripts();
      if (change.name !== undefined) applyToScripts(renameGameVariable(scripts, id, change.name));
      if (change.type !== undefined || change.default !== undefined || change.saved !== undefined) {
        applyToScripts(
          updateGameVariable(scripts, id, {
            type: next.type,
            default: next.default,
            ...(next.saved === undefined ? {} : { saved: next.saved }),
          }),
        );
      }
      return;
    }
    setVariables(
      entry,
      entry.data.variables.map((variable) => (variable.id === id ? next : variable)),
    );
  };
  // Game variables that other scripts declare and this one does not use yet.
  const available = sharedGameVariables(allScripts()).filter(
    (shared) => !entry.data.variables.some((variable) => variable.id === shared.variable.id),
  );
  return (
    <aside className="variables-panel" data-testid="variables-panel">
      <div className="variables-header">
        <strong>{t('blockEditor.variables')}</strong>
        <button
          type="button"
          className="icon-button"
          title={t('blockEditor.createVariable')}
          data-testid="add-variable"
          disabled={disabled}
          onClick={createVariable}
        >
          <Plus size={14} />
        </button>
      </div>
      {entry.data.variables.length === 0 && (
        <div className="empty-hint small">{t('blockEditor.noVariables')}</div>
      )}
      {entry.data.variables.map((variable) => (
        <div
          key={variable.id}
          className="variable-card"
          data-testid={`variable-card-${variable.name}`}
        >
          <div className="variable-row">
            <input
              className="variable-name"
              defaultValue={variable.name}
              key={variable.name}
              aria-label={t('blockEditor.variableName')}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name && name !== variable.name) update(variable.id, { name });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <button
              type="button"
              className="icon-button flat"
              title={t('blockEditor.deleteVariable')}
              disabled={disabled}
              onClick={() =>
                setVariables(
                  entry,
                  entry.data.variables.filter((item) => item.id !== variable.id),
                )
              }
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="variable-row">
            <select
              value={variable.type}
              aria-label={t('blockEditor.variableType')}
              onChange={(event) =>
                update(variable.id, { type: event.target.value as VariableData['type'] })
              }
            >
              {VARIABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`variableType.${type}` as TranslationKey)}
                </option>
              ))}
            </select>
            <select
              value={variable.scope}
              aria-label={t('blockEditor.variableScope')}
              data-testid="variable-scope"
              onChange={(event) =>
                update(variable.id, { scope: event.target.value as VariableData['scope'] })
              }
            >
              <option value="object">{t('variableScope.object')}</option>
              <option value="game">{t('variableScope.game')}</option>
            </select>
          </div>
          <div className="variable-row">
            <span className="muted">{t('blockEditor.default')}</span>
            {variable.type === 'list' || variable.type === 'dictionary' ? (
              <span className="muted">{variable.type === 'list' ? '[ ]' : '{ }'}</span>
            ) : variable.type === 'boolean' ? (
              <input
                type="checkbox"
                checked={variable.default === true}
                onChange={(event) => update(variable.id, { default: event.target.checked })}
              />
            ) : (
              <input
                className="variable-default"
                defaultValue={String(variable.default)}
                key={String(variable.default)}
                onBlur={(event) => {
                  const raw = event.target.value;
                  const value = variable.type === 'number' ? Number(raw.replace(',', '.')) : raw;
                  if (variable.type === 'number' && !Number.isFinite(value)) return;
                  if (value !== variable.default) update(variable.id, { default: value });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            )}
          </div>
          <label className="variable-row inspector-toggle">
            <input
              type="checkbox"
              checked={variable.inspector}
              disabled={
                variable.scope === 'game' ||
                variable.type === 'list' ||
                variable.type === 'dictionary'
              }
              data-testid="variable-inspector"
              onChange={(event) => update(variable.id, { inspector: event.target.checked })}
            />
            {t('blockEditor.showInInspector')}
          </label>
          <label className="variable-row inspector-toggle" title={t('variable.savedHelp')}>
            <input
              type="checkbox"
              checked={variable.saved === true}
              disabled={variable.scope !== 'game'}
              data-testid="variable-saved"
              onChange={(event) => update(variable.id, { saved: event.target.checked })}
            />
            {t('variable.saved')}
          </label>
        </div>
      ))}
      {available.length > 0 && (
        <div className="variable-shared" data-testid="shared-variables">
          <div className="muted small">{t('blockEditor.sharedVariables')}</div>
          {available.map((shared) => (
            <button
              key={shared.variable.id}
              type="button"
              className="variable-use"
              title={t('blockEditor.useVariable')}
              data-testid={`use-variable-${shared.variable.name}`}
              onClick={() => {
                const data = adoptGameVariable(entry.data, shared.variable);
                if (data) updateBlockScript(entry.id, data);
              }}
            >
              <Plus size={12} /> {shared.variable.name}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

/**
 * The JavaScript the blocks of the open script turn into (SPEC 7.9), read-only. A line belongs to
 * the block it came from: clicking a line selects the block, and selecting a block marks its lines.
 */
function CodeView({
  entry,
  selectedBlock,
  onLine,
}: {
  entry: ScriptEntry;
  selectedBlock: string | null;
  onLine: (blockId: string) => void;
}) {
  const t = useT();
  const assetsVersion = useDocument((state) => state.assetsVersion);
  const generated = useMemo(() => {
    const { project } = useDocument.getState();
    const scripts = (project?.assetsOfType('blockScript') ?? []).map((script) => ({
      assetId: script.id,
      assetName: assetDisplayName(script.path),
      workspace: script.data.workspace,
      variables: script.data.variables,
    }));
    try {
      return compileProject(scripts).get(entry.id) ?? null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the data of the script changes with assetsVersion
  }, [entry.id, assetsVersion]);
  const lines = generated?.code.split('\n') ?? [];
  return (
    <aside className="code-view" data-testid="code-view">
      <div className="variables-header">
        <strong>{t('blockEditor.codeView')}</strong>
        <span className="muted small">{t('blockEditor.codeViewReadOnly')}</span>
      </div>
      <pre className="code-lines">
        {lines.map((line, index) => {
          const blockId = generated?.lineToBlock[index] ?? null;
          return (
            <div
              key={index}
              className="code-line"
              data-block={blockId ?? undefined}
              data-selected={blockId !== null && blockId === selectedBlock}
              onClick={() => blockId && onLine(blockId)}
            >
              <span className="code-number">{index + 1}</span>
              {line || ' '}
            </div>
          );
        })}
      </pre>
    </aside>
  );
}

/**
 * Block editor window (SPEC 5.9). Blockly runs in its own page (`blocks.html`) inside an iframe,
 * so it keeps working when the window is floated or detached to a second screen. The header
 * names the edited block script and object; the variables list is on the right.
 */
export function BlockEditorPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const controllerRef = useRef<BlockFrameController | null>(null);
  const shownRef = useRef<{ id: string | null; data: BlockScriptData | null }>({
    id: null,
    data: null,
  });
  const locale = useSettings((state) => state.locale);
  const theme = useSettings((state) => state.theme);
  const project = useDocument((state) => state.project);
  const scene = useDocument((state) => state.scene);
  const assetsVersion = useDocument((state) => state.assetsVersion);
  const openScript = useEditor((state) => state.openScript);
  const selectionActive = useEditor(activeObjectId);
  const revealBlock = useEditor((state) => state.revealBlock);
  const [codeView, setCodeView] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const status = usePlay((state) => state.status);
  const playFrame = usePlay((state) => state.frame);
  const areaKind = useEditor((state) =>
    paletteArea(useDocument.getState().scene?.objects[state.activeAreaId]?.area),
  );

  // Without an explicitly opened script, show the script of the selected object.
  useEffect(() => {
    if (openScript || !selectionActive || !scene) return;
    const script = scene.objects[selectionActive]?.components.find(
      (component) => component.type === 'blockScript',
    )?.values['script'];
    if (typeof script === 'string')
      useEditor.getState().openBlockScript({ assetId: script, objectId: selectionActive });
  }, [openScript, selectionActive, scene]);

  const entry = openScriptEntry();
  const objectData = openScript?.objectId ? scene?.objects[openScript.objectId] : undefined;

  // The frame reloads whenever the window moves to another document (e.g. a detached window);
  // every load mounts Blockly again with the open script.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const release = (): void => {
      try {
        controllerRef.current?.dispose();
      } catch {
        // The previous page may already be gone (frame moved to another window).
      }
      controllerRef.current = null;
    };
    const mount = (): void => {
      release();
      const api = frame.contentWindow?.blockwerkBlockFrame;
      if (!api) return;
      const settings = useSettings.getState();
      const current = openScriptEntry();
      shownRef.current = { id: current?.id ?? null, data: current?.data ?? null };
      controllerRef.current = api.mount({
        locale: settings.locale,
        theme: settings.theme,
        area: activeAreaKind(),
        state: workspaceJson(current),
        variables: frameVariables(current),
        references: references(useDocument.getState().scene),
        customBlocks: customBlocksFor(current),
        onMakeBlock: () => {
          void editCustomBlock(newBlockSpec(), true).then((spec) => {
            if (spec) controllerRef.current?.createDefinition(spec);
          });
        },
        onEditBlock: (blockId, spec) => {
          void editCustomBlock(spec, false).then((edited) => {
            if (edited) controllerRef.current?.updateDefinition(blockId, edited);
          });
        },
        onGoToDefinition: (library, fn) => {
          const assetId = library || openScriptEntry()?.id;
          if (!assetId) return;
          if (library) useEditor.getState().openBlockScript({ assetId, objectId: null });
          useEditor.getState().showBlock(assetId, fn);
        },
        askName: () => prompt(translateNow('customBlock.askName')),
        onFindUsages: (name) => openSearch(name),
        onSelectBlock: (blockId) => setSelectedBlock(blockId),
        onChange: (state) => {
          const target = openScriptEntry();
          if (!target || target.id !== shownRef.current.id) return;
          const workspace = JSON.parse(state) as BlockScriptData['workspace'];
          const data = { ...target.data, workspace };
          shownRef.current = { id: target.id, data };
          updateBlockScript(target.id, data);
        },
        onVariablesChange: (variables) => {
          const target = openScriptEntry();
          if (!target) return;
          for (const variable of variables) {
            const known = target.data.variables.find((item) => item.id === variable.id);
            if (known?.scope === 'game' && known.name !== variable.name)
              applyToScripts(renameGameVariable(allScripts(), variable.id, variable.name));
          }
          const fresh = openScriptEntry();
          if (!fresh) return;
          const merged = variables.map((variable) => {
            const known = fresh.data.variables.find((item) => item.id === variable.id);
            return known
              ? { ...known, name: variable.name }
              : {
                  id: variable.id,
                  name: variable.name,
                  type: 'number' as const,
                  scope: 'object' as const,
                  default: 0,
                  inspector: false,
                };
          });
          if (JSON.stringify(merged) === JSON.stringify(fresh.data.variables)) return;
          const data = { ...fresh.data, variables: merged };
          shownRef.current = { id: fresh.id, data };
          updateBlockScript(fresh.id, data);
        },
        onCreateVariable: createVariable,
        onKeyDown: (event) => handleShortcut(event, { modifiersOnly: true }),
      });
      // A console jump may have asked for a block before the page was ready.
      const reveal = useEditor.getState().revealBlock;
      if (reveal && reveal.assetId === current?.id) controllerRef.current.reveal(reveal.blockId);
    };
    frame.addEventListener('load', mount);
    if (
      frame.contentDocument?.readyState === 'complete' &&
      frame.contentWindow?.blockwerkBlockFrame
    )
      mount();
    return () => {
      frame.removeEventListener('load', mount);
      release();
    };
  }, []);

  // Another script, or a change from outside the frame (variables panel, undo of a rename …).
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const shown = shownRef.current;
    if (shown.id !== (entry?.id ?? null)) {
      shownRef.current = { id: entry?.id ?? null, data: entry?.data ?? null };
      controller.load(workspaceJson(entry), frameVariables(entry));
    } else if (entry && shown.data !== entry.data) {
      const workspaceChanged = shown.data?.workspace !== entry.data.workspace;
      shownRef.current = { id: entry.id, data: entry.data };
      if (workspaceChanged) controller.load(workspaceJson(entry), frameVariables(entry));
      else controller.setVariables(frameVariables(entry));
    }
  });

  // Calls of custom blocks follow their definitions, in this script and in other ones.
  useEffect(
    () => controllerRef.current?.setCustomBlocks(customBlocksFor(entry)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the open script's data changes with assetsVersion
    [entry?.id, assetsVersion],
  );

  useEffect(() => controllerRef.current?.setLocale(locale), [locale]);
  useEffect(() => controllerRef.current?.setTheme(theme), [theme]);
  useEffect(() => controllerRef.current?.setArea(areaKind), [areaKind]);
  useEffect(
    () => controllerRef.current?.setReferences(references(scene)),
    [scene, locale, assetsVersion],
  );
  useEffect(() => {
    if (revealBlock && revealBlock.assetId === entry?.id)
      controllerRef.current?.reveal(revealBlock.blockId);
  }, [revealBlock, entry?.id]);

  // Running scripts glow while playing.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const game = currentGame();
    if (status === 'stopped' || !game || !entry) {
      controller.setRunning([]);
      return;
    }
    const objectId = openScript?.objectId ?? null;
    const hats = game
      .runningScripts(GLOW_TICKS)
      .filter(
        (script) =>
          script.assetId === entry.id && (objectId === null || script.objectId === objectId),
      )
      .map((script) => script.hatId);
    controller.setRunning([...new Set(hats)]);
  }, [status, playFrame, entry, openScript?.objectId]);

  const scripts = project?.assetsOfType('blockScript') ?? [];

  return (
    <div className="panel block-editor" data-testid="block-editor">
      <div className="panel-toolbar">
        <span className="muted">{t('blockEditor.script')}:</span>
        <select
          value={entry?.id ?? ''}
          data-testid="script-select"
          onChange={(event) =>
            useEditor
              .getState()
              .openBlockScript(
                event.target.value ? { assetId: event.target.value, objectId: null } : null,
              )
          }
        >
          <option value="">{t('inspector.none')}</option>
          {scripts.map((script) => (
            <option key={script.id} value={script.id}>
              {assetDisplayName(script.path)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-button"
          title={t('blockEditor.newScript')}
          disabled={status !== 'stopped'}
          onClick={() => createAssetWithPrompt(t, 'blockScript')}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className={`icon-button${codeView ? ' active' : ''}`}
          title={t('blockEditor.codeView')}
          data-testid="code-view-toggle"
          aria-pressed={codeView}
          onClick={() => setCodeView((value) => !value)}
        >
          <Code2 size={14} />
        </button>
        <span className="toolbar-separator" />
        <span className="muted">{t('blockEditor.object')}:</span>
        <strong data-testid="block-editor-object">
          {objectData ? objectName(objectData) : '—'}
        </strong>
      </div>
      <div className="block-editor-body">
        <div className="block-frame-host">
          {!entry && <div className="empty-hint overlay-hint">{t('blockEditor.noScript')}</div>}
          <iframe
            ref={frameRef}
            className="block-frame"
            src="blocks.html"
            title={t('panel.blockEditor')}
          />
        </div>
        {entry && codeView && (
          <CodeView
            entry={entry}
            selectedBlock={selectedBlock}
            onLine={(blockId) => controllerRef.current?.reveal(blockId)}
          />
        )}
        {entry && <VariablesPanel entry={entry} disabled={false} />}
      </div>
    </div>
  );
}
