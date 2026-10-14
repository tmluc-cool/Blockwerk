import {
  Color,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import type { Texture } from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** How the reflections are made: not at all (sky color only), at half or at full resolution. */
export type WaterReflection = 'off' | 'half' | 'full';

/** Settings of a water surface. */
export interface WaterSettings {
  /** Width (x) and depth (z) in meters. */
  readonly size: readonly [number, number];
  readonly shallowColor: string;
  readonly deepColor: string;
  /** Wave height in meters. */
  readonly waveHeight: number;
  /** Speed of the waves (1 = normal). */
  readonly waveSpeed: number;
  /** How see-through the water is where it is seen straight from above (0..1). */
  readonly clarity: number;
  readonly reflection: WaterReflection;
}

/** Where the water gets light and sky colors from (the world's environment). */
export interface WaterLight {
  /** Unit vector pointing from the water to the sun. */
  sunDirection(): Vector3;
  sunColor(): Color;
  /** Color of the sky or fog near the horizon, reflected where no scene is mirrored. */
  skyColor(): Color;
}

const VERTEX = /* glsl */ `
uniform float time;
uniform float uWaveHeight;
uniform mat4 textureMatrix;
varying vec4 vReflectUv;
varying vec3 vWorldPosition;
varying vec2 vPlane;
#include <fog_pars_vertex>
float waveAt(vec2 p, float t) {
  return sin(p.x * 0.55 + t * 1.3) * 0.5
       + sin(p.y * 0.8 - t * 1.1 + p.x * 0.2) * 0.35
       + sin((p.x + p.y) * 1.7 + t * 2.1) * 0.15;
}
void main() {
  vec3 displaced = position;
  displaced.z += waveAt(position.xy, time) * uWaveHeight;
  vPlane = position.xy;
  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = world.xyz;
  vReflectUv = textureMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform sampler2D tNormal;
uniform float time;
uniform float uReflect;
uniform float uClarity;
uniform float uWaveHeight;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
varying vec4 vReflectUv;
varying vec3 vWorldPosition;
varying vec2 vPlane;
#include <fog_pars_fragment>
void main() {
  // Ripples: two scrolling normal maps give the surface its small waves.
  vec2 uvA = vPlane * 0.08 + vec2(time * 0.03, time * 0.02);
  vec2 uvB = vPlane * 0.17 - vec2(time * 0.025, -time * 0.035);
  vec3 nA = texture2D(tNormal, uvA).xyz * 2.0 - 1.0;
  vec3 nB = texture2D(tNormal, uvB).xyz * 2.0 - 1.0;
  vec2 tilt = (nA.xy + nB.xy) * (0.35 + uWaveHeight * 0.8);
  vec3 normal = normalize(vec3(-tilt.x, 1.0, tilt.y));
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float facing = clamp(dot(normal, view), 0.0, 1.0);
  float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 4.0);
  vec3 reflection = uSky;
  if (uReflect > 0.5) {
    vec4 uv = vReflectUv;
    uv.xy += tilt * 0.06 * uv.w;
    reflection = texture2DProj(tDiffuse, uv).rgb;
  }
  float depthMix = clamp(1.0 - view.y * 1.4, 0.0, 1.0);
  vec3 body = mix(uShallow, uDeep, depthMix);
  vec3 lit = mix(body, reflection, clamp(fresnel * 1.2, 0.0, 1.0));
  vec3 halfway = normalize(uSunDirection + view);
  float glint = pow(max(dot(normal, halfway), 0.0), 420.0) * 1.2;
  lit += uSunColor * glint * step(0.0, uSunDirection.y);
  float alpha = mix(1.0 - uClarity * 0.6, 1.0, fresnel);
  gl_FragColor = vec4(lit, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** Sets a uniform of a water material (the shader declares all of them). */
function setUniform(material: ShaderMaterial, name: string, value: unknown): void {
  const uniform = material.uniforms[name];
  if (uniform) uniform.value = value;
}

/** A tileable bumpy normal map made from a few sine waves, so no image file is needed. */
function rippleTexture(): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const height = (x: number, y: number): number => {
    const u = (x / size) * Math.PI * 2;
    const v = (y / size) * Math.PI * 2;
    return (
      Math.sin(u * 2 + Math.sin(v) * 1.3) * 0.5 +
      Math.sin(v * 3 + Math.sin(u * 2) * 1.1) * 0.35 +
      Math.sin((u + v) * 4) * 0.15
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height((x + 1) % size, y) - height((x + size - 1) % size, y);
      const dy = height(x, (y + 1) % size) - height(x, (y + size - 1) % size);
      const length = Math.hypot(dx, dy, 0.6);
      const i = (y * size + x) * 4;
      data[i] = Math.round((dx / length) * 127.5 + 127.5);
      data[i + 1] = Math.round((dy / length) * 127.5 + 127.5);
      data[i + 2] = Math.round((0.6 / length) * 127.5 + 127.5);
      data[i + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

let ripples: DataTexture | null = null;

/** The shared ripple normal map. */
function sharedRipples(): Texture {
  ripples ??= rippleTexture();
  return ripples;
}

const REFLECTOR_SHADER = {
  name: 'BlockwerkWater',
  uniforms: UniformsUtils.merge([
    UniformsLib.fog,
    {
      color: { value: null },
      tDiffuse: { value: null },
      tNormal: { value: null },
      textureMatrix: { value: null },
      time: { value: 0 },
      uReflect: { value: 0 },
      uClarity: { value: 0.5 },
      uWaveHeight: { value: 0.1 },
      uShallow: { value: new Color() },
      uDeep: { value: new Color() },
      uSky: { value: new Color() },
      uSunDirection: { value: new Vector3(0, 1, 0) },
      uSunColor: { value: new Color() },
    },
  ]),
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
};

/**
 * The look of a body of water: moving waves, a fresnel mix of the water body and the
 * reflection, sun glints, and an optional planar reflection of the scene.
 */
export class WaterSurface {
  /** Holds the plane; put it where the water level is. */
  readonly root = new Group();
  private surface: Mesh | null = null;
  private material: ShaderMaterial | null = null;
  private current: WaterSettings | null = null;

  constructor(private readonly light: WaterLight) {
    this.root.name = 'Water';
  }

  /** Applies settings; the plane is built again when the size or the reflection changed. */
  configure(settings: WaterSettings): void {
    const previous = this.current;
    this.current = settings;
    const rebuild =
      !this.surface ||
      previous?.size[0] !== settings.size[0] ||
      previous?.size[1] !== settings.size[1] ||
      previous?.reflection !== settings.reflection;
    if (rebuild) this.build(settings);
    this.updateUniforms(settings);
  }

  /** Whether the water mirrors the scene (otherwise it only reflects the sky color). */
  get reflects(): boolean {
    return this.current?.reflection !== undefined && this.current.reflection !== 'off';
  }

  /** Frees the plane, material and reflection target. */
  dispose(): void {
    this.teardown();
    this.root.removeFromParent();
  }

  private teardown(): void {
    if (!this.surface) return;
    this.surface.removeFromParent();
    this.surface.geometry.dispose();
    this.material?.dispose();
    if (this.surface instanceof Reflector) this.surface.getRenderTarget().dispose();
    this.surface = null;
    this.material = null;
  }

  private build(settings: WaterSettings): void {
    this.teardown();
    const segments = (extent: number): number =>
      Math.min(160, Math.max(8, Math.round(extent / 1.5)));
    const geometry = new PlaneGeometry(
      settings.size[0],
      settings.size[1],
      segments(settings.size[0]),
      segments(settings.size[1]),
    );
    let surface: Mesh;
    let material: ShaderMaterial;
    if (settings.reflection === 'off') {
      material = new ShaderMaterial({
        name: REFLECTOR_SHADER.name,
        uniforms: UniformsUtils.clone(REFLECTOR_SHADER.uniforms),
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: DoubleSide,
        transparent: true,
        fog: true,
      });
      surface = new Mesh(geometry, material);
      // The shader reads these even without a reflection.
      setUniform(material, 'textureMatrix', surface.matrixWorld);
      setUniform(material, 'color', new Color(0x7f7f7f));
    } else {
      const resolution = settings.reflection === 'full' ? 1024 : 512;
      const reflector = new Reflector(geometry, {
        textureWidth: resolution,
        textureHeight: resolution,
        clipBias: 0.003,
        multisample: 0,
        shader: REFLECTOR_SHADER,
      });
      material = reflector.material as ShaderMaterial;
      material.transparent = true;
      material.side = DoubleSide;
      material.fog = true;
      surface = reflector;
    }
    setUniform(material, 'tNormal', sharedRipples());
    setUniform(material, 'uReflect', settings.reflection === 'off' ? 0 : 1);
    // The plane lies in XY; turn it flat and let the waves lift it along its own Z.
    surface.rotation.x = -Math.PI / 2;
    surface.name = 'WaterPlane';
    surface.castShadow = false;
    surface.receiveShadow = false;
    surface.frustumCulled = false;
    surface.raycast = () => undefined;
    const reflectorBefore = surface.onBeforeRender.bind(surface);
    surface.onBeforeRender = (...args) => {
      this.updateLight();
      reflectorBefore(...args);
    };
    this.root.add(surface);
    this.surface = surface;
    this.material = material;
  }

  private updateUniforms(settings: WaterSettings): void {
    const material = this.material;
    if (!material) return;
    setUniform(material, 'uShallow', new Color(settings.shallowColor));
    setUniform(material, 'uDeep', new Color(settings.deepColor));
    setUniform(material, 'uWaveHeight', settings.waveHeight);
    setUniform(material, 'uClarity', settings.clarity);
    this.updateLight();
  }

  private updateLight(): void {
    const material = this.material;
    if (!material) return;
    setUniform(material, 'uSunDirection', this.light.sunDirection());
    setUniform(material, 'uSunColor', this.light.sunColor());
    setUniform(material, 'uSky', this.light.skyColor());
    setUniform(material, 'time', (performance.now() / 1000) * (this.current?.waveSpeed ?? 1));
  }
}
