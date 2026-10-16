import { buildLibrary, compileBlockScript, CompileError, EMPTY_LIBRARY } from '@blockwerk/compiler';
import type { ProjectLibrary, ProjectScript } from '@blockwerk/compiler';
import { assetDisplayName, resolvePrefab } from '@blockwerk/project';
import type { BlockScriptData, SaveData, SceneData } from '@blockwerk/project';
import { Game, initPhysics, loadedRapier, loadScriptModule, setQuality } from '@blockwerk/runtime';
import type { Problem } from '@blockwerk/runtime';
import type { GamepadSnapshot } from '@blockwerk/runtime';
import type {
  CarryState,
  GameLogEntry,
  SceneRequest,
  ScriptAsset,
  VariableMonitor,
  World,
} from '@blockwerk/runtime';
import { create } from 'zustand';
import type { TranslationKey } from '../i18n';
import { gameView } from '../game/gameViews';
import { gameSettings } from '../game/settingsStore';
import { LocalSaveStorage } from '../game/saveStorage';
import { updateUiLayer } from '../game/uiLayer';
import { focusPanel } from '../layout/layoutController';
import { useMute } from '../audio/editorAudio';
import { editorModels } from '../library/models';
import {
  currentEditWorld,
  defaultObjectName,
  renderViews,
  setPlayWorld,
  worldUpdated,
} from '../scene/worlds';
import { useConsole } from './console';
import { checkScene } from '../document/sceneCheck';
import { useSettings } from './settings';
import { editScene, prefabSource, useDocument } from './document';

/** A value changed while playing that can be kept after stopping. */
export interface PlayChange {
  readonly objectId: string;
  readonly path: string;
  readonly label: TranslationKey;
  /** Applies the change to the edit scene. */
  readonly apply: (scene: SceneData) => SceneData;
}

/** Slow motion factors (SPEC 5.5). */
export const TIME_SCALES = [1, 0.5, 0.25] as const;
export type TimeScale = (typeof TIME_SCALES)[number];

interface PlayState {
  status: 'stopped' | 'playing' | 'paused';
  timeScale: TimeScale;
  /** Changes made while playing, by `objectId|path`. */
  changes: Record<string, PlayChange & { kept: boolean }>;
  /** Bumps about ten times per second while playing (refreshes inspector and hierarchy). */
  frame: number;
  monitors: VariableMonitor[];
  /** Logic tick of the running game. */
  tick: number;
  /** Milliseconds from pressing Play to the first rendered game frame. */
  startupMs: number | null;
  /** The loading screen between scenes (`null` when none is shown). */
  loading: { readonly title: string; readonly progress: number; readonly tip: number } | null;
}

/** Play mode state. */
export const usePlay = create<PlayState>()(() => ({
  status: 'stopped',
  timeScale: 1,
  changes: {},
  frame: 0,
  monitors: [],
  tick: 0,
  startupMs: null,
  loading: null,
}));

let game: Game | null = null;
let compiled = new Map<string, { data: BlockScriptData; asset: ScriptAsset }>();
let frameHandle = 0;
let lastTime = 0;
let lastUiUpdate = 0;
let playStarted: number | null = null;

/** The running game, if any. */
export function currentGame(): Game | null {
  return game;
}

/** The world of the running game (play mode), or `null` in edit mode. */
export function playingWorld(): World | null {
  return game?.world ?? null;
}

/** Remembers a change made while playing. */
export function recordPlayChange(change: PlayChange): void {
  const key = `${change.objectId}|${change.path}`;
  usePlay.setState((state) => ({
    changes: { ...state.changes, [key]: { ...change, kept: false } },
  }));
}

/** Keeps a play-mode change: it is written to the scene (with undo) and survives stopping. */
export function keepChange(key: string): void {
  const change = usePlay.getState().changes[key];
  if (!change || change.kept) return;
  editScene(change.label, change.apply);
  usePlay.setState((state) => ({
    changes: { ...state.changes, [key]: { ...change, kept: true } },
  }));
}

/** Keeps all play-mode changes of an object. */
export function keepAllChanges(objectId: string): void {
  for (const [key, change] of Object.entries(usePlay.getState().changes)) {
    if (change.objectId === objectId) keepChange(key);
  }
}

/** The project-wide custom blocks as of the last compile (hot reload compares with it). */
let library: ProjectLibrary = EMPTY_LIBRARY;

