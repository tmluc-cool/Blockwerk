import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { OrthographicCamera, PerspectiveCamera } from 'three';

/** Axis-aligned views of the scene gizmo, named after the side the camera looks from. */
export type AxisView = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

/** Yaw and pitch (radians) of each axis view. Forward is -Z at yaw 0 (three.js camera convention). */
export const AXIS_VIEW_ANGLES: Readonly<Record<AxisView, { yaw: number; pitch: number }>> = {
  right: { yaw: Math.PI / 2, pitch: 0 },
  left: { yaw: -Math.PI / 2, pitch: 0 },
  front: { yaw: 0, pitch: 0 },
  back: { yaw: Math.PI, pitch: 0 },
  top: { yaw: 0, pitch: -Math.PI / 2 },
  bottom: { yaw: 0, pitch: Math.PI / 2 },
};

/** Movement keys pressed while flying, as axis values in -1..1. */
export interface FlyInput {
  /** Right (+) / left (-). */
  readonly x: number;
  /** Up (+) / down (-), in world space. */
  readonly y: number;
  /** Forward (+) / backward (-). */
  readonly z: number;
  /** Shift held: move faster. */
  readonly fast: boolean;
}

const LOOK_SENSITIVITY = 0.0042;
const ORBIT_SENSITIVITY = 0.0065;
const MAX_LOOK_PITCH = MathUtils.degToRad(89.5);
const MIN_DISTANCE = 0.05;
const MAX_DISTANCE = 20000;
const FLY_BASE_SPEED = 5;
const FLY_FAST_FACTOR = 4;
const FLY_ACCELERATION_TIME = 2;
const FLY_MAX_ACCELERATION = 2.5;
const TRANSITION_TIME = 0.28;

interface Transition {
  readonly fromPivot: Vector3;
  readonly toPivot: Vector3;
  readonly fromDistance: number;
  readonly toDistance: number;
  readonly fromYaw: number;
  readonly toYaw: number;
  readonly fromPitch: number;
  readonly toPitch: number;
  elapsed: number;
}

