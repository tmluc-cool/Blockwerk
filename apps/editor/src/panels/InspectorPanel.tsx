import { ChevronDown } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';
import type { TranslationKey } from '../i18n';
import { useEditor } from '../state/editor';
import { findSceneObject } from '../state/scene';
import type { ComponentKind, Vec3 } from '../state/scene';
import { useT } from '../state/settings';

const COMPONENT_TITLES: Readonly<Record<ComponentKind, TranslationKey>> = {
  camera: 'inspector.component.camera',
  light: 'inspector.component.light',
  meshRenderer: 'inspector.component.meshRenderer',
};

function VectorField({ label, value }: { label: string; value: Vec3 }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div className="vector-field">
        {(['X', 'Y', 'Z'] as const).map((axis, index) => (
          <label key={axis} className={`axis axis-${axis.toLowerCase()}`}>
            <span>{axis}</span>
            <input type="number" value={value[index]} readOnly disabled />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Inspector window: header, Transform and components of the selected object (read-only in phase 0). */
export function InspectorPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const selected = findSceneObject(useEditor((state) => state.selectedObjectId));

  if (!selected) {
    return (
      <div className="panel inspector" data-testid="inspector">
        <div className="empty-hint">{t('inspector.empty')}</div>
      </div>
    );
  }

  return (
    <div className="panel inspector" data-testid="inspector">
      <div className="inspector-header">
        <input type="checkbox" checked readOnly disabled aria-label={t('inspector.active')} />
        <input
          className="name-field"
          value={t(selected.nameKey)}
          readOnly
          disabled
          data-testid="inspector-name"
        />
        <label className="static-toggle">
          <input type="checkbox" disabled />
          {t('inspector.static')}
        </label>
      </div>
      <div className="inspector-header secondary">
        <span className="field-label">{t('inspector.tag')}</span>
        <select disabled>
          <option>{t('inspector.untagged')}</option>
        </select>
        <span className="field-label">{t('inspector.layer')}</span>
        <select disabled>
          <option>{t('inspector.defaultLayer')}</option>
        </select>
      </div>
      <section className="component">
        <header>
          <ChevronDown size={14} />
          <strong>{t('inspector.transform')}</strong>
        </header>
        <VectorField label={t('inspector.position')} value={selected.position} />
        <VectorField label={t('inspector.rotation')} value={selected.rotation} />
        <VectorField label={t('inspector.scale')} value={selected.scale} />
      </section>
      {selected.components.map((component) => (
        <section className="component" key={component}>
          <header>
            <ChevronDown size={14} />
            <input type="checkbox" checked readOnly disabled />
            <strong>{t(COMPONENT_TITLES[component])}</strong>
          </header>
        </section>
      ))}
      <div className="add-component">
        <button type="button" disabled>
          {t('inspector.addComponent')}
        </button>
      </div>
    </div>
  );
}
