import { compileBlockScript } from '@blockwerk/compiler';
import * as Blockly from 'blockly/core';
import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useRef, useState } from 'react';
import { blocklyTheme, defineBlocks, DEMO_WORKSPACE, toolboxFor } from '../blocks/blocklySetup';
import { useEditor } from '../state/editor';
import { useSettings, useT } from '../state/settings';

/** Serialized state of the demo script, kept across language switches and panel moves. */
let savedState: object = DEMO_WORKSPACE;

/** Latest compiled JavaScript of the demo script (exposed for tests and later the code view). */
export function compiledDemoScript(): string {
  return compileBlockScript(savedState, { assetName: 'demo.blocks' }).code;
}

/**
 * Block editor window (SPEC 5.9): Blockly with the palette of the active area and a header
 * that names the edited block script and object.
 */
export function BlockEditorPanel({ api }: IDockviewPanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const locale = useSettings((state) => state.locale);
  const theme = useSettings((state) => state.theme);
  // Blockly measures texts when it renders, which fails while the panel is detached (hidden tab).
  // The workspace therefore only exists while the panel is visible.
  const [visible, setVisible] = useState(api.isVisible);
  const areaKind = useEditor(
    (state) => state.areas.find((area) => area.id === state.activeAreaId)?.kind ?? null,
  );

  useEffect(() => {
    const subscription = api.onDidVisibilityChange((event) => setVisible(event.isVisible));
    return () => subscription.dispose();
  }, [api]);

  // Create the workspace when the panel becomes visible; recreate it when the language changes
  // so blocks get their new texts. The script survives in `savedState`.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !visible) return;
    defineBlocks(locale);
    const workspace = Blockly.inject(host, {
      toolbox: toolboxFor(
        locale,
        useEditor.getState().areas.find((area) => area.id === useEditor.getState().activeAreaId)
          ?.kind ?? null,
      ),
      renderer: 'zelos',
      media: 'blockly-media/',
      theme: blocklyTheme(useSettings.getState().theme),
      trashcan: true,
      sounds: false,
      grid: { spacing: 24, length: 2, colour: '#4a4f5a', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    workspaceRef.current = workspace;
    Blockly.serialization.workspaces.load(savedState, workspace);
    const onChange = (event: Blockly.Events.Abstract): void => {
      if (event.isUiEvent) return;
      savedState = Blockly.serialization.workspaces.save(workspace);
    };
    workspace.addChangeListener(onChange);
    const resize = (): void => Blockly.svgResize(workspace);
    const dimensions = api.onDidDimensionsChange(resize);
    return () => {
      dimensions.dispose();
      savedState = Blockly.serialization.workspaces.save(workspace);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [api, locale, visible]);

  useEffect(() => {
    workspaceRef.current?.updateToolbox(toolboxFor(locale, areaKind));
  }, [locale, areaKind]);

  useEffect(() => {
    workspaceRef.current?.setTheme(blocklyTheme(theme));
  }, [theme]);

  return (
    <div className="panel block-editor" data-testid="block-editor">
      <div className="panel-toolbar">
        <span className="muted">{t('blockEditor.script')}:</span>
        <strong>{t('blockEditor.demoScript')}</strong>
        <span className="toolbar-separator" />
        <span className="muted">{t('blockEditor.object')}:</span>
        <strong>{t('object.testCube')}</strong>
      </div>
      <div className="block-editor-host" ref={hostRef} />
    </div>
  );
}
