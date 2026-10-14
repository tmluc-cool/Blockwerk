import type { Collider, RigidBody, World as RapierWorld } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '@blockwerk/project';
import type { Matrix4 } from 'three';
import { Quaternion, Vector3 } from 'three';
import { colliderRegistry } from '../components/colliders';
import type { ColliderState } from '../components/colliders';
import { rigidbodyRegistry } from '../components/rigidbody';
import type { BodyType, RigidbodyState } from '../components/rigidbody';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import { meshData, meshKey, ownMeshes } from './meshData';
import type { Rapier } from './rapier';

/** Physics settings of a game: scene gravity and the project's layer collision matrix. */
export interface PhysicsSettings {
  readonly gravity: Vec3;
  /** Layer names in order (bit index); `Default` first. At most 16. */
  readonly layers: readonly string[];
  /** Pairs of layers that do not collide (Unity: Layer Collision Matrix). */
  readonly ignoredPairs: readonly (readonly [string, string])[];
}

/** Default settings: Earth gravity, everything collides. */
export const DEFAULT_PHYSICS: PhysicsSettings = {
  gravity: [0, -9.81, 0],
  layers: ['Default'],
  ignoredPairs: [],
};

/** A collider that wants a capsule shape and kinematic movement (character controller). */
export interface CharacterShape {
  readonly radius: number;
  readonly height: number;
  readonly center: Vec3;
  /** Contact offset; the capsule floats this far above the feet so the feet touch the ground. */
  readonly skin: number;
  readonly enabled: boolean;
  readonly version: number;
}

/** Character controller shapes by object (filled by the character controller component). */
export const characterRegistry = new WeakMap<object, CharacterShape>();

/** Settings of a character move (character controller component). */
export interface CharacterMoveSettings {
  /** Steepest slope the character can walk up, in degrees. */
  readonly slopeLimit: number;
  /** Highest step it climbs automatically, in meters. */
  readonly stepOffset: number;
  /** Gap kept to surfaces, in meters. */
  readonly skinWidth: number;
  /** Distance it sticks to the ground when walking down, in meters. */
  readonly snapDistance: number;
  /** Mass used to push dynamic bodies, in kg. */
  readonly pushMass: number;
}

/** Result of a character move. */
export interface CharacterMoveResult {
  /** The movement actually made (after sliding, stepping and snapping). */
  readonly movement: Vector3;
  readonly grounded: boolean;
  /** Whether something above stopped an upward move. */
  readonly hitCeiling: boolean;
}

/** Something hit by a ray or shape cast. */
export interface PhysicsHit {
  readonly object: GameObject;
  readonly distance: number;
  readonly point: Vector3;
  readonly normal: Vector3;
}

/** A zone (trigger) was entered or left. */
export interface ZoneEvent {
  readonly zone: GameObject;
  readonly other: GameObject;
  readonly entered: boolean;
}

type EntryKind = 'static' | 'moving' | 'kinematic' | 'dynamic' | 'character';

interface BodyEntry {
  readonly owner: GameObject;
  body: RigidBody;
  kind: EntryKind;
  signature: string;
  colliders: Collider[];
  /** World pose last written to or read from the object. */
  readonly lastPosition: Vector3;
  readonly lastQuaternion: Quaternion;
  /** How far the object was moved by scripts in this tick (platforms carry characters). */
  readonly motion: Vector3;
}

const POSITION_EPSILON = 1e-6;

function quaternionChanged(a: Quaternion, b: Quaternion): boolean {
  return Math.abs(a.dot(b)) < 1 - 1e-9;
}

/**
 * Rapier physics for a game world (SPEC 8.4). Bodies are built from Rigidbody, collider and
 * character controller components each tick: a Rigidbody owns a body (colliders of children
 * without own Rigidbody join it); objects with colliders but no Rigidbody are fixed and become
 * kinematic as soon as something moves them (moving platforms push and carry).
 */
