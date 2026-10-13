import { createId } from '@blockwerk/project';
import type {
  AreaKindData,
  ComponentData,
  JsonValue,
  SceneData,
  SceneObjectData,
  TransformData,
  Vec3,
} from '@blockwerk/project';
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

/**
 * Pure operations on scene data. Every function returns new data and leaves its input
 * untouched; unchanged objects keep their identity, so views only update what changed.
 */

/** Decimal places kept for transform values computed by the editor (0.01 mm). */
const PRECISION = 5;

function round(value: number): number {
  const factor = 10 ** PRECISION;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundVec(values: readonly number[]): Vec3 {
  return [round(values[0] ?? 0), round(values[1] ?? 0), round(values[2] ?? 0)];
}

/** Child IDs of an object (or of the scene root for `null`), in hierarchy order. */
export function childIds(scene: SceneData, parent: string | null): string[] {
  return Object.entries(scene.objects)
    .filter(([, object]) => object.parent === parent)
    .sort(([idA, a], [idB, b]) => a.order - b.order || idA.localeCompare(idB))
    .map(([id]) => id);
}

/** An object and all objects below it, depth first. */
export function subtreeIds(scene: SceneData, id: string): string[] {
  return [id, ...childIds(scene, id).flatMap((child) => subtreeIds(scene, child))];
}

/** All object IDs in hierarchy order (depth first). */
export function hierarchyOrder(scene: SceneData): string[] {
  return childIds(scene, null).flatMap((id) => subtreeIds(scene, id));
}

/** Whether `id` is `ancestor` or below it. */
export function isInSubtree(scene: SceneData, id: string, ancestor: string): boolean {
  for (let current: string | null = id; current; current = scene.objects[current]?.parent ?? null) {
    if (current === ancestor) return true;
  }
  return false;
}

/** Area root objects in tab order. */
export function areaRoots(scene: SceneData): { id: string; object: SceneObjectData }[] {
  return childIds(scene, null)
    .map((id) => ({ id, object: scene.objects[id] }))
    .filter((entry): entry is { id: string; object: SceneObjectData } => !!entry.object?.area);
}

/** The area root above an object (or the object itself), if any. */
export function areaRootOf(scene: SceneData, id: string): string | null {
  let current: string | null = id;
  let last: string | null = null;
  while (current) {
    last = current;
    current = scene.objects[current]?.parent ?? null;
  }
  return last && scene.objects[last]?.area ? last : null;
}

/** Keeps only the topmost IDs of a selection (children of selected objects move with them). */
export function topmost(scene: SceneData, ids: readonly string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    for (
      let parent = scene.objects[id]?.parent ?? null;
      parent;
      parent = scene.objects[parent]?.parent ?? null
    ) {
      if (set.has(parent)) return false;
    }
    return id in scene.objects;
  });
}

function withObjects(scene: SceneData, objects: Record<string, SceneObjectData>): SceneData {
  return { ...scene, objects };
}

/** Applies `update` to some objects. Objects where it returns the same data stay untouched. */
export function updateObjects(
  scene: SceneData,
  ids: readonly string[],
  update: (object: SceneObjectData, id: string) => SceneObjectData,
): SceneData {
  let objects: Record<string, SceneObjectData> | null = null;
  for (const id of ids) {
    const object = scene.objects[id];
    if (!object) continue;
    const next = update(object, id);
    if (next === object) continue;
    objects ??= { ...scene.objects };
    objects[id] = next;
  }
  return objects ? withObjects(scene, objects) : scene;
}

const IDENTITY: TransformData = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

/** Options for {@link createObject}. */
export interface NewObject {
  readonly name: string;
  readonly parent: string | null;
  readonly components?: readonly Omit<ComponentData, 'id'>[];
  readonly transform?: TransformData;
  readonly area?: AreaKindData;
  readonly tag?: string;
}

/** Adds an object as last child of its parent. */
export function createObject(
  scene: SceneData,
  options: NewObject,
): { scene: SceneData; id: string } {
  const id = createId();
  const siblings = childIds(scene, options.parent);
  const lastOrder =
    siblings.length > 0 ? (scene.objects[siblings[siblings.length - 1] ?? '']?.order ?? 0) : -1;
  const object: SceneObjectData = {
    name: options.area && options.area !== 'custom' ? null : options.name,
    parent: options.parent,
    order: Math.floor(lastOrder) + 1,
    active: true,
    tag: options.tag ?? 'Untagged',
    layer: 'Default',
    static: false,
    ...(options.area ? { area: options.area } : {}),
    transform: options.transform ?? IDENTITY,
    components: (options.components ?? []).map((component) => ({ ...component, id: createId() })),
  };
  return { scene: withObjects(scene, { ...scene.objects, [id]: object }), id };
}

/** Deletes objects with everything below them. */
export function deleteObjects(scene: SceneData, ids: readonly string[]): SceneData {
  const doomed = new Set(
    ids.filter((id) => id in scene.objects).flatMap((id) => subtreeIds(scene, id)),
  );
  if (doomed.size === 0) return scene;
  const objects = Object.fromEntries(
    Object.entries(scene.objects).filter(([id]) => !doomed.has(id)),
  );
  return withObjects(scene, objects);
}

