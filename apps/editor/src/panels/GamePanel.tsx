import type { RenderStats } from '@blockwerk/runtime';
import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useRef, useState } from 'react';
import { GameViewport } from '../game/GameViewport';
import type { AspectPreset } from '../game/GameViewport';
import { useT } from '../state/settings';

type Stats = RenderStats & { width: number; height: number };

/** Game window: the scene as the player sees it through the main camera, with statistics. */
export function GamePanel({ api }: IDockviewPanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<GameViewport | null>(null);
  const [aspect, setAspect] = useState<AspectPreset>('free');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let viewport: GameViewport;
    try {
      viewport = new GameViewport(host, { stats: setStats });
    } catch {
      return;
    }
    viewportRef.current = viewport;
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
      observer.disconnect();
      dimensions.dispose();
      visibility.dispose();
      viewport.dispose();
      viewportRef.current = null;
    };
  }, [api]);

  return (
    <div className="panel game" data-testid="game-view">
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
        <span className="toolbar-spacer" />
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
        {showStats && stats && (
          <dl className="stats-overlay" data-testid="stats">
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
