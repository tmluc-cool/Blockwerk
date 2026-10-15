declare module 'n8ao' {
  import type { Camera, Color, Scene } from 'three';
  import type { Pass } from 'postprocessing';

  /** Settings of the ambient occlusion pass. */
  export interface N8AOConfiguration {
    aoRadius: number;
    distanceFalloff: number;
    intensity: number;
    color: Color;
    halfRes: boolean;
    aoSamples: number;
    denoiseSamples: number;
    denoiseRadius: number;
    gammaCorrection: boolean;
  }

  /** Ambient occlusion as a pass of the `postprocessing` composer (needs a RenderPass before it). */
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    readonly configuration: N8AOConfiguration;
    setSize(width: number, height: number): void;
  }
}