/** Unity-style copy name: `Cube` → `Cube (1)`, `Cube (1)` → `Cube (2)`, skipping taken names. */
export function copyName(name: string, taken: ReadonlySet<string>): string {
  const match = /^(.*) \((\d+)\)$/.exec(name);
  const base = match ? (match[1] ?? name) : name;
  let index = match ? Number(match[2]) + 1 : 1;
  while (taken.has(`${base} (${index})`)) index++;
  return `${base} (${index})`;
}

/**
 * Duplicates objects with their children (Ctrl+D). Copies get new IDs and are placed right
 * after their originals. Returns the IDs of the top-level copies.
 */
export function duplicateObjects(
  scene: SceneData,
  ids: readonly string[],
): { scene: SceneData; ids: string[] } {
  const objects = { ...scene.objects };
  const copies: string[] = [];
  for (const id of topmost(scene, ids)) {
    const original = scene.objects[id];
    if (!original) continue;
    const siblingNames = new Set(
      Object.values(objects)
        .filter((object) => object.parent === original.parent)
        .map((object) => object.name ?? ''),
    );
    const mapping = new Map<string, string>();
    for (const sourceId of subtreeIds(scene, id)) mapping.set(sourceId, createId());
    for (const [sourceId, copyId] of mapping) {
      const source = scene.objects[sourceId];
      if (!source) continue;
      const isTop = sourceId === id;
      const copy: SceneObjectData = {
        ...source,
        parent: isTop ? source.parent : (mapping.get(source.parent ?? '') ?? source.parent),
        // Right after the original: fractional orders are normalized by later moves.
        order: isTop ? source.order + 0.5 : source.order,
        name: isTop && source.name !== null ? copyName(source.name, siblingNames) : source.name,
        components: source.components.map((component) => ({ ...component, id: createId() })),
      };
      // Built-in area roots are unique; their copies become ordinary custom areas.
      if (copy.area && copy.area !== 'custom') {
        Reflect.deleteProperty(copy, 'area');
        copy.name = copyName(source.name ?? 'Area', siblingNames);
      }
      objects[copyId] = copy;
    }
    const top = mapping.get(id);
    if (top) copies.push(top);
  }
  return { scene: normalizeOrders(withObjects(scene, objects)), ids: copies };
}

/** Renumbers sibling orders 0, 1, 2 … where they are not already whole consecutive numbers. */
export function normalizeOrders(scene: SceneData): SceneData {
  const parents = new Set<string | null>(
    Object.values(scene.objects).map((object) => object.parent),
  );
  let result = scene;
  for (const parent of parents) {
    const ids = childIds(result, parent);
    result = updateObjects(result, ids, (object, id) => {
      const order = ids.indexOf(id);
      return object.order === order ? object : { ...object, order };
    });
  }
  return result;
}

/** Local matrix of a stored transform (rotation in degrees, Unity order Z-X-Y). */
export function localMatrix(transform: TransformData): Matrix4 {
  const [rx, ry, rz] = transform.rotation;
  const rotation = new Quaternion().setFromEuler(
    new Euler(MathUtils.degToRad(rx), MathUtils.degToRad(ry), MathUtils.degToRad(rz), 'YXZ'),
  );
  return new Matrix4().compose(
    new Vector3(...transform.position),
    rotation,
    new Vector3(...transform.scale),
  );
}

/** World matrix of an object. */
export function worldMatrix(scene: SceneData, id: string | null): Matrix4 {
  const matrix = new Matrix4();
  for (let current = id; current; current = scene.objects[current]?.parent ?? null) {
    const object = scene.objects[current];
    if (!object) break;
    matrix.premultiply(localMatrix(object.transform));
  }
  return matrix;
}

/** Converts a matrix back to a stored transform (rounded to 0.01 mm / 0.00001°). */
export function transformFromMatrix(matrix: Matrix4): TransformData {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  const euler = new Euler().setFromQuaternion(rotation, 'YXZ');
  return {
    position: roundVec(position.toArray()),
    rotation: roundVec([euler.x, euler.y, euler.z].map((radians) => MathUtils.radToDeg(radians))),
    scale: roundVec(scale.toArray()),
  };
}

/** Where to drop objects in the hierarchy. */
export type DropTarget =
  | { readonly kind: 'inside'; readonly parent: string | null }
  | { readonly kind: 'before' | 'after'; readonly sibling: string };

/**
 * Moves objects in the hierarchy (drag and drop). Objects keep their place in the world,
 * like in Unity. Moves into an object's own children are ignored.
 */
