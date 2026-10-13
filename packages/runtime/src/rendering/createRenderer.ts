import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';

/** Options for {@link createRenderer}. */
export interface RendererOptions {
  /** Canvas to render into. */
  canvas: HTMLCanvasElement;
  /** Enable multisample anti-aliasing. Defaults to `true`. */
  antialias?: boolean;
  /** Keep the drawing buffer after presenting (needed for pixel read-back). Defaults to `false`. */
  preserveDrawingBuffer?: boolean;
}

/**
 * Creates a WebGL2 renderer with the engine defaults: sRGB output, filmic tone mapping
 * and soft (filtered) shadow maps.
 */
export function createRenderer(options: RendererOptions): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas: options.canvas,
    antialias: options.antialias ?? true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;
  return renderer;
}
