import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  MathUtils,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Camera } from 'three';

/** Kinds of weather. */
export const WEATHER_TYPES = ['clear', 'rain', 'snow', 'fog'] as const;
export type WeatherType = (typeof WEATHER_TYPES)[number];

/** Whether a text names a kind of weather. */
export function isWeatherType(value: string): value is WeatherType {
  return (WEATHER_TYPES as readonly string[]).includes(value);
}

/** A weather state: kind, strength (0..1) and wind. */
export interface WeatherState {
  readonly type: WeatherType;
  readonly intensity: number;
  /** Wind speed in m/s. */
  readonly windSpeed: number;
  /** Compass direction the wind blows towards, in degrees (0 = +Z, 90 = +X). */
  readonly windDirection: number;
}

/** No weather. */
export const CLEAR_WEATHER: WeatherState = {
  type: 'clear',
  intensity: 0,
  windSpeed: 0,
  windDirection: 0,
};

/** How the weather changes the look of the scene (each between 0 and 1, 1 = unchanged). */
export interface WeatherLook {
  /** Share of the sun's light that reaches the ground. */
  readonly sun: number;
  /** Share of the normal view distance (fog range). */
  readonly visibility: number;
  /** Cloud cover of the sky (0..1). */
  readonly clouds: number;
  /** How grey the fog and sky light are (0..1). */
  readonly gloom: number;
}

/** The look of a weather state; the intensity fades it in. */
export function weatherLook(state: WeatherState): WeatherLook {
  const i = MathUtils.clamp(state.intensity, 0, 1);
  switch (state.type) {
    case 'rain':
      return { sun: 1 - 0.6 * i, visibility: 1 - 0.55 * i, clouds: 0.3 + 0.65 * i, gloom: i };
    case 'snow':
      return { sun: 1 - 0.45 * i, visibility: 1 - 0.5 * i, clouds: 0.3 + 0.6 * i, gloom: 0.7 * i };
    case 'fog':
      return { sun: 1 - 0.3 * i, visibility: 1 - 0.85 * i, clouds: 0.3 + 0.3 * i, gloom: 0.8 * i };
    default:
      return { sun: 1, visibility: 1, clouds: 0.3, gloom: 0 };
  }
}

/** Size of the box of falling drops around the camera in meters. */
const BOX = new Vector3(40, 24, 40);
/** Most streaks or flakes that exist (the graphics level draws a share of them). */
const MAX_PARTICLES = 6000;

const RAIN_VERTEX = /* glsl */ `
attribute vec3 seed;
attribute float tail;
uniform float time;
uniform vec3 camera;
uniform vec3 box;
uniform vec3 velocity;
uniform float streak;
varying float vFade;
void main() {
  vec3 start = seed * box + velocity * time;
  vec3 relative = mod(start - camera, box) - box * 0.5;
  vec3 world = camera + relative - normalize(velocity) * streak * tail;
  vFade = (1.0 - tail * 0.8) * (1.0 - smoothstep(0.55, 1.0, length(relative.xz) / (box.x * 0.5)));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const RAIN_FRAGMENT = /* glsl */ `
