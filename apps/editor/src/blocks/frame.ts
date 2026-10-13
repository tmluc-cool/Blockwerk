import './frame.css';
import type { AreaKind, Locale } from '@blockwerk/blocks';
import * as Blockly from 'blockly/core';
import type { Theme } from '../state/settings';
import { blocklyTheme, defineBlocks, toolboxFor } from './blocklySetup';
import type { BlockFrameController, BlockFrameOptions } from './frameApi';

/** Creates the Blockly workspace in this page and connects it to the editor. */
function mount(options: BlockFrameOptions): BlockFrameController {
  const host = document.getElementById('blockly');
  if (!host) throw new Error('Block frame has no #blockly element.');
  let locale: Locale = options.locale;
  let theme: Theme = options.theme;
  let area: AreaKind | null = options.area;
  let state = options.state;
  let workspace: Blockly.WorkspaceSvg | null = null;

  const save = (): void => {
    if (!workspace) return;
    state = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    options.onChange(state);
  };

  const create = (): void => {
    defineBlocks(locale);
    document.body.dataset['theme'] = theme;
    document.documentElement.lang = locale;
    const created = Blockly.inject(host, {
      toolbox: toolboxFor(locale, area),
      renderer: 'zelos',
      media: 'blockly-media/',
      theme: blocklyTheme(theme),
      trashcan: true,
      sounds: false,
      grid: { spacing: 24, length: 2, colour: '#4a4f5a', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    Blockly.serialization.workspaces.load(JSON.parse(state) as object, created);
    created.addChangeListener((event: Blockly.Events.Abstract) => {
      if (!event.isUiEvent) save();
    });
    workspace = created;
  };

  const destroy = (): void => {
    if (!workspace) return;
    state = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    workspace.dispose();
    workspace = null;
  };

  const onResize = (): void => {
    if (workspace) Blockly.svgResize(workspace);
  };
  const onKeyDown = (event: KeyboardEvent): void => options.onKeyDown(event);
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  create();

  return {
    setLocale(next) {
      if (next === locale) return;
      // Blocks get their texts when they are created, so the workspace is rebuilt.
      destroy();
      locale = next;
      create();
    },
    setTheme(next) {
      theme = next;
      document.body.dataset['theme'] = next;
      workspace?.setTheme(blocklyTheme(next));
    },
    setArea(next) {
      area = next;
      workspace?.updateToolbox(toolboxFor(locale, next));
    },
    dispose() {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      destroy();
    },
  };
}

window.blockwerkBlockFrame = { mount };
