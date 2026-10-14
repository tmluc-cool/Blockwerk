import { modelImportSettings } from '@blockwerk/project';
import type { AssetEntry, ModelImportSettings } from '@blockwerk/project';
import { ModelCache } from '@blockwerk/runtime';
import { useEffect, useState } from 'react';
import { Box3, Vector3 } from 'three';
import { editorModels } from '../../library/models';
import { ModelPreview } from '../../library/ModelPreview';
import { updateModelSettings } from '../../state/document';
import { useT } from '../../state/settings';
import { NumberInput } from './fields';

/** Height of the comparison figure in the import preview (SPEC 6.3). */
export const REFERENCE_HEIGHT = 1.8;

/**
 * Import settings of a model (SPEC 6.3, Unity: Model Import Settings): scale with a comparison
 * to a 1.8 m figure, pivot, collider generation and the license of the file.
 */
export function ModelImportInspector({ entry }: { entry: AssetEntry<'model'> }) {
  const t = useT();
  const settings = modelImportSettings(entry.meta);
  const [size, setSize] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void editorModels.load(entry.id).then((template) => {
      if (cancelled || !template) return;
      const bounds = new Box3().setFromObject(ModelCache.instantiate(template));
      if (!bounds.isEmpty()) setSize(bounds.getSize(new Vector3()).toArray());
    });
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.meta]);

  const change = (patch: Partial<ModelImportSettings>, license = entry.meta.license): void =>
    updateModelSettings(entry.id, { ...settings, ...patch }, license);

  return (
    <div className="model-import" data-testid="model-import">
      <ModelPreview modelRef={entry.id} testId="model-import-preview" />
      {size && (
        <div className="model-size" data-testid="model-size">
          <span>
            {t('import.size', {
              x: size[0].toFixed(2),
              y: size[1].toFixed(2),
              z: size[2].toFixed(2),
            })}
          </span>
          <span className="reference-bar">
            <span
              className="reference-model"
              style={{
                height: `${Math.min(100, (size[1] / Math.max(size[1], REFERENCE_HEIGHT)) * 100)}%`,
              }}
            />
            <span
              className="reference-figure"
              title={t('import.reference')}
              style={{
                height: `${Math.min(100, (REFERENCE_HEIGHT / Math.max(size[1], REFERENCE_HEIGHT)) * 100)}%`,
              }}
            />
          </span>
        </div>
      )}
      <div className="field-row">
        <span className="field-label">{t('import.scale')}</span>
        <div className="field-value">
          <NumberInput
            value={settings.scale}
            step={0.1}
            min={0.001}
            testId="import-scale"
            onChange={(value) => {
              if (value > 0) change({ scale: value });
            }}
          />
        </div>
      </div>
      <div className="field-row">
        <span className="field-label">{t('import.pivot')}</span>
        <div className="field-value">
          <select
            value={settings.pivot}
            data-testid="import-pivot"
            onChange={(event) =>
              change({ pivot: event.target.value as ModelImportSettings['pivot'] })
            }
          >
            <option value="bottom">{t('import.pivot.bottom')}</option>
            <option value="center">{t('import.pivot.center')}</option>
            <option value="original">{t('import.pivot.original')}</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <span className="field-label">{t('import.generateCollider')}</span>
        <div className="field-value">
          <input
            type="checkbox"
            checked={settings.generateCollider}
            data-testid="import-collider"
            onChange={(event) => change({ generateCollider: event.target.checked })}
          />
        </div>
      </div>
      <div className="field-row">
        <span className="field-label">{t('import.license')}</span>
        <div className="field-value">
          <input
            type="text"
            key={entry.meta.license ?? ''}
            defaultValue={entry.meta.license ?? ''}
            placeholder={t('import.licenseHint')}
            data-testid="import-license"
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value !== (entry.meta.license ?? '')) change({}, value || null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
