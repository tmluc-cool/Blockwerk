import { Paintbrush } from 'lucide-react';
import { NumberInput } from '../panels/inspector/fields';
import { useT } from '../state/settings';
import { useBrush } from './brush';
import type { BrushSource } from './brush';

/** Brush on/off and settings for a library model or prefab (shown in the library details). */
export function BrushControls({ source, disabled }: { source: BrushSource; disabled: boolean }) {
  const t = useT();
  const brush = useBrush();
  const active = brush.source?.kind === source.kind && brush.source.id === source.id;
  return (
    <div className="brush-controls" data-testid="brush-controls">
      <button
        type="button"
        data-testid="brush-toggle"
        aria-pressed={active}
        className={active ? 'toggled' : undefined}
        disabled={disabled}
        onClick={() => brush.set({ source: active ? null : source })}
      >
        <Paintbrush size={14} /> {t(active ? 'brush.stop' : 'brush.start')}
      </button>
      {active && (
        <>
          <label className="brush-row">
            <span>{t('brush.radius')}</span>
            <NumberInput
              value={brush.radius}
              step={0.5}
              min={0.5}
              max={50}
              testId="brush-radius"
              onChange={(radius) => brush.set({ radius })}
            />
          </label>
          <label className="brush-row">
            <span>{t('brush.spacing')}</span>
            <NumberInput
              value={brush.spacing}
              step={0.25}
              min={0.25}
              max={20}
              testId="brush-spacing"
              onChange={(spacing) => brush.set({ spacing })}
            />
          </label>
          <label className="brush-row">
            <span>{t('brush.randomRotation')}</span>
            <input
              type="checkbox"
              checked={brush.randomRotation}
              onChange={(event) => brush.set({ randomRotation: event.target.checked })}
            />
          </label>
          <label className="brush-row">
            <span>{t('brush.scale')}</span>
            <NumberInput
              value={brush.scaleMin}
              step={0.05}
              min={0.05}
              max={brush.scaleMax}
              onChange={(scaleMin) => brush.set({ scaleMin })}
            />
            <NumberInput
              value={brush.scaleMax}
              step={0.05}
              min={brush.scaleMin}
              max={10}
              onChange={(scaleMax) => brush.set({ scaleMax })}
            />
          </label>
        </>
      )}
    </div>
  );
}
