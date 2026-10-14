import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Fog,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from 'three';
import type { Camera, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createGroundTexture } from './groundTexture';
import { qualitySettings } from '../rendering/quality';
import { Weather, weatherLook } from './Weather';
import type { WeatherState } from './Weather';

/** Options for {@link Environment}. All values have defaults that look good out of the box. */
export interface EnvironmentOptions {
  /** Sun height above the horizon in degrees. */
  sunElevation?: number;
  /** Sun compass direction in degrees (0 = +Z, 90 = +X). */
  sunAzimuth?: number;
  /** Edge length of the square ground plane in meters. `0` disables the ground. */
  groundSize?: number;
  /** Shadow map resolution in texels. */
  shadowMapSize?: number;
  /** Half the edge length of the area around the focus point that receives sun shadows, in meters. */
  shadowExtent?: number;
  /** Distance fog in meters, or `false` to disable it. */
  fog?: { near: number; far: number } | false;
}

const DEFAULTS: Required<EnvironmentOptions> = {
  sunElevation: 38,
  sunAzimuth: 145,
  groundSize: 2000,
  shadowMapSize: 2048,
  shadowExtent: 24,
  fog: { near: 60, far: 650 },
};

/** Color of the distance fog by day, matched to the sky near the horizon. */
const FOG_COLOR = new Color(0.66, 0.74, 0.83);
const FOG_DUSK = new Color(0.93, 0.6, 0.42);
const FOG_NIGHT = new Color(0.025, 0.035, 0.075);
const FOG_GLOOM = new Color(0.5, 0.53, 0.57);
const SUN_WARM = new Color(0xff9150);

/** The sun's highest point over the horizon at noon, in degrees. */
const NOON_ELEVATION = 72;

/** Sun movement (radians) after which the ambient light is baked again while a clock runs. */
const CLOCK_REBAKE_ANGLE = 0.06;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** The day cycle of a scene: hour of the day, length of a day in seconds, compass offset. */
export interface SkyClock {
  /** Hour of the day, 0 to 24 (12 = noon). */
  readonly timeOfDay: number;
  /** Seconds a whole day takes; 0 stops the clock. */
  readonly dayLength: number;
  /** Turns the sun's path around the vertical axis, in degrees. */
  readonly sunAzimuth: number;
}

/** Strength of the ambient light baked from the sky, relative to the sun. */
const ENVIRONMENT_INTENSITY = 0.32;

/**
 * Edge length of the baked sky cube map. The sky is smooth, so a small map gives the same
 * ambient light and soft reflections while baking is much faster (play mode starts at once).
 */
const SKY_LIGHT_SIZE = 64;

/** Sun movement (radians) after which the ambient light is baked again. */
const SUN_REBAKE_ANGLE = 0.02;

/** Distance of the sun light from its focus point in meters. */
const SUN_DISTANCE = 60;

/**
 * The default outdoor environment of a scene: physically based sky with sun position,
 * image-based ambient light baked from that sky, a directional sun with soft shadows,
 * a textured ground plane and distance fog.
 */
export class Environment {
  /** Root group holding the sky, sun and ground. Add it to a scene with {@link addTo}. */
  readonly root = new Group();
  readonly sky: Sky;
  readonly sun: DirectionalLight;
  /** The moon: a weak bluish light that replaces the sun at night. */
  readonly moon: DirectionalLight;
  /** Dim sky fill that keeps dusk and night readable. */
  private readonly nightFill: HemisphereLight;
  readonly stars: Points<BufferGeometry, PointsMaterial>;
  readonly weather = new Weather();
  readonly ground: Mesh<PlaneGeometry, MeshStandardMaterial> | null;

  private readonly options: Required<EnvironmentOptions>;
  private readonly sunDirection = new Vector3();
  private readonly focus = new Vector3();
  /** Ambient lighting baked per renderer (GPU resources cannot be shared between canvases). */
  private readonly baked = new Map<
    WebGLRenderer,
    {
      readonly target: WebGLRenderTarget;
      readonly sunDirection: Vector3;
      readonly borrowed?: boolean;
    }
  >();
  /** Environment whose baked lighting may be reused while the sun is the same. */
  private lightingSource: Environment | null = null;
  private ambientIntensity = ENVIRONMENT_INTENSITY;
  private scene: Scene | null = null;
  private clock: { hours: number; dayLength: number; azimuth: number } | null = null;
  private readonly sunBase = { color: new Color(0xfff1de), intensity: 4.6, visible: true };
  private fogBase: { enabled: boolean; near: number; far: number } = {
    enabled: true,
    near: 60,
    far: 650,
  };
  private daylight = 1;
  private sunScale = 1;
  private lastPrepare = 0;