/** Every block script of the project in the form the compiler reads. */
function projectScripts(): ProjectScript[] {
  const { project } = useDocument.getState();
  return (project?.assetsOfType('blockScript') ?? []).map((entry) => ({
    assetId: entry.id,
    assetName: assetDisplayName(entry.path),
    workspace: entry.data.workspace,
    variables: entry.data.variables,
  }));
}

function compileAsset(
  id: string,
  name: string,
  data: BlockScriptData,
  shared: ProjectLibrary = library,
): ScriptAsset | null {
  try {
    const result = compileBlockScript(data.workspace, {
      assetName: name,
      assetId: id,
      variables: data.variables,
      library: shared,
    });
    for (const diagnostic of result.diagnostics) {
      useConsole
        .getState()
        .log(
          diagnostic.severity === 'error' ? 'error' : 'warning',
          `console.diagnostic.${diagnostic.code}`,
          { script: name, ...diagnostic.params },
          { assetId: id, blockId: diagnostic.blockId },
        );
    }
    const sourceUrl = `blockwerk://scripts/${id}.js`;
    return {
      assetId: id,
      module: loadScriptModule(result.code, sourceUrl),
      variables: data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl,
    };
  } catch (error) {
    const message =
      error instanceof CompileError || error instanceof Error ? error.message : String(error);
    useConsole
      .getState()
      .log('error', 'console.compileFailed', { script: name, message }, { assetId: id });
    return null;
  }
}

function compileAll(): void {
  compiled = new Map();
  library = buildLibrary(projectScripts());
  const { project } = useDocument.getState();
  for (const entry of project?.assetsOfType('blockScript') ?? []) {
    const asset = compileAsset(entry.id, assetDisplayName(entry.path), entry.data);
    if (asset) compiled.set(entry.id, { data: entry.data, asset });
  }
}

/** Hot reload: recompiles block scripts that changed while playing. */
function hotReload(): void {
  const { project } = useDocument.getState();
  if (!game || !project) return;
  const entries = project.assetsOfType('blockScript');
  const changed = entries.filter((entry) => compiled.get(entry.id)?.data !== entry.data);
  if (changed.length === 0) return;
  // A change in a script that holds project-wide custom blocks reaches every script that calls
  // them, so all scripts are compiled again; otherwise only the changed ones are.
  const before = library;
  library = buildLibrary(projectScripts());
  const ids = new Set(changed.map((entry) => entry.id));
  const touchesLibrary = [...before.signatures.values(), ...library.signatures.values()].some(
    (signature) => ids.has(signature.assetId),
  );
  for (const entry of touchesLibrary ? entries : changed) {
    const previous = compiled.get(entry.id);
    if (previous?.data === entry.data && !touchesLibrary) continue;
    const asset = compileAsset(entry.id, assetDisplayName(entry.path), entry.data);
    if (!asset) continue;
    compiled.set(entry.id, { data: entry.data, asset });
    game.replaceScript(asset);
  }
}

function logGame(entry: GameLogEntry): void {
  const log = useConsole.getState();
  if (entry.kind === 'problem') {
    logProblem(entry.problem);
    if (entry.level === 'error' && log.errorPause && usePlay.getState().status === 'playing') {
      pause();
    }
  } else if (entry.kind === 'scriptError') {
    log.log(
      'error',
      'console.scriptError',
      { object: entry.objectName, message: entry.message },
      {
        objectId: entry.objectId,
        assetId: entry.assetId,
        ...(entry.blockId ? { blockId: entry.blockId } : {}),
      },
    );
    if (log.errorPause && usePlay.getState().status === 'playing') pause();
  } else if (entry.kind === 'userLog') {
    log.log(
      entry.level,
      'console.userLog',
      { object: entry.objectName, message: entry.message },
      {
        objectId: entry.objectId,
        ...(entry.assetId ? { assetId: entry.assetId } : {}),
        ...(entry.blockId ? { blockId: entry.blockId } : {}),
      },
    );
    if (entry.level === 'error' && log.errorPause && usePlay.getState().status === 'playing') {
      pause();
    }
  } else if (entry.kind === 'missingPrefab') {
    log.log(
      'warning',
      'console.game.missingPrefab',
      { object: entry.objectName, asset: entry.assetId ?? '–' },
      { objectId: entry.objectId },
    );
  } else {
    log.log(
      'warning',
      'console.missingScript',
      { object: entry.objectName },
      { objectId: entry.objectId },
    );
  }
}

