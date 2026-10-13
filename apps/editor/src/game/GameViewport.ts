import { createRenderer, measureFrame } from '@blockwerk/runtime';
import type { RenderStats, World } from '@blockwerk/runtime';
import { Raycaster, Vector2, Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
import { currentGame } from '../state/play';
import { currentWorld, onWorldChange, registerRenderView } from '../scene/worlds';

/** Aspect ratio presets of the Game view toolbar. `null` means free aspect. */
export type AspectPreset = 'free' | '16:9' | '4:3';

const ASPECTS: Readonly<Record<AspectPreset, number | null>> = {
  free: null,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
};

/** Distance in front of the camera where sun shadows are centered, in meters. */
const SHADOW_FOCUS_DISTANCE = 10;

/** Callbacks from the Game view to its panel. */
export interface GameViewportCallbacks {
  stats(stats: RenderStats & { width: number; height: number }): void;
  /** Whether the shown world has a camera (otherwise the panel shows a hint). */
  cameraChanged(hasCamera: boolean): void;
}

/**
 * Game view: renders the current world through its main camera, exactly as the game looks
 * (no grid or gizmos). In play mode it receives keyboard and mouse input for the game.
 */
export class GameViewport {
  private readonly renderer: WebGLRenderer;
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
    listen('pointermove', (event) => this.pointer(event));
    listen('pointerdown', (event) => {
      canvas.focus({ preventScroll: true });
      const game = currentGame();
      if (!game || event.button !== 0) return;
      this.pointer(event);
      game.input.mouseDown = true;
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

  /** Gives the canvas keyboard focus (when play mode starts). */
  focus(): void {
    this.canvas.focus({ preventScroll: true });
  }

  dispose(): void {
    this.disposed = true;
    for (const dispose of this.cleanup) dispose();
    const view = this.container.ownerDocument.defaultView;
    if (this.frameHandle && view) view.cancelAnimationFrame(this.frameHandle);
    this.world?.environment.releaseRenderer(this.renderer);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private key(event: KeyboardEvent, down: boolean): void {
    const game = currentGame();
    // Editor shortcuts with Ctrl/Alt (stop, pause …) keep working while playing.
    if (!game || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat || !down) game.input.keyEvent(event.key, down);
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
    this.renderer.setPixelRatio(Math.min(view?.devicePixelRatio ?? 1, 2));
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    const canvas = this.renderer.domElement;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.requestRender();
  }

  /** Renders now (also called by the play loop). */
  render(): void {
    const world = currentWorld();
    if (world !== this.world) {
      this.world?.environment.releaseRenderer(this.renderer);
      this.world = world;
    }
    const camera = world?.activeCamera() ?? null;
    if ((camera !== null) !== this.hasCamera) {
      this.hasCamera = camera !== null;
      this.callbacks.cameraChanged(this.hasCamera);
    }
    const size = this.renderer.getDrawingBufferSize(new Vector2());
    if (!world || !camera) {
      this.renderer.setClearColor(0x15171b);
      this.renderer.clear();
      return;
    }
    camera.aspect = size.x / Math.max(1, size.y);
    camera.updateProjectionMatrix();
    world.updateSun();
    camera.updateMatrixWorld();
    // Sun shadows cover the area in front of the camera.
    const focus = camera.getWorldPosition(new Vector3());
    focus.addScaledVector(camera.getWorldDirection(new Vector3()), SHADOW_FOCUS_DISTANCE);
    world.environment.setFocus(focus);
    world.environment.prepare(this.renderer, camera);
    const stats = measureFrame(this.renderer, () => this.renderer.render(world.scene, camera));
    this.callbacks.stats({ ...stats, width: size.x, height: size.y });
  }
}