  constructor(options: EnvironmentOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.root.name = 'Environment';

    this.sky = new Sky();
    this.sky.name = 'Sky';
    this.sky.scale.setScalar(4000);
    this.sky.frustumCulled = false;
    const uniforms = this.sky.material.uniforms;
    setUniform(uniforms, 'turbidity', 4);
    setUniform(uniforms, 'rayleigh', 1.2);
    setUniform(uniforms, 'mieCoefficient', 0.004);
    setUniform(uniforms, 'mieDirectionalG', 0.82);
    setUniform(uniforms, 'cloudCoverage', 0.32);
    setUniform(uniforms, 'cloudDensity', 0.35);
    this.root.add(this.sky);

    this.sun = new DirectionalLight(0xfff1de, 4.6);
    this.sun.name = 'Sun';
    this.sun.castShadow = true;
    const shadow = this.sun.shadow;
    shadow.mapSize.set(this.options.shadowMapSize, this.options.shadowMapSize);
    shadow.radius = 3;
    shadow.bias = -0.0004;
    shadow.normalBias = 0.025;
    const extent = this.options.shadowExtent;
    shadow.camera.left = -extent;
    shadow.camera.right = extent;
    shadow.camera.top = extent;
    shadow.camera.bottom = -extent;
    shadow.camera.near = 1;
    shadow.camera.far = SUN_DISTANCE * 2.5;
    this.root.add(this.sun, this.sun.target);

    this.moon = new DirectionalLight(0x8fa8ff, 0);
    this.moon.name = 'Moon';
    this.moon.castShadow = false;
    this.nightFill = new HemisphereLight(0x6f84c4, 0x1d2233, 0);
    this.nightFill.name = 'NightFill';
    this.root.add(this.moon, this.moon.target, this.nightFill);

    const starPositions = new Float32Array(1400 * 3);
    let seed = 11;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let i = 0; i < 1400; i++) {
      // Uniform points on the upper sphere, far away.
      const z = rand() * 0.98 + 0.02;
      const angle = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      starPositions.set([Math.cos(angle) * r * 1800, z * 1800, Math.sin(angle) * r * 1800], i * 3);
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
    this.stars = new Points(
      starGeometry,
      new PointsMaterial({
        color: 0xffffff,
        size: 1.6,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    this.stars.frustumCulled = false;
    this.stars.visible = false;
    this.stars.name = 'Stars';
    this.root.add(this.stars, this.weather.root);

    if (this.options.groundSize > 0) {
      const size = this.options.groundSize;
      const texture = createGroundTexture();
      texture.repeat.set(size, size);
      const material = new MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0 });
      this.ground = new Mesh(new PlaneGeometry(size, size), material);
      this.ground.name = 'Ground';
      this.ground.rotation.x = -Math.PI / 2;
      this.ground.receiveShadow = true;
      this.root.add(this.ground);
    } else {
      this.ground = null;
    }

    this.fogBase = this.options.fog
      ? { enabled: true, ...this.options.fog }
      : { ...this.fogBase, enabled: false };
    this.setSun(this.options.sunElevation, this.options.sunAzimuth);
  }

  /** Adds the environment to a scene and configures the scene's fog. */
  addTo(scene: Scene): void {
    this.scene = scene;
    scene.add(this.root);
    scene.fog = this.fogBase.enabled
      ? new Fog(FOG_COLOR, this.fogBase.near, this.fogBase.far)
      : null;
    const first = this.baked.values().next();
    if (!first.done) scene.environment = first.value.target.texture;
    this.applyLighting();
  }

  /** How much daylight there is (0 at night, 1 by day). */
  get daylightLevel(): number {
    return this.daylight;
  }

  /** Places the sun. Elevation and azimuth are in degrees. */
  setSun(elevationDegrees: number, azimuthDegrees: number): void {
    const phi = MathUtils.degToRad(90 - elevationDegrees);
    const theta = MathUtils.degToRad(azimuthDegrees);
    this.setSunDirection(new Vector3().setFromSphericalCoords(1, phi, theta));
  }

  /** Places the sun along a direction pointing from the ground towards the sun. */
  setSunDirection(towardsSun: Vector3): void {
    if (towardsSun.lengthSq() === 0) return;
    this.sunDirection.copy(towardsSun).normalize();
    const sunPosition = this.sky.material.uniforms['sunPosition'];
    if (sunPosition) {
      (sunPosition.value as Vector3).copy(this.sunDirection);
    }
    this.updateSunPosition();
  }

  /** Direction pointing from the ground towards the sun (unit vector). */
  getSunDirection(target: Vector3 = new Vector3()): Vector3 {
    return target.copy(this.sunDirection);
  }

  /**
   * Bakes image-based ambient light from the current sky and assigns it to the scene.
   * Call once after creation and after changing the sun.
   */
  bakeLighting(renderer: WebGLRenderer): void {
    const uniforms = this.sky.material.uniforms;
    const sunDisc = uniforms['showSunDisc'];
    const previousSunDisc: unknown = sunDisc?.value;
    if (sunDisc) sunDisc.value = 0;

    const bakeScene = new Scene();
    const bakeSky = new Sky();
    bakeSky.material.uniforms = uniforms;
    bakeSky.scale.setScalar(900);
    bakeScene.add(bakeSky);

    const generator = new PMREMGenerator(renderer);
    const target = generator.fromScene(bakeScene, 0, 1, 2000, { size: SKY_LIGHT_SIZE });
    generator.dispose();
    bakeSky.geometry.dispose();
    bakeSky.material.dispose();
    if (sunDisc) sunDisc.value = previousSunDisc;

    const previous = this.baked.get(renderer);
    if (previous && !previous.borrowed) previous.target.dispose();
    this.baked.set(renderer, { target, sunDirection: this.sunDirection.clone() });
    if (this.scene) {
      this.scene.environment = target.texture;
      this.scene.environmentIntensity = this.ambientIntensity;
    }
  }

  /**
   * Prepares rendering with a renderer: uses the ambient light baked for it (baking again when
   * the sun moved) and centers the sky on the camera. Lets several views render one scene.
   */
  prepare(renderer: WebGLRenderer, camera: Camera): void {
    if (!this.baked.has(renderer)) {
      const shared = this.lightingSource?.baked.get(renderer);
      if (shared && shared.sunDirection.angleTo(this.sunDirection) <= this.rebakeAngle()) {
        this.baked.set(renderer, { ...shared, borrowed: true });
      }
    }
    const baked = this.baked.get(renderer);
    if (!baked || baked.sunDirection.angleTo(this.sunDirection) > this.rebakeAngle()) {
      this.bakeLighting(renderer);
    } else if (this.scene) {
      this.scene.environment = baked.target.texture;
      this.scene.environmentIntensity = this.ambientIntensity;
    }
    this.update(camera);
    // The weather moves with the real time between two frames.
    const now = performance.now();
    const dt = this.lastPrepare > 0 ? Math.min(0.1, (now - this.lastPrepare) / 1000) : 0;
    this.lastPrepare = now;
    this.weather.setDensity(qualitySettings().particleDensity);
    this.weather.update(dt, camera);
    this.applyLighting();
  }

  /** Frees the lighting baked for a renderer that is no longer used. */
  releaseRenderer(renderer: WebGLRenderer): void {
    const baked = this.baked.get(renderer);
    if (!baked) return;
    if (this.scene?.environment === baked.target.texture) this.scene.environment = null;
    if (!baked.borrowed) baked.target.dispose();
    this.baked.delete(renderer);
  }

  /**
   * Reuses the lighting another environment baked (e.g. the play-mode copy of a scene uses the
   * editor's), as long as both suns point the same way. Saves baking when play mode starts.
   */
  shareLightingFrom(source: Environment | null): void {
    this.lightingSource = source;
  }

  /** Changes the shadow map size (graphics level); the map is allocated again on the next draw. */
  setShadowMapSize(size: number): void {
    if (this.options.shadowMapSize === size) return;
    this.options.shadowMapSize = size;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  /** Blur radius of the sun's shadow edges in texels (graphics level). */
  setShadowRadius(radius: number): void {
    this.sun.shadow.radius = radius;
  }

  /**
   * Centers the sun's shadow area on a point of interest (usually the camera focus).
   * The center is snapped to whole shadow texels so shadows do not shimmer while moving.
   */
  setFocus(point: Vector3): void {
    this.focus.copy(point);
    this.updateSunPosition();
  }

  /** Turns distance fog on or off and sets its range in meters (before weather and time of day). */
  setFog(enabled: boolean, near: number, far: number): void {
    this.fogBase = { enabled, near, far };
    this.applyLighting();
  }

  /** Sets the strength of the ambient light baked from the sky. */
  setAmbientIntensity(intensity: number): void {
    this.ambientIntensity = intensity;
    this.applyLighting();
  }

  /** Sets the color and strength of the sun at noon (the light component of the sun). */
  setSunLight(color: Color | string | number, intensity: number): void {
    this.sunBase.color = new Color(color);
    this.sunBase.intensity = intensity;
    this.applyLighting();
  }

  /** Scales the sun's strength (1 = as set by its light, 0 = off). */
  setSunBrightness(scale: number): void {
    this.sunScale = Math.max(0, scale);
    this.applyLighting();
  }

  /** Fog thickness from 0 (none) to 1 (very thick): the range gets shorter the thicker it is. */
  setFogDensity(density: number): void {
    const d = MathUtils.clamp(density, 0, 1);
    this.setFog(d > 0, 8, 25 + (1 - d) * (1 - d) * 1975);
  }

  /** Shows or hides the sun (its light component is switched off or removed). */
  setSunVisible(visible: boolean): void {
    this.sunBase.visible = visible;
    this.applyLighting();
  }

  /**
   * Starts the day cycle (time of day, day length, compass offset) and lets it drive the sun,
   * the moon, the stars, the ambient light and the fog. `null` goes back to a sun that is
   * placed by hand (the rotation of the sun object).
   */
  setClock(clock: SkyClock | null): void {
    this.clock = clock
      ? {
          hours: ((clock.timeOfDay % 24) + 24) % 24,
          dayLength: clock.dayLength,
          azimuth: clock.sunAzimuth,
        }
      : null;
    this.applyClock();
  }

  /** Whether the day cycle places the sun. */
  get clockDriven(): boolean {
    return this.clock !== null;
  }

  /** Hour of the day (0..24), or `null` without a day cycle. */
  get timeOfDay(): number | null {
    return this.clock ? this.clock.hours : null;
  }

  /** Sets the hour of the day (starts the day cycle with a frozen clock if there is none). */
  setTimeOfDay(hours: number): void {
    const wrapped = ((hours % 24) + 24) % 24;
    if (this.clock) this.clock.hours = wrapped;
    else this.clock = { hours: wrapped, dayLength: 0, azimuth: 0 };
    this.applyClock();
  }

  /** Moves the clock on by seconds of game time (does nothing when the day length is 0). */
  advance(dt: number): void {
    if (!this.clock || this.clock.dayLength <= 0) return;
    this.clock.hours = (this.clock.hours + (dt * 24) / this.clock.dayLength) % 24;
    this.applyClock();
  }

  /** Changes the weather (it fades in over a few seconds unless `instant`). */
  setWeather(state: WeatherState, instant = false, seconds = 3): void {
    this.weather.set(state, instant, seconds);
    this.applyLighting();
  }

  /** Keeps the sky centered on the camera. Call before rendering. */
  update(camera: Camera): void {
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
  }

  /** Releases GPU resources owned by the environment. */
  dispose(): void {
    for (const baked of this.baked.values()) if (!baked.borrowed) baked.target.dispose();
    this.baked.clear();
    this.lightingSource = null;
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    this.weather.dispose();
    this.sun.shadow.map?.dispose();
    if (this.ground) {
      this.ground.geometry.dispose();
      this.ground.material.map?.dispose();
      this.ground.material.dispose();
    }
    this.root.removeFromParent();
    if (this.scene) {
      this.scene.environment = null;
      this.scene.fog = null;
      this.scene = null;
    }
  }

  private rebakeAngle(): number {
    return this.clock && this.clock.dayLength > 0 ? CLOCK_REBAKE_ANGLE : SUN_REBAKE_ANGLE;
  }

  /** Puts the sun where the clock says and updates everything that depends on it. */
  private applyClock(): void {
    const clock = this.clock;
    if (clock) {
      const elevation = NOON_ELEVATION * Math.sin(((clock.hours - 6) * Math.PI) / 12);
      this.setSun(elevation, 90 + (clock.hours - 6) * 15 + clock.azimuth);
    }
    this.applyLighting();
  }

  /**
   * Sun, moon, stars, ambient light and fog from the time of day and the weather. Cheap enough
   * to run every frame.
   */
  private applyLighting(): void {
    const look = weatherLook(this.weather.current());
    const sinElevation = this.sunDirection.y;
    // Without a clock the sun stays as it is placed.
    const day = this.clock ? smoothstep(-0.2, 0.2, sinElevation) : 1;
    const warm = this.clock ? 1 - smoothstep(0, 0.4, sinElevation) : 0;
    this.daylight = day;
    this.sun.color.copy(this.sunBase.color).lerp(SUN_WARM, warm * 0.65 * day);
    this.sun.intensity = this.sunBase.intensity * this.sunScale * day * look.sun;
    this.sun.visible = this.sunBase.visible && (day > 0.001 || !this.clock);
    // The moon shines from the opposite side of the sky.
    const night = 1 - day;
    this.moon.visible = this.clock !== null && night > 0.01;
    this.moon.intensity = 1.6 * night * (1 - 0.5 * look.gloom);
    // Dim sky light so dusk and night stay readable; the baked sky alone is nearly black.
    this.nightFill.intensity = 1.1 * night * (1 - 0.3 * look.gloom);
    this.nightFill.visible = this.clock !== null && night > 0.01;
    this.moon.position
      .copy(this.sun.target.position)
      .addScaledVector(this.sunDirection, -SUN_DISTANCE);
    this.moon.target.position.copy(this.sun.target.position);
    this.moon.target.updateMatrixWorld();
    this.moon.updateMatrixWorld();
    const starMaterial = this.stars.material;
    starMaterial.opacity = night * (1 - look.gloom);
    this.stars.visible = this.clock !== null && starMaterial.opacity > 0.01;
    // Sky: the clouds follow the weather.
    setUniform(this.sky.material.uniforms, 'cloudCoverage', look.clouds);
    const ambient = this.ambientIntensity * (0.32 + 0.68 * day) * (1 - 0.25 * look.gloom);
    if (this.scene) {
      this.scene.environmentIntensity = ambient;
      const fog = this.fogBase;
      if (!fog.enabled && look.visibility >= 1) {
        this.scene.fog = null;
      } else {
        const near = (fog.enabled ? fog.near : 400) * look.visibility;
        const far = (fog.enabled ? fog.far : 2000) * look.visibility;
        if (!(this.scene.fog instanceof Fog)) this.scene.fog = new Fog(FOG_COLOR, near, far);
        this.scene.fog.near = near;
        this.scene.fog.far = far;
        this.scene.fog.color
          .copy(FOG_NIGHT)
          .lerp(FOG_COLOR, day)
          .lerp(FOG_DUSK, warm * 0.55 * day)
          .lerp(FOG_GLOOM, look.gloom * (0.25 + 0.75 * day));
      }
    }
  }

  private updateSunPosition(): void {
    const texel = (this.options.shadowExtent * 2) / this.options.shadowMapSize;
    const snapped = snapToLightTexels(this.focus, this.sunDirection, texel);
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(this.sunDirection, SUN_DISTANCE);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }
}

/** Sets a shader uniform value if the uniform exists. */
function setUniform(
  uniforms: Record<string, { value: unknown }>,
  name: string,
  value: number,
): void {
  const uniform = uniforms[name];
  if (uniform) uniform.value = value;
}

/**
 * Snaps a world-space point to the shadow texel grid of a directional light,
 * measured in the plane perpendicular to the light direction.
 */
export function snapToLightTexels(
  point: Vector3,
  lightDirection: Vector3,
  texelSize: number,
): Vector3 {
  const forward = lightDirection.clone().normalize();
  const helperUp = Math.abs(forward.y) > 0.99 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const right = new Vector3().crossVectors(helperUp, forward).normalize();
  const up = new Vector3().crossVectors(forward, right).normalize();
  const x = Math.round(point.dot(right) / texelSize) * texelSize;
  const y = Math.round(point.dot(up) / texelSize) * texelSize;
  const z = point.dot(forward);
  return new Vector3().addScaledVector(right, x).addScaledVector(up, y).addScaledVector(forward, z);
}
