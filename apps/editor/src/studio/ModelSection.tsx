import { REQUIRED_BONES, rigFromObject } from '@blockwerk/character';
import type { LibraryEntry } from '@blockwerk/library';
import { DEFAULT_ANIMATION_SOURCE, parseList } from '@blockwerk/runtime';
import { useEffect, useMemo, useState } from 'react';
import { libraryRef, libraryUrl, loadAssetLibrary, useAssetLibrary } from '../library/assetLibrary';
import { importModelFiles, MODEL_FILE_EXTENSIONS } from '../library/importModel';
import { useSettings, useT } from '../state/settings';
import { setValue, setValues, valuesOf } from './studio';
import type { SectionProps } from './types';
import { SliderRow, StudioGroup } from './widgets';

/** Animated characters of the library (models with a skeleton and animations). */
function useCharacterEntries(): LibraryEntry[] {
  const index = useAssetLibrary((state) => state.index);
  useEffect(() => {
    void loadAssetLibrary();
  }, []);
  return useMemo(
    () =>
      (index?.entries ?? []).filter(
        (entry) => entry.category === 'characters' && entry.animations.length > 0,
      ),
    [index],
  );
}

/** Positions of the required bones on the silhouette (percent of the width and height). */
const SILHOUETTE: Readonly<Record<string, readonly [number, number]>> = {
  head: [50, 9],
  spine: [50, 38],
  hips: [50, 52],
  leftUpperArm: [66, 25],
  leftLowerArm: [74, 38],
  leftHand: [80, 50],
  rightUpperArm: [34, 25],
  rightLowerArm: [26, 38],
  rightHand: [20, 50],
  leftUpperLeg: [58, 62],
  leftLowerLeg: [58, 78],
  leftFoot: [58, 94],
  rightUpperLeg: [42, 62],
  rightLowerLeg: [42, 78],
  rightFoot: [42, 94],
};

