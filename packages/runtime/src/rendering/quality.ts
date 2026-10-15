import type { WebGLRenderer } from 'three';

/** Names of the graphics levels (SPEC 8.3). */
export const QUALITY_NAMES = ['low', 'medium', 'high', 'ultra'] as const;
export type QualityName = (typeof QUALITY_NAMES)[number];

/** What a graphics level switches on and how much it spends (counts, sizes, distances). */
export interface QualitySettings {
  /** Highest pixel ratio of the canvas (device pixels per CSS pixel). */
  readonly pixelRatio: number;
  /** Shadow map edge length in texels. */
  readonly shadowMapSize: number;
  /** Blur radius of the shadow edges in texels (1 = hard, 3 = soft). */
  readonly shadowRadius: number;
  /** Anti-aliasing in the post-processing chain (SMAA). */
  readonly antialias: boolean;
  readonly postProcessing: boolean;
  readonly bloom: boolean;
  /** Ambient occlusion: off, at half resolution, or at full resolution. */
  readonly ambientOcclusion: 'off' | 'half' | 'full';
  readonly depthOfField: boolean;
  /** Share of the grass and plant instances that are drawn (1 = all). */
  readonly grassDensity: number;
  /** Share of the particles that are emitted (1 = all). */
  readonly particleDensity: number;
  /** Distance in meters up to which grass and plants are drawn. */
  readonly detailDistance: number;
  /** Water reflections: off (sky color), half or full resolution. */
  readonly waterReflection: 'off' | 'half' | 'full';
}

/** The four graphics levels. */
export const QUALITY_LEVELS: Readonly<Record<QualityName, QualitySettings>> = {
  low: {
    pixelRatio: 1,
    shadowMapSize: 1024,
    shadowRadius: 1,
    antialias: false,
    postProcessing: false,
    bloom: false,
    ambientOcclusion: 'off',
    depthOfField: false,
    grassDensity: 0.25,
    particleDensity: 0.4,
    detailDistance: 35,
    waterReflection: 'off',
  },
  medium: {
    pixelRatio: 1.25,
    shadowMapSize: 2048,
    shadowRadius: 1,
    antialias: true,
    postProcessing: true,
    bloom: true,
    ambientOcclusion: 'off',
    depthOfField: false,
    grassDensity: 0.55,
    particleDensity: 0.7,
    detailDistance: 55,
    waterReflection: 'half',
  },
  high: {
    pixelRatio: 2,
    shadowMapSize: 2048,
    shadowRadius: 3,
    antialias: true,
    postProcessing: true,
    bloom: true,
    ambientOcclusion: 'half',
    depthOfField: false,
    grassDensity: 1,
    particleDensity: 1,
    detailDistance: 80,
    waterReflection: 'half',
  },
  ultra: {
    pixelRatio: 2,
    shadowMapSize: 4096,
    shadowRadius: 3,
    antialias: true,
    postProcessing: true,
    bloom: true,
    ambientOcclusion: 'full',
    depthOfField: true,
    grassDensity: 1.5,
    particleDensity: 1.5,
    detailDistance: 120,
    waterReflection: 'full',
  },
};

/** Whether a text is the name of a graphics level. */
export function isQualityName(name: string): name is QualityName {
  return (QUALITY_NAMES as readonly string[]).includes(name);
}

type Listener = (name: QualityName, settings: QualitySettings) => void;

const listeners = new Set<Listener>();
let current: QualityName = 'high';
let chosen = false;

/** The graphics level in use (shared by every view of the page). */
export function currentQuality(): QualityName {
  return current;
}

/** The settings of the graphics level in use. */
export function qualitySettings(): QualitySettings {
  return QUALITY_LEVELS[current];
}

/** Switches the graphics level (also while a game runs); views pick it up on the next frame. */
export function setQuality(name: QualityName): void {
  chosen = true;
  if (name === current) return;
  current = name;
  for (const listener of [...listeners]) listener(name, QUALITY_LEVELS[name]);
}

/** Calls `listener` whenever the graphics level changes. Returns the function that stops it. */
export function onQualityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Whether the renderer draws on the CPU (SwiftShader, llvmpipe …): such machines get the
 * "low" level unless a level was chosen on purpose.
 */
export function isSoftwareRenderer(renderer: WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|softpipe|software|warp|basic render/i.test(name);
  } catch {
    return false;
  }
}

/** Largest pixel ratio the level allows for a device. */
export function pixelRatioFor(devicePixelRatio: number, settings: QualitySettings): number {
  return Math.max(0.5, Math.min(devicePixelRatio, settings.pixelRatio));
}

/**
 * Picks "low" on machines that draw with the CPU (see {@link isSoftwareRenderer}), as long as
 * nobody chose a level. Call once when a view is created.
 */
export function autoQuality(renderer: WebGLRenderer): void {
  if (chosen || current === 'low' || !isSoftwareRenderer(renderer)) return;
  current = 'low';
  for (const listener of [...listeners]) listener('low', QUALITY_LEVELS.low);
}
