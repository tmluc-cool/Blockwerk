import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useEditor } from '../state/editor';
import type { AreaTab } from '../state/editor';
import { useT } from '../state/settings';

/** Area tabs below the tool bar (SPEC 5.3). Alt+1 … Alt+9 switches tabs. */
export function AreaTabs() {
  const t = useT();
  const { areas, activeAreaId, setActiveArea, addArea, renameArea } = useEditor();
  const [editingId, setEditingId] = useState<string | null>(null);
  const label = (area: AreaTab): string =>
    area.nameKey ? t(area.nameKey) : (area.name ?? area.id);

  return (
    <div className="area-tabs" role="tablist" data-testid="area-tabs">
      {areas.map((area, index) =>
        editingId === area.id ? (
          <input
            key={area.id}
            className="area-tab-input"
            defaultValue={label(area)}
            autoFocus
            onBlur={(event) => {
              renameArea(area.id, event.target.value.trim() || label(area));
              setEditingId(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setEditingId(null);
            }}
          />
        ) : (
          <button
            key={area.id}
            type="button"
            role="tab"
            aria-selected={area.id === activeAreaId}
            className={`area-tab${area.id === activeAreaId ? ' active' : ''}`}
            data-testid={`area-${area.id}`}
            title={area.nameKey ? `Alt+${index + 1}` : t('area.renameHint')}
            onClick={() => setActiveArea(area.id)}
            onDoubleClick={() => {
              if (!area.nameKey) setEditingId(area.id);
            }}
          >
            {label(area)}
          </button>
        ),
      )}
      <button
        type="button"
        className="area-tab add"
        title={t('area.add')}
        data-testid="area-add"
        onClick={() => {
          const count = areas.filter((area) => !area.nameKey).length + 1;
          const id = addArea(t('area.newName', { n: count }));
          setEditingId(id);
        }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
