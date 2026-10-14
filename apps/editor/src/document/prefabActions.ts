import {
  applyOverridesToPrefab,
  assetDisplayName,
  createId,
  createPrefabData,
  createVariantData,
  dirname,
  instanceMembers,
  instanceRootOf,
  instantiatePrefab,
  linkToPrefab,
  resolvePrefab,
  revertOverrides,
} from '@blockwerk/project';
import type { PrefabOverride, SceneData, SceneObjectData, TransformData } from '@blockwerk/project';
import { activeSceneView } from '../scene/sceneViews';
import { objectName } from '../scene/worlds';
import {
  createPrefabAsset,
  defaultFolder,
  editScene,
  prefabSource,
  updatePrefab,
  useDocument,
} from '../state/document';
import { ALL_AREAS, useEditor } from '../state/editor';
import { usePlay } from '../state/play';
import { t } from '../state/settings';
import { childIds } from './sceneOps';

/** Prefab commands (SPEC 6.4), like Unity. They work in edit mode only. */

function editable(): boolean {
  return usePlay.getState().status === 'stopped' && useDocument.getState().scene !== null;
}

/**
 * Makes a prefab from an object and everything below it (Unity: drag an object into the project
 * window). The object becomes an instance of the new prefab. Returns the prefab ID.
 */
export function createPrefabFromObject(
  objectId: string,
  folder = defaultFolder('prefab'),
): string | null {
  const { scene } = useDocument.getState();
  const object = scene?.objects[objectId];
  if (!editable() || !scene || !object || object.area) return null;
  const { prefab, links } = createPrefabData(scene.objects, objectId, createId);
  const asset = createPrefabAsset(
    folder,
    objectName(object, objectId) || t('asset.type.prefab'),
    prefab,
  );
  if (!asset) return null;
  editScene('undo.createPrefab', (data) => ({
    ...data,
    objects: linkToPrefab(data.objects, objectId, asset.id, links),
  }));
  return asset.id;
}

/** Parent of new objects: the active area tab's root (Unity: scene root). */
function newObjectParent(scene: SceneData): string | null {
  const area = useEditor.getState().activeAreaId;
  return area !== ALL_AREAS && area in scene.objects ? area : null;
}

/**
 * Places an instance of a prefab (drag from the project window). Without a position it stands
 * on the surface below the scene view pivot. Selects the new instance and returns its root ID.
 */
export function instantiatePrefabAsset(
  prefabId: string,
  position?: readonly [number, number, number],
  parent?: string | null,
): string | null {
  const { scene, project } = useDocument.getState();
  const asset = project?.assetOfType(prefabId, 'prefab');
  if (!editable() || !scene || !asset) return null;
  const resolved = resolvePrefab(prefabId, prefabSource());
  if (!resolved) return null;
  const point = position ?? activeSceneView()?.surfaceBelowPivot().toArray();
  const root = resolved.objects[resolved.root];
  const target = parent === undefined ? newObjectParent(scene) : parent;
  const siblings = childIds(scene, target);
  const lastOrder = siblings.length > 0 ? (scene.objects[siblings.at(-1) ?? '']?.order ?? 0) : -1;
  const round = (value: number): number => Math.round(value * 1000) / 1000 || 0;
  const created = instantiatePrefab(prefabId, resolved, {
    parent: target,
    order: Math.floor(lastOrder) + 1,
    transform: {
      position: point
        ? [round(point[0] ?? 0), round(point[1] ?? 0), round(point[2] ?? 0)]
        : (root?.transform.position ?? [0, 0, 0]),
      rotation: root?.transform.rotation ?? [0, 0, 0],
    },
    createId,
  });
  // The instance is named like the prefab asset (Unity does the same).
  const rootObject = created.objects[created.rootId];
  if (rootObject) {
    created.objects[created.rootId] = { ...rootObject, name: assetDisplayName(asset.path) };
  }
  editScene('undo.create', (data) => ({
    ...data,
    objects: { ...data.objects, ...created.objects },
  }));
  useEditor.getState().select(created.rootId);
  return created.rootId;
}

/**
 * Adds an instance of a prefab to scene data (used by the brush): root at `transform`, named
 * like the prefab. Returns the scene unchanged if the prefab is missing.
 */
