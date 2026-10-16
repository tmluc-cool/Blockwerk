import { assetDisplayName } from '@blockwerk/project';
import type { JsonValue } from '@blockwerk/project';
import { BUILTIN_SOUNDS, isBuiltinSound } from '@blockwerk/runtime';
import type { FieldDefinition } from '@blockwerk/runtime';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState } from 'react';
import type { TranslationKey } from '../../i18n';
import { previewSound, stopPreview } from '../../audio/editorAudio';
import { useDocument } from '../../state/document';
import { useT } from '../../state/settings';
import { useFieldLabel } from './fieldLabel';
import { ModelField } from './ModelField';
import { ObjectField } from './ObjectField';

/** Marker for values that differ between selected objects (shown as "—"). */
export const MIXED: unique symbol = Symbol('mixed');
export type Shared<T> = T | typeof MIXED;

/** The common value of several objects, or {@link MIXED}. */
export function shared<T>(values: readonly T[]): Shared<T> | undefined {
  if (values.length === 0) return undefined;
  const first = JSON.stringify(values[0]);
  return values.every((value) => JSON.stringify(value) === first) ? values[0] : MIXED;
}

function format(value: number): string {
  return String(Math.round(value * 1e5) / 1e5);
}

interface NumberInputProps {
  readonly value: Shared<number>;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
  readonly testId?: string;
  readonly label?: string;
  readonly disabled?: boolean;
}

/**
 * Number field like Unity's: type a value (Enter or leaving the field applies it) or drag the
 * label left and right to change it.
 */
