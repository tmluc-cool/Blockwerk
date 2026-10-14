import type { Vec3 } from '@blockwerk/project';
import { Euler, Group, MathUtils, Quaternion, Vector3 } from 'three';
import type {
  ComponentBehavior,
  ComponentDefinition,
  FieldDefinitions,
  FieldValues,
} from '../components/defineComponent';

/** Value of a block-script variable. */
export type VariableValue = number | string | boolean;

/** Directions of the "move" block, relative to the object. */
export type MoveDirection = 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down';

/** Directions of the "turn" block. */
export type TurnDirection = 'left' | 'right' | 'up' | 'down';

/** A component attached to a game object. */
export interface ComponentInstance {
  /** Stable ID of the component data. */
  readonly id: string;
  readonly definition: ComponentDefinition;
  readonly behavior: ComponentBehavior;
  /** Current field values (resolved, with defaults). */
  values: FieldValues<FieldDefinitions>;
  enabled: boolean;
}

/** Options for creating a {@link GameObject}. */
export interface GameObjectOptions {
  /** Stable ID of the object (never changes, used for all references). */
  id: string;
  /** Display name shown in the hierarchy. */
  name: string;
  tag?: string;
  layer?: string;
}

const LOCAL_AXES: Readonly<Record<MoveDirection, readonly [number, number, number]>> = {
  // Local +Z is forward (glTF convention), +Y up, so right is -X.
  forward: [0, 0, 1],
  backward: [0, 0, -1],
  left: [1, 0, 0],
  right: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
};

const EULER_ORDER = 'YXZ';

/**
 * An object in a scene (Unity: GameObject): transform, hierarchy, active state, tag, layer,
 * components and the variables of its block scripts.
 */
export class GameObject {
  readonly id: string;
  name: string;
  tag: string;
  layer: string;
  /** Scene graph node that carries the transform. Components add their meshes and lights to it. */
  readonly object3d = new Group();
  parent: GameObject | null = null;
  readonly children: GameObject[] = [];
  readonly components: ComponentInstance[] = [];
  /** Values of object-scoped block-script variables by variable ID. */
  readonly vars: Record<string, VariableValue> = {};
  /** Set once the object was destroyed. */
  destroyed = false;
  /** ID of the object this one is a clone of (play mode), otherwise `null`. */
  cloneOf: string | null = null;
  /** Scale from the scene data; "set size to %" is relative to it. */
  readonly baseScale = new Vector3(1, 1, 1);
  private activeSelf = true;
  private shown = true;

  constructor(options: GameObjectOptions) {
    this.id = options.id;
    this.name = options.name;
    this.tag = options.tag ?? 'Untagged';
    this.layer = options.layer ?? 'Default';
    this.object3d.name = options.name;
    this.object3d.userData['gameObjectId'] = options.id;
    this.object3d.rotation.order = EULER_ORDER;
  }

  /** Local position (meters), relative to the parent. */
  get position(): Vector3 {
    return this.object3d.position;
  }

  /** Whether the object itself is active (Unity: activeSelf). */
  get active(): boolean {
    return this.activeSelf;
  }

  /** Whether the object and all its parents are active (Unity: activeInHierarchy). */
  get activeInHierarchy(): boolean {
    return this.activeSelf && (this.parent?.activeInHierarchy ?? true);
  }

  /** Activates or deactivates the object (and with it its children). */
  setActive(active: boolean): void {
    this.activeSelf = active;
    this.object3d.visible = active;
  }

  /** Whether the object's renderers are shown (Scratch: show / hide). Hidden objects touch nothing. */
  get visible(): boolean {
    return this.shown;
  }

  /** Shows or hides the object's own meshes and models (children are not affected). */
  setVisible(visible: boolean): void {
    this.shown = visible;
    for (const child of this.object3d.children) {
      if ((child as { isMesh?: boolean }).isMesh || child.userData['model'] === true) {
        child.visible = visible;
      }
    }
  }

  /** Moves the object along its own axes, in meters. Local +Z is forward, +Y up, -X right. */
  moveLocal(x: number, y: number, z: number): void {
    this.object3d.translateX(x);
    this.object3d.translateY(y);
    this.object3d.translateZ(z);
  }

