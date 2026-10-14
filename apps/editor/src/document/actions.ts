import type { LibraryEntry } from '@blockwerk/library';
import type { ComponentData, SceneData, TransformData } from '@blockwerk/project';
import type { PrimitiveShape } from '@blockwerk/runtime';
import type { TranslationKey } from '../i18n';
import { libraryRef } from '../library/assetLibrary';
import { useLibraryPrefs } from '../library/libraryPrefs';
import { activeSceneView } from '../scene/sceneViews';
import { editScene, useDocument } from '../state/document';
import { activeObjectId, ALL_AREAS, useEditor } from '../state/editor';
import { usePlay } from '../state/play';
import { t, useSettings } from '../state/settings';
import {
  addComponent,
  createObject,
  deleteObjects,
  duplicateObjects,
  moveObjects,
  setHeaderField,
} from './sceneOps';
import type { DropTarget } from './sceneOps';

/** Object commands of menus, hierarchy and shortcuts. They work in edit mode only. */

/** Names of primitive shapes in the "Object" menu. */
export const SHAPE_NAMES: Readonly<Record<PrimitiveShape, TranslationKey>> = {
  cube: 'menu.gameObject.cube',
  sphere: 'menu.gameObject.sphere',
  cylinder: 'menu.gameObject.cylinder',
  capsule: 'menu.gameObject.capsule',
  plane: 'menu.gameObject.plane',
  ramp: 'menu.gameObject.ramp',
  stairs: 'menu.gameObject.stairs',
};

/** Light types of the "Object > Light" menu. */
export const LIGHT_TYPES = ['directional', 'point', 'spot'] as const;

function editable(): boolean {
  return usePlay.getState().status === 'stopped' && useDocument.getState().scene !== null;
}

/** Parent of new objects: the active area tab's root (Unity: scene root). */
function newObjectParent(scene: SceneData): string | null {
  const area = useEditor.getState().activeAreaId;
  return area !== ALL_AREAS && area in scene.objects ? area : null;
}

