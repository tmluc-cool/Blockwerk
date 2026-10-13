import { useLayout } from './layout/layoutController';
import { compiledDemoScript } from './panels/BlockEditorPanel';
import { activeSceneView } from './scene/sceneViews';
import type { SceneCameraSnapshot } from './scene/SceneViewport';
import { useEditor } from './state/editor';
import { useSettings } from './state/settings';

/** Read-only inspection hooks for end-to-end tests and debugging (`window.__blockwerk`). */
export interface BlockwerkDebugHooks {
  sceneCamera(): SceneCameraSnapshot | null;
  layout(): unknown;
  panelIds(): string[];
  panelLocation(id: string): string | null;
  selection(): string | null;
  locale(): string;
  tool(): string;
  compiledDemoScript(): string;
}

declare global {
  interface Window {
    __blockwerk?: BlockwerkDebugHooks;
  }
}

/** Installs the debug hooks on the main window. */
export function installTestHooks(): void {
  window.__blockwerk = {
    sceneCamera: () => activeSceneView()?.snapshot() ?? null,
    layout: () => useLayout.getState().api?.toJSON() ?? null,
    panelIds: () => useLayout.getState().api?.panels.map((panel) => panel.id) ?? [],
    panelLocation: (id) => useLayout.getState().api?.getPanel(id)?.group.api.location.type ?? null,
    selection: () => useEditor.getState().selectedObjectId,
    locale: () => useSettings.getState().locale,
    tool: () => useEditor.getState().tool,
    compiledDemoScript,
  };
}
