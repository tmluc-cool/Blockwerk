import { stringifyDeterministic } from './json';
import { FORMAT_VERSION } from './schema';
import type {
  ComponentData,
  JsonValue,
  PrefabData,
  PrefabOverride,
  SceneObjectData,
  TransformData,
} from './schema';

/**
 * Prefabs like in Unity (SPEC 6.4). Instances are stored fully expanded in scenes, so the
 * runtime needs no prefab logic. Every object of an instance carries a link to its object in
 * the prefab; the instance root also carries the overrides (changed values). Whenever a prefab
 * changes, {@link syncPrefabInstances} rebuilds the instances from the prefab and re-applies
 * the overrides. Variants store only their overrides against the base; nested prefabs are
 * instances inside a prefab.
 */

/** Objects by ID, as in scenes and prefabs. */
export type ObjectMap = Readonly<Record<string, SceneObjectData>>;

/** Looks up the data of a prefab asset by ID. */
export type PrefabSource = (id: string) => PrefabData | undefined;

/** A prefab with its variant chain and nested prefabs applied. IDs are those of the prefab. */
export interface ResolvedPrefab {
  readonly root: string;
  readonly objects: ObjectMap;
}

/** Values of the root object that always belong to the instance (Unity does the same). */
export const IMPLICIT_ROOT_PATHS: ReadonlySet<string> = new Set([
  'name',
  'transform.position',
  'transform.rotation',
]);

const TRANSFORM_KEYS = ['position', 'rotation', 'scale'] as const;

function same(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return stringifyDeterministic(a) === stringifyDeterministic(b);
}

/** All overridable values of an object by path (see `prefabOverrideSchema`). */
export function objectValues(object: SceneObjectData): Map<string, JsonValue> {
  const values = new Map<string, JsonValue>([
    ['name', object.name],
    ['active', object.active],
    ['tag', object.tag],
    ['layer', object.layer],
    ['static', object.static],
  ]);
  for (const key of TRANSFORM_KEYS) values.set(`transform.${key}`, [...object.transform[key]]);
  for (const component of object.components) {
    values.set(`component:${component.id}:enabled`, component.enabled);
    for (const [field, value] of Object.entries(component.values)) {
      values.set(`component:${component.id}:${field}`, value);
    }
  }
  return values;
}

function isVec3(value: JsonValue): value is [number, number, number] {
  return (
    Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')
  );
}

/** Sets one value of an object by path. Unknown paths and wrong types are ignored. */
export function setObjectValue(
  object: SceneObjectData,
  path: string,
  value: JsonValue,
): SceneObjectData {
  switch (path) {
    case 'name':
      return typeof value === 'string' || value === null ? { ...object, name: value } : object;
    case 'active':
    case 'static':
      return typeof value === 'boolean' ? { ...object, [path]: value } : object;
    case 'tag':
    case 'layer':
      return typeof value === 'string' ? { ...object, [path]: value } : object;
  }
  if (path.startsWith('transform.')) {
    const key = path.slice('transform.'.length) as keyof TransformData;
    if (!TRANSFORM_KEYS.includes(key) || !isVec3(value)) return object;
    return { ...object, transform: { ...object.transform, [key]: [...value] } };
  }
  const match = /^component:([^:]+):(.+)$/.exec(path);
  if (!match) return object;
  const [, componentId, field] = match;
  let changed = false;
  const components = object.components.map((component): ComponentData => {
    if (component.id !== componentId) return component;
    changed = true;
    if (field === 'enabled') {
      return typeof value === 'boolean' ? { ...component, enabled: value } : component;
    }
    return { ...component, values: { ...component.values, [field as string]: value } };
  });
  return changed ? { ...object, components } : object;
}

/** Applies overrides to objects (keyed by the IDs the overrides use). */
export function applyOverrides(
  objects: ObjectMap,
  overrides: readonly PrefabOverride[],
): Record<string, SceneObjectData> {
  const result: Record<string, SceneObjectData> = { ...objects };
  for (const override of overrides) {
    const object = result[override.object];
    if (object) result[override.object] = setObjectValue(object, override.path, override.value);
  }
  return result;
}