export class Physics {
  readonly world: RapierWorld;
  private readonly entries = new Map<GameObject, BodyEntry>();
  private readonly colliderOwners = new Map<number, GameObject>();
  private readonly eventQueue: InstanceType<Rapier['EventQueue']>;
  private readonly zoneEvents: ZoneEvent[] = [];
  private readonly layerBits = new Map<string, number>();
  private readonly layerFilters = new Map<string, number>();
  /** Body types set by blocks ("make me static / dynamic / kinematic"). */
  private readonly typeOverrides = new Map<GameObject, BodyType | 'static'>();
  /** Rigidbody settings for objects made dynamic or kinematic without a Rigidbody component. */
  private readonly virtualBodies = new Map<GameObject, RigidbodyState>();

  constructor(
    private readonly rapier: Rapier,
    private readonly scene: World,
    settings: PhysicsSettings = DEFAULT_PHYSICS,
  ) {
    const [gx, gy, gz] = settings.gravity;
    this.world = new rapier.World({ x: gx, y: gy, z: gz });
    this.world.timestep = 1 / 60;
    this.eventQueue = new rapier.EventQueue(true);
    const layers = settings.layers.slice(0, 16);
    layers.forEach((layer, index) => this.layerBits.set(layer, 1 << index));
    for (const layer of layers) {
      let filter = 0xffff;
      for (const [a, b] of settings.ignoredPairs) {
        const other = a === layer ? b : b === layer ? a : null;
        const bit = other ? this.layerBits.get(other) : undefined;
        if (bit !== undefined) filter &= ~bit;
      }
      this.layerFilters.set(layer, filter);
    }
  }

  /** Changes the gravity (block "set gravity"). */
  setGravity(gravity: Vec3): void {
    this.world.gravity = { x: gravity[0], y: gravity[1], z: gravity[2] };
    for (const entry of this.entries.values()) entry.body.wakeUp();
  }

  /** Current gravity. */
  get gravity(): Vector3 {
    const { x, y, z } = this.world.gravity;
    return new Vector3(x, y, z);
  }

  /** Brings bodies in line with the objects and their components. Call before {@link step}. */
  sync(): void {
    const owners = new Map<GameObject, GameObject[]>();
    for (const object of this.scene.allObjects()) {
      if (object.destroyed || !object.activeInHierarchy) continue;
      const hasColliders = (colliderRegistry.get(object) ?? []).some((state) => state.enabled);
      const character = characterRegistry.get(object);
      const body = this.rigidbodyOf(object);
      if (!hasColliders && !(character?.enabled ?? false) && !body) continue;
      const owner = character?.enabled ? object : (this.bodyOwner(object) ?? object);
      const list = owners.get(owner) ?? [];
      list.push(object);
      owners.set(owner, list);
    }
    for (const [owner, entry] of this.entries) {
      if (!owners.has(owner)) this.removeEntry(entry);
    }
    for (const [owner, members] of owners) {
      const signature = this.signatureOf(owner, members);
      let entry = this.entries.get(owner);
      if (!entry || entry.signature !== signature) {
        if (entry) this.removeEntry(entry);
        entry = this.createEntry(owner, members, signature);
      }
      this.syncPose(entry);
    }
  }

  /** One physics step; dynamic bodies write their poses back to the objects. */
  step(): void {
    this.world.step(this.eventQueue);
    this.eventQueue.drainCollisionEvents((first, second, started) => {
      const a = this.world.getCollider(first);
      const b = this.world.getCollider(second);
      const objectA = this.colliderOwners.get(first);
      const objectB = this.colliderOwners.get(second);
      if (!a || !b || !objectA || !objectB) return;
      if (a.isSensor()) this.zoneEvents.push({ zone: objectA, other: objectB, entered: started });
      if (b.isSensor()) this.zoneEvents.push({ zone: objectB, other: objectA, entered: started });
    });
    for (const entry of this.entries.values()) {
      if (entry.kind === 'dynamic') this.writeBack(entry);
      entry.motion.set(0, 0, 0);
    }
  }

  /** Zone events since the last call. */
  takeZoneEvents(): ZoneEvent[] {
    return this.zoneEvents.splice(0);
  }

