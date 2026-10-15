import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { WebGLRenderer, Object3D } from 'three';
import { onQualityChange, qualitySettings } from '../rendering/quality';
import type { ParticleParams } from './presets';

const VERTEX = /* glsl */ `
attribute vec4 tint;
attribute float size;
uniform float viewHeight;
varying vec4 vTint;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vTint = tint;
  float px = size * viewHeight * 0.5 * projectionMatrix[1][1] / max(-mv.z, 0.05);
  gl_PointSize = clamp(px, 0.0, 256.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
varying vec4 vTint;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = smoothstep(1.0, 0.35, d);
  float a = vTint.a * soft;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vTint.rgb, a);
}
`;

/** A small deterministic random number generator (mulberry32). */
function randomStream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextSeed = 1;

const UP = new Vector3(0, 1, 0);
const scratchPosition = new Vector3();
const scratchDirection = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchColorA = new Color();
const scratchColorB = new Color();
const scratchSize = new Vector2();

/**
 * Simulates and draws one particle system: all particles are one `Points` object (one draw
 * call). Runs on fixed steps of the game's logic tick, so effects play the same every time.
 */
export class ParticleEmitter {
  /** The object the particles are drawn with. */
  readonly points: Points;
  private params: ParticleParams;
  private readonly source: Object3D;
  private readonly scene: Object3D;
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly random = randomStream(nextSeed++ * 7919);
  private readonly stopListening: () => void;
  private capacity = 0;
  private position = new Float32Array(0);
  private velocity = new Float32Array(0);
  private age = new Float32Array(0);
  private life = new Float32Array(0);
  private scale = new Float32Array(0);
  private tint = new Float32Array(0);
  private sizes = new Float32Array(0);
  private count = 0;
  private playing = false;
  private elapsed = 0;
  private carry = 0;
  private density = 1;
  private disposed = false;
  private attached: Object3D | null = null;

