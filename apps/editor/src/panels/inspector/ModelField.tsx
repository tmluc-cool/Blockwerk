import { assetDisplayName } from '@blockwerk/project';
import { Box } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  LIBRARY_PREFIX,
  libraryEntryOf,
  libraryRef,
  libraryUrl,
  loadAssetLibrary,
  useAssetLibrary,
} from '../../library/assetLibrary';
import { draggedLibraryEntry, LIBRARY_DRAG_TYPE } from '../../library/drag';
import { NO_FILTER, searchLibrary } from '../../library/search';
import { useLibraryPrefs } from '../../library/libraryPrefs';
import { ASSET_DRAG_TYPE } from '../../library/projectDrag';
import { useDocument } from '../../state/document';
import { useSettings, useT } from '../../state/settings';
import { MIXED } from './fields';
import type { Shared } from './fields';

/** How many library results the picker lists at most. */
const PICKER_LIMIT = 60;

/** Display name of a model reference: library entry, project model or the raw reference. */
function useModelName(ref: string | null): {
  name: string;
  preview: string | null;
  missing: boolean;
} {
  const locale = useSettings((state) => state.locale);
  const project = useDocument((state) => state.project);
  useAssetLibrary((state) => state.status);
  if (!ref) return { name: '', preview: null, missing: false };
  if (ref.startsWith(LIBRARY_PREFIX)) {
    const entry = libraryEntryOf(ref);
    return entry
      ? { name: entry.name[locale], preview: libraryUrl(entry.preview), missing: false }
      : { name: ref, preview: null, missing: useAssetLibrary.getState().status !== 'loading' };
  }
  const asset = project?.assetOfType(ref, 'model');
  return asset
    ? { name: assetDisplayName(asset.path), preview: null, missing: false }
    : { name: ref, preview: null, missing: true };
}

/**
 * The Mesh Renderer's model field (Unity: Mesh field with object picker): shows the model, opens
 * a searchable list of project and library models, and accepts models dropped from the asset
 * library or the project window.
 */
export function ModelField({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: Shared<unknown> | undefined;
  onChange: (ref: string | null) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const project = useDocument((state) => state.project);
  const entries = useAssetLibrary((state) => state.index?.entries);
  const prefs = useLibraryPrefs();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLSpanElement>(null);
  const ref = typeof value === 'string' ? value : null;
  const current = useModelName(ref);

  useEffect(() => {
    if (!open) return;
    void loadAssetLibrary();
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const projectModels = (project?.assetsOfType('model') ?? []).filter((asset) =>
    assetDisplayName(asset.path).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const libraryResults = useMemo(
    () =>
      searchLibrary(entries ?? [], { ...NO_FILTER, query }, prefs, locale).slice(0, PICKER_LIMIT),
    [entries, query, prefs, locale],
  );

  const choose = (next: string | null): void => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };
  const onDrop = (event: DragEvent): void => {
    const entry = draggedLibraryEntry();
    const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (entry) {
      event.preventDefault();
      choose(libraryRef(entry));
    } else if (assetId && project?.assetOfType(assetId, 'model')) {
      event.preventDefault();
      choose(assetId);
    }
  };

  return (
    <span
      className={`model-field${current.missing ? ' missing' : ''}`}
      ref={rootRef}
      onDragOver={(event) => {
        const types = event.dataTransfer.types;
        if (!disabled && (types.includes(LIBRARY_DRAG_TYPE) || types.includes(ASSET_DRAG_TYPE))) {
          event.preventDefault();
        }
      }}
      onDrop={disabled ? undefined : onDrop}
    >
      <button
        type="button"
        className="model-field-button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        title={t('inspector.model.choose')}
      >
        {current.preview ? <img src={current.preview} alt="" /> : <Box size={14} />}
        <span>
          {value === MIXED
            ? t('inspector.mixed')
            : ref
              ? current.missing
                ? t('inspector.model.missing', { ref })
                : current.name
              : t('inspector.model.none')}
        </span>
      </button>
      {open && (
        <div className="model-picker" data-testid={testId ? `${testId}-picker` : undefined}>
          <input
            autoFocus
            type="search"
            placeholder={t('inspector.model.search')}
            aria-label={t('inspector.model.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
          />
          <div className="model-picker-list">
            <button type="button" onClick={() => choose(null)}>
              <Box size={14} /> {t('inspector.model.none')}
            </button>
            {projectModels.map((asset) => (
              <button
                key={asset.id}
                type="button"
                data-testid={`model-option-${asset.id}`}
                onClick={() => choose(asset.id)}
              >
                <Box size={14} /> {assetDisplayName(asset.path)}
              </button>
            ))}
            {libraryResults.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-testid={`model-option-${entry.id}`}
                onClick={() => choose(libraryRef(entry))}
              >
                <img src={libraryUrl(entry.preview)} alt="" loading="lazy" />
                {entry.name[locale]}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
