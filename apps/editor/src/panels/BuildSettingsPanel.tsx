import { QUALITY_NAMES } from '@blockwerk/runtime';
import type { QualityName } from '@blockwerk/runtime';
import { assetDisplayName } from '@blockwerk/project';
import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { TranslationKey } from '../i18n';
import { buildProject, desktopExporter, useBuild } from '../export/exportGame';
import type { BuildPlatform, BuildProblem } from '../export/exportGame';
import {
  setBuildSettings,
  setProjectGraphicsLevel,
  setProjectStartScene,
  useDocument,
} from '../state/document';
import { useT } from '../state/settings';

/** Text of a build problem in the interface language. */
function problemText(
  t: ReturnType<typeof useT>,
  problem: BuildProblem,
): { severity: BuildProblem['severity']; text: string } {
  return {
    severity: problem.severity,
    text: t(`export.problem.${problem.code}` as TranslationKey, problem.params),
  };
}

/**
 * Build Settings window (Unity: File → Build Settings, SPEC 9.3): the scenes of the game and its
 * start scene, the platform, the name, window mode, icon and start image, then "Build" and
 * "Build and Run". A Windows app comes from the Windows version of Blockwerk; the web build
 * (folder and ZIP) from every version.
 */
export function BuildSettingsPanel(_props: IDockviewPanelProps): ReactElement {
  const t = useT();
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const { status, outcome } = useBuild();
  const [platform, setPlatform] = useState<BuildPlatform>('web');
  const [windowsApp, setWindowsApp] = useState(false);
  useEffect(() => {
    const exporter = desktopExporter();
    if (!exporter) return;
    void exporter.windowsAvailable().then((available) => {
      setWindowsApp(available);
      if (available) setPlatform('windows');
    });
  }, []);

  if (!project) {
    return (
      <div className="studio-panel" data-testid="build-settings">
        <p className="panel-empty">{t('build.noProject')}</p>
      </div>
    );
  }
  const build = project.settings.build ?? {};
  const scenes = project.assetsOfType('scene');
  const listed = build.scenes;
  // Without a list of its own every scene counts as in the build.
  const included = listed
    ? listed.filter((id) => scenes.some((scene) => scene.id === id))
    : scenes.map((scene) => scene.id);
  const ordered = [
    ...included
      .map((id) => scenes.find((scene) => scene.id === id))
      .filter((scene) => scene !== undefined),
    ...scenes.filter((scene) => !included.includes(scene.id)),
  ];
  const start = project.settings.startScene;
  const images = project.assetsOfType('image');
  const busy = status === 'building';

  const setIncluded = (ids: string[]): void => setBuildSettings({ scenes: ids });
  const toggleScene = (id: string, on: boolean): void => {
    setIncluded(on ? [...included, id] : included.filter((other) => other !== id));
  };
  const move = (id: string, delta: -1 | 1): void => {
    const next = [...included];
    const index = next.indexOf(id);
    const to = index + delta;
    if (index < 0 || to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to] as string, next[index] as string];
    setIncluded(next);
  };

  return (
    <div className="studio-panel" data-testid="build-settings">
      <section className="studio-group">
        <h4>{t('build.scenes')}</h4>
        <p className="panel-hint">{t('build.scenesHint')}</p>
        <ul className="build-scenes">
          {ordered.map((scene) => {
            const on = included.includes(scene.id);
            return (
              <li key={scene.id} data-testid={`build-scene-${assetDisplayName(scene.path)}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(event) => toggleScene(scene.id, event.target.checked)}
                  />
                  <span>{assetDisplayName(scene.path)}</span>
                </label>
                <label className="build-start">
                  <input
                    type="radio"
                    name="build-start-scene"
                    checked={start === scene.id}
                    onChange={() => setProjectStartScene(scene.id)}
                  />
                  <span>{t('build.startScene')}</span>
                </label>
                <button
                  type="button"
                  className="link-button"
                  disabled={!on}
                  aria-label={t('build.moveUp')}
                  onClick={() => move(scene.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="link-button"
                  disabled={!on}
                  aria-label={t('build.moveDown')}
                  onClick={() => move(scene.id, 1)}
                >
                  ↓
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="studio-group">
        <h4>{t('build.platform')}</h4>
        <label className="field-row">
          <span className="field-label">{t('build.platform')}</span>
          <select
            value={platform}
            data-testid="build-platform"
            onChange={(event) => setPlatform(event.target.value as BuildPlatform)}
          >
            <option value="windows" disabled={!windowsApp}>
              {t('build.platform.windows')}
            </option>
            <option value="web">{t('build.platform.web')}</option>
          </select>
        </label>
        {!windowsApp && <p className="panel-hint">{t('build.windowsHint')}</p>}
      </section>

      <section className="studio-group">
        <h4>{t('build.game')}</h4>
        <label className="field-row">
          <span className="field-label">{t('build.productName')}</span>
          <input
            type="text"
            defaultValue={build.productName ?? ''}
            key={`name-${project.settings.name}`}
            placeholder={project.settings.name}
            data-testid="build-product-name"
            onBlur={(event) => setBuildSettings({ productName: event.target.value.trim() })}
          />
        </label>
        <label className="field-row">
          <span className="field-label">{t('build.window')}</span>
          <select
            value={build.window ?? 'fullscreen'}
            data-testid="build-window"
            onChange={(event) =>
              setBuildSettings({ window: event.target.value as 'fullscreen' | 'windowed' })
            }
          >
            <option value="fullscreen">{t('build.window.fullscreen')}</option>
            <option value="windowed">{t('build.window.windowed')}</option>
          </select>
        </label>
        <label className="field-row">
          <span className="field-label">{t('lighting.graphicsDefault')}</span>
          <select
            value={project.settings.graphicsLevel ?? ''}
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
        {(['icon', 'splash'] as const).map((key) => (
          <label className="field-row" key={key}>
            <span className="field-label">{t(`build.${key}` as TranslationKey)}</span>
            <select
              value={build[key] ?? ''}
              data-testid={`build-${key}`}
              onChange={(event) => setBuildSettings({ [key]: event.target.value || null })}
            >
              <option value="">{t('build.none')}</option>
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {assetDisplayName(image.path)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <p className="panel-hint">{t('build.credits')}</p>
      </section>

      <div className="studio-row">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          data-testid="build-run"
          onClick={() => void buildProject(platform, false)}
        >
          {t('build.build')}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy || platform !== 'windows'}
          title={platform === 'windows' ? undefined : t('build.runWindowsOnly')}
          data-testid="build-and-run"
          onClick={() => void buildProject(platform, true)}
        >
          {t('build.buildAndRun')}
        </button>
        {busy && <span data-testid="build-busy">{t('build.building')}</span>}
      </div>

      {outcome && !busy && (
        <section className="studio-group" data-testid="build-result">
          <h4>{t('build.result')}</h4>
          <p data-testid="build-summary">
            {outcome.ok
              ? t(outcome.target === 'download' ? 'build.doneDownload' : 'build.done', {
                  count: outcome.fileCount,
                  size: (outcome.bytes / 1_000_000).toFixed(1),
                  target: outcome.target,
                })
              : t('build.failed')}
          </p>
          <ul className="build-problems">
            {outcome.problems.map((problem, index) => {
              const { severity, text } = problemText(t, problem);
              return (
                <li key={index} className={`build-problem ${severity}`}>
                  {text}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
