import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { DEFAULT_POST_SETTINGS, effectivePost, PostProcessing } from './PostProcessing';
import type { PostSettings } from './PostProcessing';
import { pixelRatioFor } from './quality';
import type { QualitySettings } from './quality';
import { ACESFilmicToneMapping } from 'three';

/** What a view needs from the world it draws. */
export interface ViewWorld {
  readonly scene: Scene;
  readonly environment: {
    setShadowMapSize(size: number): void;
    setShadowRadius(radius: number): void;
  };
  /** Post-processing settings of the camera: `null` = switched off, `undefined` = no component. */
  postSettings(camera: PerspectiveCamera): PostSettings | null | undefined;
}

/**
 * Draws a world through a camera at the current graphics level: sets pixel ratio, shadow
 * quality and the post-processing chain. Split-screen views are drawn directly (no chain).
 */
export class ViewRenderer {
  private readonly post: PostProcessing;

  constructor(private readonly renderer: WebGLRenderer) {
    this.post = new PostProcessing(renderer);
  }

  /** The post-processing chain (tests, statistics). */
  get chain(): PostProcessing {
    return this.post;
  }

  /** Applies the parts of a graphics level that belong to the renderer and the sun. */
  applyQuality(settings: QualitySettings, world: ViewWorld, devicePixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatioFor(devicePixelRatio, settings));
    world.environment.setShadowMapSize(settings.shadowMapSize);
    world.environment.setShadowRadius(settings.shadowRadius);
  }

  /** Sets the size in CSS pixels. */
  setSize(width: number, height: number): void {
    this.post.setSize(width, height);
  }

  /**
   * Draws one full-canvas view. Returns whether the post-processing chain was used (the canvas
   * then needs no tone mapping of its own).
   */
  render(
    world: ViewWorld,
    camera: PerspectiveCamera,
    settings: QualitySettings,
    delta: number,
  ): boolean {
    const found = world.postSettings(camera);
    // A camera without the component gets the defaults; a switched-off component gets nothing.
    const post = found === undefined ? DEFAULT_POST_SETTINGS : found;
    const effective = effectivePost(post, settings);
    if (!post || !effective.active) {
      this.post.dispose();
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.render(world.scene, camera);
      return false;
    }
    this.post.render(world.scene, camera, post, effective, delta);
    return true;
  }

  /** Draws without post-processing (split screen, previews). */
  renderDirect(world: ViewWorld, camera: PerspectiveCamera): void {
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.render(world.scene, camera);
  }

  dispose(): void {
    this.post.dispose();
  }
}
