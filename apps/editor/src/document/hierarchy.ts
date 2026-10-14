import type { AreaKindData, SceneData, SceneObjectData } from '@blockwerk/project';
import type { World } from '@blockwerk/runtime';
import { objectName } from '../scene/worlds';
import { childIds } from './sceneOps';

/** A row of the hierarchy tree. */
export interface HierarchyNode {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly area?: AreaKindData;
  /** What the object is, for its icon. */
  readonly kind: 'area' | 'camera' | 'light' | 'mesh' | 'empty';
  readonly children: readonly HierarchyNode[];
  /** Clones created while playing. */
  readonly clone: boolean;
  /** Part of a prefab instance (shown blue): its root, or another object of it. */
  readonly prefab?: 'root' | 'member';
}

function prefabKind(object: SceneObjectData | undefined): HierarchyNode['prefab'] {
  if (!object?.prefab) return undefined;
  return object.prefab.overrides ? 'root' : 'member';
}

function kindOf(types: readonly string[], area: AreaKindData | undefined): HierarchyNode['kind'] {
  if (area) return 'area';
  if (types.includes('camera')) return 'camera';
  if (types.includes('light')) return 'light';
  if (types.includes('meshRenderer')) return 'mesh';
  return 'empty';
}

/** Hierarchy of the scene data (edit mode). */
export function hierarchyFromScene(scene: SceneData): HierarchyNode[] {
  const build = (id: string): HierarchyNode | null => {
    const object = scene.objects[id];
    if (!object) return null;
    return {
      id,
      name: objectName(object, id),
      active: object.active,
      ...(object.area ? { area: object.area } : {}),
      kind: kindOf(
        object.components.map((component) => component.type),
        object.area,
      ),
      children: childIds(scene, id)
        .map(build)
        .filter((node): node is HierarchyNode => node !== null),
      clone: false,
      ...(object.prefab ? { prefab: prefabKind(object) } : {}),
    };
  };
  return childIds(scene, null)
    .map(build)
    .filter((node): node is HierarchyNode => node !== null);
}

/** Hierarchy of a running game (play mode), including clones. */
export function hierarchyFromWorld(world: World, scene: SceneData | null): HierarchyNode[] {
  const build = (object: World['roots'][number]): HierarchyNode => {
    const area = scene?.objects[object.id]?.area;
    return {
      id: object.id,
      name: object.name,
      active: object.active,
      ...(area ? { area } : {}),
      kind: kindOf(
        object.components.map((component) => component.definition.type),
        area,
      ),
      children: object.children.filter((child) => !child.destroyed).map(build),
      clone: object.cloneOf !== null,
      ...(scene?.objects[object.cloneOf ?? object.id]?.prefab
        ? { prefab: prefabKind(scene.objects[object.cloneOf ?? object.id]) }
        : {}),
    };
  };
  return world.roots.filter((root) => !root.destroyed).map(build);
}

/** Visible rows in order (respecting collapsed nodes), with depth. */
export function flattenTree(
  nodes: readonly HierarchyNode[],
  collapsed: ReadonlySet<string>,
  depth = 0,
): { node: HierarchyNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(collapsed.has(node.id) ? [] : flattenTree(node.children, collapsed, depth + 1)),
  ]);
}

/** Rows whose name contains the search text (flat list, like Unity's hierarchy search). */
export function searchTree(nodes: readonly HierarchyNode[], query: string): HierarchyNode[] {
  const needle = query.trim().toLowerCase();
  return nodes.flatMap((node) => [
    ...(node.name.toLowerCase().includes(needle) ? [{ ...node, children: [] }] : []),
    ...searchTree(node.children, query),
  ]);
}