/** The recognized skeleton on a silhouette; a click on a dot lets you pick another bone. */
function Silhouette({ id, object, info }: Pick<SectionProps, 'id' | 'object' | 'info'>) {
  const t = useT();
  const mapping = info?.mapping ?? null;
  const [picking, setPicking] = useState<string | null>(null);
  const values = valuesOf(object, 'character');
  const overrides = Object.fromEntries(parseList(String(values['boneMap'] ?? '')));
  const nodes = useMemo(
    () => (info ? rigFromObject(info.root).bones.map((b) => b.name) : []),
    [info],
  );
  if (!info || info.mode === 'rigid' || !mapping) {
    return (
      <p className="muted" data-testid="studio-rigid">
        {info ? t('studio.rigid') : t('studio.loading')}
      </p>
    );
  }
  const current = (bone: string): string => overrides[bone] ?? mapping.map[bone] ?? '';
  const missing = REQUIRED_BONES.filter((bone) => !current(bone)).length;
  return (
    <div className="studio-skeleton" data-testid="studio-skeleton">
      <p className={missing === 0 ? 'ok' : 'warn'} data-testid="studio-skeleton-status">
        {missing === 0
          ? t('studio.skeleton.ok', { count: REQUIRED_BONES.length })
          : t('studio.skeleton.missing', { missing, count: REQUIRED_BONES.length })}
      </p>
      <div className="silhouette">
        {REQUIRED_BONES.map((bone) => {
          const place = SILHOUETTE[bone];
          if (!place) return null;
          return (
            <button
              key={bone}
              type="button"
              className={`bone-dot${current(bone) ? ' mapped' : ' missing'}`}
              style={{ left: `${place[0]}%`, top: `${place[1]}%` }}
              title={`${bone}: ${current(bone) || '–'}`}
              data-testid={`bone-${bone}`}
              onClick={() => setPicking(picking === bone ? null : bone)}
            />
          );
        })}
      </div>
      {picking && (
        <label className="field-row">
          <span className="field-label">{picking}</span>
          <select
            value={current(picking)}
            data-testid="bone-picker"
            onChange={(event) => {
              const next = { ...overrides };
              if (event.target.value) next[picking] = event.target.value;
              else Reflect.deleteProperty(next, picking);
              setValue(
                id,
                'character',
                'boneMap',
                Object.entries(next)
                  .map(([bone, node]) => `${bone}=${node}`)
                  .join(';'),
              );
              setPicking(null);
            }}
          >
            <option value="">{t('studio.skeleton.none')}</option>
            {nodes.map((node) => (
              <option key={node} value={node}>
                {node}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** Section "Model": choose or upload a model, body height, skeleton and animation source. */
export function ModelSection(props: SectionProps) {
  const { id, object, info } = props;
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const entries = useCharacterEntries();
  const [query, setQuery] = useState('');
  const values = valuesOf(object, 'character');
  const model = values['model'] as string | null;
  const shown = entries
    .filter((entry) => {
      const needle = query.trim().toLowerCase();
      return (
        !needle ||
        `${entry.name.de} ${entry.name.en} ${entry.tags.join(' ')}`.toLowerCase().includes(needle)
      );
    })
    .slice(0, 48);
  const upload = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = MODEL_FILE_EXTENSIONS.join(',');
    input.dataset['testid'] = 'studio-upload-input';
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      void importModelFiles(files).then((assets) => {
        const first = assets[0];
        if (first) setValue(id, 'character', 'model', first.id);
      });
    };
    input.click();
  };
  const source = (values['animationSource'] as string | null) ?? DEFAULT_ANIMATION_SOURCE;
  return (
    <div className="studio-section" data-testid="studio-section-model">
      <StudioGroup title={t('studio.model.choose')}>
        <div className="studio-row">
          <input
            type="search"
            placeholder={t('studio.model.search')}
            value={query}
            data-testid="studio-model-search"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" data-testid="studio-upload" onClick={upload}>
            {t('studio.model.upload')}
          </button>
        </div>
        <div className="studio-grid" data-testid="studio-model-grid">
          {shown.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`studio-tile${model === libraryRef(entry) ? ' active' : ''}`}
              title={entry.name[locale]}
              data-testid={`studio-model-${entry.id}`}
              onClick={() => setValue(id, 'character', 'model', libraryRef(entry))}
            >
              <img src={libraryUrl(entry.preview)} alt="" loading="lazy" />
              <span>{entry.name[locale]}</span>
            </button>
          ))}
          {shown.length === 0 && <p className="muted">{t('studio.model.none')}</p>}
        </div>
        <p className="muted">{t('studio.model.dropHint')}</p>
      </StudioGroup>
      <StudioGroup title={t('studio.model.size')}>
        <SliderRow
          label={t('studio.model.bodyHeight')}
          value={Number(values['bodyHeight'] ?? 1.8)}
          min={0.3}
          max={4}
          step={0.05}
          unit="m"
          testId="studio-body-height"
          onChange={(value) => setValue(id, 'character', 'bodyHeight', value)}
        />
      </StudioGroup>
      <StudioGroup title={t('studio.skeleton')}>
        <Silhouette id={id} object={object} info={info} />
      </StudioGroup>
      <StudioGroup title={t('studio.animationSource')}>
        <label className="field-row">
          <span className="field-label">{t('studio.animationSource.from')}</span>
          <select
            value={source}
            data-testid="studio-animation-source"
            onChange={(event) =>
              setValues(id, 'character', { animationSource: event.target.value })
            }
          >
            {[...entries.map((entry) => libraryRef(entry))].map((ref) => (
              <option key={ref} value={ref}>
                {ref.replace('library:', '')}
              </option>
            ))}
          </select>
        </label>
        <label className="field-row">
          <span className="field-label">{t('studio.animationSource.transfer')}</span>
          <input
            type="checkbox"
            checked={values['libraryAnimations'] !== false}
            data-testid="studio-transfer"
            onChange={(event) =>
              setValue(id, 'character', 'libraryAnimations', event.target.checked)
            }
          />
        </label>
      </StudioGroup>
    </div>
  );
}