export function NumberInput({
  value,
  onChange,
  step = 0.1,
  min,
  max,
  testId,
  label,
  disabled,
}: NumberInputProps) {
  const t = useT();
  const name = useFieldLabel(typeof label === 'string' ? label : undefined);
  const shown = value === MIXED ? '' : format(value);
  // While typing, the field shows the draft; otherwise the current value.
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const clamp = (next: number): number =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
  const commit = (): void => {
    const text = draft ?? shown;
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const parsed = Number(text.replace(',', '.'));
    if (text.trim() !== '' && Number.isFinite(parsed) && parsed !== value) onChange(clamp(parsed));
  };
  const startDrag = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const start = value === MIXED ? 0 : value;
    const move = (moveEvent: PointerEvent): void => {
      const delta = (moveEvent.clientX - startX) * step * (moveEvent.shiftKey ? 10 : 1);
      onChange(clamp(Math.round((start + delta) / step) * step));
    };
    const end = (): void => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
  };
  return (
    <label className="number-input">
      {label !== undefined && (
        <span className="drag-label" onPointerDown={startDrag}>
          {label}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? shown}
        placeholder={value === MIXED ? t('inspector.mixed') : undefined}
        aria-label={name}
        disabled={disabled}
        data-testid={testId}
        onFocus={(event) => {
          setDraft(shown);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            cancelled.current = true;
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

const AXES = ['X', 'Y', 'Z'] as const;

/** Three number fields (position, rotation, scale, sizes). */
export function VectorInput({
  values,
  onChange,
  step,
  testId,
  disabled,
}: {
  values: readonly Shared<number>[];
  onChange: (axis: 0 | 1 | 2, value: number) => void;
  step?: number;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <div className="vector-field">
      {AXES.map((axis, index) => (
        <div key={axis} className={`axis axis-${axis.toLowerCase()}`}>
          <NumberInput
            label={axis}
            value={values[index] ?? 0}
            step={step}
            disabled={disabled}
            testId={testId ? `${testId}-${axis.toLowerCase()}` : undefined}
            onChange={(value) => onChange(index as 0 | 1 | 2, value)}
          />
        </div>
      ))}
    </div>
  );
}

const UNITS: Readonly<Record<string, TranslationKey>> = {
  meters: 'unit.meters',
  degrees: 'unit.degrees',
  seconds: 'unit.seconds',
  percent: 'unit.percent',
};

/** An editor for one component field, chosen by the field type. */
export function FieldEditor({
  field,
  value,
  onChange,
  locale,
  testId,
  disabled,
  assets,
  onOpenAsset,
}: {
  field: FieldDefinition;
  value: Shared<JsonValue> | undefined;
  onChange: (value: JsonValue) => void;
  locale: 'de' | 'en';
  testId?: string;
  disabled?: boolean;
  assets?: readonly { id: string; name: string }[];
  onOpenAsset?: (id: string) => void;
}) {
  const t = useT();
  const name = useFieldLabel();
  const unit = 'unit' in field && field.unit ? t(UNITS[field.unit] ?? 'unit.meters') : null;
  switch (field.type) {
    case 'number':
      return (
        <span className="field-with-unit">
          <NumberInput
            value={typeof value === 'number' || value === MIXED ? value : field.default}
            step={field.step}
            min={field.min}
            max={field.max}
            disabled={disabled}
            testId={testId}
            onChange={onChange}
          />
          {unit && <span className="unit">{unit}</span>}
        </span>
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value === true}
          ref={(element) => {
            if (element) element.indeterminate = value === MIXED;
          }}
          aria-label={name}
          disabled={disabled}
          data-testid={testId}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    case 'string':
      return (
        <input
          type="text"
          defaultValue={typeof value === 'string' ? value : ''}
          key={typeof value === 'string' ? value : 'mixed'}
          placeholder={value === MIXED ? t('inspector.mixed') : undefined}
          aria-label={name}
          disabled={disabled}
          data-testid={testId}
          onBlur={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      );
    case 'color':
      return (
        <input
          type="color"
          value={typeof value === 'string' ? value : field.default}
          className={value === MIXED ? 'mixed' : undefined}
          aria-label={name}
          disabled={disabled}
          data-testid={testId}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'vector3': {
      const vector = Array.isArray(value) ? value : value === MIXED ? null : field.default;
      return (
        <VectorInput
          values={[0, 1, 2].map((index) => (vector ? Number(vector[index] ?? 0) : MIXED))}
          testId={testId}
          disabled={disabled}
          onChange={(axis, next) => {
            const base = vector ? vector.map(Number) : [...field.default];
            base[axis] = next;
            onChange(base);
          }}
        />
      );
    }
    case 'enum':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          aria-label={name}
          disabled={disabled}
          data-testid={testId}
          onChange={(event) => onChange(event.target.value)}
        >
          {value === MIXED && <option value="">{t('inspector.mixed')}</option>}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.text[locale]}
            </option>
          ))}
        </select>
      );
    case 'object':
      return <ObjectField value={value} onChange={onChange} disabled={disabled} testId={testId} />;
    case 'asset': {
      if (field.assetType === 'sound') {
        return <SoundField value={value} onChange={onChange} disabled={disabled} testId={testId} />;
      }
      if (field.assetType === 'model') {
        return <ModelField value={value} onChange={onChange} disabled={disabled} testId={testId} />;
      }
      const id = typeof value === 'string' ? value : '';
      return (
        <span className="asset-field">
          <select
            value={value === MIXED ? '\u0000' : id}
            aria-label={name}
            disabled={disabled}
            data-testid={testId}
            onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
          >
            {value === MIXED && <option value={'\u0000'}>{t('inspector.mixed')}</option>}
            <option value="">{t('inspector.none')}</option>
            {(assets ?? []).map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
          {id && onOpenAsset && (
            <button
              type="button"
              className="small"
              data-testid={testId ? `${testId}-open` : undefined}
              onClick={() => onOpenAsset(id)}
            >
              {t('inspector.open')}
            </button>
          )}
        </span>
      );
    }
  }
}

/** Plays a sound for listening (built-in `builtin:<name>` or project `audio:<id>`). */
export function SoundPreviewButton({ value }: { value: string }) {
  const t = useT();
  return (
    <div className="add-component">
      <button type="button" data-testid="sound-preview" onClick={() => previewSound(value)}>
        {t('sound.preview')}
      </button>
      <button type="button" data-testid="sound-preview-stop" onClick={stopPreview}>
        {t('sound.stop')}
      </button>
    </div>
  );
}

/** Choice of a sound: none, a built-in sound or a sound of the project, with a preview button. */
function SoundField({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: Shared<unknown> | undefined;
  onChange: (value: JsonValue) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const t = useT();
  const name = useFieldLabel();
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const current = typeof value === 'string' ? value : '';
  const audio = project?.assetsOfType('audio') ?? [];
  const known =
    current === '' ||
    isBuiltinSound(current.replace('builtin:', '')) ||
    audio.some((asset) => current === `audio:${asset.id}`);
  return (
    <span className="asset-field">
      <select
        value={value === MIXED ? '\u0000' : current}
        aria-label={name}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        {value === MIXED && <option value={'\u0000'}>{t('inspector.mixed')}</option>}
        <option value="">{t('sound.none')}</option>
        {!known && <option value={current}>{current}</option>}
        {BUILTIN_SOUNDS.map((name) => (
          <option key={name} value={`builtin:${name}`}>
            {t(`sound.builtin.${name}` as TranslationKey)}
          </option>
        ))}
        {audio.map((asset) => (
          <option key={asset.id} value={`audio:${asset.id}`}>
            {assetDisplayName(asset.path)}
          </option>
        ))}
      </select>
      {current && (
        <button
          type="button"
          className="small"
          data-testid={testId ? `${testId}-preview` : undefined}
          onClick={() => previewSound(current)}
        >
          {t('sound.preview')}
        </button>
      )}
    </span>
  );
}
