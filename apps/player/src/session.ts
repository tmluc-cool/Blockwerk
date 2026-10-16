import { resolvePrefab } from '@blockwerk/project';
import type { SceneData } from '@blockwerk/project';
import {
  Game,
  initNavigation,
  initPhysics,
  loadScriptModule,
  ModelCache,
  setAudioSource,
  setQuality,
  setTerrainSource,
  TerrainData,
  UiRenderer,
  uiStringsFor,
} from '@blockwerk/runtime';
import type {
  CarryState,
  GameLogEntry,
  GamepadSnapshot,
  GameSettings,
  SceneRequest,
  ScriptAsset,
  UiLoading,
} from '@blockwerk/runtime';
import type { LoadedGame } from './load';
import { playerShell } from './shell';
import { createSettings, LocalSaveStorage, settingsKey } from './storage';
import type { PlayerLocale } from './texts';
import { PlayerViewport } from './viewport';

/** Number of tips the loading screen rotates through. */
const LOADING_TIPS = 3;
/** The loading screen stays this long after the next scene is built, so it never flashes. */
const MIN_LOADING_MS = 450;

/** What tests can read from the page (`window.__blockwerkPlayer`). */
export interface PlayerHooks {
  readonly state: 'running' | 'stopped';
  readonly tick: number;
  readonly sceneName: string;
  readonly objectCount: number;
  readonly drawCalls: number;
  /** Errors and warnings the game reported while running. */
  readonly problems: readonly string[];
  readonly fullscreenRequested: boolean;
  readonly loading: boolean;
}

declare global {
  interface Window {
    __blockwerkPlayer?: () => PlayerHooks;
  }
}

/** The pointer events and keys of the page, handed to the running game. */
function pressedGamepads(): (GamepadSnapshot | null)[] {
  if (typeof navigator.getGamepads !== 'function') return [];
  return Array.from(navigator.getGamepads(), (pad) =>
    pad
      ? {
          axes: Array.from(pad.axes),
          buttons: pad.buttons.map((button) => ({ pressed: button.pressed, value: button.value })),
        }
      : null,
  );
}