function updateUi(force = false): void {
  const now = performance.now();
  if (!game || (!force && now - lastUiUpdate < 100)) return;
  lastUiUpdate = now;
  usePlay.setState((state) => ({
    frame: state.frame + 1,
    monitors: game?.monitors() ?? [],
    tick: game?.tick ?? 0,
  }));
}

/** Times of the recent play-mode frames and how long each took (for the statistics). */
const frameTimes: number[] = [];
const frameWork: number[] = [];
const MEASURED_FRAMES = 120;

/**
 * Frame rate and work per frame of play mode over the last frames: `fps` from the frame times,
 * `frameMs` the average time spent on logic and rendering per frame.
 */
export function playPerformance(): { fps: number; frameMs: number; frames: number } {
  const count = frameTimes.length;
  const first = frameTimes[0];
  const last = frameTimes[count - 1];
  const fps =
    count > 1 && first !== undefined && last !== undefined && last > first
      ? ((count - 1) * 1000) / (last - first)
      : 0;
  const frameMs = frameWork.length
    ? frameWork.reduce((sum, value) => sum + value, 0) / frameWork.length
    : 0;
  return { fps, frameMs, frames: count };
}

function loop(time: number): void {
  frameHandle = 0;
  if (!game) return;
  const workStart = performance.now();
  const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
  lastTime = time;
  const { status, timeScale } = usePlay.getState();
  game.timeScale = timeScale;
  game.paused = status !== 'playing' || sceneChange !== null;
  game.input.setGamepads(readGamepads());
  const alpha = game.advance(dt);
  const request = game.takeSceneRequest();
  if (request) beginSceneChange(request);
  updateLoading();
  game.renderInterpolated(alpha, renderViews);
  updateUiLayer(game, usePlay.getState().loading);
  if (game.quitRequested) {
    stop();
    return;
  }
  frameTimes.push(time);
  frameWork.push(performance.now() - workStart);
  if (frameTimes.length > MEASURED_FRAMES) frameTimes.shift();
  if (frameWork.length > MEASURED_FRAMES) frameWork.shift();
  if (playStarted !== null) {
    const startupMs = Math.round(performance.now() - playStarted);
    playStarted = null;
    usePlay.setState({ startupMs });
    useConsole.getState().log('info', 'console.playStarted', { ms: startupMs });
  }
  updateUi();
  frameHandle = requestAnimationFrame(loop);
}

let unsubscribeAssets: (() => void) | null = null;
let starting = false;

/** Options of {@link play}. */
export interface PlayOptions {
  /** Plays this scene instead of the open one (the test area). */
  readonly scene?: SceneData;
  /** Block scripts that exist only for the played scene (not in the project). */
  readonly extraScripts?: ReadonlyMap<string, BlockScriptData>;
  /** Start paused (the step button). */
  readonly paused?: boolean;
}

/** Pads as the Gamepad API reports them (standard mapping), reduced to what the game reads. */
function readGamepads(): (GamepadSnapshot | null)[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  return Array.from(navigator.getGamepads(), (pad) =>
    pad
      ? {
          axes: Array.from(pad.axes),
          buttons: pad.buttons.map((button) => ({
            pressed: button.pressed,
            value: button.value,
          })),
        }
      : null,
  );
}

/** Physics layers and the layer matrix of the project (SPEC 8.4). */
function physicsSettings(): {
  gravity: [number, number, number];
  layers: string[];
  ignoredPairs: [string, string][];
} {
  const { project } = useDocument.getState();
  const settings = project?.tagsAndLayers;
  return {
    gravity: [0, -9.81, 0],
    layers: ['Default', ...(settings?.layers ?? [])],
    ignoredPairs: (settings?.ignoredCollisions ?? []).map(([a, b]) => [a, b]),
  };
}

/** Number of tips the loading screen rotates through. */
const LOADING_TIPS = 3;
/** The loading screen stays this long after the next scene is built, so it never flashes. */
const MIN_LOADING_MS = 450;

interface GameExtras {
  readonly sceneId?: string | undefined;
  readonly sceneName?: string | undefined;
  readonly save?: SaveData | undefined;
  readonly carry?: CarryState;
  readonly spawn?: string;
}

