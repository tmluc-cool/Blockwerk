import {
  autoQuality,
  createRenderer,
  measureFrame,
  onQualityChange,
  pixelRatioFor,
  qualitySettings,
  ViewRenderer,
} from '@blockwerk/runtime';
import type { RenderStats, World } from '@blockwerk/runtime';
import { Raycaster, Vector2, Vector3 } from 'three';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { currentGame } from '../state/play';
import { currentEditWorld, currentWorld, onWorldChange, registerRenderView } from '../scene/worlds';
import { isOnScreen } from '../scene/visibility';

/** Aspect ratio presets of the Game view toolbar. `null` means free aspect. */
export type AspectPreset = 'free' | '16:9' | '4:3';

const ASPECTS: Readonly<Record<AspectPreset, number | null>> = {
  free: null,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
};

/** The rectangle (CSS pixels, origin at the bottom left) of a split-screen view. */
export function viewRect(
  index: number,
  count: number,
  split: 'horizontal' | 'vertical',
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  if (split === 'vertical') {
    const part = Math.floor(width / count);
    return {
      x: index * part,
      y: 0,
      width: index === count - 1 ? width - index * part : part,
      height,
    };
  }
  // Horizontal split: the first view is on top.
  const part = Math.floor(height / count);
  const bottom = (count - 1 - index) * part;
  return { x: 0, y: bottom, width, height: index === 0 ? height - (count - 1) * part : part };
}

/** Distance in front of the camera where sun shadows are centered, in meters. */
const SHADOW_FOCUS_DISTANCE = 10;

/** Callbacks from the Game view to its panel. */
export interface GameViewportCallbacks {
  stats(stats: GameViewStats): void;
  /** Whether the shown world has a camera (otherwise the panel shows a hint). */
  cameraChanged(hasCamera: boolean): void;
}

/** Statistics of a drawn game frame: render counts, size and frames per second. */
export type GameViewStats = RenderStats & { width: number; height: number; fps: number };

let lastGameStats: GameViewStats | null = null;

/** Statistics of the last frame a game view drew (for tests and the statistics overlay). */
export function lastGameViewStats(): GameViewStats | null {
  return lastGameStats;
}

/**
 * Game view: renders the current world through its main camera, exactly as the game looks
 * (no grid or gizmos). In play mode it receives keyboard and mouse input for the game.
 */
