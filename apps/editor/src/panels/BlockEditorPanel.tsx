import { compileBlockScript } from '@blockwerk/compiler';
import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useRef } from 'react';
import { DEMO_WORKSPACE } from '../blocks/demoScript';
import type { BlockFrameController } from '../blocks/frameApi';
import { handleShortcut } from '../shortcuts';
import { useEditor } from '../state/editor';
import { useSettings, useT } from '../state/settings';

/** Serialized demo script (JSON), kept across language switches, panel moves and reloads of the frame. */
let savedState = JSON.stringify(DEMO_WORKSPACE);

/** Compiled JavaScript of the demo script (used by tests and, later, the code view). */
export function compiledDemoScript(): string {
  return compileBlockScript(JSON.parse(savedState), { assetName: 'demo.blocks' }).code;
}

function activeAreaKind() {
  const editor = useEditor.getState();
  return editor.areas.find((area) => area.id === editor.activeAreaId)?.kind ?? null;
}

/**
 * Block editor window (SPEC 5.9). Blockly runs in its own page (`blocks.html`) inside an iframe,
 * so it keeps working when the window is floated or detached to a second screen. The header
 * names the edited block script and object.
 */
export function BlockEditorPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const controllerRef = useRef<BlockFrameController | null>(null);
  const locale = useSettings((state) => state.locale);
  const theme = useSettings((state) => state.theme);
  const areaKind = useEditor(
    (state) => state.areas.find((area) => area.id === state.activeAreaId)?.kind ?? null,
  );

  // The frame reloads whenever the window moves to another document (e.g. a detached window);
  // every load mounts Blockly again with the saved script.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const release = (): void => {
      try {
        controllerRef.current?.dispose();
      } catch {
        // The previous page may already be gone (frame moved to another window).
      }
      controllerRef.current = null;
    };
    const mount = (): void => {
      release();
      const api = frame.contentWindow?.blockwerkBlockFrame;
      if (!api) return;
      const settings = useSettings.getState();
      controllerRef.current = api.mount({
        locale: settings.locale,
        theme: settings.theme,
        area: activeAreaKind(),
        state: savedState,
        onChange: (state) => {
          savedState = state;
        },
        onKeyDown: (event) => handleShortcut(event, { modifiersOnly: true }),
      });
    };
    frame.addEventListener('load', mount);
    if (
      frame.contentDocument?.readyState === 'complete' &&
      frame.contentWindow?.blockwerkBlockFrame
    )
      mount();
    return () => {
      frame.removeEventListener('load', mount);
      release();
    };
  }, []);

  useEffect(() => controllerRef.current?.setLocale(locale), [locale]);
  useEffect(() => controllerRef.current?.setTheme(theme), [theme]);
  useEffect(() => controllerRef.current?.setArea(areaKind), [areaKind]);

  return (
    <div className="panel block-editor" data-testid="block-editor">
      <div className="panel-toolbar">
        <span className="muted">{t('blockEditor.script')}:</span>
        <strong>{t('blockEditor.demoScript')}</strong>
        <span className="toolbar-separator" />
        <span className="muted">{t('blockEditor.object')}:</span>
        <strong>{t('object.testCube')}</strong>
      </div>
      <iframe
        ref={frameRef}
        className="block-frame"
        src="blocks.html"
        title={t('panel.blockEditor')}
      />
    </div>
  );
}