/**
 * Differences of `edited` against `base` as overrides, for objects present in both. Values of
 * components missing in `base` are not overrides (added components stay on the object).
 */
export function diffObjects(
  base: ObjectMap,
  edited: ObjectMap,
  skip: (object: string, path: string) => boolean = () => false,
): PrefabOverride[] {
  const overrides: PrefabOverride[] = [];
  for (const [id, before] of Object.entries(base)) {
    const after = edited[id];
    if (!after) continue;
    const old = objectValues(before);
    for (const [path, value] of objectValues(after)) {
      if (!old.has(path) || skip(id, path)) continue;
      if (!same(old.get(path), value)) overrides.push({ object: id, path, value });
    }
  }
  return overrides.sort((a, b) => a.object.localeCompare(b.object) || a.path.localeCompare(b.path));
}

/** Children of every object, in hierarchy order. */
function childrenOf(objects: ObjectMap): Map<string | null, string[]> {
  const children = new Map<string | null, string[]>();
  for (const [id, object] of Object.entries(objects)) {
    const parent = object.parent !== null && objects[object.parent] ? object.parent : null;
    const list = children.get(parent) ?? [];
    list.push(id);
    children.set(parent, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => (objects[a]?.order ?? 0) - (objects[b]?.order ?? 0) || a.localeCompare(b));
  }
  return children;
}

/** Whether an object is the root of a prefab instance. */
export function isInstanceRoot(object: SceneObjectData | undefined): boolean {
  return object?.prefab?.overrides !== undefined;
}

/**
 * The objects of the instance whose root is `rootId`: the root and all descendants linked to
 * the same prefab, not crossing into other instances. Map: prefab object ID → object ID.
 */
export function instanceMembers(objects: ObjectMap, rootId: string): Map<string, string> {
  const root = objects[rootId];
  const members = new Map<string, string>();
  if (!root?.prefab) return members;
  const asset = root.prefab.asset;
  const children = childrenOf(objects);
  const visit = (id: string): void => {
    const object = objects[id];
    if (!object?.prefab || object.prefab.asset !== asset) return;
    if (id !== rootId && isInstanceRoot(object)) return;
    members.set(object.prefab.object, id);
    for (const child of children.get(id) ?? []) visit(child);
  };
  visit(rootId);
  return members;
}

/** The root of the instance an object belongs to, if any. */
export function instanceRootOf(objects: ObjectMap, id: string): string | null {
  let current: string | null = id;
  while (current !== null) {
    const object: SceneObjectData | undefined = objects[current];
    if (!object?.prefab) return null;
    if (isInstanceRoot(object)) return current;
    const parent: SceneObjectData | undefined =
      object.parent !== null ? objects[object.parent] : undefined;
    if (!parent?.prefab || parent.prefab.asset !== object.prefab.asset) return null;
    current = object.parent;
  }
  return null;
}

/**
 * Resolves a prefab: applies the variant chain (base objects, variant overrides, added objects)
 * and brings nested prefab instances up to date. Returns `undefined` for missing prefabs and
 * cycles (a prefab containing itself).
 */
export function resolvePrefab(
  id: string,
  source: PrefabSource,
  cache: Map<string, ResolvedPrefab | undefined> = new Map(),
  visiting: ReadonlySet<string> = new Set(),
): ResolvedPrefab | undefined {
  if (cache.has(id)) return cache.get(id);
  const data = source(id);
  if (!data || visiting.has(id)) return undefined;
  const inner = new Set(visiting).add(id);
  let resolved: ResolvedPrefab | undefined;
  if (data.base !== null) {
    const base = resolvePrefab(data.base, source, cache, inner);
    if (base) {
      const objects = applyOverrides({ ...base.objects, ...data.objects }, data.overrides);
      resolved = { root: base.root, objects };
    }
  } else {
    resolved = { root: data.root, objects: data.objects };
  }
  if (resolved) {
    resolved = {
      root: resolved.root,
      objects: syncWith(resolved.objects, source, cache, inner, nestedIds(id)),
    };
  }
  cache.set(id, resolved);
  return resolved;
}

