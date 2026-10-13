import { Plus } from 'lucide-react';
import { useState } from 'react';
import { createArea, renameObject } from '../document/actions';
import { areaRoots } from '../document/sceneOps';
import { objectName } from '../scene/worlds';
import { useDocument } from '../state/document';
import { ALL_AREAS, useEditor } from '../state/editor';
import { usePlay } from '../state/play';
import { useT } from '../state/settings';

/** IDs of the area tabs in order ("All" first), for Alt+1 … Alt+9. */
export function areaTabIds(): string[] {
  const scene = useDocument.getState().scene;
  return [ALL_AREAS, ...(scene ? areaRoots(scene).map((entry) => entry.id) : [])];
}

/** Area tabs below the tool bar (SPEC 5.3). Each tab is an area root object of the scene. */
export function AreaTabs() {
  const t = useT();
  const scene = useDocument((state) => state.scene);
  const activeAreaId = useEditor((state) => state.activeAreaId);
  const setActiveArea = useEditor((state) => state.setActiveArea);
  const playing = usePlay((state) => state.status !== 'stopped');
  const [editingId, setEditingId] = useState<string | null>(null);
  const roots = scene ? areaRoots(scene) : [];
  const active =
    activeAreaId === ALL_AREAS || roots.some((root) => root.id === activeAreaId)
      ? activeAreaId
      : ALL_AREAS;

  return (
    <div className="area-tabs" role="tablist" data-testid="area-tabs">
      <button
        type="button"
        role="tab"
        aria-selected={active === ALL_AREAS}
        className={`area-tab${active === ALL_AREAS ? ' active' : ''}`}
        data-testid="area-all"
        title={t('area.shortcut', { n: 1 })}
        onClick={() => setActiveArea(ALL_AREAS)}
      >
        {t('area.all')}
      </button>
      {roots.map(({ id, object }, index) => {
        const custom = object.area === 'custom';
        const label = objectName(object, id);
        return editingId === id ? (
          <input
            key={id}
            className="area-tab-input"
            defaultValue={label}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
              renameObject(id, event.target.value);
              setEditingId(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setEditingId(null);
            }}
          />
        ) : (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === active}
            className={`area-tab${id === active ? ' active' : ''}`}
            data-testid={`area-${object.area === 'custom' ? id : object.area}`}
            title={
              custom
                ? t('area.renameHint')
                : index < 8
                  ? t('area.shortcut', { n: index + 2 })
                  : undefined
            }
            style={object.color ? { borderTopColor: object.color } : undefined}
            onClick={() => setActiveArea(id)}
            onDoubleClick={() => {
              if (custom && !playing) setEditingId(id);
            }}
          >
            {label}
          </button>
        );
      })}
      <button
        type="button"
        className="area-tab add"
        title={t('area.add')}
        data-testid="area-add"
        disabled={playing || !scene}
        onClick={() => {
          const id = createArea();
          if (id) setEditingId(id);
        }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