  /** Moves the object in a direction relative to its facing. Up and down are in world space. */
  move(direction: MoveDirection, meters: number): void {
    const [x, y, z] = LOCAL_AXES[direction];
    if (direction === 'up' || direction === 'down') {
      this.object3d.position.y += y * meters;
      return;
    }
    // Horizontal moves follow the heading only, so a tilted object does not dig into the ground.
    const heading = new Quaternion().setFromEuler(
      new Euler(0, this.object3d.rotation.y, 0, EULER_ORDER),
    );
    this.object3d.position.add(
      new Vector3(x, 0, z).applyQuaternion(heading).multiplyScalar(meters),
    );
  }

  /** Turns the object: left/right around the world up axis, up/down around its own side axis. */
  turn(direction: TurnDirection, degrees: number): void {
    const radians = MathUtils.degToRad(degrees);
    const rotation = this.object3d.rotation;
    switch (direction) {
      case 'left':
        rotation.y += radians;
        break;
      case 'right':
        rotation.y -= radians;
        break;
      case 'up':
        rotation.x -= radians;
        break;
      case 'down':
        rotation.x += radians;
        break;
    }
  }

  /** Sets the local position in meters. */
  setPosition(x: number, y: number, z: number): void {
    this.object3d.position.set(x, y, z);
  }

  /** Local rotation as Euler angles in degrees (Unity order Z, X, Y). */
  getRotationDegrees(): Vec3 {
    const rotation = this.object3d.rotation;
    return [
      MathUtils.radToDeg(rotation.x),
      MathUtils.radToDeg(rotation.y),
      MathUtils.radToDeg(rotation.z),
    ];
  }

  /** Sets the local rotation from Euler angles in degrees. */
  setRotationDegrees(x: number, y: number, z: number): void {
    this.object3d.rotation.set(
      MathUtils.degToRad(x),
      MathUtils.degToRad(y),
      MathUtils.degToRad(z),
      EULER_ORDER,
    );
  }

  /** Sets the local scale. */
  setScale(x: number, y: number, z: number): void {
    this.object3d.scale.set(x, y, z);
  }

  /** Heading in degrees: 0 faces +Z, 90 faces +X (Unity: transform.eulerAngles.y). */
  get heading(): number {
    return MathUtils.euclideanModulo(MathUtils.radToDeg(this.object3d.rotation.y), 360);
  }

  /** Moves the object to a position given in world space. */
  setWorldPosition(world: Vector3): void {
    const local = world.clone();
    if (this.object3d.parent) {
      this.object3d.parent.updateWorldMatrix(true, false);
      this.object3d.parent.worldToLocal(local);
    }
    this.object3d.position.copy(local);
  }

  /** Position in world space. */
  worldPosition(target: Vector3 = new Vector3()): Vector3 {
    this.object3d.updateWorldMatrix(true, false);
    return this.object3d.getWorldPosition(target);
  }

  /** Turns the object so its forward (+Z) axis points at a world position, keeping it upright. */
  lookAtPoint(point: Vector3): void {
    const from = this.worldPosition();
    const dx = point.x - from.x;
    const dz = point.z - from.z;
    if (dx === 0 && dz === 0) return;
    this.object3d.rotation.y = Math.atan2(dx, dz);
  }

  /** The first component of a type, if any. */
  findComponent(type: string): ComponentInstance | undefined {
    return this.components.find((component) => component.definition.type === type);
  }

  /** Attaches a child object (keeps the child's local transform). */
  addChild(child: GameObject, index = this.children.length): void {
    child.removeFromParent();
    child.parent = this;
    this.children.splice(index, 0, child);
    this.object3d.add(child.object3d);
  }

  /** Detaches the object from its parent object (the caller decides where it goes). */
  removeFromParent(): void {
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
      this.parent = null;
    }
    this.object3d.removeFromParent();
  }

  /** The object and all its descendants, depth first. */
  *descendantsAndSelf(): Generator<GameObject> {
    yield this;
    for (const child of this.children) yield* child.descendantsAndSelf();
  }
}
