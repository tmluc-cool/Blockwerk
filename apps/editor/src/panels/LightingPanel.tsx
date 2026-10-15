import {
  currentQuality,
  onQualityChange,
  QUALITY_NAMES,
  setQuality,
  WEATHER_TYPES,
} from '@blockwerk/runtime';
import type { QualityName, WeatherType } from '@blockwerk/runtime';
import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useState } from 'react';
import { setValue } from '../studio/studio';
import { NumberInput } from './inspector/fields';
import { setEnvironment, setProjectGraphicsLevel, useDocument } from '../state/document';
import { useT } from '../state/settings';
import { SliderRow } from '../studio/widgets';

/** The sun: the first directional light of the scene (it gives the sun its color and strength). */
function findSun(scene: NonNullable<ReturnType<typeof useDocument.getState>['scene']>) {
  for (const [id, object] of Object.entries(scene.objects)) {
    const light = object.components.find(
      (component) =>
        component.type === 'light' &&
        (component.values['lightType'] ?? 'directional') === 'directional',
    );
    if (light) return { id, intensity: Number(light.values['intensity'] ?? 4.6) };
  }
  return null;
}

/** "07:30" for 7.5. */
function clockText(hours: number): string {
  const whole = Math.floor(hours) % 24;
  const minutes = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Lighting window (Unity: Window → Rendering → Lighting): time of day and day cycle, sun and
 * ambient light, fog, weather and the graphics level. Changes apply live in the Scene and Game
 * views; the values are stored in the scene (the graphics level default in the project).
 */
export function LightingPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const scene = useDocument((state) => state.scene);
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const [level, setLevel] = useState<QualityName>(currentQuality());
  useEffect(() => onQualityChange((name) => setLevel(name)), []);
  if (!scene) return <div className="empty-hint">{t('inspector.empty')}</div>;
  const environment = scene.environment;
  const sky = environment.sky;
  const weather = environment.weather ?? {
    type: 'clear',
    intensity: 0,
    windSpeed: 0,
    windDirection: 0,
  };
  const sun = findSun(scene);
  return (
    <div className="panel lighting" data-testid="lighting">
      <section className="studio-group">
        <h4>{t('lighting.sky')}</h4>
        <label className="field-row">
          <span className="field-label">{t('lighting.cycle')}</span>
          <input
            type="checkbox"
            checked={sky !== undefined}
            data-testid="lighting-cycle"
            onChange={(event) => {
              if (event.target.checked) {
                setEnvironment({ sky: { timeOfDay: 12, dayLength: 0, sunAzimuth: 0 } });
              } else {
                const { sky: _removed, ...rest } = environment;
                setEnvironment(rest as typeof environment, 'environment-reset');
              }
            }}
          />
        </label>
        {sky && (
          <>
            <SliderRow
              label={t('lighting.timeOfDay')}
              value={sky.timeOfDay}
              min={0}
              max={24}
              step={0.1}
              testId="lighting-time"
              onChange={(value) => setEnvironment({ sky: { ...sky, timeOfDay: value } })}
            />
            <p className="muted" data-testid="lighting-clock">
              {clockText(sky.timeOfDay)}
            </p>
            <label className="field-row">
              <span className="field-label">{t('lighting.dayLength')}</span>
              <NumberInput
                value={sky.dayLength}
                step={10}
                min={0}
                testId="lighting-day-length"
                onChange={(value) =>
                  setEnvironment({ sky: { ...sky, dayLength: Math.max(0, value) } })
                }
              />
            </label>
            <SliderRow
              label={t('lighting.sunAzimuth')}
              value={sky.sunAzimuth}
              min={-180}
              max={180}
              step={1}
              unit="°"
              testId="lighting-azimuth"
              onChange={(value) => setEnvironment({ sky: { ...sky, sunAzimuth: value } })}
            />
          </>
        )}
      </section>
      <section className="studio-group">
        <h4>{t('lighting.light')}</h4>
        {sun && (
          <SliderRow
            label={t('lighting.sun')}
            value={sun.intensity}
            min={0}
            max={10}
            step={0.1}
            testId="lighting-sun"
            onChange={(value) => setValue(sun.id, 'light', 'intensity', value)}
          />
        )}
        <SliderRow
          label={t('lighting.ambient')}
          value={environment.ambientIntensity}
          min={0}
          max={1.5}
          step={0.01}
          testId="lighting-ambient"
          onChange={(value) => setEnvironment({ ambientIntensity: value }, 'environment-ambient')}
        />
      </section>
      <section className="studio-group">
        <h4>{t('lighting.fog')}</h4>
        <label className="field-row">
          <span className="field-label">{t('lighting.fogOn')}</span>
          <input
            type="checkbox"
            checked={environment.fog.enabled}
            data-testid="lighting-fog"
            onChange={(event) =>
              setEnvironment({ fog: { ...environment.fog, enabled: event.target.checked } })
            }
          />
        </label>
        <SliderRow
          label={t('lighting.fogNear')}
          value={environment.fog.near}
          min={0}
          max={500}
          step={5}
          unit="m"
          testId="lighting-fog-near"
          onChange={(value) =>
            setEnvironment({ fog: { ...environment.fog, near: value } }, 'environment-fog')
          }
        />
        <SliderRow
          label={t('lighting.fogFar')}
          value={environment.fog.far}
          min={20}
          max={2000}
          step={10}
          unit="m"
          testId="lighting-fog-far"
          onChange={(value) =>
            setEnvironment({ fog: { ...environment.fog, far: value } }, 'environment-fog')
          }
        />
      </section>
      <section className="studio-group">
        <h4>{t('lighting.weather')}</h4>
        <label className="field-row">
          <span className="field-label">{t('lighting.weatherType')}</span>
          <select
            value={weather.type}
            data-testid="lighting-weather"
            onChange={(event) =>
              setEnvironment({
                weather: {
                  ...weather,
                  type: event.target.value as WeatherType,
                  intensity: event.target.value === 'clear' ? 0 : Math.max(0.6, weather.intensity),
                },
              })
            }
          >
            {WEATHER_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`lighting.weather.${type}` as never)}
              </option>
            ))}
          </select>
        </label>
        <SliderRow
          label={t('lighting.intensity')}
          value={weather.intensity * 100}
          min={0}
          max={100}
          step={5}
          unit="%"
          testId="lighting-weather-intensity"
          onChange={(value) =>
            setEnvironment(
              { weather: { ...weather, intensity: value / 100 } },
              'environment-weather',
            )
          }
        />
        <SliderRow
          label={t('lighting.windSpeed')}
          value={weather.windSpeed}
          min={0}
          max={20}
          step={0.5}
          unit="m/s"
          testId="lighting-wind-speed"
          onChange={(value) =>
            setEnvironment({ weather: { ...weather, windSpeed: value } }, 'environment-weather')
          }
        />
        <SliderRow
          label={t('lighting.windDirection')}
          value={weather.windDirection}
          min={0}
          max={360}
          step={5}
          unit="°"
          testId="lighting-wind-direction"
          onChange={(value) =>
            setEnvironment({ weather: { ...weather, windDirection: value } }, 'environment-weather')
          }
        />
      </section>
      <section className="studio-group">
        <h4>{t('lighting.graphics')}</h4>
        <label className="field-row">
          <span className="field-label">{t('lighting.graphicsNow')}</span>
          <select
            value={level}
            data-testid="lighting-quality"
            onChange={(event) => setQuality(event.target.value as QualityName)}
          >
            {QUALITY_NAMES.map((name) => (
              <option key={name} value={name}>
                {t(`game.quality.${name}` as never)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-row">
          <span className="field-label">{t('lighting.graphicsDefault')}</span>
          <select
            value={project?.settings.graphicsLevel ?? ''}
            data-testid="lighting-quality-default"
            onChange={(event) =>
              setProjectGraphicsLevel((event.target.value || null) as QualityName | null)
            }
          >
            <option value="">{t('lighting.graphicsAuto')}</option>
            {QUALITY_NAMES.map((name) => (
              <option key={name} value={name}>
                {t(`game.quality.${name}` as never)}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );
}
