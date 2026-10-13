import { Box, Camera, ChevronDown, Mountain, Sun } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useEditor } from '../state/editor';
import { objectsInArea } from '../state/scene';
import type { SceneObjectKind } from '../state/scene';
import { useT } from '../state/settings';
import { activeSceneView } from '../scene/sceneViews';

const ICONS: Readonly<Record<SceneObjectKind, ReactElement>> = {
  camera: <Camera size={14} />,
  sun: <Sun size={14} />,
  ground: <Mountain size={14} />,
  cube: <Box size={14} />,
};

/** Hierarchy window: objects of the scene, filtered by the active area tab and the search box. */
export function HierarchyPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const activeAreaId = useEditor((state) => state.activeAreaId);
  const selectedId = useEditor((state) => state.selectedObjectId);
  const select = useEditor((state) => state.select);
  const needle = query.trim().toLowerCase();
  const objects = objectsInArea(activeAreaId).filter((object) =>
    t(object.nameKey).toLowerCase().includes(needle),
  );

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
      <div className="tree" role="tree" tabIndex={0}>
        <div className="tree-row tree-root">
          <ChevronDown size={14} />
          <strong>{t('hierarchy.scene')}</strong>
        </div>
        {objects.length === 0 && <div className="empty-hint">{t('hierarchy.emptyArea')}</div>}
        {objects.map((object) => (
          <div
            key={object.id}
            role="treeitem"
            aria-selected={object.id === selectedId}
            className={`tree-row tree-item${object.id === selectedId ? ' selected' : ''}`}
            data-object-id={object.id}
            onClick={() => select(object.id)}
            onDoubleClick={() => {
              select(object.id);
              activeSceneView()?.focus(object.id);
            }}
          >
            {ICONS[object.kind]}
            <span>{t(object.nameKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
