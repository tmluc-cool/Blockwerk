import {
  assetDisplayName,
  UI_ELEMENT_TYPES,
  UI_SETTINGS,
  UI_TEMPLATE_KINDS,
} from '@blockwerk/project';
import type { UiAction, UiBinding, UiData, UiElement, UiElementType } from '@blockwerk/project';
import { ANCHOR_PRESETS, canvasScale, layoutRect } from '@blockwerk/runtime';
import type { AnchorPreset, Rect } from '@blockwerk/runtime';
import type { IDockviewPanelProps } from 'dockview-react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { updateUi, useDocument } from '../state/document';
import { useEditor } from '../state/editor';
import { useT } from '../state/settings';
import { addMenuFromTemplate } from '../ui/templates';
import {
  addElement,
  createElement,
  duplicateElement,
  findElement,
  fixedSize,
  flattenElements,
  moveElement,
  newElementId,
  nudge,
  removeElement,
  updateElement,
  withPreset,
} from '../ui/uiTree';

type Translate = ReturnType<typeof useT>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ui-prop">
      <span className="muted">{label}</span>
      {children}
    </label>
  );
}

function PairInput({
  value,
  testId,
  onChange,
}: {
  value: readonly [number, number];
  testId: string;
  onChange: (value: [number, number]) => void;
}) {
  return (
    <span className="ui-pair">
      {[0, 1].map((index) => (
        <input
          key={index}
          type="number"
          step="any"
          value={value[index]}
          data-testid={`${testId}-${index}`}
          onChange={(event) => {
            const next: [number, number] = [value[0], value[1]];
            next[index] = Number(event.target.value);
            onChange(next);
          }}
        />
      ))}
    </span>
  );
}

