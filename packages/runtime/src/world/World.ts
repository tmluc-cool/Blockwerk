import type { ComponentData, SceneData, SceneObjectData } from '@blockwerk/project';
import { Euler, MathUtils, Scene, Vector3 } from 'three';
import type { Object3D, PerspectiveCamera } from 'three';
import { cameraRegistry } from '../components/camera';
import type { CameraEntry } from '../components/camera';
import { resolveValues } from '../components/defineComponent';
import { getComponentDefinition } from '../components';
import { Environment } from '../environment/Environment';
import { InstanceBatcher } from '../models/InstanceBatcher';
import type { ModelCache } from '../models/ModelCache';
import type { ModelTemplate } from '../models/ModelCache';
import { GameObject } from './GameObject';
import type { ComponentInstance } from './GameObject';

/** Options for {@link World}. */
export interface WorldOptions {
  /** Name shown for objects whose stored name is `null` (built-in area roots). */
  readonly displayName?: (id: string, data: SceneObjectData) => string;
  /** Called for components whose type is unknown (e.g. from a newer version). */
  readonly onUnknownComponent?: (objectId: string, component: ComponentData) => void;
  /** Loads models referenced by Mesh Renderers. Without it, only built-in shapes are shown. */
  readonly models?: ModelCache;
  /** Called when a model finished loading and the world looks different (views re-render). */
  readonly onModelLoaded?: () => void;
}

const FORWARD = new Vector3(0, 0, 1);

/** Applies a stored transform (rotation in degrees, Unity order Z-X-Y) to an object. */
export function applyTransformData(object: GameObject, data: SceneObjectData): void {
  const { position, rotation, scale } = data.transform;
  object.object3d.position.set(...position);
  object.object3d.rotation.copy(
    new Euler(
      MathUtils.degToRad(rotation[0]),
      MathUtils.degToRad(rotation[1]),
      MathUtils.degToRad(rotation[2]),
      'YXZ',
    ),
  );
  object.object3d.scale.set(...scale);
  object.baseScale.set(...scale);
}

/**
 * A scene brought to life: game objects with their components in a three.js scene, plus sky,
 * ambient light and fog. The editor keeps one world per view in sync with the scene data;
 * play mode creates a fresh world from a copy of the data.
 */
export class World {
  readonly scene = new Scene();
  readonly environment: Environment;
  readonly objects = new Map<string, GameObject>();
  /** Root objects in hierarchy order. */
  readonly roots: GameObject[] = [];
  private data: SceneData;
  private sunOwner: GameObject | null = null;
  private readonly options: WorldOptions;
  /** Draws equal model meshes together (automatic instancing). */
  readonly batcher: InstanceBatcher;
  private readonly pendingModels = new Set<Promise<unknown>>();

  constructor(data: SceneData, options: WorldOptions = {}) {
    this.options = options;
    this.environment = new Environment({ groundSize: 0 });
    this.environment.addTo(this.scene);
    this.batcher = new InstanceBatcher(this.scene);
    this.data = { ...data, objects: {} };
    this.sync(data);
  }

  /** The scene data the world currently shows. */
  get sceneData(): SceneData {
    return this.data;
  }

  /**
   * Brings the world in line with new scene data. Only objects whose data object changed
   * (by reference) are updated, so editing is cheap.
   */
  sync(next: SceneData): void {
    const previous = this.data;
    for (const id of Object.keys(previous.objects)) {
      if (!(id in next.objects)) this.removeObject(id);
    }
    let hierarchyChanged = false;
    for (const [id, objectData] of Object.entries(next.objects)) {
      const before = previous.objects[id];
      if (before === objectData) continue;
      let object = this.objects.get(id);
      if (!object) {
        object = new GameObject({ id, name: this.nameOf(id, objectData) });
        this.objects.set(id, object);
        hierarchyChanged = true;
      }
      if (!before || before.parent !== objectData.parent || before.order !== objectData.order) {
        hierarchyChanged = true;
      }
      this.updateObject(object, objectData, before);
    }
    this.data = next;
    if (hierarchyChanged) this.rebuildHierarchy();
    if (previous.environment !== next.environment) this.applyEnvironment();
    this.updateSun();
  }

  /** Looks up an object by ID. */
  getObject(id: string): GameObject | undefined {
    return this.objects.get(id);
  }

  /** The game object a scene graph node belongs to (for picking with the mouse). */
  objectFromNode(node: Object3D | null): GameObject | undefined {
    for (let current = node; current; current = current.parent) {
      const id: unknown = current.userData['gameObjectId'];
      if (typeof id === 'string') return this.objects.get(id);
    }
    return undefined;
  }

