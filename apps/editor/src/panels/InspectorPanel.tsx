import { assetDisplayName } from '@blockwerk/project';
import type { ComponentData, JsonValue, SceneObjectData } from '@blockwerk/project';
import {
  COMPONENTS,
  getComponentDefinition,
  isFieldVisible,
  particleTemplateValues,
} from '@blockwerk/runtime';
import type { ComponentDefinition, FieldDefinition, GameObject } from '@blockwerk/runtime';
import type { IDockviewPanelProps } from 'dockview-react';
import { ChevronDown, ChevronRight, EllipsisVertical, Pin } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { ContextMenu } from '../chrome/ContextMenu';
import type { ContextMenuState } from '../chrome/ContextMenu';
import { addComponentToSelection } from '../document/actions';
import {
  editComponentEnabled,
  editComponentValue,
  editComponentValues,
  editHeader,
  editScriptVariable,
  editTransformAxis,
  liveObjectData,
} from '../document/edits';
import {
  moveComponent,
  pasteComponentValues,
  removeComponent,
  resetComponent,
} from '../document/sceneOps';
import type { TransformPart } from '../document/sceneOps';
import { openDialogEditor, openScriptEditor, openUiEditor } from '../navigation';
import { objectName } from '../scene/worlds';
import { prompt } from '../state/dialogs';
import {
  addTagOrLayer,
  BUILT_IN_TAGS,
  DEFAULT_LAYER,
  editScene,
  openPrefab,
  openScene,
  useDocument,
} from '../state/document';
import { useEditor } from '../state/editor';
import { keepAllChanges, keepChange, playingWorld, usePlay } from '../state/play';
import { PlayDebug } from './inspector/PlayDebug';
import type { TranslationKey } from '../i18n';
import { useSettings, useT } from '../state/settings';
import { TerrainTools } from '../terrain/TerrainTools';
import { FieldLabelContext } from './inspector/fieldLabel';
import { SoundPreviewButton } from './inspector/fields';
import { FieldEditor, MIXED, shared, VectorInput } from './inspector/fields';
import { ModelImportInspector } from './inspector/ModelImportInspector';
import { PrefabBar } from './inspector/PrefabBar';
import {
  applyInstanceOverrides,
  createPrefabVariant,
  overridesOf,
  prefabInstanceOf,
  revertInstanceOverrides,
} from '../document/prefabActions';
import type { Shared } from './inspector/fields';

/** Values copied with "Copy Component". */
let clipboard: { type: string; values: Record<string, JsonValue> } | null = null;

/** A component slot shared by all selected objects: type and position among components of that type. */
interface Slot {
  readonly type: string;
  readonly index: number;
  readonly components: readonly ComponentData[];
}

function slots(objects: readonly SceneObjectData[]): Slot[] {
  const first = objects[0];
  if (!first) return [];
  const result: Slot[] = [];
  const seen = new Map<string, number>();
  for (const component of first.components) {
    const index = seen.get(component.type) ?? 0;
    seen.set(component.type, index + 1);
    const components = objects.map(
      (object) => object.components.filter((item) => item.type === component.type)[index],
    );
    if (components.every((item): item is ComponentData => item !== undefined)) {
      result.push({ type: component.type, index, components });
    }
  }
  return result;
}

/** Keep button shown next to values changed in play mode. */
function KeepButton({ objectId, paths }: { objectId: string; paths: readonly string[] }) {
  const t = useT();
  const changes = usePlay((state) => state.changes);
  const keys = Object.keys(changes).filter((key) => {
    const change = changes[key];
    return (
      change?.objectId === objectId &&
      paths.some((path) => change.path === path || change.path.startsWith(`${path}.`))
    );
  });
  if (keys.length === 0) return null;
  const kept = keys.every((key) => changes[key]?.kept);
  return (
    <button
      type="button"
      className={`keep-button${kept ? ' kept' : ''}`}
      title={kept ? t('inspector.kept') : t('inspector.keep')}
      data-testid="keep-value"
      disabled={kept}
      onClick={() => keys.forEach(keepChange)}
    >
      <Pin size={12} />
      {kept ? t('inspector.kept') : t('inspector.keep')}
    </button>
  );
}