  /**
   * @param source Object whose position and rotation emit the particles.
   * @param scene Root the particles are drawn under when they live in world space.
   */
  constructor(source: Object3D, scene: Object3D, params: ParticleParams) {
    this.source = source;
    this.scene = scene;
    this.params = params;
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { viewHeight: { value: 720 } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.name = 'Particles';
    this.points.frustumCulled = false;
    this.points.raycast = () => undefined;
    this.points.onBeforeRender = (renderer: WebGLRenderer) => {
      const target = renderer.getRenderTarget();
      this.material.uniforms['viewHeight'] = {
        value: target ? target.height : renderer.getDrawingBufferSize(scratchSize).y,
      };
    };
    this.density = qualitySettings().particleDensity;
    this.stopListening = onQualityChange(() => {
      this.density = qualitySettings().particleDensity;
      this.allocate();
    });
    this.configure(params);
  }

  /** Applies new settings; running particles carry on. */
  configure(params: ParticleParams): void {
    this.params = params;
    this.material.blending = params.additive ? AdditiveBlending : NormalBlending;
    this.material.needsUpdate = true;
    this.allocate();
    this.attach();
  }

  /** Number of living particles. */
  get alive(): number {
    return this.count;
  }

  /** Whether the emitter still creates particles. */
  get isPlaying(): boolean {
    return this.playing;
  }

  /** Whether nothing is left to draw and nothing will be emitted. */
  get finished(): boolean {
    return !this.playing && this.count === 0;
  }

  /** Starts emitting (a burst first, then the rate). */
  play(): void {
    this.playing = true;
    this.elapsed = 0;
    this.carry = 0;
    this.emitBurst();
  }

  /** Stops emitting; living particles fade out. */
  stop(): void {
    this.playing = false;
  }

  /** Removes all living particles. */
  clear(): void {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  /** Emits `amount` particles at once (scaled by the graphics level). */
  burst(amount: number): void {
    const scaled = Math.round(amount * this.density);
    for (let i = 0; i < scaled; i++) this.emit();
  }

  /** Advances the simulation by `dt` seconds. */
  step(dt: number): void {
    if (this.disposed) return;
    this.attach();
    if (this.playing) {
      this.elapsed += dt;
      if (!this.params.loop && this.elapsed >= this.params.duration) {
        this.playing = false;
      } else {
        this.carry += this.params.rate * this.density * dt;
        while (this.carry >= 1) {
          this.carry -= 1;
          this.emit();
        }
      }
    }
    this.simulate(dt);
    this.write();
  }

  /** Frees the geometry and the material and takes the particles out of the scene. */
  dispose(): void {
    this.disposed = true;
    this.stopListening();
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private emitBurst(): void {
    if (this.params.burst > 0) this.burst(this.params.burst);
  }

  /** Puts the points under the right parent for the space setting. */
  private attach(): void {
    const parent = this.params.space === 'local' ? this.source : this.scene;
    if (this.attached === parent && this.points.parent === parent) return;
    this.points.removeFromParent();
    parent.add(this.points);
    this.attached = parent;
    this.clear();
  }

  /** Allocates the particle arrays for the current maximum and graphics level. */
  private allocate(): void {
    const wanted = Math.max(1, Math.ceil(this.params.maxParticles * this.density));
    if (wanted === this.capacity) return;
    const keep = Math.min(this.count, wanted);
    const grow = (old: Float32Array, per: number): Float32Array<ArrayBuffer> => {
      const next = new Float32Array(wanted * per);
      next.set(old.subarray(0, keep * per));
      return next;
    };
    this.position = grow(this.position, 3);
    this.velocity = grow(this.velocity, 3);
    this.age = grow(this.age, 1);
    this.life = grow(this.life, 1);
    this.scale = grow(this.scale, 1);
    this.tint = grow(this.tint, 4);
    this.sizes = grow(this.sizes, 1);
    this.count = keep;
    this.capacity = wanted;
    this.geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    this.geometry.setAttribute('tint', new BufferAttribute(this.tint, 4));
    this.geometry.setAttribute('size', new BufferAttribute(this.sizes, 1));
    this.geometry.setDrawRange(0, this.count);
  }

  /** Creates one particle at the emitter. */
  private emit(): void {
    if (this.count >= this.capacity) return;
    const p = this.params;
    const r = this.random;
    const i = this.count++;
    const local = this.params.space === 'local';
    // Position and direction in the emitter's own space.
    const position = scratchPosition.set(0, 0, 0);
    const direction = scratchDirection.set(0, 1, 0);
    switch (p.shape) {
      case 'sphere': {
        const u = r() * 2 - 1;
        const phi = r() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        direction.set(s * Math.cos(phi), u, s * Math.sin(phi));
        position.copy(direction).multiplyScalar(p.shapeRadius * Math.cbrt(r()));
        break;
      }
      case 'cone': {
        const spread = (p.coneAngle * Math.PI) / 180;
        const tilt = Math.sqrt(r()) * spread;
        const phi = r() * Math.PI * 2;
        direction.set(
          Math.sin(tilt) * Math.cos(phi),
          Math.cos(tilt),
          Math.sin(tilt) * Math.sin(phi),
        );
        const radius = p.shapeRadius * Math.sqrt(r());
        position.set(radius * Math.cos(phi), 0, radius * Math.sin(phi));
        break;
      }
      case 'circle': {
        const phi = r() * Math.PI * 2;
        const radius = p.shapeRadius * Math.sqrt(r());
        position.set(radius * Math.cos(phi), 0, radius * Math.sin(phi));
        const spread = (p.coneAngle * Math.PI) / 180;
        const tilt = r() * spread;
        direction.set(
          Math.sin(tilt) * Math.cos(phi),
          Math.cos(tilt),
          Math.sin(tilt) * Math.sin(phi),
        );
        break;
      }
      case 'box':
        position.set(
          (r() - 0.5) * p.shapeSize[0],
          (r() - 0.5) * p.shapeSize[1],
          (r() - 0.5) * p.shapeSize[2],
        );
        break;
      default:
        break;
    }
    const speed = p.speed * (1 + (r() * 2 - 1) * p.speedVariance);
    direction.multiplyScalar(speed);
    if (!local) {
      // World space: bring the emitter's position and direction into the world.
      this.source.updateWorldMatrix(true, false);
      this.source.getWorldQuaternion(scratchQuaternion);
      position.applyMatrix4(this.source.matrixWorld);
      direction.applyQuaternion(scratchQuaternion);
    }
    this.position.set([position.x, position.y, position.z], i * 3);
    this.velocity.set([direction.x, direction.y, direction.z], i * 3);
    this.age[i] = 0;
    this.life[i] = Math.max(0.05, p.lifetime * (1 + (r() * 2 - 1) * p.lifetimeVariance));
    this.scale[i] = Math.max(0.05, 1 + (r() * 2 - 1) * p.sizeVariance);
  }

  /** Moves particles and removes the ones that reached the end of their life. */
  private simulate(dt: number): void {
    const gravity = -9.81 * this.params.gravity;
    const damping = Math.max(0, 1 - this.params.drag * dt);
    let i = 0;
    while (i < this.count) {
      this.age[i] = (this.age[i] ?? 0) + dt;
      if ((this.age[i] ?? 0) >= (this.life[i] ?? 0)) {
        this.remove(i);
        continue;
      }
      const o = i * 3;
      const vy = ((this.velocity[o + 1] ?? 0) + gravity * dt) * damping;
      const vx = (this.velocity[o] ?? 0) * damping;
      const vz = (this.velocity[o + 2] ?? 0) * damping;
      this.velocity[o] = vx;
      this.velocity[o + 1] = vy;
      this.velocity[o + 2] = vz;
      this.position[o] = (this.position[o] ?? 0) + vx * dt;
      this.position[o + 1] = (this.position[o + 1] ?? 0) + vy * dt;
      this.position[o + 2] = (this.position[o + 2] ?? 0) + vz * dt;
      i++;
    }
  }

  /** Removes particle `i` by moving the last one into its place. */
  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.position.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.velocity.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.age[i] = this.age[last] ?? 0;
    this.life[i] = this.life[last] ?? 0;
    this.scale[i] = this.scale[last] ?? 1;
  }

  /** Writes colors and sizes for drawing. */
  private write(): void {
    const p = this.params;
    scratchColorA.set(p.startColor);
    scratchColorB.set(p.endColor);
    for (let i = 0; i < this.count; i++) {
      const t = Math.min(1, (this.age[i] ?? 0) / (this.life[i] ?? 1));
      const o = i * 4;
      this.tint[o] = scratchColorA.r + (scratchColorB.r - scratchColorA.r) * t;
      this.tint[o + 1] = scratchColorA.g + (scratchColorB.g - scratchColorA.g) * t;
      this.tint[o + 2] = scratchColorA.b + (scratchColorB.b - scratchColorA.b) * t;
      this.tint[o + 3] = p.startAlpha + (p.endAlpha - p.startAlpha) * t;
      this.sizes[i] = (p.startSize + (p.endSize - p.startSize) * t) * (this.scale[i] ?? 1);
    }
    this.geometry.setDrawRange(0, this.count);
    const position = this.geometry.getAttribute('position');
    const tint = this.geometry.getAttribute('tint');
    const size = this.geometry.getAttribute('size');
    position.needsUpdate = true;
    tint.needsUpdate = true;
    size.needsUpdate = true;
  }
}

/** Direction the emitter points to in the world (its local up axis). */
export function emitterUp(object: Object3D, target: Vector3 = new Vector3()): Vector3 {
  return target.copy(UP).applyQuaternion(object.getWorldQuaternion(scratchQuaternion));
}
