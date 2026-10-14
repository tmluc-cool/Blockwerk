import {
  ANIMATION_STATE_TEXT,
  ANIMATION_STATES,
  LOOPING_STATES,
  matchClips,
  parseList,
} from '@blockwerk/runtime';
import { useEffect, useRef, useState } from 'react';
import { useSettings, useT } from '../state/settings';
import { setValue, useStudio, valuesOf } from './studio';
import type { SectionProps } from './types';

/** Playback speeds of the speed drop-down; the first is the slow motion. */
const SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const;

/** Marker list of the animator: `state@seconds=name`. */
function markersOf(text: string): { state: string; at: number; name: string }[] {
  return parseList(text).flatMap(([target, name]) => {
    const split = target.lastIndexOf('@');
    const at = Number(target.slice(split + 1));
    return split > 0 && Number.isFinite(at) ? [{ state: target.slice(0, split), at, name }] : [];
  });
}

function writeMarkers(id: string, markers: readonly { state: string; at: number; name: string }[]) {
  setValue(
    id,
    'animator',
    'markers',
    markers.map((marker) => `${marker.state}@${marker.at}=${marker.name}`).join(';'),
  );
}

/** The timeline of the playing animation with its event markers (foot lands, hit moment …). */
function Timeline({ id, object, animator }: Pick<SectionProps, 'id' | 'object' | 'animator'>) {
  const t = useT();
  const animation = useStudio((state) => state.animation);
  const barRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ time: 0, duration: 0 });
  useEffect(() => {
    let frame = 0;
    const update = (): void => {
      const info = animation && animator ? animator.timeOf(animation) : null;
      setPosition(info ?? { time: 0, duration: 0 });
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [animation, animator]);
  if (!animation) return null;
  const markers = markersOf(String(valuesOf(object, 'animator')['markers'] ?? ''));
  const mine = markers.filter((marker) => marker.state === animation);
  const add = (clientX: number): void => {
    const bar = barRef.current;
    if (!bar || position.duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const at = Math.round(((clientX - rect.left) / rect.width) * position.duration * 100) / 100;
    writeMarkers(id, [
      ...markers,
      { state: animation, at: Math.max(0, Math.min(position.duration, at)), name: 'step' },
    ]);
  };
  return (
    <div className="studio-timeline" data-testid="studio-timeline">
      <div
        className="timeline-bar"
        ref={barRef}
        role="presentation"
        data-testid="timeline-bar"
        onClick={(event) => add(event.clientX)}
      >
        <span
          className="timeline-head"
          style={{
            left: `${position.duration > 0 ? (position.time / position.duration) * 100 : 0}%`,
          }}
        />
        {mine.map((marker) => (
          <span
            key={`${marker.at}-${marker.name}`}
            className="timeline-marker"
            title={`${marker.name} @ ${marker.at}s`}
            style={{
              left: `${position.duration > 0 ? (marker.at / position.duration) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <p className="muted">{t('studio.timeline.hint')}</p>
      <ul className="studio-parts" data-testid="timeline-markers">
        {mine.map((marker) => (
          <li key={`${marker.at}-${marker.name}`}>
            <input
              type="text"
              defaultValue={marker.name}
              data-testid="marker-name"
              onBlur={(event) =>
                writeMarkers(
                  id,
                  markers.map((item) =>
                    item === marker
                      ? { ...item, name: event.currentTarget.value.trim() || 'step' }
                      : item,
                  ),
                )
              }
            />
            <span className="muted">{t('studio.seconds', { value: marker.at })}</span>
            <button
              type="button"
              data-testid="marker-remove"
              onClick={() =>
                writeMarkers(
                  id,
                  markers.filter((item) => item !== marker),
                )
              }
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The list of standard animation states with playback controls and the timeline. */
export function AnimationsPanel(props: SectionProps) {
  const { id, object, animator } = props;
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const animation = useStudio((state) => state.animation);
  const speed = useStudio((state) => state.speed);
  const loop = useStudio((state) => state.loop);
  const available = matchClips(animator?.clips ?? []);
  return (
    <div className="studio-animations" data-testid="studio-animations">
      <h4>{t('studio.animations')}</h4>
      <ul>
        {ANIMATION_STATES.map((state) => {
          const has = available.has(state);
          return (
            <li key={state} className={animation === state ? 'selected' : ''}>
              <button
                type="button"
                disabled={!has}
                data-testid={`anim-play-${state}`}
                onClick={() => {
                  useStudio.getState().setAnimation(state);
                  useStudio.getState().setLoop(LOOPING_STATES.has(state));
                }}
              >
                ▶ {ANIMATION_STATE_TEXT[state][locale]}
              </button>
              <span
                className={has ? 'ok' : 'warn'}
                title={has ? available.get(state) : t('studio.animations.missing')}
                data-testid={`anim-has-${state}`}
              >
                {has ? '✓' : '+'}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="studio-row">
        <label className="toolbar-field">
          <span className="muted">{t('studio.animations.speed')}</span>
          <select
            value={speed}
            data-testid="studio-speed"
            onChange={(event) => useStudio.getState().setSpeed(Number(event.target.value))}
          >
            <option value={0}>{t('studio.animations.pause')}</option>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value === 0.25 ? t('studio.animations.slowMotion') : `${value}×`}
              </option>
            ))}
          </select>
        </label>
        <label className="toolbar-field">
          <input
            type="checkbox"
            checked={loop}
            data-testid="studio-loop"
            onChange={(event) => useStudio.getState().setLoop(event.target.checked)}
          />
          <span className="muted">{t('studio.animations.loop')}</span>
        </label>
      </div>
      <Timeline id={id} object={object} animator={animator} />
    </div>
  );
}
