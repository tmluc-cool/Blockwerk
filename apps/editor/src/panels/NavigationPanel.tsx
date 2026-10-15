import { DEFAULT_NAVIGATION } from '@blockwerk/runtime';
import type { IDockviewPanelProps } from 'dockview-react';
import { bakeNavigation, useNavigationView } from '../navigation/navigationView';
import { setNavigationSettings, useDocument } from '../state/document';
import { useT } from '../state/settings';
import { SliderRow } from '../studio/widgets';

/**
 * Navigation window (Unity: Window → AI → Navigation): the size of the agents the mesh is made
 * for, the Bake button, and the display of the mesh in the Scene view. Settings are stored in the
 * scene; the mesh itself is built in the editor when asked and again when play mode starts.
 */
export function NavigationPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const scene = useDocument((state) => state.scene);
  const view = useNavigationView();
  if (!scene) return <div className="empty-hint">{t('inspector.empty')}</div>;
  const settings = { ...DEFAULT_NAVIGATION, ...scene.environment.navigation };
  const set = (patch: Partial<typeof settings>): void =>
    setNavigationSettings({ ...settings, ...patch });
  return (
    <div className="panel navigation" data-testid="navigation">
      <section className="studio-group">
        <h4>{t('navigation.agents')}</h4>
        <SliderRow
          label={t('navigation.radius')}
          value={settings.agentRadius}
          min={0.1}
          max={2}
          step={0.05}
          unit=" m"
          testId="navigation-radius"
          onChange={(value) => set({ agentRadius: value })}
        />
        <SliderRow
          label={t('navigation.height')}
          value={settings.agentHeight}
          min={0.5}
          max={4}
          step={0.1}
          unit=" m"
          testId="navigation-height"
          onChange={(value) => set({ agentHeight: value })}
        />
        <SliderRow
          label={t('navigation.climb')}
          value={settings.maxClimb}
          min={0}
          max={1.5}
          step={0.05}
          unit=" m"
          testId="navigation-climb"
          onChange={(value) => set({ maxClimb: value })}
        />
        <SliderRow
          label={t('navigation.slope')}
          value={settings.maxSlope}
          min={0}
          max={80}
          step={1}
          unit="°"
          testId="navigation-slope"
          onChange={(value) => set({ maxSlope: value })}
        />
        <SliderRow
          label={t('navigation.cell')}
          value={settings.cellSize}
          min={0}
          max={1}
          step={0.05}
          unit=" m"
          testId="navigation-cell"
          onChange={(value) => set({ cellSize: value })}
        />
        <p className="muted">{t('navigation.cellHint')}</p>
      </section>
      <section className="studio-group">
        <h4>{t('navigation.bake')}</h4>
        <button type="button" data-testid="navigation-bake" onClick={bakeNavigation}>
          {t('navigation.bakeButton')}
        </button>
        <label className="field-row">
          <span className="field-label">{t('navigation.show')}</span>
          <input
            type="checkbox"
            checked={view.show}
            data-testid="navigation-show"
            onChange={(event) => view.setShow(event.target.checked)}
          />
        </label>
        <label className="field-row">
          <span className="field-label">{t('navigation.auto')}</span>
          <input
            type="checkbox"
            checked={view.auto}
            data-testid="navigation-auto"
            onChange={(event) => view.setAuto(event.target.checked)}
          />
        </label>
        <p className="muted" data-testid="navigation-status">
          {view.status === 'none' && t('navigation.statusNone')}
          {view.status === 'empty' && t('navigation.statusEmpty')}
          {view.status === 'ok' &&
            t('navigation.statusOk', {
              triangles: String(view.triangles),
              ms: String(view.bakeMs ?? 0),
            })}
        </p>
      </section>
    </div>
  );
}