uniform float opacity;
varying float vFade;
void main() { gl_FragColor = vec4(0.72, 0.8, 0.9, opacity * vFade); }`;

const SNOW_VERTEX = /* glsl */ `
attribute vec3 seed;
uniform float time;
uniform vec3 camera;
uniform vec3 box;
uniform vec3 velocity;
uniform float size;
varying float vFade;
void main() {
  vec3 start = seed * box + velocity * time;
  start.x += sin(time * 0.7 + seed.y * 40.0) * 0.8;
  start.z += cos(time * 0.6 + seed.x * 40.0) * 0.8;
  vec3 relative = mod(start - camera, box) - box * 0.5;
  vec4 view = viewMatrix * vec4(camera + relative, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = clamp(size * (1.0 + seed.z) * 40.0 / max(0.5, -view.z), 1.0, 14.0);
  vFade = 1.0 - smoothstep(0.55, 1.0, length(relative.xz) / (box.x * 0.5));
}`;

const SNOW_FRAGMENT = /* glsl */ `
uniform float opacity;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, opacity * vFade * (1.0 - d * 1.6));
}`;

function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Rain and snow: streaks and flakes that fall through a box around the camera and wrap around
 * it, computed on the graphics card from a clock. The state changes smoothly over a few seconds.
 */
export class Weather {
  readonly root = new Group();
  private readonly rain: LineSegments;
  private readonly snow: Points;
  private readonly rainMaterial: ShaderMaterial;
  private readonly snowMaterial: ShaderMaterial;
  private target: WeatherState = CLEAR_WEATHER;
  private type: WeatherType = 'clear';
  private level = 0;
  private time = 0;
  private fadeSeconds = 3;
  private density = 1;
  private readonly wind = new Vector3();

  constructor() {
    this.root.name = 'Weather';
    const next = random(7);
    const seeds = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = next();
    const rainSeeds = new Float32Array(MAX_PARTICLES * 6);
    const tails = new Float32Array(MAX_PARTICLES * 2);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      for (let end = 0; end < 2; end++) {
        rainSeeds.set(seeds.subarray(i * 3, i * 3 + 3), i * 6 + end * 3);
        tails[i * 2 + end] = end;
      }
    }
    const uniforms = () => ({
      time: { value: 0 },
      camera: { value: new Vector3() },
      box: { value: BOX.clone() },
      velocity: { value: new Vector3(0, -1, 0) },
      opacity: { value: 0 },
    });
    this.rainMaterial = new ShaderMaterial({
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      uniforms: { ...uniforms(), streak: { value: 0.9 } },
      transparent: true,
      depthWrite: false,
    });
    const rainGeometry = new BufferGeometry();
    rainGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(MAX_PARTICLES * 6), 3),
    );
    rainGeometry.setAttribute('seed', new BufferAttribute(rainSeeds, 3));
    rainGeometry.setAttribute('tail', new BufferAttribute(tails, 1));
    this.rain = new LineSegments(rainGeometry, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.name = 'Rain';

    this.snowMaterial = new ShaderMaterial({
      vertexShader: SNOW_VERTEX,
      fragmentShader: SNOW_FRAGMENT,
      uniforms: { ...uniforms(), size: { value: 0.05 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const snowGeometry = new BufferGeometry();
    snowGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3),
    );
    snowGeometry.setAttribute('seed', new BufferAttribute(seeds, 3));
    this.snow = new Points(snowGeometry, this.snowMaterial);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.snow.name = 'Snow';
    this.root.add(this.rain, this.snow);
  }

  /** The state the weather is moving towards. */
  get state(): WeatherState {
    return this.target;
  }

  /** The current strength of the shown weather (0 when clear, fades while changing). */
  get shownIntensity(): number {
    return this.level;
  }

  /** Changes the weather; it fades over a few seconds (`instant` skips that). */
  set(state: WeatherState, instant = false, seconds = 3): void {
    this.fadeSeconds = Math.max(0.05, seconds);
    this.target = {
      ...state,
      intensity: MathUtils.clamp(state.intensity, 0, 1),
      windSpeed: Math.max(0, state.windSpeed),
    };
    if (instant) {
      this.type = this.target.type;
      this.level = this.target.type === 'clear' ? 0 : this.target.intensity;
    }
  }

  /** Share of the particles that fall (graphics level). */
  setDensity(density: number): void {
    this.density = Math.max(0, density);
  }

  /** How strong the weather is now, as a state (for the look of the scene). */
  current(): WeatherState {
    return { ...this.target, type: this.type, intensity: this.level };
  }

  private uniform(material: ShaderMaterial, name: string): { value: unknown } {
    const found = material.uniforms[name];
    if (!found) throw new Error(`Missing uniform ${name}`);
    return found;
  }

  /** Moves the weather on by a time step and centers the drops on the camera. */
  update(dt: number, camera: Camera | null): void {
    this.time += dt;
    const goal = this.target.type === 'clear' ? 0 : this.target.intensity;
    // A different kind fades the old one out first, then the new one in.
    if (this.target.type !== this.type && this.target.type !== 'clear') {
      this.level = Math.max(0, this.level - dt / (this.fadeSeconds * 0.5));
      if (this.level === 0) this.type = this.target.type;
    } else {
      if (this.target.type !== 'clear') this.type = this.target.type;
      this.level +=
        Math.sign(goal - this.level) * Math.min(Math.abs(goal - this.level), dt / this.fadeSeconds);
    }
    const heading = MathUtils.degToRad(this.target.windDirection);
    this.wind.set(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(this.target.windSpeed);
    const shown = this.level;
    const rain = this.type === 'rain' && shown > 0.001;
    const snow = this.type === 'snow' && shown > 0.001;
    this.rain.visible = rain;
    this.snow.visible = snow;
    const camPosition = camera ? camera.getWorldPosition(new Vector3()) : new Vector3();
    if (rain) {
      const count = Math.floor(MAX_PARTICLES * Math.min(1, shown) * Math.min(1, this.density));
      this.rain.geometry.setDrawRange(0, count * 2);
      this.uniform(this.rainMaterial, 'time').value = this.time;
      (this.uniform(this.rainMaterial, 'camera').value as Vector3).copy(camPosition);
      (this.uniform(this.rainMaterial, 'velocity').value as Vector3).set(
        this.wind.x * 0.6,
        -(14 + 8 * shown),
        this.wind.z * 0.6,
      );
      this.uniform(this.rainMaterial, 'opacity').value = 0.35 + 0.3 * shown;
    }
    if (snow) {
      const count = Math.floor(MAX_PARTICLES * Math.min(1, shown) * Math.min(1, this.density));
      this.snow.geometry.setDrawRange(0, count);
      this.uniform(this.snowMaterial, 'time').value = this.time;
      (this.uniform(this.snowMaterial, 'camera').value as Vector3).copy(camPosition);
      (this.uniform(this.snowMaterial, 'velocity').value as Vector3).set(
        this.wind.x * 0.5,
        -1.4,
        this.wind.z * 0.5,
      );
      this.uniform(this.snowMaterial, 'opacity').value = 0.85;
    }
  }

  /** Number of streaks or flakes drawn now (for statistics and tests). */
  drawnParticles(): number {
    if (this.rain.visible) return this.rain.geometry.drawRange.count / 2;
    if (this.snow.visible) return this.snow.geometry.drawRange.count;
    return 0;
  }

  dispose(): void {
    this.rain.geometry.dispose();
    this.snow.geometry.dispose();
    this.rainMaterial.dispose();
    this.snowMaterial.dispose();
    this.root.removeFromParent();
  }
}