/** Where new objects appear: the scene view's pivot, like Unity. */
function placement(): TransformData {
  const point = activeSceneView()?.placementPoint();
  const round = (value: number): number => Math.round(value * 100) / 100 || 0;
  return {
    position: point ? [round(point.x), round(point.y), round(point.z)] : [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function create(
  name: string,
  components: Omit<ComponentData, 'id'>[],
  transform = placement(),
  parent?: string | null,
): string | null {
  if (!editable()) return null;
  let id: string | null = null;
  editScene('undo.create', (scene) => {
    const result = createObject(scene, {
      name,
      parent: parent === undefined ? newObjectParent(scene) : parent,
      components,
      transform,
    });
    id = result.id;
    return result.scene;
  });
  if (id) {
    useEditor.getState().select(id);
    useEditor.getState().setRenaming(id);
  }
  return id;
}

/** Ctrl+Shift+N: empty object. */
export function createEmpty(parent?: string | null): string | null {
  return create(t('object.empty'), [], placement(), parent);
}

const COLLIDERS: Readonly<Record<PrimitiveShape, Omit<ComponentData, 'id'>>> = {
  cube: { type: 'boxCollider', enabled: true, values: {} },
  sphere: { type: 'sphereCollider', enabled: true, values: {} },
  capsule: { type: 'capsuleCollider', enabled: true, values: {} },
  cylinder: { type: 'capsuleCollider', enabled: true, values: {} },
  plane: { type: 'boxCollider', enabled: true, values: { size: [10, 0.01, 10] } },
  ramp: { type: 'boxCollider', enabled: true, values: {} },
  stairs: { type: 'boxCollider', enabled: true, values: {} },
};

/** Object > 3D object: a primitive with renderer and matching collider (like Unity). */
export function createPrimitiveObject(
  shape: PrimitiveShape,
  parent?: string | null,
): string | null {
  return create(
    t(SHAPE_NAMES[shape]),
    [{ type: 'meshRenderer', enabled: true, values: { shape } }, COLLIDERS[shape]],
    placement(),
    parent,
  );
}

/** Renderer and suggested collider for a model of the asset library. */
export function libraryComponents(entry: LibraryEntry): Omit<ComponentData, 'id'>[] {
  const renderer = { type: 'meshRenderer', enabled: true, values: { model: libraryRef(entry) } };
  const collider = entry.collider;
  switch (collider.type) {
    case 'box':
      return [
        renderer,
        {
          type: 'boxCollider',
          enabled: true,
          values: { center: [...collider.center], size: [...collider.size] },
        },
      ];
    case 'capsule':
      return [
        renderer,
        {
          type: 'capsuleCollider',
          enabled: true,
          values: {
            center: [...collider.center],
            radius: collider.radius,
            height: collider.height,
          },
        },
      ];
    case 'none':
      return [renderer];
  }
}

/**
 * Places a model of the asset library in the scene (drag and drop, "Place in Scene"), standing
 * at `position` (default: the scene view pivot). Selects it and remembers it as recently used.
 */
export function createLibraryObject(
  entry: LibraryEntry,
  position?: readonly [number, number, number],
): string | null {
  const transform = placement();
  const round = (value: number): number => Math.round(value * 1000) / 1000 || 0;
  const surface = position ? null : activeSceneView()?.surfaceBelowPivot();
  position ??= surface ? [surface.x, surface.y, surface.z] : undefined;
  const id = create(
    entry.name[useSettings.getState().locale],
    libraryComponents(entry),
    position
      ? { ...transform, position: [round(position[0]), round(position[1]), round(position[2])] }
      : transform,
  );
  if (id) {
    useEditor.getState().setRenaming(null);
    useLibraryPrefs.getState().markUsed(entry.id);
  }
  return id;
}

/** Object > Camera. */
export function createCamera(parent?: string | null): string | null {
  return create(
    t('menu.gameObject.camera'),
    [{ type: 'camera', enabled: true, values: {} }],
    placement(),
    parent,
  );
}

/** Object > Light. */
export function createLight(
  type: (typeof LIGHT_TYPES)[number],
  parent?: string | null,
): string | null {
  const transform = placement();
  return create(
    t(`menu.gameObject.light.${type}`),
    [{ type: 'light', enabled: true, values: { lightType: type } }],
    type === 'point' ? transform : { ...transform, rotation: [50, -30, 0] },
    parent,
  );
}

/** Ctrl+D. */
export function duplicateSelection(): void {
  const { selection } = useEditor.getState();
  if (!editable() || selection.length === 0) return;
  let copies: string[] = [];
  editScene('undo.duplicate', (scene) => {
    const result = duplicateObjects(scene, selection);
    copies = result.ids;
    return result.scene;
  });
  if (copies.length > 0) useEditor.getState().setSelection(copies);
}

/** Delete key. Built-in area roots cannot be deleted. */
export function deleteSelection(): void {
  const { selection } = useEditor.getState();
  const { scene } = useDocument.getState();
  if (!editable() || !scene) return;
  const deletable = selection.filter((id) => {
    const area = scene.objects[id]?.area;
    return !area || area === 'custom';
  });
  if (deletable.length === 0) return;
  editScene('undo.delete', (data) => deleteObjects(data, deletable));
  const editor = useEditor.getState();
  editor.setSelection([]);
  if (deletable.includes(editor.activeAreaId)) editor.setActiveArea(ALL_AREAS);
}

/** F2. */
export function renameSelection(): void {
  const id = activeObjectId(useEditor.getState());
  if (editable() && id) useEditor.getState().setRenaming(id);
}

/** Renames an object (custom area roots too). */
export function renameObject(id: string, name: string): void {
  const trimmed = name.trim();
  const object = useDocument.getState().scene?.objects[id];
  if (!editable() || !trimmed || !object || (object.area && object.area !== 'custom')) return;
  editScene('undo.rename', (scene) => setHeaderField(scene, [id], 'name', trimmed));
}

/** Drag and drop in the hierarchy. */
export function moveSelection(ids: readonly string[], target: DropTarget): void {
  if (!editable()) return;
  editScene('undo.move', (scene) => moveObjects(scene, ids, target));
}

/** F: frames the selection in the scene view. */
export function focusSelection(): void {
  activeSceneView()?.focus(useEditor.getState().selection);
}

/** "+" next to the area tabs: a custom area root object. */
export function createArea(): string | null {
  if (!editable()) return null;
  const scene = useDocument.getState().scene;
  if (!scene) return null;
  const count =
    Object.values(scene.objects).filter((object) => object.area === 'custom').length + 1;
  let id: string | null = null;
  editScene('undo.create', (data) => {
    const result = createObject(data, {
      name: t('area.newName', { n: count }),
      parent: null,
      area: 'custom',
    });
    id = result.id;
    return result.scene;
  });
  if (id) useEditor.getState().setActiveArea(id);
  return id;
}

/** Component > Add: adds a component to all selected objects. */
export function addComponentToSelection(type: string, unique: boolean): void {
  const { selection } = useEditor.getState();
  if (!editable() || selection.length === 0) return;
  editScene('undo.addComponent', (scene) => addComponent(scene, selection, type, unique));
}