/** Builds a game for a scene with the project's scripts, prefabs, dialogs and physics settings. */
function createGame(scene: SceneData, extras: GameExtras): Game {
  const project = useDocument.getState().project;
  return new Game(scene, {
    scripts: (id) => compiled.get(id)?.asset ?? null,
    dialogs: (id) => project?.assetOfType(id, 'dialog')?.data ?? null,
    uis: (id) => project?.assetOfType(id, 'ui')?.data ?? null,
    settings: gameSettings,
    saves: new LocalSaveStorage(project?.settings.name ?? 'project'),
    savedVariables: savedVariableIds(),
    log: logGame,
    displayName: defaultObjectName,
    models: editorModels,
    onModelLoaded: worldUpdated,
    prefabs: (id) => resolvePrefab(id, prefabSource()) ?? null,
    physics: physicsSettings(),
    ...(extras.sceneId ? { sceneId: extras.sceneId } : {}),
    ...(extras.sceneName ? { sceneName: extras.sceneName } : {}),
    ...(extras.carry ? { carry: extras.carry } : {}),
    ...(extras.spawn !== undefined ? { spawn: extras.spawn } : {}),
    ...(extras.save ? { save: extras.save } : {}),
  });
}

/** Texts in the interface language: the check hands both, `fieldEn` / `componentEn` are English. */
function problemParams(problem: Problem, german: boolean): Record<string, string> {
  const params: Record<string, string> = { ...problem.params };
  if (!german) {
    if (params['componentEn']) params['component'] = params['componentEn'];
    if (params['fieldEn']) params['field'] = params['fieldEn'];
  }
  delete params['componentEn'];
  delete params['fieldEn'];
  return params;
}

/** Writes a problem to the console, with the script name filled in where the problem has a script. */
function logProblem(problem: Problem): void {
  const { project } = useDocument.getState();
  const locale = useSettings.getState().locale;
  const params = problemParams(problem, locale === 'de');
  const assetId = problem.link.assetId;
  const entry = assetId ? project?.asset(assetId) : undefined;
  if (entry && params['script'] === undefined) params['script'] = assetDisplayName(entry.path);
  useConsole.getState().log(problem.severity, `check.${problem.code}`, params, problem.link);
}

/** Checks a freshly built scene and lists the problems in the console (nothing stops the game). */
export function runSceneCheck(built: Game): number {
  const { project } = useDocument.getState();
  if (!project) return 0;
  const locale = useSettings.getState().locale;
  const problems = checkScene(built.world, { project, displayName: assetDisplayName, locale });
  for (const problem of problems) logProblem(problem);
  return problems.length;
}

/** IDs of the game variables (of all block scripts) that belong in a save. */
function savedVariableIds(): Set<string> {
  const ids = new Set<string>();
  for (const entry of useDocument.getState().project?.assetsOfType('blockScript') ?? []) {
    for (const variable of entry.data.variables) {
      if (variable.scope === 'game' && variable.saved) ids.add(variable.id);
    }
  }
  return ids;
}

let sceneChange: {
  readonly request: SceneRequest;
  readonly started: number;
  /** When the next scene was built (`null` before). */
  swappedAt: number | null;
  /** Frames since the change began: the screen is drawn after the first one. */
  frames: number;
  /** The frame in which the screen was first shown after the build (`null` before). */
  shownAt: number | null;
} | null = null;

/** Shows the loading screen and, a moment later, replaces the game by the next scene's game. */
function beginSceneChange(request: SceneRequest): void {
  if (sceneChange) return;
  const { project, sceneId, scene } = useDocument.getState();
  const entry = project?.assetOfType(request.scene, 'scene');
  if (!entry) {
    useConsole.getState().log('warning', 'console.game.missingScene', { asset: request.scene });
    return;
  }
  const title = assetDisplayName(entry.path);
  sceneChange = { request, started: performance.now(), swappedAt: null, frames: 0, shownAt: null };
  usePlay.setState({
    loading: { title, progress: 0, tip: Math.floor(Math.random() * LOADING_TIPS) },
  });
  // Let the loading screen be drawn before the heavy work starts (slow machines draw late).
  const build = (): void => {
    const change = sceneChange;
    const old = game;
    if (!change || !old) return;
    if (change.frames < 2) {
      setTimeout(build, 30);
      return;
    }
    const data = entry.id === sceneId && scene ? scene : entry.data;
    const next = createGame(data, {
      sceneId: entry.id,
      sceneName: title,
      // Loading a save brings everything from the slot; a scene change carries the old state over.
      ...(change.request.save
        ? { save: change.request.save }
        : { carry: old.exportCarry(), spawn: change.request.spawn }),
    });
    next.audio.setMuted(useMute.getState().muted);
    next.world.updateSun();
    runSceneCheck(next);
    game = next;
    setPlayWorld(next.world);
    old.dispose();
    change.swappedAt = performance.now();
    usePlay.setState({ monitors: [], tick: 0 });
  };
  setTimeout(build, 80);
}