  /** The body that moves an object (its own or an ancestor's), if any. */
  bodyOf(object: GameObject): RigidBody | null {
    const owner = this.entries.has(object) ? object : this.bodyOwner(object);
    return owner ? (this.entries.get(owner)?.body ?? null) : null;
  }

  /** The first collider of an object (the character capsule for characters). */
  colliderOf(object: GameObject): Collider | null {
    for (const [handle, owner] of this.colliderOwners) {
      if (owner === object) return this.world.getCollider(handle) ?? null;
    }
    return null;
  }

  /** The object a collider belongs to. */
  objectOfCollider(collider: Collider): GameObject | undefined {
    return this.colliderOwners.get(collider.handle);
  }

  /** Linear velocity of an object's body (m/s); zero without a body. */
  velocity(object: GameObject): Vector3 {
    const body = this.bodyOf(object);
    if (!body) return new Vector3();
    const { x, y, z } = body.linvel();
    return new Vector3(x, y, z);
  }

  /** Sets the velocity of a dynamic body. */
  setVelocity(object: GameObject, velocity: Vector3): void {
    const body = this.bodyOf(object);
    if (!body?.isDynamic()) return;
    body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
  }

  /** Pushes a dynamic body (impulse in N·s). */
  applyImpulse(object: GameObject, impulse: Vector3): void {
    const body = this.bodyOf(object);
    if (!body?.isDynamic()) return;
    body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }

  /**
   * Makes an object static, dynamic or kinematic at runtime (block "make me …"). Objects
   * without a Rigidbody get one with default values.
   */
  setBodyType(object: GameObject, type: BodyType | 'static'): void {
    this.typeOverrides.set(object, type);
    if (type !== 'static' && !rigidbodyRegistry.get(object) && !this.virtualBodies.has(object)) {
      this.virtualBodies.set(object, {
        type,
        mass: 1,
        drag: 0,
        angularDrag: 0.05,
        useGravity: true,
        freezeRotation: [false, false, false],
        continuous: false,
        enabled: true,
        version: 0,
      });
    }
  }