/** Runs a loaded game in `host`: the world, the UI layer, input, scene changes and saving. */
export class PlayerSession {
  private game: Game;
  private readonly viewport: PlayerViewport;
  private readonly ui: UiRenderer;
  private readonly settings: GameSettings;
  private readonly models: ModelCache;
  private readonly scripts = new Map<string, ScriptAsset>();
  private readonly terrains = new Map<string, TerrainData>();
  private readonly problems: string[] = [];
  private readonly cleanup: (() => void)[] = [];
  private frame = 0;
  private lastTime = 0;
  private stopped = false;
  private fullscreenRequested = false;
  private sceneName: string;
  private loading: UiLoading | null = null;
  private change: {
    readonly request: SceneRequest;
    readonly started: number;
    swappedAt: number | null;
    frames: number;
    shownAt: number | null;
  } | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly loaded: LoadedGame,
    private readonly locale: PlayerLocale,
  ) {
    const { pack } = loaded;
    this.settings = createSettings(pack.name);
    const firstRun = (() => {
      try {
        return localStorage.getItem(settingsKey(pack.name)) === null;
      } catch {
        return true;
      }
    })();
    // The first start of the Windows app follows the build setting; later starts the player's.
    if (firstRun && playerShell()) this.settings.set('fullscreen', pack.window === 'fullscreen');
    if (pack.graphicsLevel && !this.settings.get('graphicsLevel')) setQuality(pack.graphicsLevel);

    for (const [id, script] of Object.entries(pack.scripts)) {
      try {
        this.scripts.set(id, {
          assetId: id,
          module: loadScriptModule(script.code, `blockwerk://scripts/${id}.js`),
          variables: script.variables,
          lineToBlock: [],
          sourceUrl: `blockwerk://scripts/${id}.js`,
        });
      } catch (error) {
        this.report(`Script ${script.name}: ${String(error)}`);
      }
    }
    setAudioSource((id) => loaded.audio.get(id)?.slice(0) ?? null);
    setTerrainSource((id) => {
      const known = this.terrains.get(id);
      if (known) return known;
      const bytes = loaded.terrains.get(id);
      if (!bytes) return null;
      const data = TerrainData.deserialize(new Uint8Array(bytes));
      this.terrains.set(id, data);
      return data;
    });
    this.models = new ModelCache((ref) => {
      if (ref.startsWith('library:')) {
        const url = loaded.libraryUrls.get(ref.slice('library:'.length));
        return url ?? null;
      }
      const url = loaded.urls.get(ref);
      if (!url) return null;
      const file = pack.files[ref]?.model;
      return { url, ...(file ?? {}) };
    });

    this.viewport = new PlayerViewport(host);
    this.ui = new UiRenderer(
      host,
      {
        strings: uiStringsFor(locale),
        imageUrl: (id) => loaded.urls.get(id) ?? null,
      },
      this.settings,
    );
    this.cleanup.push(
      this.settings.onChange((key) => {
        if (key === 'fullscreen') this.applyFullscreen();
      }),
    );

    const start = pack.scenes[pack.startScene];
    if (!start) throw new Error('The start scene is missing.');
    this.sceneName = start.name;
    this.game = this.createGame(pack.startScene, start.data, start.name, {});
    this.attachInput();
    this.applyFullscreen();
  }

  /** Allows sound and starts the loop (called from the click on the start screen). */
  start(): void {
    this.game.audio.resume();
    this.lastTime = 0;
    this.frame = requestAnimationFrame((time) => this.loop(time));
  }

  /** What tests read. */
  hooks(): PlayerHooks {
    return {
      state: this.stopped ? 'stopped' : 'running',
      tick: this.game.tick,
      sceneName: this.sceneName,
      objectCount: [...this.game.world.allObjects()].length,
      drawCalls: this.viewport.stats?.drawCalls ?? 0,
      problems: this.problems,
      fullscreenRequested: this.fullscreenRequested,
      loading: this.loading !== null,
    };
  }

  private report(message: string): void {
    if (this.problems.length < 100) this.problems.push(message);
    console.warn(message);
  }

  private onLog = (entry: GameLogEntry): void => {
    if (entry.kind === 'scriptError') {
      this.report(`${entry.objectName}: ${entry.message}`);
    } else if (entry.kind === 'problem') {
      this.report(`${entry.problem.code}: ${JSON.stringify(entry.problem.params)}`);
    } else if (entry.kind === 'userLog') {
      console.info(entry.message);
    } else {
      this.report(`${entry.kind}: ${entry.objectName}`);
    }
  };

  private createGame(
    sceneId: string,
    data: SceneData,
    name: string,
    extras: { carry?: CarryState; spawn?: string; save?: SceneRequest['save'] },
  ): Game {
    const { pack } = this.loaded;
    const created = new Game(data, {
      scripts: (id) => this.scripts.get(id) ?? null,
      dialogs: (id) => pack.dialogs[id] ?? null,
      uis: (id) => pack.uis[id] ?? null,
      settings: this.settings,
      saves: new LocalSaveStorage(pack.name),
      savedVariables: new Set(pack.savedVariables),
      log: this.onLog,
      displayName: (_id, object) => (object.area && object.area !== 'custom' ? object.area : ''),
      models: this.models,
      onModelLoaded: () => undefined,
      prefabs: (id) => resolvePrefab(id, (prefabId) => pack.prefabs[prefabId]) ?? null,
      physics: {
        gravity: [0, -9.81, 0],
        layers: [...pack.layers],
        ignoredPairs: pack.ignoredCollisions.map(([a, b]) => [a, b]),
      },
      sceneId,
      sceneName: name,
      ...(extras.carry ? { carry: extras.carry } : {}),
      ...(extras.spawn !== undefined ? { spawn: extras.spawn } : {}),
      ...(extras.save ? { save: extras.save } : {}),
    });
    created.world.updateSun();
    return created;
  }

  private applyFullscreen(): void {
    const on = this.settings.get('fullscreen');
    const shell = playerShell();
    this.fullscreenRequested = on;
    if (shell) {
      shell.fullscreen(on);
      return;
    }
    const document = this.host.ownerDocument;
    if (on) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }

  private attachInput(): void {
    const canvas = this.viewport.canvas;
    const doc = this.host.ownerDocument;
    const listen = <T extends EventTarget>(
      target: T,
      type: string,
      listener: (event: never) => void,
      options?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, listener as EventListener, options);
      this.cleanup.push(() => target.removeEventListener(type, listener as EventListener, options));
    };
    const key = (event: KeyboardEvent, down: boolean): void => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.startsWith('F')) return;
      event.preventDefault();
      if (!event.repeat || !down) this.game.input.keyEvent(event.key, down, event.code);
    };
    listen(window, 'keydown', (event: KeyboardEvent) => key(event, true));
    listen(window, 'keyup', (event: KeyboardEvent) => key(event, false));
    listen(window, 'blur', () => this.game.input.releaseAll());
    const pointer = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = rect.height / 2 - (event.clientY - rect.top);
      this.game.setPointer(
        Math.round(x),
        Math.round(y),
        (x / Math.max(1, rect.width)) * 2,
        (y / Math.max(1, rect.height)) * 2,
        rect.width / Math.max(1, rect.height),
      );
    };
    listen(canvas, 'pointermove', (event: PointerEvent) => {
      pointer(event);
      if (doc.pointerLockElement === canvas) {
        this.game.input.mouseMove(event.movementX, event.movementY);
      }
    });
    listen(
      canvas,
      'wheel',
      (event: WheelEvent) => {
        event.preventDefault();
        this.game.input.wheel(event.deltaY);
      },
      { passive: false },
    );
    listen(canvas, 'pointerdown', (event: PointerEvent) => {
      canvas.focus({ preventScroll: true });
      if (event.button !== 0) return;
      pointer(event);
      this.game.input.mouseDown = true;
      if (this.game.wantsMouseLook() && doc.pointerLockElement !== canvas) {
        try {
          const request = canvas.requestPointerLock() as unknown;
          if (request instanceof Promise) request.catch(() => undefined);
        } catch {
          // Pointer lock is optional.
        }
      }
      const id = this.viewport.pick(this.game, event);
      if (id) this.game.click(id);
    });
    listen(canvas, 'pointerup', () => {
      this.game.input.mouseDown = false;
    });
    canvas.focus({ preventScroll: true });
  }

  private loop(time: number): void {
    if (this.stopped) return;
    const dt = this.lastTime ? Math.min(0.25, (time - this.lastTime) / 1000) : 1 / 60;
    this.lastTime = time;
    const game = this.game;
    game.paused = this.change !== null;
    game.input.setGamepads(pressedGamepads());
    const alpha = game.advance(dt);
    const request = game.takeSceneRequest();
    if (request) this.beginSceneChange(request);
    this.updateLoading();
    game.renderInterpolated(alpha, () => this.viewport.draw(game));
    const views = game.views();
    this.ui.update({
      game,
      loading: this.loading,
      views: {
        players: views.views.map((view): 1 | 2 => (view.player === '2' ? 2 : 1)),
        split: views.split,
      },
    });
    // Menus and dialogs need the mouse.
    if (game.gamePaused || game.talking || game.uiCanvases().some((canvas) => canvas.modal)) {
      this.host.ownerDocument.exitPointerLock?.();
    }
    if (game.quitRequested) {
      this.stop();
      const shell = playerShell();
      if (shell) shell.quit();
      else window.close();
      return;
    }
    this.frame = requestAnimationFrame((next) => this.loop(next));
  }

  /** Shows the loading screen and, a moment later, replaces the game by the next scene's game. */
  private beginSceneChange(request: SceneRequest): void {
    if (this.change) return;
    const entry = this.loaded.pack.scenes[request.scene];
    if (!entry) {
      this.report(`The scene ${request.scene} is not part of this game.`);
      return;
    }
    this.change = {
      request,
      started: performance.now(),
      swappedAt: null,
      frames: 0,
      shownAt: null,
    };
    this.loading = {
      title: entry.name,
      progress: 0,
      tip: Math.floor(Math.random() * LOADING_TIPS),
    };
    // Let the loading screen be drawn before the heavy work starts.
    const build = (): void => {
      const change = this.change;
      if (!change || this.stopped) return;
      if (change.frames < 2) {
        setTimeout(build, 30);
        return;
      }
      const old = this.game;
      const next = this.createGame(request.scene, entry.data, entry.name, {
        // Loading a save brings everything from the slot; a scene change carries the state over.
        ...(request.save
          ? { save: request.save }
          : { carry: old.exportCarry(), spawn: request.spawn }),
      });
      this.game = next;
      this.sceneName = entry.name;
      old.dispose();
      next.audio.resume();
      change.swappedAt = performance.now();
    };
    setTimeout(build, 80);
  }

  /** Moves the loading bar and hides the loading screen once the new scene is ready. */
  private updateLoading(): void {
    const change = this.change;
    if (!change) return;
    const now = performance.now();
    change.frames += 1;
    if (change.swappedAt !== null && change.shownAt === null) change.shownAt = now;
    if (change.shownAt !== null && now - change.shownAt >= MIN_LOADING_MS) {
      this.change = null;
      this.loading = null;
      return;
    }
    const progress =
      change.swappedAt === null ? Math.min(0.9, (now - change.started) / MIN_LOADING_MS) : 1;
    if (this.loading) this.loading = { ...this.loading, progress };
  }

  /** Stops the loop and frees the game. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    for (const dispose of this.cleanup) dispose();
    this.game.dispose();
    this.ui.dispose();
    this.viewport.dispose();
  }
}

/** Starts physics and navigation (they load once, before the first game is built). */
export async function initEngine(): Promise<void> {
  await initPhysics();
  await initNavigation().catch(() => undefined);
}