/** Moves the loading bar and hides the loading screen once the new scene is ready. */
function updateLoading(): void {
  const change = sceneChange;
  if (!change) return;
  const now = performance.now();
  change.frames += 1;
  // The screen stays a moment after the (blocking) build, counted from the first frame that shows
  // it again, so even a slow frame after the build cannot take it away unseen.
  if (change.swappedAt !== null && change.shownAt === null) change.shownAt = now;
  if (change.shownAt !== null && now - change.shownAt >= MIN_LOADING_MS) {
    sceneChange = null;
    usePlay.setState({ loading: null });
    return;
  }
  const progress =
    change.swappedAt === null ? Math.min(0.9, (now - change.started) / MIN_LOADING_MS) : 1;
  usePlay.setState((state) => (state.loading ? { loading: { ...state.loading, progress } } : {}));
}

/**
 * Enters play mode (Ctrl+P). The start-up time is logged once the first frame is drawn. The
 * physics engine loads once and stays loaded; the very first start waits for it.
 */
export function play(options: PlayOptions = {}): void {
  if (game || starting) return;
  if (!loadedRapier()) {
    starting = true;
    void initPhysics().then(
      () => {
        starting = false;
        play(options);
      },
      () => {
        starting = false;
      },
    );
    return;
  }
  // The project's graphics level, if it names one (players can switch it afterwards).
  const level = useDocument.getState().project?.settings.graphicsLevel;
  if (level) setQuality(level);
  playStarted = performance.now();
  frameTimes.length = 0;
  frameWork.length = 0;
  const scene = options.scene ?? useDocument.getState().scene;
  if (!scene) return;
  compileAll();
  for (const [id, data] of options.extraScripts ?? []) {
    const asset = compileAsset(id, id, data);
    if (asset) compiled.set(id, { data, asset });
  }
  const openSceneId = useDocument.getState().sceneId;
  const openScene = openSceneId ? useDocument.getState().project?.asset(openSceneId) : undefined;
  game = createGame(scene, {
    sceneId: openSceneId ?? undefined,
    sceneName: openScene ? assetDisplayName(openScene.path) : undefined,
  });
  game.audio.setMuted(useMute.getState().muted);
  runSceneCheck(game);
  // The Play click allows sound in the browser.
  game.audio.resume();
  // Same sun as the edit world: reuse its baked ambient light instead of baking again.
  game.world.updateSun();
  game.world.environment.shareLightingFrom(currentEditWorld()?.environment ?? null);
  usePlay.setState({
    status: options.paused ? 'paused' : 'playing',
    changes: {},
    monitors: [],
    tick: 0,
    startupMs: null,
  });
  setPlayWorld(game.world);
  unsubscribeAssets = useDocument.subscribe((state, previous) => {
    if (state.assetsVersion !== previous.assetsVersion) hotReload();
  });
  lastTime = 0;
  frameHandle = requestAnimationFrame(loop);
  // Like Unity, the Game view comes to the front and receives the keyboard.
  focusPanel('game');
  gameView()?.focus();
}

/** Leaves play mode; everything not kept is reset. */
export function stop(): void {
  if (!game) return;
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  unsubscribeAssets?.();
  unsubscribeAssets = null;
  const finished = game;
  game = null;
  setPlayWorld(null);
  finished.dispose();
  updateUiLayer(null, null);
  compiled = new Map();
  sceneChange = null;
  usePlay.setState({ status: 'stopped', changes: {}, monitors: [], tick: 0, loading: null });
}

/** Play button: starts or stops. */
export function togglePlay(): void {
  if (game) stop();
  else play();
}

/** Pause button (Ctrl+Shift+P). */
export function pause(): void {
  const { status } = usePlay.getState();
  if (status === 'playing') usePlay.setState({ status: 'paused' });
  else if (status === 'paused') usePlay.setState({ status: 'playing' });
}

/** Step button (Ctrl+Alt+P): pauses and runs exactly one logic tick. */
export function step(): void {
  if (!game) {
    play({ paused: true });
    return;
  }
  usePlay.setState({ status: 'paused' });
  game.stepTick();
  game.renderInterpolated(1, renderViews);
  updateUiLayer(game, usePlay.getState().loading);
  updateUi(true);
}

/** Sets slow motion. */
export function setTimeScale(timeScale: TimeScale): void {
  usePlay.setState({ timeScale });
}