/**
 * IDs for objects that appear in nested instances inside a prefab: derived from the outer
 * prefab, the instance root and the inner object, so resolving twice gives the same IDs.
 */
function nestedIds(prefabId: string): (rootId: string, object: string) => string {
  return (rootId, object) => derivedId(`${prefabId}/${rootId}/${object}`);
}

/** A stable 12-character ID derived from a text (FNV-1a, base 36). */
export function derivedId(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return (a.toString(36) + b.toString(36)).padStart(12, '0').slice(-12);
}

/** Options for {@link instantiatePrefab}. */
export interface InstantiateOptions {
  readonly parent: string | null;
  readonly order: number;
  /** Position and rotation of the instance root (default: as in the prefab). */
  readonly transform?: Pick<TransformData, 'position' | 'rotation'>;
  readonly createId: () => string;
}

/** Creates the objects of a new prefab instance. Returns the root ID and the new objects. */
export function instantiatePrefab(
  prefabId: string,
  resolved: ResolvedPrefab,
  options: InstantiateOptions,
): { rootId: string; objects: Record<string, SceneObjectData> } {
  const ids = new Map(Object.keys(resolved.objects).map((id) => [id, options.createId()]));
  const objects: Record<string, SceneObjectData> = {};
  for (const [prefabObject, object] of Object.entries(resolved.objects)) {
    const id = ids.get(prefabObject) ?? options.createId();
    const isRoot = prefabObject === resolved.root;
    objects[id] = {
      ...object,
      parent: isRoot ? options.parent : (ids.get(object.parent ?? '') ?? null),
      order: isRoot ? options.order : object.order,
      transform:
        isRoot && options.transform
          ? { ...object.transform, ...options.transform }
          : object.transform,
      prefab: isRoot
        ? { asset: prefabId, object: prefabObject, overrides: [] }
        : { asset: prefabId, object: prefabObject },
    };
  }
  return { rootId: ids.get(resolved.root) ?? '', objects };
}

/**
 * Rebuilds every prefab instance in `objects` from its prefab and re-applies its overrides
 * (after a prefab changed, and when loading). Objects added to an instance by the user and
 * components added to instance objects are kept. Unchanged objects keep their identity.
 */
export function syncPrefabInstances(
  objects: ObjectMap,
  source: PrefabSource,
  createId: () => string,
): Record<string, SceneObjectData> {
  return syncWith(objects, source, new Map(), new Set(), (_root, _object) => createId());
}

function syncWith(
  objects: ObjectMap,
  source: PrefabSource,
  cache: Map<string, ResolvedPrefab | undefined>,
  visiting: ReadonlySet<string>,
  newId: (rootId: string, object: string) => string,
): Record<string, SceneObjectData> {
  let result: Record<string, SceneObjectData> = { ...objects };
  const roots = Object.keys(objects).filter((id) => isInstanceRoot(objects[id]));
  for (const rootId of roots) {
    const root = result[rootId];
    if (!root?.prefab) continue;
    const resolved = resolvePrefab(root.prefab.asset, source, cache, visiting);
    if (!resolved) continue;
    result = syncInstance(result, rootId, root.prefab.asset, resolved, newId);
  }
  // Keep unchanged objects identical, so views and saving see no change.
  for (const [id, object] of Object.entries(result)) {
    const before = objects[id];
    if (
      before &&
      before !== object &&
      stringifyDeterministic(before) === stringifyDeterministic(object)
    ) {
      result[id] = before;
    }
  }
  return result;
}