function ActionEditor({
  actions,
  scenes,
  uis,
  t,
  onChange,
}: {
  actions: readonly UiAction[];
  scenes: readonly { id: string; name: string }[];
  uis: readonly { id: string; name: string }[];
  t: Translate;
  onChange: (actions: UiAction[]) => void;
}) {
  const blank = (type: UiAction['type']): UiAction => {
    switch (type) {
      case 'sendMessage':
        return { type, message: 'ok' };
      case 'showUi':
      case 'hideUi':
        return { type, ui: uis[0]?.id ?? '' };
      case 'loadScene':
        return { type, scene: scenes[0]?.id ?? '', spawn: '' };
      case 'saveGame':
      case 'loadGame':
        return { type, slot: 1 };
      default:
        return { type } as UiAction;
    }
  };
  const types = [
    'sendMessage',
    'showUi',
    'hideUi',
    'loadScene',
    'resume',
    'restart',
    'saveGame',
    'loadGame',
    'quit',
  ] as const;
  const select = (
    value: string,
    options: readonly { id: string; name: string }[],
    empty: string,
    onPick: (id: string) => void,
  ) => (
    <select value={value} onChange={(event) => onPick(event.target.value)}>
      <option value="">{empty}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
  return (
    <div className="ui-actions">
      {actions.map((action, index) => (
        <div className="ui-action" key={index} data-testid={`ui-action-${index}`}>
          <select
            value={action.type}
            data-testid={`ui-action-${index}-type`}
            onChange={(event) =>
              onChange(
                actions.map((item, i) =>
                  i === index ? blank(event.target.value as UiAction['type']) : item,
                ),
              )
            }
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {t(`uiEditor.action.${type}` as never)}
              </option>
            ))}
          </select>
          {action.type === 'sendMessage' && (
            <input
              value={action.message}
              onChange={(event) =>
                onChange(
                  actions.map((item, i) =>
                    i === index ? { ...action, message: event.target.value } : item,
                  ),
                )
              }
            />
          )}
          {(action.type === 'showUi' || action.type === 'hideUi') &&
            select(action.ui, uis, t('uiEditor.chooseUi'), (ui) =>
              onChange(actions.map((item, i) => (i === index ? { ...action, ui } : item))),
            )}
          {action.type === 'loadScene' && (
            <>
              {select(action.scene, scenes, t('uiEditor.chooseScene'), (scene) =>
                onChange(actions.map((item, i) => (i === index ? { ...action, scene } : item))),
              )}
              <input
                value={action.spawn}
                placeholder={t('uiEditor.spawn')}
                onChange={(event) =>
                  onChange(
                    actions.map((item, i) =>
                      i === index ? { ...action, spawn: event.target.value } : item,
                    ),
                  )
                }
              />
            </>
          )}
          {(action.type === 'saveGame' || action.type === 'loadGame') && (
            <select
              value={action.slot}
              onChange={(event) =>
                onChange(
                  actions.map((item, i) =>
                    i === index
                      ? { ...action, slot: Number(event.target.value) as 1 | 2 | 3 }
                      : item,
                  ),
                )
              }
            >
              {[1, 2, 3].map((slot) => (
                <option key={slot} value={slot}>
                  {t('uiEditor.slot')} {slot}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="icon-button flat"
            title={t('uiEditor.delete')}
            onClick={() => onChange(actions.filter((_, i) => i !== index))}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        data-testid="ui-action-add"
        onClick={() => onChange([...actions, blank('resume')])}
      >
        <Plus size={12} /> {t('uiEditor.addAction')}
      </button>
    </div>
  );
}

function ElementProperties({
  element,
  gameVariables,
  images,
  scenes,
  uis,
  t,
  onChange,
}: {
  element: UiElement;
  gameVariables: readonly { id: string; name: string }[];
  images: readonly { id: string; name: string }[];
  scenes: readonly { id: string; name: string }[];
  uis: readonly { id: string; name: string }[];
  t: Translate;
  onChange: (change: (element: UiElement) => UiElement) => void;
}) {
  const set = (patch: Partial<UiElement>): void =>
    onChange((current) => ({ ...current, ...patch }));
  const hasText = ['text', 'button', 'toggle'].includes(element.type);
  const bindable = ['text', 'bar', 'slider'].includes(element.type);
  const bind = element.bind;
  const setBind = (kind: string): void => {
    const next: UiBinding | undefined =
      kind === 'variable'
        ? { kind, variable: gameVariables[0]?.id ?? '' }
        : kind === 'item'
          ? { kind, item: '' }
          : kind === 'health' || kind === 'stamina' || kind === 'loading'
            ? { kind }
            : undefined;
    onChange((current) => {
      const { bind: _old, ...rest } = current;
      return next ? { ...rest, bind: next } : rest;
    });
  };
  return (
    <div className="ui-props" data-testid="ui-properties">
      <Row label={t('uiEditor.name')}>
        <input
          value={element.name}
          data-testid="ui-prop-name"
          onChange={(event) => set({ name: event.target.value })}
        />
      </Row>
      <Row label={t('uiEditor.visible')}>
        <input
          type="checkbox"
          checked={element.visible}
          onChange={(event) => set({ visible: event.target.checked })}
        />
      </Row>
      <Row label={t('uiEditor.anchorPreset')}>
        <select
          value=""
          data-testid="ui-prop-preset"
          onChange={(event) => {
            const preset = event.target.value as AnchorPreset;
            if (preset) onChange((current) => withPreset(current, preset, fixedSize(current)));
          }}
        >
          <option value="" />
          {ANCHOR_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {t(`uiEditor.preset.${preset}` as never)}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t('uiEditor.anchorMin')}>
        <PairInput
          value={element.anchorMin}
          testId="ui-prop-anchor-min"
          onChange={(v) => set({ anchorMin: v })}
        />
      </Row>
      <Row label={t('uiEditor.anchorMax')}>
        <PairInput
          value={element.anchorMax}
          testId="ui-prop-anchor-max"
          onChange={(v) => set({ anchorMax: v })}
        />
      </Row>
      <Row label={t('uiEditor.offsetMin')}>
        <PairInput
          value={element.offsetMin}
          testId="ui-prop-offset-min"
          onChange={(v) => set({ offsetMin: v })}
        />
      </Row>
      <Row label={t('uiEditor.offsetMax')}>
        <PairInput
          value={element.offsetMax}
          testId="ui-prop-offset-max"
          onChange={(v) => set({ offsetMax: v })}
        />
      </Row>
      {hasText && (
        <Row label={t('uiEditor.text')}>
          <input
            value={element.text ?? ''}
            title={t('uiEditor.textHelp')}
            data-testid="ui-prop-text"
            onChange={(event) => set({ text: event.target.value })}
          />
        </Row>
      )}
      {['text', 'button', 'toggle', 'inventory', 'hint', 'dialog', 'keybindings'].includes(
        element.type,
      ) && (
        <>
          <Row label={t('uiEditor.fontSize')}>
            <input
              type="number"
              min={6}
              value={element.fontSize ?? 20}
              onChange={(event) => set({ fontSize: Number(event.target.value) })}
            />
          </Row>
          <Row label={t('uiEditor.align')}>
            <select
              value={element.align ?? 'center'}
              onChange={(event) => set({ align: event.target.value as UiElement['align'] })}
            >
              {(['left', 'center', 'right'] as const).map((align) => (
                <option key={align} value={align}>
                  {t(`uiEditor.align.${align}` as never)}
                </option>
              ))}
            </select>
          </Row>
        </>
      )}
      <Row label={t('uiEditor.color')}>
        <input
          value={element.color ?? ''}
          data-testid="ui-prop-color"
          onChange={(event) => set({ color: event.target.value })}
        />
      </Row>
      <Row label={t('uiEditor.background')}>
        <input
          value={element.background ?? ''}
          data-testid="ui-prop-background"
          onChange={(event) => set({ background: event.target.value })}
        />
      </Row>
      <Row label={t('uiEditor.opacity')}>
        <input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={element.opacity ?? 1}
          onChange={(event) => set({ opacity: Number(event.target.value) })}
        />
      </Row>
      {element.type === 'image' && (
        <Row label={t('uiEditor.image')}>
          <select
            value={element.image ?? ''}
            onChange={(event) => set({ image: event.target.value || null })}
          >
            <option value="">{t('uiEditor.noImage')}</option>
            {images.map((image) => (
              <option key={image.id} value={image.id}>
                {image.name}
              </option>
            ))}
          </select>
        </Row>
      )}
      {bindable && (
        <>
          <Row label={t('uiEditor.bind')}>
            <select
              value={bind?.kind ?? 'none'}
              data-testid="ui-prop-bind"
              onChange={(event) => setBind(event.target.value)}
            >
              {['none', 'variable', 'health', 'stamina', 'item', 'loading'].map((kind) => (
                <option key={kind} value={kind}>
                  {t(`uiEditor.bind.${kind}` as never)}
                </option>
              ))}
            </select>
          </Row>
          {bind?.kind === 'variable' && (
            <Row label={t('uiEditor.variable')}>
              <select
                value={bind.variable}
                onChange={(event) =>
                  set({ bind: { kind: 'variable', variable: event.target.value } })
                }
              >
                <option value="">{t('uiEditor.chooseVariable')}</option>
                {gameVariables.map((variable) => (
                  <option key={variable.id} value={variable.id}>
                    {variable.name}
                  </option>
                ))}
              </select>
            </Row>
          )}
          {bind?.kind === 'item' && (
            <Row label={t('uiEditor.item')}>
              <input
                value={bind.item}
                onChange={(event) => set({ bind: { kind: 'item', item: event.target.value } })}
              />
            </Row>
          )}
          {(element.type === 'bar' || element.type === 'slider') && (
            <>
              <Row label={t('uiEditor.max')}>
                <input
                  type="number"
                  value={element.max ?? ''}
                  onChange={(event) =>
                    set({ max: event.target.value === '' ? undefined : Number(event.target.value) })
                  }
                />
              </Row>
            </>
          )}
        </>
      )}
      {['slider', 'toggle', 'dropdown'].includes(element.type) && (
        <Row label={t('uiEditor.setting')}>
          <select
            value={element.setting ?? ''}
            data-testid="ui-prop-setting"
            onChange={(event) =>
              onChange((current) => {
                const { setting: _old, ...rest } = current;
                return event.target.value
                  ? { ...rest, setting: event.target.value as (typeof UI_SETTINGS)[number] }
                  : rest;
              })
            }
          >
            <option value="">{t('uiEditor.noSetting')}</option>
            {UI_SETTINGS.map((setting) => (
              <option key={setting} value={setting}>
                {t(`uiEditor.setting.${setting}` as never)}
              </option>
            ))}
          </select>
        </Row>
      )}
      {element.type === 'button' && (
        <>
          <h5>{t('uiEditor.actions')}</h5>
          <ActionEditor
            actions={element.actions ?? []}
            scenes={scenes}
            uis={uis}
            t={t}
            onChange={(actions) => set({ actions })}
          />
        </>
      )}
    </div>
  );
}

/** One element drawn in the preview. */
function PreviewElement({
  element,
  parent,
  scale,
  selected,
  onSelect,
  onDragStart,
}: {
  element: UiElement;
  parent: Rect;
  scale: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onDragStart: (event: ReactPointerEvent, element: UiElement) => void;
}) {
  const rect = layoutRect(parent, element, scale);
  const inner: Rect = { x: 0, y: 0, width: rect.width, height: rect.height };
  const bar = element.type === 'bar';
  return (
    <div
      className={`ui-preview-el${selected === element.id ? ' selected' : ''}${element.visible ? '' : ' hidden'}`}
      data-testid={`ui-preview-${element.id}`}
      data-type={element.type}
      style={{
        left: rect.x - parent.x,
        top: rect.y - parent.y,
        width: rect.width,
        height: rect.height,
        background: element.background || undefined,
        color: element.color && !bar ? element.color : undefined,
        fontSize: (element.fontSize ?? 20) * scale,
        opacity: element.opacity,
        justifyContent:
          element.align === 'left'
            ? 'flex-start'
            : element.align === 'right'
              ? 'flex-end'
              : 'center',
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(element.id);
        onDragStart(event, element);
      }}
    >
      {bar && <div className="ui-preview-fill" style={{ background: element.color || '#d33' }} />}
      {(element.type === 'text' || element.type === 'button') && (element.text ?? '')}
      {!['text', 'button', 'panel', 'bar'].includes(element.type) && (
        <span className="ui-preview-tag">{element.type}</span>
      )}
      {element.children?.map((child) => (
        <PreviewElement
          key={child.id}
          element={child}
          parent={inner}
          scale={scale}
          selected={selected}
          onSelect={onSelect}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}

/**
 * UI Editor (SPEC 5.11, 8.12): the elements of a UI canvas as a list, a preview in which they can be
 * selected and dragged, and the properties of the selected element (anchors, offsets, look, what it
 * shows, what its button does). Every change is saved into the project at once.
 */
export function UiEditorPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const openId = useEditor((state) => state.openUi);
  const entry = openId ? project?.assetOfType(openId, 'ui') : undefined;
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState(640);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(200, element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [entry?.id]);
  if (!project || !entry) {
    return (
      <div className="panel ui-editor" data-testid="ui-editor">
        <div className="empty-hint">{t('uiEditor.empty')}</div>
      </div>
    );
  }
  const data: UiData = entry.data;
  const save = (next: UiData): void => updateUi(entry.id, next);
  const setElements = (elements: UiElement[]): void => save({ ...data, elements });
  const list = (type: 'scene' | 'ui' | 'image') =>
    project
      .assetsOfType(type)
      .map((asset) => ({ id: asset.id, name: assetDisplayName(asset.path) }));
  const gameVariables = project
    .assetsOfType('blockScript')
    .flatMap((script) => script.data.variables)
    .filter((variable) => variable.scope === 'game')
    .map((variable) => ({ id: variable.id, name: variable.name }));
  const current = selected ? findElement(data.elements, selected) : null;
  const height = (width * data.referenceHeight) / data.referenceWidth;
  const scale = canvasScale(width, height, data.referenceWidth, data.referenceHeight);
  const root: Rect = { x: 0, y: 0, width, height };
  const startDrag = (event: ReactPointerEvent, element: UiElement): void => {
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    let latest = data.elements;
    const onMove = (move: PointerEvent): void => {
      const dx = (move.clientX - startX) / scale;
      const dy = (move.clientY - startY) / scale;
      latest = updateElement(data.elements, element.id, () => nudge(element, dx, dy));
      save({ ...data, elements: latest });
    };
    const onUp = (): void => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };
  return (
    <div className="panel ui-editor" data-testid="ui-editor">
      <div className="panel-toolbar">
        <strong data-testid="ui-name">{assetDisplayName(entry.path)}</strong>
        <label className="toolbar-field">
          <span className="muted">{t('uiEditor.add')}</span>
          <select
            value=""
            data-testid="ui-add"
            onChange={(event) => {
              const type = event.target.value as UiElementType;
              if (!type) return;
              const id = newElementId(data.elements);
              const parent = current?.type === 'panel' ? current.id : null;
              setElements(
                addElement(
                  data.elements,
                  createElement(type, id, t(`uiEditor.type.${type}` as never)),
                  parent,
                ),
              );
              setSelected(id);
            }}
          >
            <option value="" />
            {UI_ELEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`uiEditor.type.${type}` as never)}
              </option>
            ))}
          </select>
        </label>
        <label className="toolbar-field">
          <span className="muted">{t('uiEditor.fromTemplate')}</span>
          <select
            value=""
            data-testid="ui-template"
            onChange={(event) => {
              const kind = event.target.value as (typeof UI_TEMPLATE_KINDS)[number];
              if (!kind) return;
              const id = addMenuFromTemplate(kind);
              if (id) useEditor.getState().openUiAsset(id);
            }}
          >
            <option value="" />
            {UI_TEMPLATE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`uiEditor.template.${kind}` as never)}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar-spacer" />
        <span className="muted">{t('uiEditor.referenceSize')}</span>
        <input
          type="number"
          className="ui-ref"
          value={data.referenceWidth}
          onChange={(event) =>
            save({ ...data, referenceWidth: Math.max(1, Number(event.target.value)) })
          }
        />
        ×
        <input
          type="number"
          className="ui-ref"
          value={data.referenceHeight}
          onChange={(event) =>
            save({ ...data, referenceHeight: Math.max(1, Number(event.target.value)) })
          }
        />
      </div>
      <p className="muted ui-help">{t('uiEditor.help')}</p>
      <div className="ui-editor-body">
        <div className="ui-list" data-testid="ui-list">
          <div className="ui-list-tools">
            <button
              type="button"
              className="icon-button flat"
              title={t('uiEditor.duplicate')}
              disabled={!current}
              data-testid="ui-duplicate"
              onClick={() => current && setElements(duplicateElement(data.elements, current.id))}
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              className="icon-button flat"
              title={t('uiEditor.up')}
              disabled={!current}
              onClick={() => current && setElements(moveElement(data.elements, current.id, -1))}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              className="icon-button flat"
              title={t('uiEditor.down')}
              disabled={!current}
              onClick={() => current && setElements(moveElement(data.elements, current.id, 1))}
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              className="icon-button flat"
              title={t('uiEditor.delete')}
              disabled={!current}
              data-testid="ui-delete"
              onClick={() => {
                if (!current) return;
                setElements(removeElement(data.elements, current.id));
                setSelected(null);
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
          {flattenElements(data.elements).map(({ element, depth }) => (
            <button
              type="button"
              key={element.id}
              className={`ui-list-item${selected === element.id ? ' selected' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              data-testid={`ui-item-${element.id}`}
              onClick={() => setSelected(element.id)}
            >
              <span className="muted">{t(`uiEditor.type.${element.type}` as never)}</span>{' '}
              {element.name}
            </button>
          ))}
        </div>
        <div className="ui-preview-wrap">
          <div
            ref={previewRef}
            className="ui-preview"
            data-testid="ui-preview"
            style={{ height }}
            onPointerDown={() => setSelected(null)}
          >
            {data.elements.map((element) => (
              <PreviewElement
                key={element.id}
                element={element}
                parent={root}
                scale={scale}
                selected={selected}
                onSelect={setSelected}
                onDragStart={startDrag}
              />
            ))}
          </div>
        </div>
        <div className="ui-side">
          {current ? (
            <ElementProperties
              element={current}
              gameVariables={gameVariables}
              images={list('image')}
              scenes={list('scene')}
              uis={list('ui')}
              t={t}
              onChange={(change) => setElements(updateElement(data.elements, current.id, change))}
            />
          ) : (
            <div className="empty-hint">{t('uiEditor.noSelection')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
