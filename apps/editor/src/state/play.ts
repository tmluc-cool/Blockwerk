import { compileBlockScript, CompileError } from '@blockwerk/compiler';
import { assetDisplayName } from '@blockwerk/project';
import type { BlockScriptData, SceneData } from '@blockwerk/project';
import { Game, loadScriptModule } from '@blockwerk/runtime';
import type { GameLogEntry, ScriptAsset, VariableMonitor, World } from '@blockwerk/runtime';
import { create } from 'zustand';
import type { TranslationKey } from '../i18n';
import { gameView } from '../game/gameViews';
import { focusPanel } from '../layout/layoutController';
import { defaultObjectName, renderViews, setPlayWorld } from '../scene/worlds';
import { useConsole } from './console';
import { editScene, useDocument } from './document';

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
}

/** Play mode state. */
export const usePlay = create<PlayState>()(() => ({
  status: 'stopped',
  timeScale: 1,
  changes: {},
  frame: 0,
  monitors: [],
  tick: 0,
}));

let game: Game | null = null;
let compiled = new Map<string, { data: BlockScriptData; asset: ScriptAsset }>();
let frameHandle = 0;
let lastTime = 0;
let lastUiUpdate = 0;

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

function compileAsset(id: string, name: string, data: BlockScriptData): ScriptAsset | null {
  try {
    const result = compileBlockScript(data.workspace, {
      assetName: name,
      variables: data.variables,
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
  for (const entry of project.assetsOfType('blockScript')) {
    const previous = compiled.get(entry.id);
    if (previous?.data === entry.data) continue;
    const asset = compileAsset(entry.id, assetDisplayName(entry.path), entry.data);
    if (!asset) continue;
    compiled.set(entry.id, { data: entry.data, asset });
    game.replaceScript(asset);
  }
}

function logGame(entry: GameLogEntry): void {
  const log = useConsole.getState();
  if (entry.kind === 'scriptError') {
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

function loop(time: number): void {
  frameHandle = 0;
  if (!game) return;
  const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
  lastTime = time;
  const { status, timeScale } = usePlay.getState();
  game.timeScale = timeScale;
  game.paused = status !== 'playing';
  const alpha = game.advance(dt);
  game.renderInterpolated(alpha, renderViews);
  updateUi();
  frameHandle = requestAnimationFrame(loop);
}

let unsubscribeAssets: (() => void) | null = null;

/** Enters play mode (Ctrl+P). Returns the start-up time in milliseconds. */
export function play(): number {
  if (game) return 0;
  const started = performance.now();
  const { scene } = useDocument.getState();
  if (!scene) return 0;
  compileAll();
  game = new Game(scene, {
    scripts: (id) => compiled.get(id)?.asset ?? null,
    log: logGame,
    displayName: defaultObjectName,
  });
  usePlay.setState({ status: 'playing', changes: {}, monitors: [], tick: 0 });
  setPlayWorld(game.world);
  unsubscribeAssets = useDocument.subscribe((state, previous) => {
    if (state.assetsVersion !== previous.assetsVersion) hotReload();
  });
  lastTime = 0;
  frameHandle = requestAnimationFrame(loop);
  // Like Unity, the Game view comes to the front and receives the keyboard.
  focusPanel('game');
  gameView()?.focus();
  const elapsed = Math.round(performance.now() - started);
  useConsole.getState().log('info', 'console.playStarted', { ms: elapsed });
  return elapsed;
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
  compiled = new Map();
  usePlay.setState({ status: 'stopped', changes: {}, monitors: [], tick: 0 });
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
    play();
    usePlay.setState({ status: 'paused' });
    return;
  }
  usePlay.setState({ status: 'paused' });
  game.stepTick();
  game.renderInterpolated(1, renderViews);
  updateUi(true);
}

/** Sets slow motion. */
export function setTimeScale(timeScale: TimeScale): void {
  usePlay.setState({ timeScale });
}