function syncInstance(
  objects: Record<string, SceneObjectData>,
  rootId: string,
  asset: string,
  resolved: ResolvedPrefab,
  newId: (rootId: string, object: string) => string,
): Record<string, SceneObjectData> {
  const root = objects[rootId];
  if (!root?.prefab) return objects;
  const overrides = root.prefab.overrides ?? [];
  const members = instanceMembers(objects, rootId);
  members.set(resolved.root, rootId);
  const ids = new Map<string, string>();
  for (const prefabObject of Object.keys(resolved.objects)) {
    ids.set(prefabObject, members.get(prefabObject) ?? newId(rootId, prefabObject));
  }
  const expected = applyOverrides(resolved.objects, overrides);
  const result: Record<string, SceneObjectData> = { ...objects };
  for (const [prefabObject, id] of members) {
    if (id !== rootId && !(prefabObject in resolved.objects)) Reflect.deleteProperty(result, id);
  }
  for (const [prefabObject, object] of Object.entries(expected)) {
    const id = ids.get(prefabObject) ?? newId(rootId, prefabObject);
    const current = objects[id];
    const isRoot = prefabObject === resolved.root;
    const prefabComponents = new Set(object.components.map((component) => component.id));
    const added = (current?.components ?? []).filter(
      (component) => !prefabComponents.has(component.id),
    );
    result[id] = {
      ...object,
      name: isRoot ? root.name : object.name,
      parent: isRoot ? root.parent : (ids.get(object.parent ?? '') ?? rootId),
      order: isRoot ? root.order : object.order,
      transform: isRoot
        ? {
            ...object.transform,
            position: root.transform.position,
            rotation: root.transform.rotation,
          }
        : object.transform,
      components: [...object.components, ...added],
      prefab: isRoot ? { asset, object: prefabObject, overrides } : { asset, object: prefabObject },
    };
  }
  // Children the user added below removed prefab objects move to the instance root.
  for (const [id, object] of Object.entries(result)) {
    if (object.parent !== null && !(object.parent in result)) {
      result[id] = { ...object, parent: rootId };
    }
  }
  return result;
}

/**
 * Recomputes the overrides of an instance from its current objects (after the user edited
 * them). The root's name, position and rotation are never overrides.
 */
export function updateInstanceOverrides(
  objects: ObjectMap,
  rootId: string,
  source: PrefabSource,
): Record<string, SceneObjectData> {
  const root = objects[rootId];
  if (!root?.prefab || !isInstanceRoot(root)) return { ...objects };
  const resolved = resolvePrefab(root.prefab.asset, source);
  if (!resolved) return { ...objects };
  const members = instanceMembers(objects, rootId);
  const current: Record<string, SceneObjectData> = {};
  for (const [prefabObject, id] of members) {
    const object = objects[id];
    if (object) current[prefabObject] = object;
  }
  const overrides = diffObjects(
    resolved.objects,
    current,
    (object, path) => object === resolved.root && IMPLICIT_ROOT_PATHS.has(path),
  );
  const previous = root.prefab.overrides ?? [];
  if (stringifyDeterministic(previous) === stringifyDeterministic(overrides)) {
    return { ...objects };
  }
  return { ...objects, [rootId]: { ...root, prefab: { ...root.prefab, overrides } } };
}

/** Recomputes the overrides of every instance in `objects` (e.g. nested prefabs in a prefab). */
export function updateAllInstanceOverrides(
  objects: ObjectMap,
  source: PrefabSource,
): Record<string, SceneObjectData> {
  let result: Record<string, SceneObjectData> = { ...objects };
  for (const id of Object.keys(objects)) {
    if (isInstanceRoot(objects[id])) result = updateInstanceOverrides(result, id, source);
  }
  return result;
}

/** Removes overrides (all, or those matching `filter`) and rebuilds the instance. */
export function revertOverrides(
  objects: ObjectMap,
  rootId: string,
  source: PrefabSource,
  filter: (override: PrefabOverride) => boolean = () => true,
): Record<string, SceneObjectData> {
  const root = objects[rootId];
  if (!root?.prefab?.overrides) return { ...objects };
  const overrides = root.prefab.overrides.filter((override) => !filter(override));
  const updated = { ...objects, [rootId]: { ...root, prefab: { ...root.prefab, overrides } } };
  const resolved = resolvePrefab(root.prefab.asset, source);
  if (!resolved) return updated;
  return syncInstance(updated, rootId, root.prefab.asset, resolved, (instance, object) =>
    derivedId(`${instance}/${object}`),
  );
}

