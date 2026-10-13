import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Vector3,
} from 'three';
import type { Camera, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createGroundTexture } from './groundTexture';

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

/** Color of the distance fog, matched to the sky near the horizon. */
const FOG_COLOR = new Color(0.66, 0.74, 0.83);

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

    this.setSun(this.options.sunElevation, this.options.sunAzimuth);
  }

  /** Adds the environment to a scene and configures the scene's fog. */
  addTo(scene: Scene): void {
    this.scene = scene;
    scene.add(this.root);
    const fog = this.options.fog;
    scene.fog = fog ? new Fog(FOG_COLOR, fog.near, fog.far) : null;
    const first = this.baked.values().next();
    if (!first.done) scene.environment = first.value.target.texture;
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
      if (shared && shared.sunDirection.angleTo(this.sunDirection) <= SUN_REBAKE_ANGLE) {
        this.baked.set(renderer, { ...shared, borrowed: true });
      }
    }
    const baked = this.baked.get(renderer);
    if (!baked || baked.sunDirection.angleTo(this.sunDirection) > SUN_REBAKE_ANGLE) {
      this.bakeLighting(renderer);
    } else if (this.scene) {
      this.scene.environment = baked.target.texture;
      this.scene.environmentIntensity = this.ambientIntensity;
    }
    this.update(camera);
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

  /**
   * Centers the sun's shadow area on a point of interest (usually the camera focus).
   * The center is snapped to whole shadow texels so shadows do not shimmer while moving.
   */
  setFocus(point: Vector3): void {
    this.focus.copy(point);
    this.updateSunPosition();
  }

  /** Turns distance fog on or off and sets its range in meters. */
  setFog(enabled: boolean, near: number, far: number): void {
    if (!this.scene) return;
    if (!enabled) {
      this.scene.fog = null;
      return;
    }
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.near = near;
      this.scene.fog.far = far;
    } else {
      this.scene.fog = new Fog(FOG_COLOR, near, far);
    }
  }

  /** Sets the strength of the ambient light baked from the sky. */
  setAmbientIntensity(intensity: number): void {
    this.ambientIntensity = intensity;
    if (this.scene) this.scene.environmentIntensity = intensity;
  }

  /** Keeps the sky centered on the camera. Call before rendering. */
  update(camera: Camera): void {
    this.sky.position.copy(camera.position);
  }

  /** Releases GPU resources owned by the environment. */
  dispose(): void {
    for (const baked of this.baked.values()) if (!baked.borrowed) baked.target.dispose();
    this.baked.clear();
    this.lightingSource = null;
    this.sky.geometry.dispose();
    this.sky.material.dispose();
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
