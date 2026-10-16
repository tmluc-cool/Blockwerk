import type { JsonValue } from '@blockwerk/project';
import { OBJECTS_DRAG_TYPE } from '../../library/projectDrag';
import { useDocument } from '../../state/document';
import { useT } from '../../state/settings';
import { useFieldLabel } from './fieldLabel';
import { MIXED } from './fields';
import type { Shared } from './fields';

/**
 * Field for a reference to a scene object (Unity: a GameObject field): pick it from the list or
 * drag it in from the Hierarchy.
 */
export function ObjectField({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: Shared<JsonValue> | undefined;
  onChange: (value: JsonValue) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const t = useT();
  const name = useFieldLabel();
  const objects = useDocument((state) => state.scene?.objects);
  const id = typeof value === 'string' ? value : '';
  const entries = Object.entries(objects ?? {}).sort(([, a], [, b]) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  );
  return (
    <span
      className="asset-field"
      onDragOver={(event) => {
        if (!disabled && event.dataTransfer.types.includes(OBJECTS_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'link';
        }
      }}
      onDrop={(event) => {
        const ids = JSON.parse(event.dataTransfer.getData(OBJECTS_DRAG_TYPE) || '[]') as unknown;
        if (!Array.isArray(ids) || typeof ids[0] !== 'string') return;
        event.preventDefault();
        onChange(ids[0]);
      }}
    >
      <select
        value={value === MIXED ? '\u0000' : id}
        aria-label={name}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        {value === MIXED && <option value={'\u0000'}>{t('inspector.mixed')}</option>}
        <option value="">{t('inspector.none')}</option>
        {id && !objects?.[id] && <option value={id}>{t('inspector.missing')}</option>}
        {entries.map(([objectId, object]) => (
          <option key={objectId} value={objectId}>
            {object.name}
          </option>
        ))}
      </select>
    </span>
  );
}
