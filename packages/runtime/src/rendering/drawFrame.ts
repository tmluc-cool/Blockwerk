import { Vector2, Vector3 } from 'three';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import type { World } from '../world/World';
import { measureFrame } from './RenderStats';
import type { RenderStats } from './RenderStats';
import { qualitySettings } from './quality';
import type { ViewRenderer } from './ViewRenderer';

/** Distance in front of the camera where sun shadows are centered, in meters. */
const SHADOW_FOCUS_DISTANCE = 10;

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

/** What a game shows: one camera, or several in a split screen. */
export interface GameLayout {
  readonly views: readonly { readonly camera: PerspectiveCamera }[];
  readonly split: 'horizontal' | 'vertical';
}

/**
 * Draws one frame of a world through the cameras of a layout (the Game view of the editor and
 * the player of an exported game share it). `delta` is the time since the last frame in seconds.
 * Needs at least one view.
 */
export function drawGameFrame(
  renderer: WebGLRenderer,
  views: ViewRenderer,
  world: World,
  layout: GameLayout,
  delta: number,
): RenderStats | null {
  const first = layout.views[0]?.camera;
  if (!first) return null;
  world.prepareRender();
  // Sun shadows cover the area in front of the first camera.
  first.updateMatrixWorld();
  const focus = first.getWorldPosition(new Vector3());
  focus.addScaledVector(first.getWorldDirection(new Vector3()), SHADOW_FOCUS_DISTANCE);
  world.environment.setFocus(focus);
  world.environment.prepare(renderer, first);
  const css = renderer.getSize(new Vector2());
  const quality = qualitySettings();
  const dpr = renderer.domElement.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  views.applyQuality(quality, world, dpr);
  views.setSize(css.x, css.y);
  return measureFrame(renderer, () => {
    if (layout.views.length <= 1) {
      // One view: the whole canvas, through the post-processing chain of its camera.
      first.aspect = css.x / Math.max(1, css.y);
      first.updateProjectionMatrix();
      first.updateMatrixWorld();
      views.render(world, first, quality, delta);
      return;
    }
    renderer.setScissorTest(true);
    layout.views.forEach((view, index) => {
      const rect = viewRect(index, layout.views.length, layout.split, css.x, css.y);
      const camera = view.camera;
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
      renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
      views.renderDirect(world, camera);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, css.x, css.y);
  });
}