  /** All objects in hierarchy order (depth first). */
  *allObjects(): Generator<GameObject> {
    for (const root of this.roots) yield* root.descendantsAndSelf();
  }

  /** The camera that renders the game: the first enabled camera on an active object. */
  activeCamera(): PerspectiveCamera | null {
    for (const object of this.allObjects()) {
      if (!object.activeInHierarchy) continue;
      const entry = cameraRegistry.get(object);
      if (entry?.enabled) return entry.camera;
    }
    return null;
  }

  /**
   * The cameras of the game view: one shared camera, or one per player for split screen when
   * active cameras are set to player 1 and player 2.
   */
  viewCameras(): {
    readonly views: readonly {
      readonly camera: PerspectiveCamera;
      readonly player: 'all' | '1' | '2';
      /** Seconds of the transition when this camera takes over. */
      readonly blendTime: number;
    }[];
    readonly split: 'horizontal' | 'vertical';
  } {
    const found = new Map<'all' | '1' | '2', CameraEntry>();
    for (const object of this.allObjects()) {
      if (!object.activeInHierarchy) continue;
      const entry = cameraRegistry.get(object);
      if (entry?.enabled && !found.has(entry.player)) found.set(entry.player, entry);
    }
    const one = found.get('1');
    const two = found.get('2');
    if (one && two) {
      return {
        views: [
          { camera: one.camera, player: '1', blendTime: one.blendTime },
          { camera: two.camera, player: '2', blendTime: two.blendTime },
        ],
        split: one.split,
      };
    }
    const single = found.get('all') ?? one ?? two;
    return {
      views: single
        ? [{ camera: single.camera, player: single.player, blendTime: single.blendTime }]
        : [],
      split: 'vertical',
    };
  }

  /** The camera entry that shows a player (for camera-relative controls and camera blocks). */
  cameraEntryForPlayer(player: 1 | 2): CameraEntry | null {
    let shared: CameraEntry | null = null;
    for (const object of this.allObjects()) {
      if (!object.activeInHierarchy) continue;
      const entry = cameraRegistry.get(object);
      if (!entry?.enabled) continue;
      if (entry.player === String(player)) return entry;
      shared ??= entry.player === 'all' ? entry : null;
    }
    return shared;
  }

  /** The camera that shows a player (for camera-relative controls). */
  cameraForPlayer(player: 1 | 2): PerspectiveCamera | null {
    return this.cameraEntryForPlayer(player)?.camera ?? null;
  }

  /** Called by light components: the first directional light becomes the sun of the sky. */
  claimSun(owner: GameObject): boolean {
    if (this.sunOwner && this.sunOwner !== owner) return false;
    this.sunOwner = owner;
    this.environment.sun.visible = true;
    return true;
  }

  /** Called by light components when they stop being the sun. */
  releaseSun(owner: GameObject): void {
    if (this.sunOwner !== owner) return;
    this.sunOwner = null;
    this.environment.sun.visible = false;
  }

  /** Follows the sun object's rotation. Call before rendering. */
  updateSun(): void {
    const owner = this.sunOwner;
    if (!owner) {
      this.environment.sun.visible = false;
      return;
    }
    owner.object3d.updateWorldMatrix(true, false);
    const shining = FORWARD.clone().transformDirection(owner.object3d.matrixWorld);
    this.environment.setSunDirection(shining.negate());
    this.environment.sun.visible = owner.activeInHierarchy;
  }

  /** Brings everything that is derived per frame up to date (sun, instancing). Call before rendering. */
  prepareRender(): void {
    this.updateSun();
    this.batcher.update();
  }

  /**
   * Requests a model. `onLoaded` runs right away if the model is already loaded, otherwise once
   * it has loaded (with `null` if it could not be loaded).
   */
  requestModel(ref: string, onLoaded: (template: ModelTemplate | null) => void): void {
    const cache = this.options.models;
    if (!cache) {
      onLoaded(null);
      return;
    }
    const ready = cache.peek(ref);
    if (ready !== undefined) {
      onLoaded(ready);
      return;
    }
    const pending = cache.load(ref).then((template) => {
      this.pendingModels.delete(pending);
      onLoaded(template);
      this.options.onModelLoaded?.();
    });
    this.pendingModels.add(pending);
  }

  /** Resolves once all models requested so far have loaded (or failed). */
  async modelsLoaded(): Promise<void> {
    while (this.pendingModels.size > 0) await Promise.all([...this.pendingModels]);
  }

