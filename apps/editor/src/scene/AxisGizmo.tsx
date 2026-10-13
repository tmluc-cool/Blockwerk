import { Quaternion, Vector3 } from 'three';
import type { TranslationKey } from '../i18n';
import { useT } from '../state/settings';
import type { AxisView } from './SceneCamera';
import type { SceneCameraSnapshot } from './SceneViewport';

interface AxisSpec {
  readonly view: AxisView;
  readonly direction: Vector3;
  readonly label: string;
  readonly color: string;
  readonly positive: boolean;
}

const AXES: readonly AxisSpec[] = [
  { view: 'right', direction: new Vector3(1, 0, 0), label: 'X', color: '#e5484d', positive: true },
  { view: 'left', direction: new Vector3(-1, 0, 0), label: '', color: '#e5484d', positive: false },
  { view: 'top', direction: new Vector3(0, 1, 0), label: 'Y', color: '#4cc35f', positive: true },
  {
    view: 'bottom',
    direction: new Vector3(0, -1, 0),
    label: '',
    color: '#4cc35f',
    positive: false,
  },
  { view: 'front', direction: new Vector3(0, 0, 1), label: 'Z', color: '#3e8bf0', positive: true },
  { view: 'back', direction: new Vector3(0, 0, -1), label: '', color: '#3e8bf0', positive: false },
];

const VIEW_KEYS: Readonly<Record<AxisView, TranslationKey>> = {
  top: 'scene.view.top',
  bottom: 'scene.view.bottom',
  left: 'scene.view.left',
  right: 'scene.view.right',
  front: 'scene.view.front',
  back: 'scene.view.back',
};

const SIZE = 84;
const RADIUS = 30;

interface AxisGizmoProps {
  readonly snapshot: SceneCameraSnapshot | null;
  readonly onView: (view: AxisView) => void;
  readonly onToggleProjection: () => void;
}

/**
 * Scene gizmo in the top right corner of the scene view (Unity: Scene Gizmo): shows the world
 * axes as seen by the camera. Clicking an axis looks from that side, the label below toggles
 * perspective and orthographic projection.
 */
export function AxisGizmo({ snapshot, onView, onToggleProjection }: AxisGizmoProps) {
  const t = useT();
  const inverse = snapshot ? new Quaternion(...snapshot.quaternion).invert() : new Quaternion();
  const projected = AXES.map((axis) => {
    const v = axis.direction.clone().applyQuaternion(inverse);
    return { axis, x: SIZE / 2 + v.x * RADIUS, y: SIZE / 2 - v.y * RADIUS, depth: v.z };
  }).sort((a, b) => a.depth - b.depth);
  const projection = snapshot?.orthographic ? t('scene.iso') : t('scene.persp');
  const axisView = snapshot?.axisView ?? null;
  const label = axisView ? `${t(VIEW_KEYS[axisView])} · ${projection}` : projection;

  return (
    <div className="axis-gizmo" data-testid="axis-gizmo">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS + 10} className="axis-gizmo-backdrop" />
        {projected.map(({ axis, x, y }) => (
          <g
            key={axis.view}
            className="axis-gizmo-handle"
            data-view={axis.view}
            onClick={() => onView(axis.view)}
          >
            <title>{t('scene.viewHint', { view: t(VIEW_KEYS[axis.view]) })}</title>
            {axis.positive && (
              <line
                x1={SIZE / 2}
                y1={SIZE / 2}
                x2={x}
                y2={y}
                stroke={axis.color}
                strokeWidth={2.5}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={axis.positive ? 8.5 : 6}
              fill={axis.positive ? axis.color : 'var(--bw-panel)'}
              stroke={axis.color}
              strokeWidth={2}
            />
            {axis.positive && (
              <text x={x} y={y + 3.5} textAnchor="middle" className="axis-gizmo-label">
                {axis.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <button
        type="button"
        className="axis-gizmo-projection"
        data-testid="projection-toggle"
        title={t('scene.toggleProjection')}
        onClick={onToggleProjection}
      >
        {label}
      </button>
    </div>
  );
}
