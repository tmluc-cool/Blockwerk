import {
  autoQuality,
  createRenderer,
  drawGameFrame,
  onQualityChange,
  pixelRatioFor,
  qualitySettings,
  ViewRenderer,
} from '@blockwerk/runtime';
import type { Game, RenderStats } from '@blockwerk/runtime';
import { Raycaster, Vector2 } from 'three';
import type { WebGLRenderer } from 'three';

/** The canvas of the player: fills its parent and draws the running game. */
export class PlayerViewport {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly views: ViewRenderer;
  private lastDraw = 0;
  private readonly cleanup: (() => void)[] = [];
  /** Statistics of the last frame drawn. */
  stats: RenderStats | null = null;

  /** Throws if the browser cannot create a WebGL 2 context. */
  constructor(private readonly parent: HTMLElement) {
    this.canvas = parent.ownerDocument.createElement('canvas');
    this.canvas.dataset['testid'] = 'player-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.canvas.tabIndex = 0;
    parent.appendChild(this.canvas);
    this.renderer = createRenderer({ canvas: this.canvas });
    this.views = new ViewRenderer(this.renderer);
    autoQuality(this.renderer);
    this.cleanup.push(onQualityChange(() => this.layout()));
    const view = parent.ownerDocument.defaultView;
    if (view) {
      const onResize = (): void => this.layout();
      view.addEventListener('resize', onResize);
      this.cleanup.push(() => view.removeEventListener('resize', onResize));
    }
    this.layout();
  }

  /** Fits the drawing buffer to the window and the graphics level. */
  layout(): void {
    const view = this.parent.ownerDocument.defaultView;
    const width = Math.max(1, this.parent.clientWidth);
    const height = Math.max(1, this.parent.clientHeight);
    this.renderer.setPixelRatio(pixelRatioFor(view?.devicePixelRatio ?? 1, qualitySettings()));
    this.renderer.setSize(width, height, false);
  }

  /** Draws the game's current frame (inside `renderInterpolated`). */
  draw(game: Game): void {
    const clock = performance.now();
    const delta = this.lastDraw > 0 ? Math.min(0.1, (clock - this.lastDraw) / 1000) : 1 / 60;
    this.lastDraw = clock;
    const layout = game.views();
    if (layout.views.length === 0) {
      this.renderer.setClearColor(0x000000);
      this.renderer.clear();
      return;
    }
    this.stats = drawGameFrame(this.renderer, this.views, game.world, layout, delta);
  }

  /** The object under a pointer position (for clicks on things in the world), or `null`. */
  pick(game: Game, event: PointerEvent): string | null {
    const camera = game.world.activeCamera();
    if (!camera) return null;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(game.world.scene.children, true)) {
      const object = game.world.objectFromNode(hit.object);
      if (object && (hit.object as { isMesh?: boolean }).isMesh && object.visible) return object.id;
    }
    return null;
  }

  dispose(): void {
    for (const dispose of this.cleanup) dispose();
    this.views.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