export function instantiatePrefabInScene(
  scene: SceneData,
  prefabId: string,
  parent: string | null,
  transform: TransformData,
): SceneData {
  const asset = useDocument.getState().project?.assetOfType(prefabId, 'prefab');
  const resolved = resolvePrefab(prefabId, prefabSource());
  if (!asset || !resolved) return scene;
  const siblings = childIds(scene, parent);
  const lastOrder = siblings.length > 0 ? (scene.objects[siblings.at(-1) ?? '']?.order ?? 0) : -1;
  const created = instantiatePrefab(prefabId, resolved, {
    parent,
    order: Math.floor(lastOrder) + 1,
    transform: { position: transform.position, rotation: transform.rotation },
    createId,
  });
  const root = created.objects[created.rootId];
  if (root) {
    created.objects[created.rootId] = {
      ...root,
      name: assetDisplayName(asset.path),
      transform: { ...root.transform, scale: transform.scale },
    };
  }
  return { ...scene, objects: { ...scene.objects, ...created.objects } };
}

/** The instance root of an object and the prefab it comes from. */
export function prefabInstanceOf(
  scene: SceneData | null,
  objectId: string,
): { rootId: string; prefabId: string; root: SceneObjectData } | null {
  if (!scene) return null;
  const rootId = instanceRootOf(scene.objects, objectId);
  const root = rootId ? scene.objects[rootId] : undefined;
  if (!rootId || !root?.prefab) return null;
  return { rootId, prefabId: root.prefab.asset, root };
}

/** Overrides of an instance that concern one object (by its ID in the scene). */
export function overridesOf(scene: SceneData | null, objectId: string): PrefabOverride[] {
  const object = scene?.objects[objectId];
  const instance = prefabInstanceOf(scene, objectId);
  if (!object?.prefab || !instance) return [];
  return (instance.root.prefab?.overrides ?? []).filter(
    (override) => override.object === object.prefab?.object,
  );
}

/**
 * Writes overrides of an instance into its prefab (Unity: Apply / "Übernehmen") and updates all
 * instances. Without `filter`, all overrides are applied.
 */
export function applyInstanceOverrides(
  rootId: string,
  filter: (override: PrefabOverride) => boolean = () => true,
): void {
  const { scene, project } = useDocument.getState();
  const root = scene?.objects[rootId];
  const prefabId = root?.prefab?.asset;
  const asset = prefabId ? project?.assetOfType(prefabId, 'prefab') : undefined;
  if (!editable() || !scene || !root?.prefab?.overrides || !prefabId || !asset) return;
  const chosen = root.prefab.overrides.filter(filter);
  if (chosen.length === 0) return;
  const source = prefabSource();
  updatePrefab(prefabId, applyOverridesToPrefab(asset.data, chosen, source, prefabId));
  editScene('undo.applyOverrides', (data) => ({
    ...data,
    objects: revertOverrides(data.objects, rootId, prefabSource(), (item) => chosen.includes(item)),
  }));
}

/** Removes overrides of an instance (Unity: Revert / "Zurücksetzen"). */
export function revertInstanceOverrides(
  rootId: string,
  filter: (override: PrefabOverride) => boolean = () => true,
): void {
  if (!editable()) return;
  editScene('undo.revertOverrides', (data) => ({
    ...data,
    objects: revertOverrides(data.objects, rootId, prefabSource(), filter),
  }));
}

/** Creates a variant of a prefab next to it (Unity: Create > Prefab Variant). */
export function createPrefabVariant(prefabId: string): string | null {
  const { project } = useDocument.getState();
  const asset = project?.assetOfType(prefabId, 'prefab');
  const resolved = resolvePrefab(prefabId, prefabSource());
  if (!project || !asset || !resolved) return null;
  const variant = createPrefabAsset(
    dirname(asset.path),
    t('prefab.variantName', { name: assetDisplayName(asset.path) }),
    createVariantData(prefabId, resolved),
  );
  return variant?.id ?? null;
}

/** Turns an instance into plain objects (Unity: Unpack Prefab). */
export function unpackInstance(rootId: string): void {
  const { scene } = useDocument.getState();
  if (!editable() || !scene) return;
  const members = new Set(instanceMembers(scene.objects, rootId).values());
  if (members.size === 0) return;
  editScene('undo.unpackPrefab', (data) => {
    const objects = { ...data.objects };
    for (const id of members) {
      const object = objects[id];
      if (!object) continue;
      const { prefab: _link, ...plain } = object;
      objects[id] = plain;
    }
    return { ...data, objects };
  });
}
