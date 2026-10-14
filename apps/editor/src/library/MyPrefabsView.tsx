import { Download, Package, PackagePlus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { instantiatePrefabAsset } from '../document/prefabActions';
import { useEditor } from '../state/editor';
import { useSettings, useT } from '../state/settings';
import { endLibraryDrag, startMyPrefabDrag } from './drag';
import { deleteMyPrefab, importMyPrefab, refreshMyPrefabs, useMyPrefabs } from './myPrefabs';

/**
 * "My Prefabs" in the asset library (SPEC 6.4): prefabs saved from any project, placed or
 * imported into the open one together with everything they need.
 */
export function MyPrefabsView({ query, disabled }: { query: string; disabled: boolean }) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const packages = useMyPrefabs((state) => state.packages);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void refreshMyPrefabs();
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = packages.filter((item) => item.name.toLowerCase().includes(needle));
  const selected = packages.find((item) => item.id === selectedId) ?? null;
  const place = async (id: string): Promise<void> => {
    const prefab = await importMyPrefab(id);
    if (prefab) instantiatePrefabAsset(prefab);
  };

  return (
    <>
      <div className="library-grid my-prefabs">
        {shown.length === 0 && <div className="empty-hint">{t('myPrefabs.empty')}</div>}
        {shown.map((item) => (
          <div
            key={item.id}
            className={`library-tile${item.id === selectedId ? ' selected' : ''}`}
            data-testid={`my-prefab-${item.name}`}
            tabIndex={0}
            draggable={!disabled}
            onClick={() => setSelectedId(item.id)}
            onDoubleClick={() => void place(item.id)}
            onDragStart={(event) => startMyPrefabDrag(event, item.id)}
            onDragEnd={endLibraryDrag}
          >
            <Package size={48} className="prefab-icon" />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
      {selected && (
        <aside className="library-details" data-testid="my-prefab-details">
          <h3>{selected.name}</h3>
          <dl>
            <dt>{t('prefab.objects')}</dt>
            <dd>{t('myPrefabs.files', { n: selected.files })}</dd>
            <dt>{t('myPrefabs.title')}</dt>
            <dd>{new Date(selected.savedAt).toLocaleString(locale)}</dd>
          </dl>
          <div className="button-column">
            <button
              type="button"
              data-testid="my-prefab-place"
              disabled={disabled}
              onClick={() => void place(selected.id)}
            >
              <PackagePlus size={14} /> {t('assetLibrary.place')}
            </button>
            <button
              type="button"
              data-testid="my-prefab-import"
              disabled={disabled}
              onClick={() =>
                void importMyPrefab(selected.id).then((id) => {
                  if (id) useEditor.getState().selectAsset(id);
                })
              }
            >
              <Download size={14} /> {t('assetLibrary.import')}
            </button>
            <button
              type="button"
              data-testid="my-prefab-remove"
              onClick={() => {
                void deleteMyPrefab(selected.id);
                setSelectedId(null);
              }}
            >
              <Trash2 size={14} /> {t('myPrefabs.remove')}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
