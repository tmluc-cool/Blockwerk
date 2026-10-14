import type { LibraryEntry } from '@blockwerk/library';
import { ATTACHMENT_POINTS, parseAttachments } from '@blockwerk/runtime';
import { useEffect, useMemo, useState } from 'react';
import { libraryRef, libraryUrl, loadAssetLibrary, useAssetLibrary } from '../library/assetLibrary';
import { startLibraryDrag } from '../library/drag';
import { useSettings, useT } from '../state/settings';
import { setValue, valuesOf } from './studio';
import type { SectionProps } from './types';
import { StudioGroup } from './widgets';

/** The attachment point an item usually belongs to, from its name. */
export function suggestedPoint(entry: LibraryEntry): (typeof ATTACHMENT_POINTS)[number] {
  const text = `${entry.id} ${entry.tags.join(' ')}`.toLowerCase();
  if (/shield|torch|lantern|wand|staff/.test(text)) return 'leftHand';
  if (/hat|helm|crown|hood|cap/.test(text)) return 'head';
  if (/pack|quiver|bow|cape/.test(text)) return 'back';
  if (/belt|pouch|bottle|potion/.test(text)) return 'hip';
  return 'rightHand';
}

/** Writes the attachment list of a figure. */
export function writeAttachments(id: string, list: readonly (readonly [string, string])[]): void {
  setValue(
    id,
    'character',
    'attachments',
    list.map(([item, point]) => `${item}@${point}`).join(';'),
  );
}

/** Section "Equipment": items on the attachment points (hands, back, head, hip). */
export function EquipmentSection({ id, object }: SectionProps) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const index = useAssetLibrary((state) => state.index);
  useEffect(() => {
    void loadAssetLibrary();
  }, []);
  const [query, setQuery] = useState('');
  const [point, setPoint] = useState<(typeof ATTACHMENT_POINTS)[number]>('rightHand');
  const values = valuesOf(object, 'character');
  const attached = parseAttachments(String(values['attachments'] ?? ''));
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (index?.entries ?? [])
      .filter((entry) => entry.category === 'items')
      .filter(
        (entry) =>
          !needle ||
          `${entry.name.de} ${entry.name.en} ${entry.tags.join(' ')}`
            .toLowerCase()
            .includes(needle),
      )
      .slice(0, 60);
  }, [index, query]);
  const put = (entry: LibraryEntry, at: string): void =>
    writeAttachments(id, [
      ...attached.filter(([, existing]) => existing !== at),
      [libraryRef(entry), at],
    ]);
  return (
    <div className="studio-section" data-testid="studio-section-equipment">
      <StudioGroup title={t('studio.equipment.points')}>
        <ul className="studio-parts" data-testid="studio-attachments">
          {ATTACHMENT_POINTS.map((name) => {
            const item = attached.find(([, at]) => at === name)?.[0];
            return (
              <li key={name} className={point === name ? 'selected' : ''}>
                <button
                  type="button"
                  data-testid={`point-${name}`}
                  onClick={() => setPoint(name)}
                  aria-pressed={point === name}
                >
                  {t(`studio.point.${name}` as never)}
                </button>
                <span className="muted">{item ? item.replace('library:', '') : '–'}</span>
                {item && (
                  <button
                    type="button"
                    data-testid={`remove-${name}`}
                    onClick={() =>
                      writeAttachments(
                        id,
                        attached.filter(([, at]) => at !== name),
                      )
                    }
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </StudioGroup>
      <StudioGroup title={t('studio.equipment.items')}>
        <input
          type="search"
          placeholder={t('studio.equipment.search')}
          value={query}
          data-testid="studio-item-search"
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="muted">{t('studio.equipment.hint')}</p>
        <div className="studio-grid">
          {items.map((entry) => (
            <button
              key={entry.id}
              type="button"
              draggable
              className="studio-tile"
              title={entry.name[locale]}
              data-testid={`item-${entry.id}`}
              onDragStart={(event) => startLibraryDrag(event, entry)}
              onClick={() => put(entry, point)}
            >
              <img src={libraryUrl(entry.preview)} alt="" loading="lazy" />
              <span>{entry.name[locale]}</span>
            </button>
          ))}
        </div>
      </StudioGroup>
    </div>
  );
}
