import { Object3D } from 'three';
import type { Scene, Vector3 } from 'three';
import { ParticleEmitter } from './ParticleEmitter';
import { PARTICLE_PRESETS } from './presets';
import type { ParticleParams, ParticlePresetName } from './presets';

/** Options of a one-shot effect. */
export interface EffectOptions {
  /** Scales the size of the particles (default 1). */
  readonly scale?: number;
}

/**
 * One-shot effects (dust, sparks, explosion …) that live next to the scene's objects: each
 * effect plays its template once at a point and removes itself when the last particle is gone.
 */
export class Effects {
  private readonly running: { emitter: ParticleEmitter; anchor: Object3D }[] = [];

  constructor(private readonly scene: Scene) {}

  /** Number of effects that are still playing. */
  get active(): number {
    return this.running.length;
  }

  /** Plays a template at a world position. Looping templates run until {@link clear}. */
  spawn(name: ParticlePresetName, position: Vector3, options: EffectOptions = {}): ParticleEmitter {
    const base = PARTICLE_PRESETS[name];
    const scale = options.scale ?? 1;
    const params: ParticleParams = {
      ...base,
      startSize: base.startSize * scale,
      endSize: base.endSize * scale,
      shapeRadius: base.shapeRadius * scale,
      space: 'world',
    };
    const anchor = new Object3D();
    anchor.position.copy(position);
    this.scene.add(anchor);
    const emitter = new ParticleEmitter(anchor, this.scene, params);
    emitter.play();
    this.running.push({ emitter, anchor });
    return emitter;
  }

  /** Advances all effects and removes the finished ones. */
  update(dt: number): void {
    for (let i = this.running.length - 1; i >= 0; i--) {
      const entry = this.running[i];
      if (!entry) continue;
      entry.emitter.step(dt);
      if (entry.emitter.finished) {
        entry.emitter.dispose();
        entry.anchor.removeFromParent();
        this.running.splice(i, 1);
      }
    }
  }

  /** Stops and removes every effect. */
  clear(): void {
    for (const entry of this.running.splice(0)) {
      entry.emitter.dispose();
      entry.anchor.removeFromParent();
    }
  }
}
