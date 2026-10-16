import type { IDockviewPanelProps } from 'dockview-react';
import { assetDisplayName } from '@blockwerk/project';
import type { ReactElement } from 'react';
import { useDocument } from '../state/document';
import { PROFILER_FRAMES, playingWorld, profilerSamples, usePlay } from '../state/play';
import type { ProfilerSample } from '../state/play';
import { useT } from '../state/settings';
import type { TranslationKey } from '../i18n';

/** The parts of a frame, bottom to top in the chart. */
const PARTS: readonly {
  readonly key: keyof Pick<
    ProfilerSample,
    'scripts' | 'physics' | 'npc' | 'components' | 'other' | 'renderMs'
  >;
  readonly label: TranslationKey;
  readonly color: string;
}[] = [
  { key: 'scripts', label: 'profiler.scripts', color: '#5b8def' },
  { key: 'physics', label: 'profiler.physics', color: '#e0a03a' },
  { key: 'npc', label: 'profiler.npc', color: '#9b6bd6' },
  { key: 'components', label: 'profiler.components', color: '#4cb782' },
  { key: 'other', label: 'profiler.other', color: '#8a8f98' },
  { key: 'renderMs', label: 'profiler.rendering', color: '#e5584d' },
];

const CHART_HEIGHT = 120;
/** The chart is at least this tall in milliseconds (a frame at 60 fps is 16.7 ms). */
const MIN_SCALE_MS = 16.7;

function average(samples: readonly ProfilerSample[], pick: (sample: ProfilerSample) => number) {
  if (samples.length === 0) return 0;
  return samples.reduce((sum, sample) => sum + pick(sample), 0) / samples.length;
}

/** Prefab instances in the running scene: how many objects each prefab made, most first. */
function objectsPerPrefab(): { id: string; count: number }[] {
  const world = playingWorld();
  if (!world) return [];
  const counts = new Map<string, number>();
  for (const object of Object.values(world.sceneData.objects)) {
    const prefab = object.prefab?.asset;
    if (prefab) counts.set(prefab, (counts.get(prefab) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

/** Profiler window (SPEC 9.2): frame time by part, draw calls, triangles, objects per prefab. */
export function ProfilerPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const status = usePlay((state) => state.status);
  usePlay((state) => state.frame);
  const project = useDocument((state) => state.project);
  const samples = profilerSamples();
  const world = status === 'stopped' ? null : playingWorld();
  const scale = Math.max(MIN_SCALE_MS, ...samples.map((sample) => sample.frameMs));
  const width = PROFILER_FRAMES;
  const bars: ReactElement[] = [];
  samples.forEach((sample, index) => {
    let y = CHART_HEIGHT;
    for (const part of PARTS) {
      const height = (sample[part.key] / scale) * CHART_HEIGHT;
      if (height < 0.05) continue;
      y -= height;
      bars.push(
        <rect
          key={`${index}-${part.key}`}
          x={index + (width - samples.length)}
          y={y}
          width={1}
          height={height}
          fill={part.color}
        />,
      );
    }
  });
  const latest = samples[samples.length - 1];
  const recent = samples.slice(-60);
  const prefabs = objectsPerPrefab();

  return (
    <div className="panel profiler" data-testid="profiler">
      {!world && <div className="empty-hint">{t('profiler.empty')}</div>}
      {world && (
        <>
          <svg
            className="profiler-chart"
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={t('profiler.chart')}
          >
            <line
              x1={0}
              x2={width}
              y1={CHART_HEIGHT - (16.7 / scale) * CHART_HEIGHT}
              y2={CHART_HEIGHT - (16.7 / scale) * CHART_HEIGHT}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeDasharray="2 2"
            />
            {bars}
          </svg>
          <div className="profiler-legend">
            {PARTS.map((part) => (
              <span key={part.key} className="profiler-key">
                <i style={{ background: part.color }} />
                {t(part.label)}{' '}
                <strong data-testid={`profiler-${part.key}`}>
                  {t('game.milliseconds', {
                    value: average(recent, (sample) => sample[part.key]).toFixed(2),
                  })}
                </strong>
              </span>
            ))}
          </div>
          <dl className="profiler-numbers">
            <dt>{t('game.frameTime')}</dt>
            <dd data-testid="profiler-frame">
              {t('game.milliseconds', {
                value: average(recent, (sample) => sample.frameMs).toFixed(2),
              })}
            </dd>
            <dt>{t('game.drawCalls')}</dt>
            <dd data-testid="profiler-draw-calls">{latest?.drawCalls ?? 0}</dd>
            <dt>{t('game.triangles')}</dt>
            <dd>{(latest?.triangles ?? 0).toLocaleString()}</dd>
            <dt>{t('profiler.objects')}</dt>
            <dd>{world.objects.size}</dd>
          </dl>
          <div className="profiler-prefabs">
            <div className="muted">{t('profiler.perPrefab')}</div>
            {prefabs.length === 0 && (
              <div className="empty-hint small">{t('profiler.noPrefabs')}</div>
            )}
            {prefabs.map(({ id, count }) => {
              const entry = project?.asset(id);
              return (
                <div key={id} className="profiler-prefab-row" data-testid="profiler-prefab">
                  <span>{entry ? assetDisplayName(entry.path) : id}</span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
