// The package ships no types; this declares the part Blockwerk uses.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./n8ao.d.ts" />
import {
  BlendFunction,
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { HalfFloatType, NoToneMapping, Uniform } from 'three';
import type { Camera, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { QualitySettings } from './quality';

/** Tone mapping curves of the post-processing component. */
export const TONE_MAPPINGS = ['aces', 'agx', 'neutral', 'none'] as const;
export type ToneMappingName = (typeof TONE_MAPPINGS)[number];

/** Settings of the post-processing component (Unity: Volume profile). */
export interface PostSettings {
  readonly toneMapping: ToneMappingName;
  readonly exposure: number;
  readonly bloom: boolean;
  readonly bloomIntensity: number;
  readonly bloomThreshold: number;
  readonly ambientOcclusion: boolean;
  /** Radius of the occlusion in meters. */
  readonly aoRadius: number;
  readonly aoIntensity: number;
  readonly antialiasing: boolean;
  readonly saturation: number;
  readonly contrast: number;
  readonly brightness: number;
  readonly vignette: boolean;
  readonly vignetteDarkness: number;
  readonly depthOfField: boolean;
  /** Distance in meters that is sharp. */
  readonly focusDistance: number;
  readonly bokehScale: number;
}

/** What a camera without a post-processing component gets: light bloom and occlusion. */
export const DEFAULT_POST_SETTINGS: PostSettings = {
  toneMapping: 'aces',
  exposure: 0.6,
  bloom: true,
  bloomIntensity: 0.2,
  bloomThreshold: 1,
  ambientOcclusion: true,
  aoRadius: 2,
  aoIntensity: 2.5,
  antialiasing: true,
  saturation: 1.05,
  contrast: 0.04,
  brightness: 0,
  vignette: true,
  vignetteDarkness: 0.35,
  depthOfField: false,
  focusDistance: 8,
  bokehScale: 2,
};

/** The effects that really run: what the settings ask for, limited by the graphics level. */
export interface EffectivePost {
  readonly active: boolean;
  readonly bloom: boolean;
  readonly ambientOcclusion: 'off' | 'half' | 'full';
  readonly antialiasing: boolean;
  readonly depthOfField: boolean;
  readonly vignette: boolean;
  readonly colorGrading: boolean;
}

/** Combines a camera's settings with the graphics level (the level is the upper limit). */
export function effectivePost(
  settings: PostSettings | null,
  quality: QualitySettings,
): EffectivePost {
  const wanted = settings ?? null;
  if (!quality.postProcessing || wanted === null) {
    return {
      active: false,
      bloom: false,
      ambientOcclusion: 'off',
      antialiasing: false,
      depthOfField: false,
      vignette: false,
      colorGrading: false,
    };
  }
  return {
    active: true,
    bloom: wanted.bloom && quality.bloom,
    ambientOcclusion: wanted.ambientOcclusion ? quality.ambientOcclusion : 'off',
    antialiasing: wanted.antialiasing && quality.antialias,
    depthOfField: wanted.depthOfField && quality.depthOfField,
    vignette: wanted.vignette,
    colorGrading: true,
  };
}

/** Multiplies the light before tone mapping (the exposure of a camera). */
class ExposureEffect extends Effect {
  constructor(exposure: number) {
    super(
      'ExposureEffect',
      'uniform float exposure; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * exposure, inputColor.a); }',
      {
        blendFunction: BlendFunction.SRC,
        uniforms: new Map([['exposure', new Uniform(exposure)]]),
      },
    );
  }

  set exposure(value: number) {
    const uniform = this.uniforms.get('exposure');
    if (uniform) uniform.value = value;
  }
}

const MODES: Readonly<Record<ToneMappingName, number>> = {
  aces: ToneMappingMode.ACES_FILMIC,
  agx: ToneMappingMode.AGX,
  neutral: ToneMappingMode.NEUTRAL,
  none: ToneMappingMode.LINEAR,
};

/**
 * The post-processing chain of one renderer: scene → ambient occlusion → exposure, bloom and
 * color grading → tone mapping and vignette → anti-aliasing. The chain is rebuilt when the
 * effects, the camera or the scene change; slider values only update uniforms.
 */
export class PostProcessing {
  private composer: EffectComposer | null = null;
  private signature = '';
  private exposure: ExposureEffect | null = null;
  private bloom: BloomEffect | null = null;
  private ao: N8AOPostPass | null = null;
  private saturation: HueSaturationEffect | null = null;
  private contrast: BrightnessContrastEffect | null = null;
  private vignette: VignetteEffect | null = null;
  private dof: DepthOfFieldEffect | null = null;
  private width = 1;
  private height = 1;

  constructor(private readonly renderer: WebGLRenderer) {}

  /** Number of passes in the chain (0 before the first frame). */
  get passCount(): number {
    return this.composer?.passes.length ?? 0;
  }

  /** Sets the size in CSS pixels. */
  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.composer?.setSize(this.width, this.height, false);
  }

  /** Draws the scene through the chain. */
  render(
    scene: Scene,
    camera: Camera,
    settings: PostSettings,
    effective: EffectivePost,
    delta: number,
  ): void {
    const signature = [
      scene.uuid,
      camera.uuid,
      effective.bloom,
      effective.ambientOcclusion,
      effective.antialiasing,
      effective.depthOfField,
      effective.vignette,
      settings.toneMapping,
    ].join('|');
    if (!this.composer || signature !== this.signature)
      this.build(scene, camera, settings, effective);
    this.signature = signature;
    this.apply(settings, effective, camera);
    this.composer?.render(delta);
  }

  private build(
    scene: Scene,
    camera: Camera,
    settings: PostSettings,
    effective: EffectivePost,
  ): void {
    this.dispose();
    // The chain does the tone mapping itself; the canvas only converts to sRGB.
    this.renderer.toneMapping = NoToneMapping;
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
      multisampling: 0,
    });
    composer.setSize(this.width, this.height, false);
    composer.addPass(new RenderPass(scene, camera));
    if (effective.ambientOcclusion !== 'off') {
      this.ao = new N8AOPostPass(scene, camera, this.width, this.height);
      this.ao.configuration.gammaCorrection = false;
      composer.addPass(this.ao);
    }
    this.exposure = new ExposureEffect(settings.exposure);
    const first: Effect[] = [this.exposure];
    if (effective.bloom) {
      this.bloom = new BloomEffect({
        blendFunction: BlendFunction.ADD,
        mipmapBlur: true,
        intensity: settings.bloomIntensity,
        luminanceThreshold: settings.bloomThreshold,
        luminanceSmoothing: 0.2,
      });
      first.push(this.bloom);
    }
    this.saturation = new HueSaturationEffect({ saturation: settings.saturation - 1 });
    this.contrast = new BrightnessContrastEffect({
      brightness: settings.brightness,
      contrast: settings.contrast,
    });
    first.push(this.saturation, this.contrast);
    composer.addPass(new EffectPass(camera, ...first));
    if (effective.depthOfField) {
      this.dof = new DepthOfFieldEffect(camera as PerspectiveCamera, {
        worldFocusDistance: settings.focusDistance,
        worldFocusRange: Math.max(2, settings.focusDistance * 0.5),
        bokehScale: settings.bokehScale,
      });
      composer.addPass(new EffectPass(camera, this.dof));
    }
    const last: Effect[] = [new ToneMappingEffect({ mode: MODES[settings.toneMapping] })];
    if (effective.vignette) {
      this.vignette = new VignetteEffect({ darkness: settings.vignetteDarkness, offset: 0.35 });
      last.push(this.vignette);
    }
    composer.addPass(new EffectPass(camera, ...last));
    if (effective.antialiasing) composer.addPass(new EffectPass(camera, new SMAAEffect()));
    this.composer = composer;
  }

  private apply(settings: PostSettings, effective: EffectivePost, camera: Camera): void {
    if (this.exposure) this.exposure.exposure = settings.exposure;
    if (this.bloom) {
      this.bloom.intensity = settings.bloomIntensity;
      this.bloom.luminanceMaterial.threshold = settings.bloomThreshold;
    }
    if (this.ao) {
      this.ao.configuration.aoRadius = settings.aoRadius;
      this.ao.configuration.intensity = settings.aoIntensity;
      this.ao.configuration.halfRes = effective.ambientOcclusion === 'half';
    }
    if (this.saturation) this.saturation.saturation = settings.saturation - 1;
    if (this.contrast) {
      this.contrast.brightness = settings.brightness;
      this.contrast.contrast = settings.contrast;
    }
    if (this.vignette) this.vignette.darkness = settings.vignetteDarkness;
    if (this.dof) {
      this.dof.circleOfConfusionMaterial.worldFocusDistance = settings.focusDistance;
      this.dof.bokehScale = settings.bokehScale;
    }
    void camera;
  }

  /** Frees the chain (when effects change and at the end). */
  dispose(): void {
    this.composer?.dispose();
    this.composer = null;
    this.exposure = null;
    this.bloom = null;
    this.ao = null;
    this.saturation = null;
    this.contrast = null;
    this.vignette = null;
    this.dof = null;
    this.signature = '';
  }
}
