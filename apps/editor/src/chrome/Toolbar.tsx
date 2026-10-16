import {
  ChevronsRight,
  Hand,
  Layers,
  LayoutGrid,
  Sparkles,
  Move,
  Move3d,
  Pause,
  Play,
  RectangleHorizontal,
  RotateCw,
  Scaling,
  StepForward,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { TranslationKey } from '../i18n';
import { useAiSettings } from '../ai/aiSettings';
import { openPanel, useLayout } from '../layout/layoutController';
import { useEditor } from '../state/editor';
import {
  pause,
  setTimeScale,
  step,
  stepBlock,
  TIME_SCALES,
  togglePlay,
  usePlay,
} from '../state/play';
import { useDebug } from '../state/debug';
import type { TimeScale } from '../state/play';
import { useDocument } from '../state/document';
import type { Tool } from '../state/editor';
import { useT } from '../state/settings';
import { MenuButton } from './Menu';
import { layoutMenuItems } from './menus';

const TOOLS: readonly { tool: Tool; icon: ReactElement; titleKey: TranslationKey }[] = [
  { tool: 'hand', icon: <Hand size={16} />, titleKey: 'toolbar.hand' },
  { tool: 'move', icon: <Move size={16} />, titleKey: 'toolbar.move' },
  { tool: 'rotate', icon: <RotateCw size={16} />, titleKey: 'toolbar.rotate' },
  { tool: 'scale', icon: <Scaling size={16} />, titleKey: 'toolbar.scale' },
  { tool: 'rect', icon: <RectangleHorizontal size={16} />, titleKey: 'toolbar.rect' },
  { tool: 'transform', icon: <Move3d size={16} />, titleKey: 'toolbar.transform' },
];

/** Tool bar (Unity: tools left, Play/Pause/Step center, Layers and Layout right). */
export function Toolbar() {
  const t = useT();
  const { tool, setTool, pivotMode, togglePivotMode, space, toggleSpace } = useEditor();
  useLayout((state) => state.named);
  const [openMenu, setOpenMenu] = useState<'layout' | 'layers' | null>(null);
  // The assistant exists only with a stored key (SPEC 9.4).
  const hasAiKey = useAiSettings((state) => state.hasKey);
  const status = usePlay((state) => state.status);
  const timeScale = usePlay((state) => state.timeScale);
  const ready = useDocument((state) => state.scene !== null);
  const playing = status !== 'stopped';
  const stopped = useDebug((state) => state.hit !== null);

  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="toolbar-group" role="radiogroup">
        {TOOLS.map((item) => (
          <button
            key={item.tool}
            type="button"
            role="radio"
            aria-checked={tool === item.tool}
            className={`icon-button${tool === item.tool ? ' toggled' : ''}`}
            title={t(item.titleKey)}
            data-testid={`tool-${item.tool}`}
            onClick={() => setTool(item.tool)}
          >
            {item.icon}
          </button>
        ))}
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className="text-button"
          title={t('toolbar.pivotHint')}
          onClick={togglePivotMode}
        >
          {pivotMode === 'pivot' ? t('toolbar.pivot') : t('toolbar.center')}
        </button>
        <button
          type="button"
          className="text-button"
          title={t('toolbar.spaceHint')}
          onClick={toggleSpace}
        >
          {space === 'local' ? t('toolbar.local') : t('toolbar.global')}
        </button>
      </div>
      <div className="toolbar-center">
        <button
          type="button"
          className={`icon-button play${playing ? ' toggled' : ''}`}
          title={t(playing ? 'toolbar.stop' : 'toolbar.play')}
          aria-pressed={playing}
          disabled={!ready}
          data-testid="play"
          onClick={togglePlay}
        >
          <Play size={16} />
        </button>
        <button
          type="button"
          className={`icon-button${status === 'paused' ? ' toggled' : ''}`}
          title={t('toolbar.pause')}
          aria-pressed={status === 'paused'}
          disabled={!playing}
          data-testid="pause"
          onClick={pause}
        >
          <Pause size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          title={t('toolbar.step')}
          disabled={!ready}
          data-testid="step"
          onClick={step}
        >
          <StepForward size={16} />
        </button>
        {stopped && (
          <button
            type="button"
            className="text-button"
            title={t('toolbar.stepBlockTip')}
            data-testid="step-block"
            onClick={stepBlock}
          >
            <ChevronsRight size={14} />
            {t('toolbar.stepBlock')}
          </button>
        )}
        <select
          className="time-scale"
          value={timeScale}
          title={t('toolbar.timeScale')}
          data-testid="time-scale"
          onChange={(event) => setTimeScale(Number(event.target.value) as TimeScale)}
        >
          {TIME_SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {t('toolbar.timeScaleValue', { value: scale.toLocaleString() })}
            </option>
          ))}
        </select>
      </div>
      <div className="toolbar-group right">
        {hasAiKey && (
          <button
            type="button"
            className="text-button"
            data-testid="toolbar-ai"
            onClick={() => openPanel('ai')}
          >
            <Sparkles size={14} />
            {t('toolbar.ai')}
          </button>
        )}
        <MenuButton
          className="text-button"
          label={
            <>
              <Layers size={14} />
              {t('toolbar.layers')}
            </>
          }
          items={[{ label: t('inspector.defaultLayer'), checked: true, disabled: true }]}
          open={openMenu === 'layers'}
          onOpenChange={(open) => setOpenMenu(open ? 'layers' : null)}
        />
        <MenuButton
          className="text-button"
          testId="layout-dropdown"
          label={
            <>
              <LayoutGrid size={14} />
              {t('toolbar.layout')}
            </>
          }
          items={layoutMenuItems(t)}
          open={openMenu === 'layout'}
          onOpenChange={(open) => setOpenMenu(open ? 'layout' : null)}
        />
      </div>
    </div>
  );
}
