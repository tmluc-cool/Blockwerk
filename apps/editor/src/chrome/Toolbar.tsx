import {
  Hand,
  Layers,
  LayoutGrid,
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
import { useLayout } from '../layout/layoutController';
import { useEditor } from '../state/editor';
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
          className="icon-button play"
          title={t('toolbar.play')}
          disabled
          data-testid="play"
        >
          <Play size={16} />
        </button>
        <button type="button" className="icon-button" title={t('toolbar.pause')} disabled>
          <Pause size={16} />
        </button>
        <button type="button" className="icon-button" title={t('toolbar.step')} disabled>
          <StepForward size={16} />
        </button>
      </div>
      <div className="toolbar-group right">
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
