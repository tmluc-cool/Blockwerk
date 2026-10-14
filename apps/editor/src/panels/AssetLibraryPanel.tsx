import { LIBRARY_CATEGORIES } from '@blockwerk/library';
import type { LibraryEntry } from '@blockwerk/library';
import type { IDockviewPanelProps } from 'dockview-react';
import { Clock, Download, Library, Package, PackagePlus, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createLibraryObject } from '../document/actions';
import type { TranslationKey } from '../i18n';
import { libraryRef, libraryUrl, loadAssetLibrary, useAssetLibrary } from '../library/assetLibrary';
import { endLibraryDrag, startLibraryDrag } from '../library/drag';
import { BrushControls } from '../library/BrushControls';
import { importLibraryModel } from '../library/importModel';
import { useLibraryPrefs } from '../library/libraryPrefs';
import { ModelPreview } from '../library/ModelPreview';
import { MyPrefabsView } from '../library/MyPrefabsView';
import { NO_FILTER, searchLibrary } from '../library/search';
import type { LibraryFilter } from '../library/search';
import { useDocument } from '../state/document';
import { usePlay } from '../state/play';
import { useSettings, useT } from '../state/settings';

/** Triangle limits of the polygon filter. */
const TRIANGLE_LIMITS = [500, 2000, 10000] as const;

/** Formats a size in meters with one decimal (two below 1 m). */
function meters(value: number): string {
  return value < 1 ? value.toFixed(2) : value.toFixed(1);
}

/**
 * Asset library window (SPEC 5.8, 6.1): CC0 models from `pnpm assets:fetch` with fuzzy search
 * in German and English, filters, favorites, recently used, a rotatable preview and drag and
 * drop into the scene.
 */