  /** The closest hit along a ray (ignoring `exclude` and triggers). */
  raycast(
    origin: Vector3,
    direction: Vector3,
    maxDistance: number,
    exclude: GameObject | null = null,
  ): PhysicsHit | null {
    const length = direction.length();
    if (length === 0) return null;
    const dir = direction.clone().divideScalar(length);
    const ray = new this.rapier.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const excluded = exclude ? this.collidersOf(exclude) : new Set<number>();
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxDistance,
      true,
      this.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      undefined,
      (collider) => !excluded.has(collider.handle),
    );
    if (!hit) return null;
    const object = this.colliderOwners.get(hit.collider.handle);
    if (!object) return null;
    return {
      object,
      distance: hit.timeOfImpact,
      point: origin.clone().addScaledVector(dir, hit.timeOfImpact),
      normal: new Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    };
  }

  /**
   * How far a sphere can travel from `from` towards `to` before hitting something (camera
   * collision). Returns the free distance (the full distance if nothing is in the way).
   */
  sphereCast(from: Vector3, to: Vector3, radius: number, exclude: readonly GameObject[]): number {
    const direction = to.clone().sub(from);
    const distance = direction.length();
    if (distance === 0) return 0;
    direction.divideScalar(distance);
    const excluded = new Set<number>();
    for (const object of exclude) {
      for (const handle of this.collidersOf(object, true)) excluded.add(handle);
    }
    const hit = this.world.castShape(
      { x: from.x, y: from.y, z: from.z },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: direction.x, y: direction.y, z: direction.z },
      new this.rapier.Ball(radius),
      0,
      distance,
      true,
      this.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      undefined,
      (collider) => !excluded.has(collider.handle),
    );
    return hit ? hit.time_of_impact : distance;
  }

  private readonly characters = new Map<
    GameObject,
    { controller: ReturnType<RapierWorld['createCharacterController']>; ground: RigidBody | null }
  >();

  /**
   * Moves a character by `desired` with Rapier's kinematic character controller (SPEC 8.5):
   * slopes up to the limit, sliding down steeper ones, climbing steps, sticking to the ground,
   * gliding along walls, pushing dynamic bodies and riding moving platforms.
   */
  moveCharacter(
    object: GameObject,
    desired: Vector3,
    settings: CharacterMoveSettings,
  ): CharacterMoveResult {
    const entry = this.entries.get(object);
    const collider = entry?.colliders[0];
    if (!entry || !collider) {
      object.object3d.position.add(desired);
      return { movement: desired.clone(), grounded: false, hitCeiling: false };
    }
    let character = this.characters.get(object);
    if (!character) {
      character = {
        controller: this.world.createCharacterController(settings.skinWidth),
        ground: null,
      };
      character.controller.setUp({ x: 0, y: 1, z: 0 });
      character.controller.setSlideEnabled(true);
      this.characters.set(object, character);
    }
    const controller = character.controller;
    controller.setOffset(settings.skinWidth);
    controller.setMaxSlopeClimbAngle((settings.slopeLimit * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((settings.slopeLimit * Math.PI) / 180);
    if (settings.stepOffset > 0) controller.enableAutostep(settings.stepOffset, 0.05, false);
    else controller.disableAutostep();
    if (settings.snapDistance > 0) controller.enableSnapToGround(settings.snapDistance);
    else controller.disableSnapToGround();
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(settings.pushMass);
    // Ride a moving platform: take over its movement of this tick.
    const ride = new Vector3();
    const ground = character.ground;
    if (ground && this.world.bodies.contains(ground.handle)) {
      // The platform's own measured movement: Rapier's velocity of a position-controlled
      // kinematic body is zero in every second tick.
      for (const platform of this.entries.values()) {
        if (
          platform.body !== ground ||
          (platform.kind !== 'moving' && platform.kind !== 'kinematic')
        ) {
          continue;
        }
        ride.set(platform.motion.x, Math.max(0, platform.motion.y), platform.motion.z);
        break;
      }
    }
    // The platform's movement is added after the collision test: its collider still stands where
    // it was before this tick, which would block the character.
    const wanted = desired;
    this.depenetrate(entry.body, collider, settings.skinWidth);
    controller.computeColliderMovement(
      collider,
      { x: wanted.x, y: wanted.y, z: wanted.z },
      this.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    );
    const computed = controller.computedMovement();
    const movement = new Vector3(computed.x, computed.y, computed.z);
    const grounded = controller.computedGrounded();
    if (ride.x !== 0 || ride.z !== 0) {
      // On a moving platform the controller sometimes adds a sideways step of the platform's
      // own size. A character never moves farther than asked: limit it to the wanted distance.
      const wantedLength = Math.hypot(wanted.x, wanted.z);
      const length = Math.hypot(movement.x, movement.z);
      if (length > wantedLength + 1e-4) {
        const scale = wantedLength / length;
        movement.x *= scale;
        movement.z *= scale;
      }
    }
    // The body that carries the character: found through the contacts of this move; it stays
    // while the character is still grounded (contacts are not reported in every tick).
    if (!grounded) character.ground = null;
    for (let index = 0; index < controller.numComputedCollisions(); index++) {
      const collision = controller.computedCollision(index);
      const body = collision?.collider?.parent();
      if (collision && body && collision.normal1.y > 0.7) character.ground = body;
    }
    const hitCeiling = wanted.y > 0 && movement.y < wanted.y * 0.5;
    const translation = entry.body.translation();
    const position = new Vector3(translation.x, translation.y, translation.z)
      .add(movement)
      .add(ride);
    const rotation = entry.owner.object3d.getWorldQuaternion(new Quaternion());
    setWorldPose(object, position, rotation);
    entry.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    entry.body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
    entry.lastPosition.copy(position);
    return { movement, grounded, hitCeiling };
  }

  /**
   * Pushes a character capsule out of fixed and kinematic colliders it overlaps (spawned inside
   * something, a platform moved into it). Rapier's character controller does not resolve
   * overlaps by itself and would otherwise sink further. The capsule ends up `skin` away, where
   * the controller keeps it anyway.
   */
  private depenetrate(body: RigidBody, collider: Collider, skin: number): void {
    const push = new Vector3();
    const center = collider.translation();
    const extent = collider.halfHeight() + collider.radius() + skin;
    const groups = collider.collisionGroups();
    const owner = this.colliderOwners.get(collider.handle);
    this.world.collidersWithAabbIntersectingAabb(
      center,
      { x: extent, y: extent, z: extent },
      (other) => {
        if (other.handle === collider.handle || other.isSensor() || other.parent()?.isDynamic())
          return true;
        if (this.colliderOwners.get(other.handle) === owner) return true;
        // Same filter as the physics: each side's membership must be in the other's filter.
        const otherGroups = other.collisionGroups();
        if (((groups >>> 16) & otherGroups) === 0 || ((otherGroups >>> 16) & groups) === 0)
          return true;
        const contact = collider.contactCollider(other, skin);
        if (contact && contact.distance < skin * 0.8) {
          const n = contact.normal1;
          push.add(new Vector3(n.x, n.y, n.z).multiplyScalar(contact.distance - skin));
        }
        return true;
      },
    );
    if (push.lengthSq() < 1e-10) return;
    const t = body.translation();
    body.setTranslation({ x: t.x + push.x, y: t.y + push.y, z: t.z + push.z }, true);
    this.world.propagateModifiedBodyPositionsToColliders();
  }

  /** Frees the physics world. */
  dispose(): void {
    for (const { controller } of this.characters.values())
      this.world.removeCharacterController(controller);
    this.characters.clear();
    this.eventQueue.free();
    this.world.free();
    this.entries.clear();
    this.colliderOwners.clear();
  }

  // ---------------------------------------------------------------- internals

  private rigidbodyOf(object: GameObject): RigidbodyState | null {
    const override = this.typeOverrides.get(object);
    if (override === 'static') return null;
    const state = rigidbodyRegistry.get(object);
    if (state?.enabled) return state;
    return override ? (this.virtualBodies.get(object) ?? null) : null;
  }

  /** Nearest ancestor (or the object) with a Rigidbody. */
  private bodyOwner(object: GameObject): GameObject | null {
    for (let current: GameObject | null = object; current; current = current.parent) {
      if (this.rigidbodyOf(current)) return current;
    }
    return null;
  }

  /** Collider handles of an object (and, with `descendants`, of its children). */
  private collidersOf(object: GameObject, descendants = false): Set<number> {
    const handles = new Set<number>();
    for (const [handle, owner] of this.colliderOwners) {
      if (owner === object) handles.add(handle);
      else if (descendants) {
        for (let current = owner.parent; current; current = current.parent) {
          if (current === object) {
            handles.add(handle);
            break;
          }
        }
      }
    }
    return handles;
  }

  private kindOf(owner: GameObject): EntryKind {
    if (characterRegistry.get(owner)?.enabled) return 'character';
    const state = this.rigidbodyOf(owner);
    if (!state) return 'static';
    const override = this.typeOverrides.get(owner);
    const type = override && override !== 'static' ? override : state.type;
    return type === 'kinematic' ? 'kinematic' : 'dynamic';
  }

  private signatureOf(owner: GameObject, members: readonly GameObject[]): string {
    const parts: string[] = [this.kindOf(owner)];
    const rigid = this.rigidbodyOf(owner);
    if (rigid) parts.push(`rb${rigid.version}`);
    const character = characterRegistry.get(owner);
    if (character?.enabled) parts.push(`cc${character.version}`);
    owner.object3d.updateWorldMatrix(true, false);
    const ownerInverse = owner.object3d.matrixWorld.clone().invert();
    for (const member of members) {
      const states = colliderRegistry.get(member) ?? [];
      parts.push(
        member.id,
        member.layer,
        ...states.map((state) => `${state.version}${state.enabled ? '' : 'x'}`),
      );
      if (states.some((state) => state.shape.kind === 'mesh')) {
        parts.push(meshKey(ownMeshes(member.object3d)));
      }
      const scale = new Vector3().setFromMatrixScale(member.object3d.matrixWorld);
      parts.push(
        scale
          .toArray()
          .map((value) => value.toFixed(4))
          .join(','),
      );
      if (member !== owner) {
        const relative = ownerInverse.clone().multiply(member.object3d.matrixWorld);
        parts.push(relative.elements.map((value) => value.toFixed(4)).join(','));
      }
    }
    return parts.join('|');
  }

  private createEntry(
    owner: GameObject,
    members: readonly GameObject[],
    signature: string,
  ): BodyEntry {
    const rapier = this.rapier;
    const kind = this.kindOf(owner);
    const position = new Vector3();
    const quaternion = new Quaternion();
    owner.object3d.updateWorldMatrix(true, false);
    owner.object3d.matrixWorld.decompose(position, quaternion, new Vector3());
    let description;
    switch (kind) {
      case 'dynamic':
        description = rapier.RigidBodyDesc.dynamic();
        break;
      case 'kinematic':
      case 'character':
      case 'moving':
        description = rapier.RigidBodyDesc.kinematicPositionBased();
        break;
      case 'static':
        description = rapier.RigidBodyDesc.fixed();
        break;
    }
    description
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });
    const rigid = this.rigidbodyOf(owner);
    if (rigid && kind === 'dynamic') {
      description
        .setLinearDamping(rigid.drag)
        .setAngularDamping(rigid.angularDrag)
        .setGravityScale(rigid.useGravity ? 1 : 0)
        .setCcdEnabled(rigid.continuous)
        .enabledRotations(
          !rigid.freezeRotation[0],
          !rigid.freezeRotation[1],
          !rigid.freezeRotation[2],
        );
    }
    const body = this.world.createRigidBody(description);
    const entry: BodyEntry = {
      owner,
      body,
      kind,
      signature,
      colliders: [],
      lastPosition: position.clone(),
      lastQuaternion: quaternion.clone(),
      motion: new Vector3(),
    };
    const ownerInverse = owner.object3d.matrixWorld.clone().invert();
    // Distribute the Rigidbody's mass over its colliders by volume (Unity: mass per body).
    const pending: { member: GameObject; state: ColliderState; volume: number }[] = [];
    for (const member of members) {
      for (const state of colliderRegistry.get(member) ?? []) {
        if (state.enabled) pending.push({ member, state, volume: this.volumeOf(member, state) });
      }
    }
    const totalVolume = pending.reduce((sum, item) => sum + item.volume, 0) || 1;
    for (const { member, state, volume } of pending) {
      const collider = this.createCollider(
        entry,
        member,
        ownerInverse,
        state,
        rigid && kind === 'dynamic' ? (rigid.mass * volume) / totalVolume : null,
      );
      if (collider) entry.colliders.push(collider);
    }
    const character = characterRegistry.get(owner);
    if (kind === 'character' && character && !pending.some((item) => item.member === owner)) {
      const scale = new Vector3().setFromMatrixScale(owner.object3d.matrixWorld);
      const radius = character.radius * Math.max(Math.abs(scale.x), Math.abs(scale.z));
      const half = Math.max(0.01, (character.height * Math.abs(scale.y)) / 2 - radius);
      const desc = rapier.ColliderDesc.capsule(half, radius)
        .setTranslation(
          character.center[0] * scale.x,
          character.center[1] * scale.y + character.skin,
          character.center[2] * scale.z,
        )
        .setCollisionGroups(this.groupsOf(owner))
        .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
        .setActiveCollisionTypes(rapier.ActiveCollisionTypes.ALL);
      const collider = this.world.createCollider(desc, body);
      this.colliderOwners.set(collider.handle, owner);
      entry.colliders.push(collider);
    }
    if (rigid && kind === 'dynamic' && entry.colliders.length === 0) {
      body.setAdditionalMass(rigid.mass, true);
    }
    this.entries.set(owner, entry);
    return entry;
  }

  private groupsOf(object: GameObject): number {
    const membership = this.layerBits.get(object.layer) ?? 1;
    const filter = this.layerFilters.get(object.layer) ?? 0xffff;
    return (membership << 16) | filter;
  }

  private volumeOf(member: GameObject, state: ColliderState): number {
    const scale = new Vector3().setFromMatrixScale(member.object3d.matrixWorld);
    const s = Math.abs(scale.x * scale.y * scale.z);
    const shape = state.shape;
    switch (shape.kind) {
      case 'box':
        return Math.abs(shape.size[0] * shape.size[1] * shape.size[2]) * s;
      case 'sphere':
        return (4 / 3) * Math.PI * shape.radius ** 3 * s;
      case 'capsule':
      case 'cylinder':
        return Math.PI * shape.radius ** 2 * shape.height * s;
      case 'heightfield':
        return shape.size * shape.size * Math.max(0.01, shape.maxHeight - shape.minHeight) * s;
      case 'mesh': {
        const bounds = meshData(member.object3d)?.bounds;
        const size = bounds ? bounds.getSize(new Vector3()) : new Vector3(1, 1, 1);
        return size.x * size.y * size.z * s;
      }
    }
  }

  private createCollider(
    entry: BodyEntry,
    member: GameObject,
    ownerInverse: Matrix4,
    state: ColliderState,
    mass: number | null,
  ): Collider | null {
    const rapier = this.rapier;
    const relative = ownerInverse.clone().multiply(member.object3d.matrixWorld);
    const offset = new Vector3();
    const rotation = new Quaternion();
    const relativeScale = new Vector3();
    relative.decompose(offset, rotation, relativeScale);
    const worldScale = new Vector3().setFromMatrixScale(member.object3d.matrixWorld);
    const sx = Math.abs(worldScale.x);
    const sy = Math.abs(worldScale.y);
    const sz = Math.abs(worldScale.z);
    const shape = state.shape;
    const center = new Vector3(shape.center[0] * sx, shape.center[1] * sy, shape.center[2] * sz);
    let description;
    switch (shape.kind) {
      case 'box':
        description = rapier.ColliderDesc.cuboid(
          Math.max(0.001, (Math.abs(shape.size[0]) * sx) / 2),
          Math.max(0.001, (Math.abs(shape.size[1]) * sy) / 2),
          Math.max(0.001, (Math.abs(shape.size[2]) * sz) / 2),
        );
        break;
      case 'sphere':
        description = rapier.ColliderDesc.ball(
          Math.max(0.001, shape.radius * Math.max(sx, sy, sz)),
        );
        break;
      case 'capsule': {
        const radius = Math.max(0.001, shape.radius * Math.max(sx, sz));
        description = rapier.ColliderDesc.capsule(
          Math.max(0, (shape.height * sy) / 2 - radius),
          radius,
        );
        break;
      }
      case 'cylinder':
        description = rapier.ColliderDesc.cylinder(
          Math.max(0.001, (shape.height * sy) / 2),
          Math.max(0.001, shape.radius * Math.max(sx, sz)),
        );
        break;
      case 'heightfield': {
        // Rapier wants the heights column by column (index = x * resolution + z).
        const n = shape.resolution;
        const heights = new Float32Array(n * n);
        for (let gz = 0; gz < n; gz++) {
          for (let gx = 0; gx < n; gx++) {
            heights[gx * n + gz] = (shape.heights[gz * n + gx] ?? 0) * sy;
          }
        }
        description = rapier.ColliderDesc.heightfield(n - 1, n - 1, heights, {
          x: shape.size * sx,
          y: 1,
          z: shape.size * sz,
        });
        break;
      }
      case 'mesh': {
        const data = meshData(member.object3d);
        if (!data) return null;
        const vertices = new Float32Array(data.vertices.length);
        for (let index = 0; index < data.vertices.length; index += 3) {
          vertices[index] = (data.vertices[index] ?? 0) * sx;
          vertices[index + 1] = (data.vertices[index + 1] ?? 0) * sy;
          vertices[index + 2] = (data.vertices[index + 2] ?? 0) * sz;
        }
        // Moving bodies need convex shapes (Unity does the same for non-kinematic bodies).
        description =
          shape.convex || entry.kind === 'dynamic'
            ? rapier.ColliderDesc.convexHull(vertices)
            : rapier.ColliderDesc.trimesh(vertices, data.indices);
        if (!description) return null;
        break;
      }
    }
    // The center is in the object's (unrotated) local frame; rotate it with the object.
    offset.add(center.applyQuaternion(rotation));
    description
      .setTranslation(offset.x, offset.y, offset.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
      .setSensor(state.isTrigger)
      .setFriction(state.friction)
      .setRestitution(state.bounciness)
      .setCollisionGroups(this.groupsOf(member))
      .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
      .setActiveCollisionTypes(rapier.ActiveCollisionTypes.ALL);
    if (mass !== null && !state.isTrigger) description.setMass(Math.max(mass, 0.0001));
    else if (state.isTrigger) description.setDensity(0);
    const collider = this.world.createCollider(description, entry.body);
    this.colliderOwners.set(collider.handle, member);
    return collider;
  }

  private removeEntry(entry: BodyEntry): void {
    for (const collider of entry.colliders) this.colliderOwners.delete(collider.handle);
    this.world.removeRigidBody(entry.body);
    this.entries.delete(entry.owner);
  }

  /** Moves bodies whose objects were moved by scripts, animations or controllers. */
  private syncPose(entry: BodyEntry): void {
    const position = new Vector3();
    const quaternion = new Quaternion();
    entry.owner.object3d.updateWorldMatrix(true, false);
    entry.owner.object3d.matrixWorld.decompose(position, quaternion, new Vector3());
    const moved =
      position.distanceToSquared(entry.lastPosition) > POSITION_EPSILON ||
      quaternionChanged(quaternion, entry.lastQuaternion);
    const translation = { x: position.x, y: position.y, z: position.z };
    const rotation = { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w };
    switch (entry.kind) {
      case 'dynamic':
        if (moved) {
          entry.body.setTranslation(translation, true);
          entry.body.setRotation(rotation, true);
        }
        break;
      case 'static':
        if (!moved) break;
        // Something moves this fixed collider: it becomes kinematic (pushes and carries).
        entry.body.setBodyType(this.rapier.RigidBodyType.KinematicPositionBased, true);
        entry.kind = 'moving';
        entry.motion.copy(position).sub(entry.lastPosition);
        entry.body.setNextKinematicTranslation(translation);
        entry.body.setNextKinematicRotation(rotation);
        break;
      case 'moving':
      case 'kinematic':
        if (moved) entry.motion.copy(position).sub(entry.lastPosition);
        entry.body.setNextKinematicTranslation(translation);
        entry.body.setNextKinematicRotation(rotation);
        break;
      case 'character':
        // Characters move with moveCharacter; anything else (teleport, turning) is applied as is.
        if (moved) {
          entry.body.setTranslation(translation, true);
          entry.body.setRotation(rotation, true);
          entry.body.setNextKinematicTranslation(translation);
          entry.body.setNextKinematicRotation(rotation);
        }
        break;
    }
    entry.lastPosition.copy(position);
    entry.lastQuaternion.copy(quaternion);
  }

  /** Writes the pose of a dynamic body into its object (keeping the object's scale). */
  private writeBack(entry: BodyEntry): void {
    const t = entry.body.translation();
    const r = entry.body.rotation();
    const position = new Vector3(t.x, t.y, t.z);
    const quaternion = new Quaternion(r.x, r.y, r.z, r.w);
    setWorldPose(entry.owner, position, quaternion);
    entry.lastPosition.copy(position);
    entry.lastQuaternion.copy(quaternion);
  }
}

/** Places an object at a world position and rotation (its scale stays). */
export function setWorldPose(object: GameObject, position: Vector3, quaternion: Quaternion): void {
  const node = object.object3d;
  const parent = node.parent;
  if (!parent) {
    node.position.copy(position);
    node.quaternion.copy(quaternion);
    return;
  }
  parent.updateWorldMatrix(true, false);
  const parentInverse = parent.matrixWorld.clone().invert();
  const parentRotation = new Quaternion();
  parent.matrixWorld.decompose(new Vector3(), parentRotation, new Vector3());
  node.position.copy(position).applyMatrix4(parentInverse);
  node.quaternion.copy(parentRotation.invert().multiply(quaternion));
  node.updateMatrix();
}
