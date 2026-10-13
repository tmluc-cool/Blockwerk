import type { Vector3 } from 'three';
import { Object3D } from 'three';

/** Options for creating a {@link GameObject}. */
export interface GameObjectOptions {
  /** Stable ID of the object (never changes, used for all references). */
  id: string;
  /** Display name shown in the hierarchy. */
  name: string;
  /** Scene graph node that carries the object's transform. A new one is created if omitted. */
  object3d?: Object3D;
}

/**
 * An object in a running game (Unity: GameObject). Phase 0 only carries the transform and
 * the movement primitives used by compiled blocks; components follow in phase 1.
 */
export class GameObject {
  readonly id: string;
  name: string;
  readonly object3d: Object3D;

  constructor(options: GameObjectOptions) {
    this.id = options.id;
    this.name = options.name;
    this.object3d = options.object3d ?? new Object3D();
    this.object3d.name = options.name;
  }

  /** World-independent local position (meters), relative to the parent. */
  get position(): Vector3 {
    return this.object3d.position;
  }

  /**
   * Moves the object along its own axes, in meters. Local +Z is forward
   * (glTF convention), +Y is up.
   */
  moveLocal(x: number, y: number, z: number): void {
    this.object3d.translateX(x);
    this.object3d.translateY(y);
    this.object3d.translateZ(z);
  }
}