export function AssetLibraryPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const status = useAssetLibrary((state) => state.status);
  const index = useAssetLibrary((state) => state.index);
  const favorites = useLibraryPrefs((state) => state.favorites);
  const recent = useLibraryPrefs((state) => state.recent);
  const tileSize = useLibraryPrefs((state) => state.tileSize);
  const playing = usePlay((state) => state.status !== 'stopped');
  const hasProject = useDocument((state) => state.project !== null);
  const [filter, setFilter] = useState<LibraryFilter>(NO_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void loadAssetLibrary();
  }, []);

  const entries = useMemo(() => index?.entries ?? [], [index]);
  const results = useMemo(
    () => searchLibrary(entries, filter, { favorites, recent }, locale),
    [entries, filter, favorites, recent, locale],
  );
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) map.set(entry.category, (map.get(entry.category) ?? 0) + 1);
    return map;
  }, [entries]);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const update = (patch: Partial<LibraryFilter>): void => setFilter({ ...filter, ...patch });

  if (status !== 'ready') {
    return (
      <div className="panel asset-library" data-testid="asset-library">
        <div className="empty-hint" data-testid="library-status">
          {t(status === 'loading' ? 'assetLibrary.loading' : 'assetLibrary.missing')}
        </div>
      </div>
    );
  }

  const categoryRow = (
    value: LibraryFilter['category'],
    label: string,
    icon: React.ReactNode,
    count?: number,
  ) => (
    <div
      key={value}
      role="treeitem"
      aria-selected={filter.category === value}
      className={`tree-row tree-item${filter.category === value ? ' selected' : ''}`}
      data-testid={`library-category-${value}`}
      onClick={() => update({ category: value })}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <span className="muted count">{count}</span>}
    </div>
  );

  const place = (entry: LibraryEntry): void => {
    createLibraryObject(entry);
  };

  return (
    <div className="panel asset-library" data-testid="asset-library">
      <div className="panel-toolbar">
        <input
          className="search"
          type="search"
          data-testid="library-search"
          placeholder={t('assetLibrary.search')}
          value={filter.query}
          onChange={(event) => update({ query: event.target.value })}
        />
        <label className="toolbar-field">
          <input
            type="checkbox"
            data-testid="library-animated"
            checked={filter.animatedOnly}
            onChange={(event) => update({ animatedOnly: event.target.checked })}
          />
          <span>{t('assetLibrary.animatedOnly')}</span>
        </label>
        <label className="toolbar-field">
          <span className="muted">{t('assetLibrary.triangles')}</span>
          <select
            data-testid="library-triangles"
            value={filter.maxTriangles ?? ''}
            onChange={(event) =>
              update({ maxTriangles: event.target.value ? Number(event.target.value) : null })
            }
          >
            <option value="">{t('assetLibrary.trianglesAny')}</option>
            {TRIANGLE_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {t('assetLibrary.trianglesMax', { n: limit.toLocaleString(locale) })}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar-spacer" />
        <span className="muted" data-testid="library-count">
          {t('assetLibrary.count', { n: results.length })}
        </span>
        <input
          type="range"
          min={64}
          max={160}
          step={8}
          value={tileSize}
          title={t('assetLibrary.tileSize')}
          aria-label={t('assetLibrary.tileSize')}
          onChange={(event) => useLibraryPrefs.getState().setTileSize(Number(event.target.value))}
        />
      </div>
      <div className="split">
        <div className="tree folder-tree" role="tree" tabIndex={0}>
          {categoryRow('all', t('assetLibrary.all'), <Library size={14} />, entries.length)}
          {categoryRow('favorites', t('assetLibrary.favorites'), <Star size={14} />)}
          {categoryRow('recent', t('assetLibrary.recent'), <Clock size={14} />)}
          {categoryRow('mine', t('myPrefabs.title'), <Package size={14} />)}
          {LIBRARY_CATEGORIES.filter((category) => counts.has(category)).map((category) =>
            categoryRow(
              category,
              t(`assetLibrary.category.${category}` as TranslationKey),
              <span className="tree-indent" />,
              counts.get(category),
            ),
          )}
        </div>
        {filter.category === 'mine' && (
          <MyPrefabsView query={filter.query} disabled={playing || !hasProject} />
        )}
        <div
          className="library-grid"
          hidden={filter.category === 'mine'}
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
        >
          {results.length === 0 && <div className="empty-hint">{t('assetLibrary.noResults')}</div>}
          {results.map((entry) => (
            <div
              key={entry.id}
              className={`library-tile${entry.id === selectedId ? ' selected' : ''}`}
              data-testid={`library-tile-${entry.id}`}
              title={entry.name[locale]}
              tabIndex={0}
              draggable={!playing}
              onClick={() => setSelectedId(entry.id)}
              onDoubleClick={() => place(entry)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') place(entry);
              }}
              onDragStart={(event) => startLibraryDrag(event, entry)}
              onDragEnd={endLibraryDrag}
            >
              <img
                src={libraryUrl(entry.preview)}
                alt=""
                loading="lazy"
                draggable={false}
                style={{ width: tileSize, height: tileSize }}
              />
              <span>{entry.name[locale]}</span>
              {favorites.includes(entry.id) && <Star size={12} className="favorite-mark" />}
            </div>
          ))}
        </div>
        {selected && filter.category !== 'mine' && (
          <aside className="library-details" data-testid="library-details">
            <ModelPreview modelRef={libraryRef(selected)} testId="library-preview" />
            <h3>{selected.name[locale]}</h3>
            <dl>
              <dt>{t('assetLibrary.info.category')}</dt>
              <dd>{t(`assetLibrary.category.${selected.category}` as TranslationKey)}</dd>
              <dt>{t('assetLibrary.info.size')}</dt>
              <dd>
                {selected.size.map(meters).join(' × ')} {t('unit.meters')}
              </dd>
              <dt>{t('assetLibrary.info.triangles')}</dt>
              <dd>{selected.triangles.toLocaleString(locale)}</dd>
              {selected.animations.length > 0 && (
                <>
                  <dt>{t('assetLibrary.info.animations')}</dt>
                  <dd>{selected.animations.length}</dd>
                </>
              )}
              <dt>{t('assetLibrary.info.license')}</dt>
              <dd>{selected.license}</dd>
              <dt>{t('assetLibrary.info.author')}</dt>
              <dd>{selected.author}</dd>
              <dt>{t('assetLibrary.info.source')}</dt>
              <dd>{index?.sources.find((source) => source.id === selected.source)?.name}</dd>
            </dl>
            <div className="button-column">
              <button
                type="button"
                data-testid="library-place"
                disabled={playing || !hasProject}
                onClick={() => place(selected)}
              >
                <PackagePlus size={14} /> {t('assetLibrary.place')}
              </button>
              <button
                type="button"
                data-testid="library-import"
                disabled={playing || !hasProject}
                onClick={() => void importLibraryModel(selected)}
              >
                <Download size={14} /> {t('assetLibrary.import')}
              </button>
              <BrushControls
                source={{ kind: 'library', id: selected.id }}
                disabled={playing || !hasProject}
              />
              <button
                type="button"
                data-testid="library-favorite"
                aria-pressed={favorites.includes(selected.id)}
                className={favorites.includes(selected.id) ? 'toggled' : undefined}
                onClick={() => useLibraryPrefs.getState().toggleFavorite(selected.id)}
              >
                <Star size={14} /> {t('assetLibrary.favorite')}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
