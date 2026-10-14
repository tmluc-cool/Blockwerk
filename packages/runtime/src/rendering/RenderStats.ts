import type { WebGLRenderer } from 'three';

/** Per-frame rendering statistics, as shown in the statistics overlay and the profiler. */
export interface RenderStats {
  /** Number of draw calls issued for the last frame. */
  drawCalls: number;
  /** Number of triangles rendered in the last frame. */
  triangles: number;
  /** CPU time spent submitting the last frame, in milliseconds. */
  frameTimeMs: number;
}

/**
 * Measures draw calls, triangles and CPU frame time around a render callback.
 * The renderer must have `info.autoReset` disabled (see `createRenderer`).
 */
export function measureFrame(renderer: WebGLRenderer, render: () => void): RenderStats {
  renderer.info.reset();
  const start = performance.now();
  render();
  const frameTimeMs = performance.now() - start;
  return {
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    frameTimeMs,
  };
}