  /** Adds a component instance to an object from its data. */
  addComponent(object: GameObject, data: ComponentData): ComponentInstance | null {
    const instance = this.createComponent(object, data);
    if (instance) object.components.push(instance);
    return instance;
  }

  private createComponent(object: GameObject, data: ComponentData): ComponentInstance | null {
    const definition = getComponentDefinition(data.type);
    if (!definition) {
      this.options.onUnknownComponent?.(object.id, data);
      return null;
    }
    const values = resolveValues(definition, data.values);
    const behavior = definition.create({ object, world: this }, values);
    behavior.apply(values);
    behavior.setEnabled?.(data.enabled);
    return { id: data.id, definition, behavior, values, enabled: data.enabled };
  }

  /** Removes an object and its children from the world. */
  removeObject(id: string): void {
    const object = this.objects.get(id);
    if (!object) return;
    for (const child of [...object.children]) this.removeObject(child.id);
    for (const component of object.components) component.behavior.destroy();
    object.components.length = 0;
    object.removeFromParent();
    const rootIndex = this.roots.indexOf(object);
    if (rootIndex >= 0) this.roots.splice(rootIndex, 1);
    object.destroyed = true;
    this.objects.delete(id);
  }

  /** Releases all resources. */
  dispose(): void {
    for (const id of [...this.objects.keys()]) this.removeObject(id);
    this.batcher.dispose();
    this.environment.dispose();
  }

  /** Adds a runtime-created object (e.g. a clone in play mode) under a parent or at the root. */
  adoptObject(object: GameObject, parent: GameObject | null): void {
    this.objects.set(object.id, object);
    if (parent) {
      parent.addChild(object);
    } else {
      this.roots.push(object);
      this.scene.add(object.object3d);
    }
  }

  private nameOf(id: string, data: SceneObjectData): string {
    return data.name ?? this.options.displayName?.(id, data) ?? '';
  }

  private updateObject(
    object: GameObject,
    data: SceneObjectData,
    before: SceneObjectData | undefined,
  ): void {
    object.name = this.nameOf(object.id, data);
    object.object3d.name = object.name;
    object.tag = data.tag;
    object.layer = data.layer;
    object.setActive(data.active);
    applyTransformData(object, data);
    if (before?.components === data.components) return;
    const previous = new Map(object.components.map((component) => [component.id, component]));
    const next: ComponentInstance[] = [];
    for (const componentData of data.components) {
      const existing = previous.get(componentData.id);
      if (existing && existing.definition.type === componentData.type) {
        previous.delete(componentData.id);
        const old = before?.components.find((component) => component.id === componentData.id);
        if (old !== componentData) {
          existing.values = resolveValues(existing.definition, componentData.values);
          existing.behavior.apply(existing.values);
          existing.enabled = componentData.enabled;
          existing.behavior.setEnabled?.(componentData.enabled);
        }
        next.push(existing);
      } else {
        const created = this.createComponent(object, componentData);
        if (created) next.push(created);
      }
    }
    for (const removed of previous.values()) removed.behavior.destroy();
    object.components.length = 0;
    object.components.push(...next);
  }

  private rebuildHierarchy(): void {
    const byParent = new Map<string | null, [number, GameObject][]>();
    for (const [id, data] of Object.entries(this.data.objects)) {
      const object = this.objects.get(id);
      if (!object) continue;
      const parentId = data.parent && this.data.objects[data.parent] ? data.parent : null;
      const siblings = byParent.get(parentId) ?? [];
      siblings.push([data.order, object]);
      byParent.set(parentId, siblings);
    }
    // Runtime-created objects (clones) keep their place.
    const dataIds = new Set(Object.keys(this.data.objects));
    this.roots.splice(0, this.roots.length, ...this.roots.filter((root) => !dataIds.has(root.id)));
    const attach = (parentId: string | null): void => {
      const siblings = (byParent.get(parentId) ?? []).sort(
        (a, b) => a[0] - b[0] || a[1].id.localeCompare(b[1].id),
      );
      const parent = parentId ? this.objects.get(parentId) : undefined;
      for (const [, object] of siblings) {
        if (parent) {
          parent.addChild(object);
        } else {
          object.removeFromParent();
          this.roots.push(object);
          this.scene.add(object.object3d);
        }
        attach(object.id);
      }
    };
    attach(null);
  }

  private applyEnvironment(): void {
    const environment = this.data.environment;
    this.environment.setAmbientIntensity(environment.ambientIntensity);
    this.environment.setFog(environment.fog.enabled, environment.fog.near, environment.fog.far);
  }
}