/** Shortest signed angle from `from` to `to`. */
function angleDelta(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

/** Smoothstep easing for camera transitions. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Scene view camera state with Unity-like navigation: the camera orbits a pivot at a
 * distance with yaw and pitch. Pure math, no DOM. `apply` writes the state to three.js cameras.
 */
export class SceneCamera {
  readonly pivot = new Vector3();
  distance = 10;
  yaw = 0;
  pitch = 0;
  orthographic = false;
  /** Vertical field of view of the perspective camera, in degrees. */
  readonly fov = 60;
  /** User fly speed multiplier (Unity: Camera Speed). */
  speed = 1;

  private flyTime = 0;
  private transition: Transition | null = null;
  private readonly euler = new Euler(0, 0, 0, 'YXZ');

  /** Rotation of the camera. */
  get quaternion(): Quaternion {
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    return new Quaternion().setFromEuler(this.euler);
  }

  /** Unit vector the camera looks along. */
  get forward(): Vector3 {
    return new Vector3(0, 0, -1).applyQuaternion(this.quaternion);
  }

  /** Unit vector to the right of the view. */
  get right(): Vector3 {
    return new Vector3(1, 0, 0).applyQuaternion(this.quaternion);
  }

  /** Unit vector pointing up in the view. */
  get up(): Vector3 {
    return new Vector3(0, 1, 0).applyQuaternion(this.quaternion);
  }

  /** Camera position derived from pivot, direction and distance. */
  get position(): Vector3 {
    return this.pivot.clone().addScaledVector(this.forward, -this.distance);
  }

  /** Whether a smooth transition (focus or axis view) is running. */
  get animating(): boolean {
    return this.transition !== null;
  }

  /** Puts the camera at `position` looking at `target`. */
  lookAt(position: Vector3, target: Vector3): void {
    const direction = target.clone().sub(position);
    this.distance = Math.max(MIN_DISTANCE, direction.length());
    direction.normalize();
    this.pitch = Math.asin(MathUtils.clamp(direction.y, -1, 1));
    this.yaw = Math.atan2(-direction.x, -direction.z);
    this.pivot.copy(target);
    this.transition = null;
  }

  /** Free look (right mouse button): rotates the view around the camera position. */
  look(dx: number, dy: number): void {
    this.transition = null;
    const position = this.position;
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = MathUtils.clamp(
      this.pitch - dy * LOOK_SENSITIVITY,
      -MAX_LOOK_PITCH,
      MAX_LOOK_PITCH,
    );
    this.pivot.copy(position).addScaledVector(this.forward, this.distance);
  }

  /** Orbit (Alt + left mouse button): rotates the camera around the pivot. */
  orbit(dx: number, dy: number): void {
    this.transition = null;
    this.yaw -= dx * ORBIT_SENSITIVITY;
    this.pitch = MathUtils.clamp(
      this.pitch - dy * ORBIT_SENSITIVITY,
      -MAX_LOOK_PITCH,
      MAX_LOOK_PITCH,
    );
  }

  /** World units covered by one pixel at the pivot, for a viewport of the given height. */
  unitsPerPixel(viewportHeight: number): number {
    const visibleHeight = 2 * this.distance * Math.tan(MathUtils.degToRad(this.fov / 2));
    return visibleHeight / Math.max(1, viewportHeight);
  }

  /** Pan (middle mouse button or hand tool): moves the view so the scene follows the mouse. */
  pan(dx: number, dy: number, viewportHeight: number): void {
    this.transition = null;
    const scale = this.unitsPerPixel(viewportHeight);
    this.pivot.addScaledVector(this.right, -dx * scale).addScaledVector(this.up, dy * scale);
  }

  /** Zoom (mouse wheel or Alt + right mouse button): changes the distance to the pivot. */
  zoom(delta: number): void {
    this.transition = null;
    this.distance = MathUtils.clamp(
      this.distance * Math.exp(delta * 0.0012),
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
  }

  /** Changes the fly speed (mouse wheel while flying). */
  adjustSpeed(delta: number): void {
    this.speed = MathUtils.clamp(this.speed * Math.exp(-delta * 0.0015), 0.01, 20);
  }

  /**
   * Fly mode (right mouse button + WASD/QE): moves camera and pivot together. Speed grows
   * the longer the keys are held, like in Unity. Returns whether the camera moved.
   */
  fly(input: FlyInput, dt: number): boolean {
    if (input.x === 0 && input.y === 0 && input.z === 0) {
      this.flyTime = 0;
      return false;
    }
    this.transition = null;
    this.flyTime += dt;
    const acceleration =
      1 + Math.min(1, this.flyTime / FLY_ACCELERATION_TIME) * (FLY_MAX_ACCELERATION - 1);
    const speed = FLY_BASE_SPEED * this.speed * acceleration * (input.fast ? FLY_FAST_FACTOR : 1);
    const move = new Vector3()
      .addScaledVector(this.right, input.x)
      .addScaledVector(new Vector3(0, 1, 0), input.y)
      .addScaledVector(this.forward, input.z);
    if (move.lengthSq() > 1) move.normalize();
    this.pivot.addScaledVector(move, speed * dt);
    return true;
  }

  /** Frames a bounding sphere (F key): keeps the viewing direction, animates pivot and distance. */
  frame(center: Vector3, radius: number): void {
    const halfFov = MathUtils.degToRad(this.fov / 2);
    const distance = MathUtils.clamp(
      (Math.max(radius, 0.1) / Math.sin(halfFov)) * 1.15,
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
    this.startTransition(center, distance, this.yaw, this.pitch);
  }

  /** Turns to an axis view (scene gizmo click) and switches to orthographic, like Unity. */
  setAxisView(view: AxisView): void {
    const angles = AXIS_VIEW_ANGLES[view];
    this.orthographic = true;
    this.startTransition(this.pivot.clone(), this.distance, angles.yaw, angles.pitch);
  }

  /** Returns the axis view the camera currently shows, if any. */
  currentAxisView(): AxisView | null {
    for (const [view, angles] of Object.entries(AXIS_VIEW_ANGLES) as [
      AxisView,
      { yaw: number; pitch: number },
    ][]) {
      const vertical = Math.abs(angles.pitch) > 1;
      const pitchMatches = Math.abs(this.pitch - angles.pitch) < 1e-3;
      const yawMatches = vertical || Math.abs(angleDelta(this.yaw, angles.yaw)) < 1e-3;
      if (pitchMatches && yawMatches) return view;
    }
    return null;
  }

  /** Advances running transitions. Returns whether the camera changed. */
  update(dt: number): boolean {
    const transition = this.transition;
    if (!transition) return false;
    transition.elapsed += dt;
    const t = Math.min(1, transition.elapsed / TRANSITION_TIME);
    const k = ease(t);
    this.pivot.lerpVectors(transition.fromPivot, transition.toPivot, k);
    this.distance = MathUtils.lerp(transition.fromDistance, transition.toDistance, k);
    this.yaw = transition.fromYaw + angleDelta(transition.fromYaw, transition.toYaw) * k;
    this.pitch = MathUtils.lerp(transition.fromPitch, transition.toPitch, k);
    if (t >= 1) {
      this.yaw = transition.toYaw;
      this.pitch = transition.toPitch;
      this.transition = null;
    }
    return true;
  }

  /** Jumps to the end of a running transition. */
  finishTransition(): void {
    if (this.transition) this.update(TRANSITION_TIME);
  }

  /** Writes the state to the perspective and orthographic cameras. */
  apply(perspective: PerspectiveCamera, orthographic: OrthographicCamera, aspect: number): void {
    const rotation = this.quaternion;
    perspective.fov = this.fov;
    perspective.aspect = aspect;
    perspective.near = MathUtils.clamp(this.distance * 0.002, 0.01, 1);
    perspective.far = 10000;
    perspective.position.copy(this.position);
    perspective.quaternion.copy(rotation);
    perspective.updateProjectionMatrix();
    perspective.updateMatrixWorld();

    const halfHeight = this.distance * Math.tan(MathUtils.degToRad(this.fov / 2));
    orthographic.left = -halfHeight * aspect;
    orthographic.right = halfHeight * aspect;
    orthographic.top = halfHeight;
    orthographic.bottom = -halfHeight;
    orthographic.near = 0.01;
    orthographic.far = 20000;
    // Keep the orthographic camera far behind the pivot so nothing in front gets clipped.
    orthographic.position
      .copy(this.pivot)
      .addScaledVector(this.forward, -Math.max(this.distance, 2000));
    orthographic.quaternion.copy(rotation);
    orthographic.updateProjectionMatrix();
    orthographic.updateMatrixWorld();
  }

  private startTransition(pivot: Vector3, distance: number, yaw: number, pitch: number): void {
    this.transition = {
      fromPivot: this.pivot.clone(),
      toPivot: pivot.clone(),
      fromDistance: this.distance,
      toDistance: distance,
      fromYaw: this.yaw,
      toYaw: yaw,
      fromPitch: this.pitch,
      toPitch: pitch,
      elapsed: 0,
    };
  }
}