export class GameViewport {
  /** Times of the frames drawn in the last second (for the frame rate). */
  private readonly frameTimes: number[] = [];
  private readonly renderer: WebGLRenderer;
  private readonly views: ViewRenderer;
  private lastRender = 0;
  private world: World | null = null;
  private aspect: AspectPreset = 'free';
  private containerWidth = 1;
  private containerHeight = 1;
  private frameHandle = 0;
  private disposed = false;
  private hasCamera: boolean | null = null;
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: GameViewportCallbacks,
  ) {
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.className = 'viewport-canvas game-canvas';
    canvas.dataset['testid'] = 'game-canvas';
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    this.renderer = createRenderer({ canvas });
    this.views = new ViewRenderer(this.renderer);
    autoQuality(this.renderer);
    this.cleanup.push(
      onQualityChange(() => {
        this.layout();
      }),
    );
    this.cleanup.push(onWorldChange(() => this.requestRender()));
    this.cleanup.push(registerRenderView(this));
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (event: HTMLElementEventMap[K]) => void,
    ): void => {
      canvas.addEventListener(type, listener);
      this.cleanup.push(() => canvas.removeEventListener(type, listener));
    };
    listen('keydown', (event) => this.key(event, true));
    listen('keyup', (event) => this.key(event, false));
    listen('blur', () => currentGame()?.input.releaseAll());
    listen('pointermove', (event) => {
      this.pointer(event);
      // With a captured pointer the mouse turns the view (player 1).
      if (canvas.ownerDocument.pointerLockElement === canvas) {
        currentGame()?.input.mouseMove(event.movementX, event.movementY);
      }
    });
    listen('wheel', (event) => {
      const game = currentGame();
      if (!game) return;
      event.preventDefault();
      game.input.wheel(event.deltaY);
    });
    listen('pointerdown', (event) => {
      canvas.focus({ preventScroll: true });
      const game = currentGame();
      if (!game || event.button !== 0) return;
      this.pointer(event);
      game.input.mouseDown = true;
      this.capturePointer();
      const id = this.pick(event);
      if (id) game.click(id);
    });
    listen('pointerup', () => {
      const game = currentGame();
      if (game) game.input.mouseDown = false;
    });
    this.resize(container.clientWidth, container.clientHeight);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setAspect(aspect: AspectPreset): void {
    this.aspect = aspect;
    this.layout();
  }

  /** Sets the available size in CSS pixels. */
  resize(width: number, height: number): void {
    this.containerWidth = Math.max(1, Math.floor(width));
    this.containerHeight = Math.max(1, Math.floor(height));
    this.layout();
  }

  /** Schedules a frame. */
  requestRender(): void {
    if (this.frameHandle || this.disposed) return;
    const view = this.container.ownerDocument.defaultView;
    if (!view) return;
    this.frameHandle = view.requestAnimationFrame(() => {
      this.frameHandle = 0;
      if (!this.disposed) this.render();
    });
  }

  /**
   * Captures the mouse pointer while playing (Esc gives it back), so the mouse can turn the
   * view without leaving the Game view. Refusals (no user gesture, unsupported) are ignored.
   */
  private capturePointer(): void {
    const canvas = this.canvas;
    if (canvas.ownerDocument.pointerLockElement === canvas) return;
    if (!currentGame()?.wantsMouseLook()) return;
    try {
      const request = canvas.requestPointerLock() as unknown;
      if (request instanceof Promise) request.catch(() => undefined);
    } catch {
      // Pointer lock is optional.
    }
  }

  /** Gives the canvas keyboard focus (when play mode starts). */
  focus(): void {
    this.canvas.focus({ preventScroll: true });
  }

  dispose(): void {
    this.disposed = true;
    for (const dispose of this.cleanup) dispose();
    const view = this.container.ownerDocument.defaultView;
    if (this.frameHandle && view) view.cancelAnimationFrame(this.frameHandle);
    for (const world of new Set([this.world, currentEditWorld()])) {
      world?.environment.releaseRenderer(this.renderer);
    }
    this.views.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private key(event: KeyboardEvent, down: boolean): void {
    const game = currentGame();
    // Editor shortcuts with Ctrl/Alt (stop, pause …) keep working while playing.
    if (!game || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat || !down) game.input.keyEvent(event.key, down, event.code);
  }

  private pointer(event: PointerEvent): void {
    const game = currentGame();
    if (!game) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = rect.height / 2 - (event.clientY - rect.top);
    const ndcX = (x / Math.max(1, rect.width)) * 2;
    const ndcY = (y / Math.max(1, rect.height)) * 2;
    game.setPointer(
      Math.round(x),
      Math.round(y),
      ndcX,
      ndcY,
      rect.width / Math.max(1, rect.height),
    );
  }

  private pick(event: PointerEvent): string | null {
    const world = this.world;
    const camera = world?.activeCamera();
    if (!world || !camera) return null;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(world.scene.children, true)) {
      const object = world.objectFromNode(hit.object);
      if (object && (hit.object as { isMesh?: boolean }).isMesh && object.visible) return object.id;
    }
    return null;
  }

  private layout(): void {
    const target = ASPECTS[this.aspect];
    let width = this.containerWidth;
    let height = this.containerHeight;
    if (target !== null) {
      if (width / height > target) width = Math.round(height * target);
      else height = Math.round(width / target);
    }
    const view = this.container.ownerDocument.defaultView;
    this.renderer.setPixelRatio(pixelRatioFor(view?.devicePixelRatio ?? 1, qualitySettings()));
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    const canvas = this.renderer.domElement;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.requestRender();
  }

  /** Renders now (also called by the play loop). */
  render(): void {
    // Hidden tabs (e.g. behind the Scene view) draw nothing; showing them draws again.
    if (!isOnScreen(this.canvas)) return;
    const world = currentWorld();
    if (world !== this.world) {
      // Baked lighting stays with its world (worlds free it when they are disposed).
      this.world = world;
    }
    // While playing, the game decides what is shown (one camera, or split screen with two).
    const game = currentGame();
    const layout = game
      ? game.views()
      : {
          views: world?.activeCamera()
            ? [{ camera: world.activeCamera() as PerspectiveCamera }]
            : [],
          split: 'vertical' as const,
        };
    const first = layout.views[0]?.camera ?? null;
    if ((first !== null) !== this.hasCamera) {
      this.hasCamera = first !== null;
      this.callbacks.cameraChanged(this.hasCamera);
    }
    const size = this.renderer.getDrawingBufferSize(new Vector2());
    if (!world || !first) {
      this.renderer.setClearColor(0x15171b);
      this.renderer.clear();
      return;
    }
    world.prepareRender();
    // Sun shadows cover the area in front of the first camera.
    first.updateMatrixWorld();
    const focus = first.getWorldPosition(new Vector3());
    focus.addScaledVector(first.getWorldDirection(new Vector3()), SHADOW_FOCUS_DISTANCE);
    world.environment.setFocus(focus);
    world.environment.prepare(this.renderer, first);
    const css = this.renderer.getSize(new Vector2());
    const quality = qualitySettings();
    const dpr = this.container.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    this.views.applyQuality(quality, world, dpr);
    this.views.setSize(css.x, css.y);
    const clock = performance.now();
    const delta = this.lastRender > 0 ? Math.min(0.1, (clock - this.lastRender) / 1000) : 1 / 60;
    this.lastRender = clock;
    const stats = measureFrame(this.renderer, () => {
      const split = layout.views.length > 1;
      if (!split) {
        // One view: the whole canvas, through the post-processing chain of its camera.
        first.aspect = css.x / Math.max(1, css.y);
        first.updateProjectionMatrix();
        first.updateMatrixWorld();
        this.views.render(world, first, quality, delta);
        return;
      }
      this.renderer.setScissorTest(true);
      layout.views.forEach((view, index) => {
        const rect = viewRect(index, layout.views.length, layout.split, css.x, css.y);
        const camera = view.camera;
        camera.aspect = rect.width / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        this.renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
        this.renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
        this.views.renderDirect(world, camera);
      });
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, css.x, css.y);
    });
    const now = performance.now();
    this.frameTimes.push(now);
    while (this.frameTimes.length > 0 && now - (this.frameTimes[0] ?? now) > 1000) {
      this.frameTimes.shift();
    }
    const span = now - (this.frameTimes[0] ?? now);
    const fps = span > 0 ? ((this.frameTimes.length - 1) * 1000) / span : 0;
    lastGameStats = { ...stats, width: size.x, height: size.y, fps };
    this.callbacks.stats(lastGameStats);
  }
}
