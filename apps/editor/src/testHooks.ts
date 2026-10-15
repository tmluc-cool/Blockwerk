import { assetDisplayName } from '@blockwerk/project';
import {
  animatorRegistry,
  controlRegistry,
  peekInventory,
  peekNpcState,
  terrainRegistry,
} from '@blockwerk/runtime';
import { compileProject } from '@blockwerk/compiler';
import type { SceneData } from '@blockwerk/project';
import { Vector3 } from 'three';
import { lastGameViewStats } from './game/GameViewport';
import { currentWorld } from './scene/worlds';
import { currentStage } from './studio/StudioStage';
import { useLayout } from './layout/layoutController';
import { activeSceneView } from './scene/sceneViews';
import type { SceneCameraSnapshot } from './scene/SceneViewport';
import {
  hasUnsavedChanges,
  importProject,
  openScene,
  saveProject,
  updateBlockScript,
  useDocument,
} from './state/document';
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
  /** The Blockly workspace of a block script (JSON). */
  scriptWorkspace(assetId: string): unknown;
  /** Replaces the workspace of a block script, as if it was edited in the block editor. */
  setScriptWorkspace(assetId: string, workspace: unknown): void;
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
  /** Views the running game renders (one, or two with split screen) and how they are split. */
  gameViews(): { count: number; split: string; players: string[] };
  /** Presses or releases a key (like the Game view does) in the running game. */
  pressKey(code: string, down: boolean): void;
  /** Steps a paused game by ticks; returns the height of the named object after each tick. */
  stepGame(ticks: number, objectName: string): number[];
  /** Ability and animation events of the running game, e.g. `roll:started`, and how often they happened. */
  eventCounts(): Record<string, number>;
  /** The Character Studio's preview: mode, size, parts, equipment, clips, jump numbers. */
  studioState(): ReturnType<NonNullable<ReturnType<typeof currentStage>>['inspect']>;
  /** Animation state, speed and ground contact of a live object (play mode). */
  characterState(name: string): {
    animation: string | null;
    speed: number;
    grounded: boolean;
    running: boolean;
  } | null;
  /** Quest example probes: scene, NPC states, hint, dialog box, loading screen (play mode). */
  questProbe(): {
    scene: string | null;
    npcStates: Record<string, string>;
    hint: string | null;
    talking: boolean;
    loading: string | null;
    items: Record<string, number>;
    paused: boolean;
    /** Position of the object named "Ritter". */
    ritter: [number, number, number] | null;
  };
  /** Opens a scene of the project by its name (edit mode). */
  openSceneByName(name: string): boolean;
  /** Puts a live object somewhere (play mode). */
  teleportLive(name: string, position: [number, number, number]): void;
  /** Live inspector variable or game variable value by variable name (play mode). */
  liveVariable(objectName: string | null, variableName: string): unknown;
  /** Height in meters of a terrain object at a local position, and its grass clump count. */
  terrainProbe(
    objectId: string,
    x: number,
    z: number,
  ): { height: number; layer0: number; layer1: number } | null;
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
    scriptWorkspace: (assetId) =>
      useDocument.getState().project?.assetOfType(assetId, 'blockScript')?.data.workspace ?? null,
    setScriptWorkspace: (assetId, workspace) => {
      const entry = useDocument.getState().project?.assetOfType(assetId, 'blockScript');
      if (entry) updateBlockScript(assetId, { ...entry.data, workspace: workspace as never });
    },
    compiledScript: (assetId) => {
      const { project } = useDocument.getState();
      if (!project?.assetOfType(assetId, 'blockScript')) return '';
      const scripts = project.assetsOfType('blockScript').map((entry) => ({
        assetId: entry.id,
        assetName: assetDisplayName(entry.path),
        workspace: entry.data.workspace,
        variables: entry.data.variables,
      }));
      return compileProject(scripts).get(assetId)?.code ?? '';
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
    gameViews: () => {
      const views = currentGame()?.views();
      return {
        count: views?.views.length ?? 0,
        split: views?.split ?? 'vertical',
        players: views?.views.map((view) => view.player) ?? [],
      };
    },
    studioState: () => currentStage()?.inspect() ?? null,
    pressKey: (code, down) => {
      const key =
        code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
      currentGame()?.input.keyEvent(key, down, code);
    },
    stepGame: (ticks, objectName) => {
      const game = currentGame();
      const heights: number[] = [];
      for (let i = 0; i < ticks && game; i++) {
        game.stepTick();
        const object = [...game.world.allObjects()].find((item) => item.name === objectName);
        heights.push(object?.worldPosition().y ?? 0);
      }
      return heights;
    },
    eventCounts: () => ({ ...(currentGame()?.eventCounts ?? {}) }),
    characterState: (name) => {
      const object = [...(currentGame()?.world.allObjects() ?? [])].find(
        (item) => item.name === name,
      );
      const control = object ? controlRegistry.get(object) : undefined;
      if (!object || !control) return null;
      return {
        animation: animatorRegistry.get(object)?.current ?? null,
        speed: control.speed,
        grounded: control.grounded,
        running: control.running,
      };
    },
    terrainProbe: (objectId, x, z) => {
      const object = currentWorld()?.getObject(objectId);
      const state = object ? terrainRegistry.get(object) : undefined;
      if (!state) return null;
      return {
        height: state.data.heightAt(x, z),
        layer0: state.data.weightAt(0, x, z),
        layer1: state.data.weightAt(1, x, z),
      };
    },
    questProbe: () => {
      const game = currentGame();
      const npcStates: Record<string, string> = {};
      let items: Record<string, number> = {};
      let ritter: [number, number, number] | null = null;
      for (const object of game?.world.allObjects() ?? []) {
        const state = peekNpcState(object);
        if (state && !object.destroyed) npcStates[object.name] = state.current;
        if (object.name === 'Ritter' && !object.destroyed) {
          items = peekInventory(object)?.snapshot() ?? {};
          ritter = object.worldPosition().toArray() as [number, number, number];
        }
      }
      return {
        scene: game?.sceneId ?? null,
        npcStates,
        hint: game?.interactionHint(1)?.kind ?? null,
        talking: game?.talking ?? false,
        loading: usePlay.getState().loading?.title ?? null,
        items,
        paused: game?.gamePaused ?? false,
        ritter,
      };
    },
    openSceneByName: (name) => {
      const entry = useDocument
        .getState()
        .project?.assetsOfType('scene')
        .find((asset) => assetDisplayName(asset.path) === name);
      if (!entry) return false;
      openScene(entry.id);
      return true;
    },
    teleportLive: (name, position) => {
      const object = [...(currentGame()?.world.allObjects() ?? [])].find(
        (item) => item.name === name && !item.destroyed,
      );
      object?.setWorldPosition(new Vector3(...position));
    },
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
