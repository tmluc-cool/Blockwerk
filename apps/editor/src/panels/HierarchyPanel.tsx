import {
  Box,
  Camera,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  FolderClosed,
  Lightbulb,
} from 'lucide-react';
import { assetDisplayName } from '@blockwerk/project';
import type { IDockviewPanelProps } from 'dockview-react';
import type { DragEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { useState } from 'react';
import { ContextMenu } from '../chrome/ContextMenu';
import type { ContextMenuState } from '../chrome/ContextMenu';
import { createObjectMenuItems } from '../chrome/menus';
import {
  deleteSelection,
  duplicateSelection,
  moveSelection,
  renameObject,
} from '../document/actions';
import {
  flattenTree,
  hierarchyFromScene,
  hierarchyFromWorld,
  searchTree,
} from '../document/hierarchy';
import type { HierarchyNode } from '../document/hierarchy';
import type { DropTarget } from '../document/sceneOps';
import { activeSceneView } from '../scene/sceneViews';
import { useDocument } from '../state/document';
import { ALL_AREAS, useEditor } from '../state/editor';
import { playingWorld, usePlay } from '../state/play';
import { useT } from '../state/settings';

const ICONS: Readonly<Record<HierarchyNode['kind'], ReactElement>> = {
  area: <FolderClosed size={14} />,
  camera: <Camera size={14} />,
  light: <Lightbulb size={14} />,
  mesh: <Box size={14} />,
  empty: <Circle size={12} />,
};

const DRAG_TYPE = 'application/x-blockwerk-objects';

type DropPosition = 'before' | 'inside' | 'after';

function dropPosition(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = (event.clientY - rect.top) / Math.max(1, rect.height);
  return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
}

/** Hierarchy window (SPEC 5.2): tree of the scene, filtered by the active area tab. */
export function HierarchyPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; position: DropPosition } | null>(null);
  const scene = useDocument((state) => state.scene);
  const sceneName = useDocument((state) => {
    const entry = state.sceneId ? state.project?.asset(state.sceneId) : undefined;
    return entry ? assetDisplayName(entry.path) : null;
  });
  const status = usePlay((state) => state.status);
  // Refresh the live hierarchy while playing.
  usePlay((state) => (state.status === 'stopped' ? 0 : state.frame));
  const activeAreaId = useEditor((state) => state.activeAreaId);
  const selection = useEditor((state) => state.selection);
  const renamingId = useEditor((state) => state.renamingId);
  const playing = status !== 'stopped';

  const world = playing ? playingWorld() : null;
  const roots = world ? hierarchyFromWorld(world, scene) : scene ? hierarchyFromScene(scene) : [];
  const areaRoot =
    activeAreaId === ALL_AREAS ? null : roots.find((node) => node.id === activeAreaId);
  const shown = areaRoot ? [areaRoot] : roots;
  const rows = query.trim()
    ? searchTree(shown, query).map((node) => ({ node, depth: 0 }))
    : flattenTree(shown, collapsed);
  const rowIds = rows.map((row) => row.node.id);

  const select = (event: MouseEvent, id: string): void => {
    const editor = useEditor.getState();
    if (event.shiftKey && editor.selection.length > 0) {
      const anchor = rowIds.indexOf(editor.selection[editor.selection.length - 1] ?? '');
      const index = rowIds.indexOf(id);
      if (anchor >= 0 && index >= 0) {
        const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
        const range = rowIds.slice(from, to + 1).filter((item) => item !== id);
        editor.setSelection([...new Set([...editor.selection, ...range, id])]);
        return;
      }
    }
    editor.select(id, event.ctrlKey || event.metaKey ? 'toggle' : 'replace');
  };

  const openMenu = (event: MouseEvent, node: HierarchyNode | null): void => {
    event.preventDefault();
    if (node && !selection.includes(node.id)) useEditor.getState().select(node.id);
    const disabled = playing;
    const builtInArea = node?.area !== undefined && node.area !== 'custom';
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        ...createObjectMenuItems(t, node ? node.id : undefined, disabled),
        { kind: 'separator' },
        {
          label: t('menu.gameObject.rename'),
          shortcut: 'F2',
          disabled: disabled || !node || builtInArea,
          testId: 'context-rename',
          action: () => node && useEditor.getState().setRenaming(node.id),
        },
        {
          label: t('menu.gameObject.duplicate'),
          shortcut: 'Ctrl+D',
          disabled: disabled || !node,
          testId: 'context-duplicate',
          action: duplicateSelection,
        },
        {
          label: t('menu.gameObject.delete'),
          shortcut: 'Entf',
          disabled: disabled || !node || builtInArea,
          testId: 'context-delete',
          action: deleteSelection,
        },
      ],
    });
  };

  const onDrop = (event: DragEvent<HTMLElement>, node: HierarchyNode | null): void => {
    event.preventDefault();
    event.stopPropagation();
    setDropHint(null);
    const ids = JSON.parse(event.dataTransfer.getData(DRAG_TYPE) || '[]') as string[];
    if (ids.length === 0) return;
    let target: DropTarget;
    if (!node) target = { kind: 'inside', parent: areaRoot?.id ?? null };
    else {
      const position = dropPosition(event);
      // Area roots stay at the top level; dropping beside one means into it.
      target =
        position === 'inside' ||
        (node.area && !ids.some((id) => roots.some((root) => root.id === id)))
          ? { kind: 'inside', parent: node.id }
          : { kind: position, sibling: node.id };
    }
    moveSelection(ids, target);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    const index = rowIds.indexOf(selection[selection.length - 1] ?? '');
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next =
        rowIds[
          Math.min(rowIds.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))
        ];
      if (next) useEditor.getState().select(next);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const id = rowIds[index];
      if (!id) return;
      event.preventDefault();
      setCollapsed((current) => {
        const next = new Set(current);
        if (event.key === 'ArrowLeft') next.add(id);
        else next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="panel hierarchy" data-testid="hierarchy">
      <div className="panel-toolbar">
        <input
          className="search"
          type="search"
          placeholder={t('hierarchy.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div
        className="tree"
        role="tree"
        tabIndex={0}
        aria-multiselectable
        onKeyDown={onKeyDown}
        onContextMenu={(event) => openMenu(event, null)}
        onDragOver={(event) => {
          if (!playing && event.dataTransfer.types.includes(DRAG_TYPE)) event.preventDefault();
        }}
        onDrop={(event) => onDrop(event, null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) useEditor.getState().setSelection([]);
        }}
      >
        <div className="tree-row tree-root">
          <ChevronDown size={14} />
          <strong data-testid="scene-name">{sceneName ?? t('hierarchy.scene')}</strong>
          {playing && <span className="badge">{t('hierarchy.live')}</span>}
        </div>
        {rows.length === 0 && <div className="empty-hint">{t('hierarchy.emptyArea')}</div>}
        {rows.map(({ node, depth }) => {
          const selected = selection.includes(node.id);
          const hint = dropHint?.id === node.id ? ` drop-${dropHint.position}` : '';
          return (
            <div
              key={node.id}
              role="treeitem"
              aria-selected={selected}
              aria-expanded={node.children.length > 0 ? !collapsed.has(node.id) : undefined}
              className={`tree-row tree-item${selected ? ' selected' : ''}${node.active ? '' : ' inactive'}${node.area ? ' area-root' : ''}${hint}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              data-object-id={node.id}
              draggable={!playing && renamingId !== node.id}
              onClick={(event) => select(event, node.id)}
              onDoubleClick={() => {
                useEditor.getState().select(node.id);
                activeSceneView()?.focus([node.id]);
              }}
              onContextMenu={(event) => {
                event.stopPropagation();
                openMenu(event, node);
              }}
              onDragStart={(event) => {
                const ids = selection.includes(node.id) ? selection : [node.id];
                event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                event.stopPropagation();
                const position = dropPosition(event);
                if (dropHint?.id !== node.id || dropHint.position !== position)
                  setDropHint({ id: node.id, position });
              }}
              onDragLeave={() =>
                setDropHint((hintState) => (hintState?.id === node.id ? null : hintState))
              }
              onDrop={(event) => onDrop(event, node)}
            >
              <span
                className="tree-toggle"
                onClick={(event) => {
                  event.stopPropagation();
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
              >
                {node.children.length > 0 &&
                  (collapsed.has(node.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />)}
              </span>
              {node.clone ? <Copy size={14} /> : ICONS[node.kind]}
              {renamingId === node.id ? (
                <input
                  className="rename-field"
                  autoFocus
                  defaultValue={node.name}
                  data-testid="rename-input"
                  onClick={(event) => event.stopPropagation()}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={(event) => {
                    renameObject(node.id, event.currentTarget.value);
                    useEditor.getState().setRenaming(null);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      event.currentTarget.value = node.name;
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <span className="tree-label">{node.name}</span>
              )}
            </div>
          );
        })}
      </div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