/** Override state of a value of a prefab instance: marked bold with a bar, like Unity. */
interface OverrideMark {
  readonly overridden: boolean;
  readonly onMenu: (event: MouseEvent) => void;
}

function Row({
  label,
  children,
  keep,
  override,
}: {
  label: string;
  children: ReactNode;
  keep?: ReactNode;
  override?: OverrideMark;
}) {
  return (
    <div
      className={`field-row${override?.overridden ? ' overridden' : ''}`}
      onContextMenu={override?.overridden ? override.onMenu : undefined}
    >
      <span className="field-label" title={label}>
        {label}
      </span>
      <FieldLabelContext.Provider value={label}>
        <div className="field-value">{children}</div>
      </FieldLabelContext.Provider>
      {keep}
    </div>
  );
}

function AddComponentButton({ disabled }: { disabled: boolean }) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = COMPONENTS.filter((definition) => {
    if (!needle) return true;
    const words = [
      definition.text[locale],
      definition.type,
      ...(definition.keywords?.[locale] ?? []),
    ];
    return words.some((word) => word.toLowerCase().includes(needle));
  });
  const categories = [...new Set(matches.map((definition) => definition.category))];
  return (
    <div className="add-component">
      <button
        type="button"
        disabled={disabled}
        data-testid="add-component"
        onClick={() => setOpen(!open)}
      >
        {t('inspector.addComponent')}
      </button>
      {open && (
        <div className="add-component-popup" data-testid="add-component-popup">
          <input
            autoFocus
            type="search"
            placeholder={t('inspector.searchComponents')}
            value={query}
            data-testid="add-component-search"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              const first = matches[0];
              if (event.key === 'Enter' && first) {
                addComponentToSelection(first.type, first.unique === true);
                setOpen(false);
              }
            }}
          />
          {matches.length === 0 && <div className="empty-hint">{t('inspector.noComponents')}</div>}
          {categories.map((category) => (
            <div key={category} className="component-category">
              <div className="category-title">{t(`component.category.${category}`)}</div>
              {matches
                .filter((definition) => definition.category === category)
                .map((definition) => (
                  <button
                    key={definition.type}
                    type="button"
                    className="component-choice"
                    data-testid={`add-${definition.type}`}
                    title={definition.docs[locale]}
                    onClick={() => {
                      addComponentToSelection(definition.type, definition.unique === true);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {definition.text[locale]}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ComponentSectionProps {
  readonly slot: Slot;
  readonly ids: readonly string[];
  readonly activeId: string;
  readonly playing: boolean;
  /** Override marks of a prefab instance (single selection only). */
  readonly overrideMark?: (path: string) => OverrideMark | undefined;
  readonly onMenu: (
    event: MouseEvent,
    slot: Slot,
    definition: ComponentDefinition | undefined,
  ) => void;
}

function ComponentSection({
  slot,
  ids,
  activeId,
  playing,
  onMenu,
  overrideMark,
}: ComponentSectionProps) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const [open, setOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({});
  const definition = getComponentDefinition(slot.type);
  const enabled = shared(slot.components.map((component) => component.enabled));
  const testBase = `component-${slot.type}-${slot.index}`;
  if (!definition) {
    return (
      <section className="component unknown" data-testid={testBase}>
        <header onContextMenu={(event) => onMenu(event, slot, undefined)}>
          <strong>{t('inspector.unknownComponent', { type: slot.type })}</strong>
        </header>
      </section>
    );
  }
  // Fields that depend on others (e.g. Shape only without a model) show if any object needs them.
  const fieldEntries = (Object.entries(definition.fields) as [string, FieldDefinition][]).filter(
    ([, field]) =>
      !field.hidden && slot.components.some((component) => isFieldVisible(field, component.values)),
  );
  const ungrouped = fieldEntries.filter(([, field]) => !field.group);
  const groups = [
    ...new Set(
      fieldEntries.map(([, field]) => field.group).filter((group): group is string => !!group),
    ),
  ];
  const scripts =
    project
      ?.assetsOfType('blockScript')
      .map((entry) => ({ id: entry.id, name: assetDisplayName(entry.path) })) ?? [];
  const dialogs =
    project
      ?.assetsOfType('dialog')
      .map((entry) => ({ id: entry.id, name: assetDisplayName(entry.path) })) ?? [];
  const uis =
    project
      ?.assetsOfType('ui')
      .map((entry) => ({ id: entry.id, name: assetDisplayName(entry.path) })) ?? [];
  const terrains =
    project
      ?.assetsOfType('terrain')
      .map((entry) => ({ id: entry.id, name: assetDisplayName(entry.path) })) ?? [];
  const componentId = slot.components[0]?.id ?? '';
  const renderField = ([name, field]: [string, FieldDefinition]) => (
    <Row
      key={name}
      label={field.text[locale]}
      override={overrideMark?.(`component:${componentId}:${name}`)}
      keep={
        playing ? (
          <KeepButton
            objectId={activeId}
            paths={[`component:${slot.type}:${slot.index}:${name}`]}
          />
        ) : undefined
      }
    >
      <FieldEditor
        field={field}
        locale={locale}
        value={shared(
          slot.components.map((component) => component.values[name] ?? fieldDefault(field)),
        )}
        testId={`${testBase}-${name}`}
        assets={
          field.type === 'asset'
            ? field.assetType === 'blockScript'
              ? scripts
              : field.assetType === 'terrain'
                ? terrains
                : field.assetType === 'dialog'
                  ? dialogs
                  : field.assetType === 'ui'
                    ? uis
                    : undefined
            : undefined
        }
        disabled={playing && field.type === 'asset'}
        onOpenAsset={(id) =>
          field.type === 'asset' && field.assetType === 'dialog'
            ? openDialogEditor(id)
            : field.type === 'asset' && field.assetType === 'ui'
              ? openUiEditor(id)
              : openScriptEditor(id, ids.length === 1 ? (ids[0] ?? null) : null)
        }
        onChange={(value) => {
          if (slot.type === 'particleSystem' && name === 'preset' && typeof value === 'string') {
            const template = particleTemplateValues(value);
            if (template) {
              editComponentValues(ids, slot.type, slot.index, { ...template, preset: value });
              return;
            }
          }
          editComponentValue(ids, slot.type, slot.index, name, value);
        }}
      />
    </Row>
  );
  return (
    <section className="component" data-testid={testBase}>
      <header onContextMenu={(event) => onMenu(event, slot, definition)}>
        <button
          type="button"
          className="icon-button flat"
          aria-label={t('inspector.toggleComponent')}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <input
          type="checkbox"
          checked={enabled === true}
          ref={(element) => {
            if (element) element.indeterminate = enabled === MIXED;
          }}
          aria-label={t('inspector.active')}
          data-testid={`${testBase}-enabled`}
          onChange={(event) =>
            editComponentEnabled(ids, slot.type, slot.index, event.target.checked)
          }
        />
        <strong
          onDoubleClick={() => {
            const script = slot.components[0]?.values['script'];
            if (slot.type === 'blockScript' && typeof script === 'string')
              openScriptEditor(script, ids[0] ?? null);
          }}
        >
          {definition.text[locale]}
        </strong>
        <span className="toolbar-spacer" />
        <button
          type="button"
          className="icon-button flat"
          title={t('inspector.componentMenu')}
          data-testid={`${testBase}-menu`}
          onClick={(event) => onMenu(event, slot, definition)}
        >
          <EllipsisVertical size={14} />
        </button>
      </header>
      {open && (
        <div className="component-body">
          {ungrouped.map(renderField)}
          {groups.map((group) => {
            const groupOpen = groupsOpen[group] ?? true;
            return (
              <div key={group} className="field-group">
                <button
                  type="button"
                  className="group-title"
                  onClick={() => setGroupsOpen({ ...groupsOpen, [group]: !groupOpen })}
                >
                  {groupOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {t(`component.group.${group}` as TranslationKey)}
                </button>
                {groupOpen &&
                  fieldEntries.filter(([, field]) => field.group === group).map(renderField)}
              </div>
            );
          })}
          {slot.type === 'terrain' && ids.length === 1 && ids[0] && (
            <TerrainTools
              objectId={ids[0]}
              asset={
                typeof slot.components[0]?.values['terrain'] === 'string'
                  ? slot.components[0].values['terrain']
                  : null
              }
            />
          )}
          {slot.type === 'blockScript' && (
            <ScriptVariables slot={slot} ids={ids} activeId={activeId} playing={playing} />
          )}
        </div>
      )}
    </section>
  );
}

function fieldDefault(field: FieldDefinition): JsonValue {
  return field.type === 'vector3' ? [...field.default] : field.default;
}

/** Inspector variables of a block script (Unity: public fields of a script). */
function ScriptVariables({
  slot,
  ids,
  activeId,
  playing,
}: {
  slot: Slot;
  ids: readonly string[];
  activeId: string;
  playing: boolean;
}) {
  const t = useT();
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const scriptIds = new Set(slot.components.map((component) => component.values['script']));
  const scriptId = scriptIds.size === 1 ? [...scriptIds][0] : null;
  const script =
    typeof scriptId === 'string' ? project?.assetOfType(scriptId, 'blockScript') : undefined;
  if (!script) return null;
  const variables = script.data.variables.filter(
    (variable) => variable.inspector && variable.scope === 'object',
  );
  const world = playingWorld();
  return (
    <div className="script-variables" data-testid="script-variables">
      {variables.length === 0 && (
        <div className="empty-hint small">{t('inspector.noInspectorVariables')}</div>
      )}
      {variables.map((variable) => {
        const values = slot.components.map((component, index) => {
          if (world) {
            const live = world.getObject(ids[index] ?? '')?.vars[variable.id];
            if (live !== undefined) return live;
          }
          const stored = component.values['variables'];
          const map = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
          const value = map[variable.id];
          return typeof value === typeof variable.default
            ? (value as number | string | boolean)
            : variable.default;
        });
        const value: Shared<JsonValue> | undefined = shared(values);
        const field: FieldDefinition =
          variable.type === 'number'
            ? { type: 'number', default: 0, text: { de: variable.name, en: variable.name } }
            : variable.type === 'boolean'
              ? { type: 'boolean', default: false, text: { de: variable.name, en: variable.name } }
              : { type: 'string', default: '', text: { de: variable.name, en: variable.name } };
        return (
          <Row
            key={variable.id}
            label={variable.name}
            keep={
              playing ? (
                <KeepButton objectId={activeId} paths={[`variable:${slot.index}:${variable.id}`]} />
              ) : undefined
            }
          >
            <FieldEditor
              field={field}
              locale="de"
              value={value}
              testId={`variable-${variable.name}`}
              onChange={(next) => {
                if (
                  typeof next === 'number' ||
                  typeof next === 'string' ||
                  typeof next === 'boolean'
                ) {
                  editScriptVariable(ids, slot.index, variable.id, next);
                }
              }}
            />
          </Row>
        );
      })}
    </div>
  );
}

function AssetInspector({ id }: { id: string }) {
  const t = useT();
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const entry = project?.asset(id);
  if (!entry) return <div className="empty-hint">{t('inspector.empty')}</div>;
  return (
    <div className="asset-inspector" data-testid="asset-inspector">
      <div className="inspector-header">
        <strong>{assetDisplayName(entry.path)}</strong>
        <span className="muted">{t(`asset.type.${entry.type}`)}</span>
      </div>
      <Row label={t('inspector.assetPath')}>
        <code>{entry.path}</code>
      </Row>
      <Row label={t('inspector.assetId')}>
        <code>{entry.id}</code>
      </Row>
      {entry.type === 'blockScript' && (
        <Row label={t('inspector.variables')}>
          <span>{entry.data.variables.map((variable) => variable.name).join(', ') || '–'}</span>
        </Row>
      )}
      {entry.type === 'model' && <ModelImportInspector entry={entry} />}
      {entry.type === 'prefab' && entry.data.base && (
        <Row label={t('prefab.label')}>
          <span>
            {t('prefab.variantOf', {
              name: (() => {
                const base = project?.asset(entry.data.base);
                return base ? assetDisplayName(base.path) : t('prefab.missing');
              })(),
            })}
          </span>
        </Row>
      )}
      {entry.type === 'audio' && <SoundPreviewButton value={`audio:${entry.id}`} />}
      {(entry.type === 'scene' || entry.type === 'prefab' || entry.type === 'blockScript') && (
        <div className="add-component">
          <button
            type="button"
            data-testid="asset-open"
            onClick={() => {
              if (entry.type === 'scene') openScene(entry.id);
              else if (entry.type === 'prefab') openPrefab(entry.id);
              else openScriptEditor(entry.id);
            }}
          >
            {t('inspector.open')}
          </button>
          {entry.type === 'prefab' && (
            <button
              type="button"
              data-testid="asset-create-variant"
              onClick={() => {
                const id = createPrefabVariant(entry.id);
                if (id) useEditor.getState().selectAsset(id);
              }}
            >
              {t('prefab.createVariant')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Inspector window (SPEC 5.7): header, Transform and components of the selected objects. */
export function InspectorPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const scene = useDocument((state) => state.scene);
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const selection = useEditor((state) => state.selection);
  const selectedAssetId = useEditor((state) => state.selectedAssetId);
  const status = usePlay((state) => state.status);
  usePlay((state) => (state.status === 'stopped' ? 0 : state.frame));
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const playing = status !== 'stopped';
  const world = playing ? playingWorld() : null;

  const entries = selection
    .map((id) => {
      if (world) {
        const object = world.getObject(id);
        return object
          ? { id, data: liveObjectData(object, scene?.objects[object.cloneOf ?? id]) }
          : null;
      }
      const data = scene?.objects[id];
      return data ? { id, data } : null;
    })
    .filter((entry): entry is { id: string; data: SceneObjectData } => entry !== null);

  if (entries.length === 0) {
    return (
      <div className="panel inspector" data-testid="inspector">
        {selectedAssetId ? (
          <AssetInspector id={selectedAssetId} />
        ) : (
          <div className="empty-hint">{t('inspector.empty')}</div>
        )}
      </div>
    );
  }

  const ids = entries.map((entry) => entry.id);
  const objects = entries.map((entry) => entry.data);
  const active = entries[entries.length - 1];
  if (!active) return null;
  const activeKeepId = world?.getObject(active.id)?.cloneOf ?? active.id;
  const builtInArea = objects.some((object) => object.area && object.area !== 'custom');
  const isArea = objects.every((object) => object.area);
  const name = shared(objects.map((object, index) => objectName(object, ids[index])));
  const activeFlag = shared(objects.map((object) => object.active));
  const staticFlag = shared(objects.map((object) => object.static));
  const tag = shared(objects.map((object) => object.tag));
  const layer = shared(objects.map((object) => object.layer));
  const tags = [...BUILT_IN_TAGS, ...(project?.tagsAndLayers.tags ?? [])];
  const layers = [DEFAULT_LAYER, ...(project?.tagsAndLayers.layers ?? [])];
  const keep = (paths: string[]) =>
    playing ? <KeepButton objectId={activeKeepId} paths={paths} /> : undefined;

  const openComponentMenu = (
    event: MouseEvent,
    slot: Slot,
    definition: ComponentDefinition | undefined,
  ): void => {
    event.preventDefault();
    const disabled = playing;
    const index =
      objects[0]?.components.findIndex((component) => component === slot.components[0]) ?? -1;
    const count = objects[0]?.components.length ?? 0;
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          label: t('inspector.reset'),
          disabled: disabled || !definition,
          testId: 'component-reset',
          action: () =>
            editScene('undo.resetComponent', (data) =>
              resetComponent(data, ids, slot.type, slot.index),
            ),
        },
        {
          label: t('inspector.copyValues'),
          testId: 'component-copy',
          action: () => {
            clipboard = { type: slot.type, values: { ...(slot.components[0]?.values ?? {}) } };
          },
        },
        {
          label: t('inspector.pasteValues'),
          disabled: disabled || clipboard?.type !== slot.type,
          testId: 'component-paste',
          action: () => {
            const values = clipboard?.values;
            if (values)
              editScene('undo.pasteComponent', (data) =>
                pasteComponentValues(data, ids, slot.type, slot.index, values),
              );
          },
        },
        { kind: 'separator' },
        {
          label: t('inspector.moveUp'),
          disabled: disabled || index <= 0,
          action: () =>
            editScene('undo.moveComponent', (data) =>
              moveComponent(data, ids, slot.type, slot.index, -1),
            ),
        },
        {
          label: t('inspector.moveDown'),
          disabled: disabled || index < 0 || index >= count - 1,
          action: () =>
            editScene('undo.moveComponent', (data) =>
              moveComponent(data, ids, slot.type, slot.index, 1),
            ),
        },
        { kind: 'separator' },
        {
          label: t('inspector.remove'),
          disabled,
          testId: 'component-remove',
          action: () =>
            editScene('undo.removeComponent', (data) =>
              removeComponent(data, ids, slot.type, slot.index),
            ),
        },
      ],
    });
  };

  // Prefab instance: overridden values of the (single) selected object.
  const instance = ids.length === 1 && !playing ? prefabInstanceOf(scene, active.id) : null;
  const ownOverrides = instance ? overridesOf(scene, active.id) : [];
  const overrideMark = (path: string): OverrideMark | undefined => {
    const matching = ownOverrides.filter((override) => override.path === path);
    if (!instance || matching.length === 0) return undefined;
    return {
      overridden: true,
      onMenu: (event: MouseEvent) => {
        event.preventDefault();
        setMenu({
          x: event.clientX,
          y: event.clientY,
          items: [
            {
              label: t('prefab.apply'),
              testId: 'override-apply',
              action: () =>
                applyInstanceOverrides(instance.rootId, (item) => matching.includes(item)),
            },
            {
              label: t('prefab.revert'),
              testId: 'override-revert',
              action: () =>
                revertInstanceOverrides(instance.rootId, (item) => matching.includes(item)),
            },
          ],
        });
      },
    };
  };

  const pickTagOrLayer = (kind: 'tags' | 'layers', value: string): void => {
    if (value !== '\u0000add') {
      editHeader(ids, kind === 'tags' ? 'tag' : 'layer', value);
      return;
    }
    void prompt(t(kind === 'tags' ? 'tag.prompt' : 'layer.prompt')).then((entered) => {
      if (entered && addTagOrLayer(kind, entered))
        editHeader(ids, kind === 'tags' ? 'tag' : 'layer', entered.trim());
    });
  };

  return (
    <div className={`panel inspector${playing ? ' playing' : ''}`} data-testid="inspector">
      {playing && (
        <div className="play-hint">
          <span>{t('inspector.playHint')}</span>
          <button
            type="button"
            className="small"
            data-testid="keep-all"
            onClick={() => keepAllChanges(activeKeepId)}
          >
            {t('inspector.keepAll')}
          </button>
        </div>
      )}
      <div className="inspector-header">
        <input
          type="checkbox"
          checked={activeFlag === true}
          ref={(element) => {
            if (element) element.indeterminate = activeFlag === MIXED;
          }}
          aria-label={t('inspector.active')}
          data-testid="inspector-active"
          onChange={(event) => editHeader(ids, 'active', event.target.checked)}
        />
        <input
          className="name-field"
          aria-label={t('inspector.objectName')}
          key={`${ids.join(',')}|${name === MIXED ? '' : String(name)}`}
          defaultValue={name === MIXED ? '' : String(name)}
          placeholder={name === MIXED ? t('inspector.mixed') : undefined}
          disabled={builtInArea}
          data-testid="inspector-name"
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value && value !== name) editHeader(ids, 'name', value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <label className="static-toggle">
          <input
            type="checkbox"
            checked={staticFlag === true}
            ref={(element) => {
              if (element) element.indeterminate = staticFlag === MIXED;
            }}
            onChange={(event) => editHeader(ids, 'static', event.target.checked)}
          />
          {t('inspector.static')}
        </label>
      </div>
      {entries.length > 1 && (
        <div className="muted inspector-count">
          {t('inspector.multiple', { count: entries.length })}
        </div>
      )}
      <div className="inspector-header secondary">
        <span className="field-label">{t('inspector.tag')}</span>
        <select
          value={tag === MIXED ? '' : String(tag)}
          data-testid="inspector-tag"
          onChange={(event) => pickTagOrLayer('tags', event.target.value)}
        >
          {tag === MIXED && <option value="">{t('inspector.mixed')}</option>}
          {tags.map((item) => (
            <option key={item} value={item}>
              {item === 'Untagged' ? t('inspector.untagged') : item}
            </option>
          ))}
          <option value={'\u0000add'}>{t('inspector.addTag')}</option>
        </select>
        <span className="field-label">{t('inspector.layer')}</span>
        <select
          value={layer === MIXED ? '' : String(layer)}
          data-testid="inspector-layer"
          onChange={(event) => pickTagOrLayer('layers', event.target.value)}
        >
          {layer === MIXED && <option value="">{t('inspector.mixed')}</option>}
          {layers.map((item) => (
            <option key={item} value={item}>
              {item === DEFAULT_LAYER ? t('inspector.defaultLayer') : item}
            </option>
          ))}
          <option value={'\u0000add'}>{t('inspector.addLayer')}</option>
        </select>
      </div>
      {isArea && <div className="muted inspector-count">{t('inspector.areaRoot')}</div>}
      {instance && <PrefabBar instance={instance} scene={scene} />}
      <section className="component" data-testid="transform">
        <header>
          <ChevronDown size={14} />
          <strong>{t('inspector.transform')}</strong>
        </header>
        {(['position', 'rotation', 'scale'] as const).map((part: TransformPart) => (
          <Row
            key={part}
            label={t(`inspector.${part}`)}
            keep={keep([`transform.${part}`, 'transform'])}
            override={overrideMark(`transform.${part}`)}
          >
            <VectorInput
              values={[0, 1, 2].map(
                (axis) => shared(objects.map((object) => object.transform[part][axis] ?? 0)) ?? 0,
              )}
              step={part === 'rotation' ? 1 : 0.1}
              testId={`transform-${part}`}
              onChange={(axis, value) => editTransformAxis(ids, part, axis, value)}
            />
          </Row>
        ))}
      </section>
      {slots(objects).map((slot) => (
        <ComponentSection
          key={`${slot.type}-${slot.index}`}
          slot={slot}
          ids={ids}
          activeId={activeKeepId}
          playing={playing}
          onMenu={openComponentMenu}
          overrideMark={overrideMark}
        />
      ))}
      {playing && entries.length === 1 && world?.getObject(active.id) && (
        <PlayDebug object={world.getObject(active.id) as GameObject} />
      )}
      <AddComponentButton disabled={playing} />
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
