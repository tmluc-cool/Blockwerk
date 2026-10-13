import { createRenderer, measureFrame } from '@blockwerk/runtime';
import type { RenderStats } from '@blockwerk/runtime';
import { Vector2 } from 'three';
import type { WebGLRenderer } from 'three';
import { buildSampleWorld } from '../scene/sampleWorld';
import type { SampleWorld } from '../scene/sampleWorld';

/** Aspect ratio presets of the Game view toolbar. `null` means free aspect. */
export type AspectPreset = 'free' | '16:9' | '4:3';

const ASPECTS: Readonly<Record<AspectPreset, number | null>> = {
  free: null,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
};

/** Callbacks from the Game view to its panel. */
export interface GameViewportCallbacks {
  stats(stats: RenderStats & { width: number; height: number }): void;
}

/**
 * Game view: renders the sample scene from the main camera, exactly as the game would
 * (no editor grid or gizmos). Renders on demand; the play mode in phase 1 makes it continuous.
 */
export class GameViewport {
  private readonly renderer: WebGLRenderer;
  private readonly world: SampleWorld;
  private aspect: AspectPreset = 'free';
  private containerWidth = 1;
  private containerHeight = 1;
  private frameHandle = 0;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: GameViewportCallbacks,
  ) {
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.className = 'viewport-canvas game-canvas';
    canvas.dataset['testid'] = 'game-canvas';
    container.appendChild(canvas);
    this.renderer = createRenderer({ canvas });
    this.world = buildSampleWorld();
    this.world.environment.bakeLighting(this.renderer);
    this.world.environment.setFocus(
      this.world.objects.get('test-cube')?.position ?? this.world.mainCamera.position,
    );
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

  dispose(): void {
    this.disposed = true;
    const view = this.container.ownerDocument.defaultView;
    if (this.frameHandle && view) view.cancelAnimationFrame(this.frameHandle);
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
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

  private render(): void {
    const camera = this.world.mainCamera;
    const size = this.renderer.getDrawingBufferSize(new Vector2());
    camera.aspect = size.x / Math.max(1, size.y);
    camera.updateProjectionMatrix();
    this.world.environment.update(camera);
    const stats = measureFrame(this.renderer, () => this.renderer.render(this.world.scene, camera));
    this.callbacks.stats({ ...stats, width: size.x, height: size.y });
  }
}
