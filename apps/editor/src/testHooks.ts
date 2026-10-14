import { assetDisplayName } from '@blockwerk/project';
import { compileBlockScript } from '@blockwerk/compiler';
import type { SceneData } from '@blockwerk/project';
import { lastGameViewStats } from './game/GameViewport';
import { useLayout } from './layout/layoutController';
import { activeSceneView } from './scene/sceneViews';
import type { SceneCameraSnapshot } from './scene/SceneViewport';
import { hasUnsavedChanges, importProject, saveProject, useDocument } from './state/document';
import { useEditor } from './state/editor';
import { currentGame, playPerformance, usePlay } from './state/play';
import { useSettings } from './state/settings';

/** A live object as seen by tests. */
export interface ObjectProbe {
  readonly id: string;
  readonly name: string;
  readonly position: readonly [number, number, number];
  readonly vars: Readonly<Record<string, unknown>>;
  readonly visible: boolean;
}

/** Read-only inspection hooks for end-to-end tests and debugging (`window.__blockwerk`). */
export interface BlockwerkDebugHooks {
  sceneCamera(): SceneCameraSnapshot | null;
  layout(): unknown;
  panelIds(): string[];
  panelLocation(id: string): string | null;
  panelGroup(id: string): string | null;
  activePanel(id: string): boolean;
  panelVisible(id: string): boolean;
  selection(): string | null;
  selectionIds(): readonly string[];
  locale(): string;
  tool(): string;
  /** Status of the project (loading/ready) and its name. */
  project(): { status: string; name: string | null; dirty: boolean };
  /** Assets of the open project with their display names. */
  assets(): { id: string; type: string; name: string; path: string }[];
  /** The open scene data. */
  scene(): SceneData | null;
  /** Finds object IDs by name in the open scene. */
  objectIds(name: string): string[];
  /** Files as they would be written (deterministic JSON). */
  files(): Record<string, string>;
  save(): Promise<void>;
  compiledScript(assetId: string): string;
  playStatus(): string;
  /** Milliseconds from Play to the first rendered game frame. */
  playStartupMs(): number | null;
  /** Play mode: frame rate, work per frame, and draw calls and triangles of the game view. */
  playPerformance(): {
    fps: number;
    frameMs: number;
    frames: number;
    drawCalls: number;
    triangles: number;
  };
  /** Live objects of the running game with a given name. */
  liveObjects(name: string): ObjectProbe[];
  gameVars(): Readonly<Record<string, unknown>>;
  /** Imports project files as a new project and opens it. */
  importFiles(name: string, files: Record<string, string>): Promise<void>;
  /** Position of an object on the scene canvas in CSS pixels, or `null`. */
  screenPoint(id: string): { x: number; y: number } | null;
  /** Live inspector variable or game variable value by variable name (play mode). */
  liveVariable(objectName: string | null, variableName: string): unknown;
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
    panelGroup: (id) => useLayout.getState().api?.getPanel(id)?.group.id ?? null,
    activePanel: (id) => useLayout.getState().api?.getPanel(id)?.api.isActive ?? false,
    panelVisible: (id) => useLayout.getState().api?.getPanel(id)?.api.isVisible ?? false,
    selection: () => {
      const selection = useEditor.getState().selection;
      return selection[selection.length - 1] ?? null;
    },
    selectionIds: () => useEditor.getState().selection,
    locale: () => useSettings.getState().locale,
    tool: () => useEditor.getState().tool,
    assets: () =>
      (useDocument.getState().project?.assets ?? []).map((asset) => ({
        id: asset.id,
        type: asset.type,
        name: assetDisplayName(asset.path),
        path: asset.path,
      })),
    project: () => {
      const state = useDocument.getState();
      return {
        status: state.status,
        name: state.project?.settings.name ?? null,
        dirty: hasUnsavedChanges(),
      };
    },
    scene: () => useDocument.getState().scene,
    objectIds: (name) =>
      Object.entries(useDocument.getState().scene?.objects ?? {})
        .filter(([, object]) => object.name === name)
        .map(([id]) => id),
    files: () => {
      const { project, sceneId, scene } = useDocument.getState();
      if (!project) return {};
      if (sceneId && scene) project.updateAsset(sceneId, 'scene', scene);
      return Object.fromEntries(project.files());
    },
    save: () => saveProject(),
    compiledScript: (assetId) => {
      const entry = useDocument.getState().project?.assetOfType(assetId, 'blockScript');
      if (!entry) return '';
      return compileBlockScript(entry.data.workspace, {
        assetName: assetId,
        variables: entry.data.variables,
      }).code;
    },
    playStatus: () => usePlay.getState().status,
    playStartupMs: () => usePlay.getState().startupMs,
    playPerformance: () => {
      const stats = lastGameViewStats();
      return {
        ...playPerformance(),
        drawCalls: stats?.drawCalls ?? 0,
        triangles: stats?.triangles ?? 0,
      };
    },
    liveObjects: (name) =>
      [...(currentGame()?.world.allObjects() ?? [])]
        .filter((object) => object.name === name && !object.destroyed)
        .map((object) => ({
          id: object.id,
          name: object.name,
          position: object.worldPosition().toArray() as [number, number, number],
          vars: { ...object.vars },
          visible: object.visible,
        })),
    gameVars: () => ({ ...(currentGame()?.vars ?? {}) }),
    importFiles: (name, files) => importProject(name, files),
    screenPoint: (id) => activeSceneView()?.screenPoint(id) ?? null,
    liveVariable: (objectName, variableName) => {
      const project = useDocument.getState().project;
      const variable = project
        ?.assetsOfType('blockScript')
        .flatMap((entry) => entry.data.variables)
        .find((item) => item.name === variableName);
      const game = currentGame();
      if (!variable || !game) return undefined;
      if (variable.scope === 'game') return game.vars[variable.id];
      const object = [...game.world.allObjects()].find((item) => item.name === objectName);
      return object?.vars[variable.id];
    },
  };
}
