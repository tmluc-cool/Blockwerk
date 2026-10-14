import { jumpArc, MOVEMENT_PROFILES, PROFILE_NAMES, PROFILE_TEXT } from '@blockwerk/runtime';
import type { ProfileName } from '@blockwerk/runtime';
import { useSettings, useT } from '../state/settings';
import { applyProfile, controlType, ensureComponent, setValue, valuesOf } from './studio';
import type { SectionProps } from './types';
import { SliderRow, StudioGroup } from './widgets';

/** Movement sliders of the control component (SPEC 5.10 "Bewegung mit Live-Vorschau"). */
const SLIDERS = [
  ['walkSpeed', 'studio.move.walk', 0, 10, 0.1, 'm/s'],
  ['runSpeed', 'studio.move.run', 0, 15, 0.1, 'm/s'],
  ['acceleration', 'studio.move.acceleration', 1, 60, 1, ''],
  ['rotationSmoothTime', 'studio.move.turn', 0, 0.6, 0.01, 's'],
  ['jumpHeight', 'studio.move.jump', 0, 5, 0.05, 'm'],
  ['airControl', 'studio.move.air', 0, 1, 0.05, ''],
  ['gravity', 'studio.move.gravity', 1, 50, 0.5, 'm/s²'],
] as const;

/** Section "Movement": profiles, sliders and the numbers of the jump arc. */
export function MovementSection({ id, object }: SectionProps) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const control = controlType(object);
  if (!control) {
    return (
      <div className="studio-section" data-testid="studio-section-movement">
        <p className="muted">{t('studio.move.noControl')}</p>
        <button
          type="button"
          data-testid="studio-add-control"
          onClick={() => {
            ensureComponent(id, 'characterController');
            ensureComponent(id, 'thirdPersonControl');
          }}
        >
          {t('studio.move.addControl')}
        </button>
      </div>
    );
  }
  const values = valuesOf(object, control);
  const controller = valuesOf(object, 'characterController');
  const profile = String(valuesOf(object, 'character')['profile'] ?? 'custom');
  const arc = jumpArc(
    {
      jumpHeight: Number(values['jumpHeight']),
      gravity: Number(values['gravity']),
      walkSpeed: Number(values['walkSpeed']),
      runSpeed: Number(values['runSpeed']),
    },
    Number(controller['snapDistance'] ?? 0.3),
  );
  const check = (ok: boolean): string => (ok ? '✓' : '✗');
  return (
    <div className="studio-section" data-testid="studio-section-movement">
      <StudioGroup title={t('studio.move.profiles')}>
        <div className="studio-profiles">
          {PROFILE_NAMES.map((name: ProfileName) => (
            <button
              key={name}
              type="button"
              className={profile === name ? 'active' : ''}
              aria-pressed={profile === name}
              data-testid={`profile-${name}`}
              title={`${MOVEMENT_PROFILES[name].walkSpeed} / ${MOVEMENT_PROFILES[name].runSpeed} m/s · ${MOVEMENT_PROFILES[name].jumpHeight} m`}
              onClick={() => applyProfile(id, name)}
            >
              {PROFILE_TEXT[name][locale]}
            </button>
          ))}
        </div>
      </StudioGroup>
      <StudioGroup title={t('studio.move.sliders')}>
        {SLIDERS.map(([field, key, min, max, step, unit]) => (
          <SliderRow
            key={field}
            label={t(key)}
            value={Number(values[field])}
            min={min}
            max={max}
            step={step}
            unit={unit}
            testId={`move-${field}`}
            onChange={(value) => {
              setValue(id, control, field, value);
              // A hand-tuned slider leaves the profile.
              if (profile !== 'custom') setValue(id, 'character', 'profile', 'custom');
            }}
          />
        ))}
        <SliderRow
          label={t('studio.move.slope')}
          value={Number(controller['slopeLimit'] ?? 45)}
          min={0}
          max={85}
          step={1}
          unit="°"
          testId="move-slopeLimit"
          onChange={(value) => setValue(id, 'characterController', 'slopeLimit', value)}
        />
        <SliderRow
          label={t('studio.move.step')}
          value={Number(controller['stepOffset'] ?? 0.35)}
          min={0}
          max={1}
          step={0.05}
          unit="m"
          testId="move-stepOffset"
          onChange={(value) => setValue(id, 'characterController', 'stepOffset', value)}
        />
      </StudioGroup>
      <StudioGroup title={t('studio.move.arc')}>
        <dl className="studio-numbers" data-testid="studio-jump-numbers">
          <dt>{t('studio.move.arc.height')}</dt>
          <dd data-testid="jump-height">{t('studio.meters', { value: arc.height.toFixed(2) })}</dd>
          <dt>{t('studio.move.arc.walk')}</dt>
          <dd data-testid="jump-walk">
            {t('studio.meters', { value: arc.walkDistance.toFixed(2) })}
          </dd>
          <dt>{t('studio.move.arc.run')}</dt>
          <dd data-testid="jump-run">
            {t('studio.meters', { value: arc.runDistance.toFixed(2) })}
          </dd>
          <dt>{t('studio.move.arc.air')}</dt>
          <dd>{t('studio.seconds', { value: arc.airtime.toFixed(2) })}</dd>
        </dl>
        <ul className="studio-obstacles">
          <li>
            {check(true)} {t('studio.obstacle.step')}
          </li>
          <li>
            {check(arc.height >= 1)} {t('studio.obstacle.crate')}
          </li>
          <li>
            {check(arc.runDistance >= 2)} {t('studio.obstacle.gap')}
          </li>
        </ul>
      </StudioGroup>
    </div>
  );
}
