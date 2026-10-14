import type { ReactNode } from 'react';

/** A labeled slider with its value, for the studio's movement and body sections. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  testId: string;
  onChange: (value: number) => void;
}) {
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (
    <label className="studio-slider">
      <span className="field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="studio-slider-value">
        {value.toFixed(digits)}
        {unit ? ` ${unit}` : ''}
      </span>
    </label>
  );
}

/** A block of the left column with a title. */
export function StudioGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="studio-group">
      <h4>{title}</h4>
      {children}
    </section>
  );
}