export function moveObjects(
  scene: SceneData,
  ids: readonly string[],
  target: DropTarget,
): SceneData {
  const parent =
    target.kind === 'inside' ? target.parent : (scene.objects[target.sibling]?.parent ?? null);
  const moving = topmost(scene, ids).filter((id) => !(parent && isInSubtree(scene, parent, id)));
  if (moving.length === 0 || (target.kind !== 'inside' && moving.includes(target.sibling))) {
    return scene;
  }
  const parentInverse = worldMatrix(scene, parent).invert();
  let result = updateObjects(scene, moving, (object, id) => {
    if (object.parent === parent) return object;
    const world = worldMatrix(scene, id);
    return { ...object, parent, transform: transformFromMatrix(world.premultiply(parentInverse)) };
  });
  const siblings = childIds(result, parent).filter((id) => !moving.includes(id));
  let index = siblings.length;
  if (target.kind !== 'inside') {
    const position = siblings.indexOf(target.sibling);
    index = position < 0 ? siblings.length : position + (target.kind === 'after' ? 1 : 0);
  }
  siblings.splice(index, 0, ...moving);
  result = updateObjects(result, siblings, (object, id) => {
    const order = siblings.indexOf(id);
    return object.order === order ? object : { ...object, order };
  });
  return result;
}

/** Which part of the transform a value belongs to. */
export type TransformPart = keyof TransformData;

/** Sets one axis of position, rotation or scale on several objects. */
export function setTransformAxis(
  scene: SceneData,
  ids: readonly string[],
  part: TransformPart,
  axis: 0 | 1 | 2,
  value: number,
): SceneData {
  return updateObjects(scene, ids, (object) => {
    if (object.transform[part][axis] === value) return object;
    const vector = [...object.transform[part]] as [number, number, number];
    vector[axis] = value;
    return { ...object, transform: { ...object.transform, [part]: vector } };
  });
}

/** Sets whole transforms (gizmo drags). */
export function setTransforms(
  scene: SceneData,
  transforms: ReadonlyMap<string, TransformData>,
): SceneData {
  return updateObjects(scene, [...transforms.keys()], (object, id) => {
    const transform = transforms.get(id);
    return transform ? { ...object, transform } : object;
  });
}

/** Header fields of the inspector. */
export type HeaderField = 'name' | 'active' | 'static' | 'tag' | 'layer' | 'color';

/** Sets a header field on several objects. */
export function setHeaderField(
  scene: SceneData,
  ids: readonly string[],
  field: HeaderField,
  value: string | boolean,
): SceneData {
  return updateObjects(scene, ids, (object) =>
    object[field] === value ? object : { ...object, [field]: value },
  );
}

/** Adds a component to objects. Unique components are skipped where one exists. */
export function addComponent(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  unique: boolean,
  values: Readonly<Record<string, JsonValue>> = {},
): SceneData {
  return updateObjects(scene, ids, (object) => {
    if (unique && object.components.some((component) => component.type === type)) return object;
    const component: ComponentData = { id: createId(), type, enabled: true, values: { ...values } };
    return { ...object, components: [...object.components, component] };
  });
}

/**
 * Applies `update` to the `index`-th component of `type` on every object (multi-editing
 * works per type and position, like Unity).
 */
export function updateComponents(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  index: number,
  update: (
    component: ComponentData,
    components: readonly ComponentData[],
  ) => ComponentData[] | ComponentData,
): SceneData {
  return updateObjects(scene, ids, (object) => {
    const matching = object.components.filter((component) => component.type === type);
    const component = matching[index];
    if (!component) return object;
    const result = update(component, object.components);
    if (Array.isArray(result)) return { ...object, components: result };
    if (result === component) return object;
    return {
      ...object,
      components: object.components.map((item) => (item === component ? result : item)),
    };
  });
}

/** Sets a field value of a component. */
export function setComponentValue(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  index: number,
  field: string,
  value: JsonValue,
): SceneData {
  return updateComponents(scene, ids, type, index, (component) =>
    JSON.stringify(component.values[field]) === JSON.stringify(value)
      ? component
      : { ...component, values: { ...component.values, [field]: value } },
  );
}

/** Turns a component on or off. */
export function setComponentEnabled(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  index: number,
  enabled: boolean,
): SceneData {
  return updateComponents(scene, ids, type, index, (component) =>
    component.enabled === enabled ? component : { ...component, enabled },
  );
}

/** Removes a component. */
export function removeComponent(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  index: number,
): SceneData {
  return updateComponents(scene, ids, type, index, (component, components) =>
    components.filter((item) => item !== component),
  );
}

/** Resets all values of a component to the defaults. */
export function resetComponent(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  index: number,
): SceneData {
  return updateComponents(scene, ids, type, index, (component) => ({ ...component, values: {} }));
}

/** Replaces the values of a component (paste). */
export function pasteComponentValues(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  index: number,
  values: Readonly<Record<string, JsonValue>>,
): SceneData {
  return updateComponents(scene, ids, type, index, (component) => ({
    ...component,
    values: { ...values },
  }));
}

/** Moves a component one place up or down in the inspector. */
export function moveComponent(
  scene: SceneData,
  ids: readonly string[],
  type: string,
  index: number,
  direction: -1 | 1,
): SceneData {
  return updateComponents(scene, ids, type, index, (component, components) => {
    const from = components.indexOf(component);
    const to = from + direction;
    if (to < 0 || to >= components.length) return [...components];
    const result = [...components];
    result.splice(from, 1);
    result.splice(to, 0, component);
    return result;
  });
}