/** A prefab made from objects of a scene (Unity: drag into the project window). */
export function createPrefabData(
  objects: ObjectMap,
  rootId: string,
  createId: () => string,
): { prefab: PrefabData; links: Map<string, string> } {
  const subtree: string[] = [];
  const children = childrenOf(objects);
  const visit = (id: string): void => {
    subtree.push(id);
    for (const child of children.get(id) ?? []) visit(child);
  };
  visit(rootId);
  const links = new Map(subtree.map((id) => [id, createId()]));
  // Making a prefab from an instance root unpacks that instance (its objects become plain).
  const unpacked = isInstanceRoot(objects[rootId]) ? rootId : null;
  const prefabObjects: Record<string, SceneObjectData> = {};
  for (const id of subtree) {
    const object = objects[id];
    const prefabId = links.get(id);
    if (!object || !prefabId) continue;
    const isRoot = id === rootId;
    const copy: SceneObjectData = {
      ...object,
      parent: isRoot ? null : (links.get(object.parent ?? '') ?? null),
      order: isRoot ? 0 : object.order,
    };
    // Whole instances inside become nested prefabs; other links are dropped.
    const instance = copy.prefab ? instanceRootOf(objects, id) : null;
    if (
      copy.prefab &&
      (instance === null || instance === unpacked || !subtree.includes(instance))
    ) {
      delete copy.prefab;
    }
    if (isRoot) delete copy.area;
    prefabObjects[prefabId] = copy;
  }
  return {
    prefab: {
      formatVersion: FORMAT_VERSION,
      base: null,
      root: links.get(rootId) ?? '',
      objects: prefabObjects,
      overrides: [],
    },
    links,
  };
}

/**
 * Links scene objects to a prefab made from them by {@link createPrefabData}: they become an
 * instance without overrides.
 */
export function linkToPrefab(
  objects: ObjectMap,
  rootId: string,
  asset: string,
  links: ReadonlyMap<string, string>,
): Record<string, SceneObjectData> {
  const result: Record<string, SceneObjectData> = { ...objects };
  for (const [id, prefabObject] of links) {
    const object = result[id];
    if (!object) continue;
    result[id] = {
      ...object,
      prefab:
        id === rootId
          ? { asset, object: prefabObject, overrides: [] }
          : { asset, object: prefabObject },
    };
  }
  return result;
}

/** A new variant of a prefab: no own objects, no overrides yet. */
export function createVariantData(base: string, resolvedBase: ResolvedPrefab): PrefabData {
  return {
    formatVersion: FORMAT_VERSION,
    base,
    root: resolvedBase.root,
    objects: {},
    overrides: [],
  };
}

/**
 * Stores objects edited in prefab mode back into prefab data. Plain prefabs store all objects;
 * variants store their differences to the base and the objects they add.
 */
export function prefabFromEdited(
  data: PrefabData,
  edited: ObjectMap,
  source: PrefabSource,
): PrefabData {
  if (data.base === null) return { ...data, objects: updateAllInstanceOverrides(edited, source) };
  const base = resolvePrefab(data.base, source);
  if (!base) return data;
  const added: Record<string, SceneObjectData> = {};
  for (const [id, object] of Object.entries(edited)) {
    if (!(id in base.objects)) added[id] = object;
  }
  return { ...data, objects: added, overrides: diffObjects(base.objects, edited) };
}

/**
 * Applies overrides of an instance to its prefab (Unity: Apply / "Übernehmen"). Returns the new
 * prefab data; afterwards the instance's overrides are removed with {@link revertOverrides}
 * and all instances are synced.
 */
export function applyOverridesToPrefab(
  data: PrefabData,
  overrides: readonly PrefabOverride[],
  source: PrefabSource,
  prefabId: string,
): PrefabData {
  const resolved = resolvePrefab(prefabId, source);
  if (!resolved) return data;
  const edited = applyOverrides(resolved.objects, overrides);
  return prefabFromEdited(data, edited, source);
}
