import type { IDockviewPanelProps } from 'dockview-react';
import { currentQuality, onQualityChange, QUALITY_NAMES, setQuality } from '@blockwerk/runtime';
import type { QualityName } from '@blockwerk/runtime';
import { useEffect, useRef, useState } from 'react';
import { GameViewport } from '../game/GameViewport';
import type { GameViewStats } from '../game/GameViewport';
import type { AspectPreset } from '../game/GameViewport';
import { setGameView } from '../game/gameViews';
import { createUiRenderer, setUiRenderer } from '../game/uiLayer';
import { Volume2, VolumeX } from 'lucide-react';
import { useMute } from '../audio/editorAudio';
import { currentGame, usePlay } from '../state/play';
import { useT } from '../state/settings';

type Stats = GameViewStats;

/** Game window: the scene through its main camera, input target in play mode, with statistics. */
export function GamePanel({ api }: IDockviewPanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<GameViewport | null>(null);
  const [aspect, setAspect] = useState<AspectPreset>('free');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [quality, setQualityState] = useState<QualityName>(currentQuality());
  useEffect(() => onQualityChange((name) => setQualityState(name)), []);
  const [hasCamera, setHasCamera] = useState(true);
  const monitors = usePlay((state) => state.monitors);
  const status = usePlay((state) => state.status);
  const muted = useMute((state) => state.muted);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const viewport = new GameViewport(host, { stats: setStats, cameraChanged: setHasCamera });
    viewportRef.current = viewport;
    const unregister = setGameView(viewport);
    const ui = createUiRenderer(host);
    setUiRenderer(ui);
    const resize = (): void => viewport.resize(host.clientWidth, host.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const dimensions = api.onDidDimensionsChange(resize);
    const visibility = api.onDidVisibilityChange((event) => {
      if (event.isVisible) {
        resize();
        viewport.requestRender();
      }
    });
    return () => {
      unregister();
      setUiRenderer(null);
      ui.dispose();
      observer.disconnect();
      dimensions.dispose();
      visibility.dispose();
      viewport.dispose();
      viewportRef.current = null;
    };
  }, [api]);

  return (
    <div className={`panel game${status !== 'stopped' ? ' playing' : ''}`} data-testid="game-view">
      <div className="panel-toolbar">
        <span className="muted">{t('game.display')}</span>
        <label className="toolbar-field">
          <span className="muted">{t('game.aspect')}</span>
          <select
            value={aspect}
            onChange={(event) => {
              const value = event.target.value as AspectPreset;
              setAspect(value);
              viewportRef.current?.setAspect(value);
            }}
          >
            <option value="free">{t('game.aspectFree')}</option>
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
          </select>
        </label>
        <label className="toolbar-field">
          <span className="muted">{t('game.quality')}</span>
          <select
            value={quality}
            data-testid="game-quality"
            onChange={(event) => setQuality(event.target.value as QualityName)}
          >
            {QUALITY_NAMES.map((name) => (
              <option key={name} value={name}>
                {t(`game.quality.${name}` as never)}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar-spacer" />
        <button
          type="button"
          className={muted ? 'toggled' : ''}
          aria-pressed={muted}
          data-testid="mute-toggle"
          onClick={() => {
            const next = !muted;
            useMute.getState().set(next);
            currentGame()?.audio.setMuted(next);
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {t('game.mute')}
        </button>
        <button
          type="button"
          className={showStats ? 'toggled' : ''}
          aria-pressed={showStats}
          data-testid="stats-toggle"
          onClick={() => setShowStats(!showStats)}
        >
          {t('game.stats')}
        </button>
      </div>
      <div className="viewport-host game-host" ref={hostRef}>
        {!hasCamera && <div className="empty-hint overlay-hint">{t('game.noCamera')}</div>}
        {monitors.length > 0 && (
          <div className="monitors" data-testid="monitors">
            {monitors.map((monitor) => (
              <div key={monitor.key} className="monitor" data-testid="monitor">
                <span className="monitor-name">
                  {monitor.objectName ? `${monitor.objectName}: ${monitor.name}` : monitor.name}
                </span>
                <span className="monitor-value">{String(monitor.value)}</span>
              </div>
            ))}
          </div>
        )}
        {showStats && stats && (
          <dl className="stats-overlay" data-testid="stats">
            <dt>{t('game.fps')}</dt>
            <dd data-testid="stats-fps">{stats.fps.toFixed(0)}</dd>
            <dt>{t('game.frameTime')}</dt>
            <dd>{t('game.milliseconds', { value: stats.frameTimeMs.toFixed(2) })}</dd>
            <dt>{t('game.drawCalls')}</dt>
            <dd>{stats.drawCalls}</dd>
            <dt>{t('game.triangles')}</dt>
            <dd>{stats.triangles.toLocaleString()}</dd>
            <dt>{t('game.resolution')}</dt>
            <dd>
              {stats.width} × {stats.height}
            </dd>
          </dl>
        )}
      </div>
    </div>
  );
}
