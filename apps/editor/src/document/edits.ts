import type { JsonValue, SceneData, SceneObjectData, TransformData } from '@blockwerk/project';
import { resolveValues } from '@blockwerk/runtime';
import type { GameObject } from '@blockwerk/runtime';
import { Euler, MathUtils } from 'three';
import type { TranslationKey } from '../i18n';
import { editScene } from '../state/document';
import { recordPlayChange, playingWorld } from '../state/play';
import {
  setComponentEnabled,
  setComponentValue,
  setHeaderField,
  setTransformAxis,
  setTransforms,
  updateComponents,
} from './sceneOps';
import type { HeaderField, TransformPart } from './sceneOps';

/**
 * Edits made in the inspector and with gizmos. In edit mode they change the scene (with
 * undo). In play mode they change the running game only and are remembered, so the user
 * can keep single values ("Diesen Wert behalten") before stopping resets everything.
 */
export interface Edit {
  readonly label: TranslationKey;
  readonly ids: readonly string[];
  /** Change of the scene data for some objects. */
  recipe(scene: SceneData, ids: readonly string[]): SceneData;
  /** The same change applied to a live object in play mode. */
  live(object: GameObject): void;
  /** What is changed, e.g. `transform.position` or `component:light:0:color`. */
  readonly path: string;
  readonly mergeKey?: string;
}

/** Applies an edit in edit mode or play mode. */
export function applyEdit(edit: Edit): void {
  const world = playingWorld();
  if (!world) {
    editScene(
      edit.label,
      (scene) => edit.recipe(scene, edit.ids),
      edit.mergeKey ?? `${edit.path}|${edit.ids.join(',')}`,
    );
    return;
  }
  for (const id of edit.ids) {
    const object = world.getObject(id);
    if (!object) continue;
    edit.live(object);
    recordPlayChange({
      objectId: object.cloneOf ?? id,
      path: edit.path,
      label: edit.label,
      apply: (scene) => edit.recipe(scene, [object.cloneOf ?? id]),
    });
  }
}

function applyTransformLive(object: GameObject, transform: TransformData): void {
  const [rx, ry, rz] = transform.rotation;
  object.object3d.position.set(...transform.position);
  object.object3d.rotation.copy(
    new Euler(MathUtils.degToRad(rx), MathUtils.degToRad(ry), MathUtils.degToRad(rz), 'YXZ'),
  );
  object.object3d.scale.set(...transform.scale);
}

/** Reads the live transform of an object (play mode). */
export function liveTransform(object: GameObject): TransformData {
  const round = (value: number): number => Math.round(value * 1e5) / 1e5 || 0;
  const node = object.object3d;
  return {
    position: [round(node.position.x), round(node.position.y), round(node.position.z)],
    rotation: object.getRotationDegrees().map(round) as [number, number, number],
    scale: [round(node.scale.x), round(node.scale.y), round(node.scale.z)],
  };
}

/** Gizmo drags: whole transforms per object. */
export function editTransforms(transforms: ReadonlyMap<string, TransformData>): void {
  const world = playingWorld();
  if (!world) {
    editScene('undo.transform', (scene) => setTransforms(scene, transforms), 'gizmo');
    return;
  }
  for (const [id, transform] of transforms) {
    applyEdit({
      label: 'undo.transform',
      ids: [id],
      path: 'transform',
      recipe: (scene, ids) =>
        setTransforms(scene, new Map(ids.map((target) => [target, transform]))),
      live: (object) => applyTransformLive(object, transform),
    });
  }
}

/** One axis of position, rotation or scale typed in the inspector. */
export function editTransformAxis(
  ids: readonly string[],
  part: TransformPart,
  axis: 0 | 1 | 2,
  value: number,
): void {
  applyEdit({
    label: 'undo.transform',
    ids,
    path: `transform.${part}.${axis}`,
    recipe: (scene, targets) => setTransformAxis(scene, targets, part, axis, value),
    live: (object) => {
      const transform = liveTransform(object);
      const vector = [...transform[part]] as [number, number, number];
      vector[axis] = value;
      applyTransformLive(object, { ...transform, [part]: vector });
    },
  });
}

/** Header fields (name, active, static, tag, layer). */
export function editHeader(
  ids: readonly string[],
  field: HeaderField,
  value: string | boolean,
): void {
  applyEdit({
    label: field === 'name' ? 'undo.rename' : 'undo.change',
    ids,
    path: `header.${field}`,
    recipe: (scene, targets) => setHeaderField(scene, targets, field, value),
    live: (object) => {
      if (field === 'name' && typeof value === 'string') object.name = value;
      if (field === 'active' && typeof value === 'boolean') object.setActive(value);
      if (field === 'tag' && typeof value === 'string') object.tag = value;
      if (field === 'layer' && typeof value === 'string') object.layer = value;
    },
  });
}

/** A field value of a component. */
export function editComponentValue(
  ids: readonly string[],
  type: string,
  index: number,
  field: string,
  value: JsonValue,
): void {
  applyEdit({
    label: 'undo.change',
    ids,
    path: `component:${type}:${index}:${field}`,
    recipe: (scene, targets) => setComponentValue(scene, targets, type, index, field, value),
    live: (object) => {
      const instance = object.components.filter((component) => component.definition.type === type)[
        index
      ];
      if (!instance) return;
      const stored = { ...(instance.values as Record<string, JsonValue>), [field]: value };
      instance.values = resolveValues(instance.definition, stored);
      instance.behavior.apply(instance.values);
    },
  });
}

/** Turns a component on or off. */
export function editComponentEnabled(
  ids: readonly string[],
  type: string,
  index: number,
  enabled: boolean,
): void {
  applyEdit({
    label: 'undo.change',
    ids,
    path: `componentEnabled:${type}:${index}`,
    recipe: (scene, targets) => setComponentEnabled(scene, targets, type, index, enabled),
    live: (object) => {
      const instance = object.components.filter((component) => component.definition.type === type)[
        index
      ];
      if (!instance) return;
      instance.enabled = enabled;
      instance.behavior.setEnabled?.(enabled);
    },
  });
}

/** Scene-object data of a live object (what the inspector shows in play mode). */
export function liveObjectData(
  object: GameObject,
  stored: SceneObjectData | undefined,
): SceneObjectData {
  return {
    name: object.name,
    parent: object.parent?.id ?? null,
    order: stored?.order ?? 0,
    active: object.active,
    tag: object.tag,
    layer: object.layer,
    static: stored?.static ?? false,
    ...(stored?.area ? { area: stored.area } : {}),
    transform: liveTransform(object),
    components: object.components.map((component) => ({
      id: component.id,
      type: component.definition.type,
      enabled: component.enabled,
      values: component.values as Record<string, JsonValue>,
    })),
  };
}

/** Per-object value of an inspector variable of a block script component. */
export function editScriptVariable(
  ids: readonly string[],
  index: number,
  variableId: string,
  value: number | string | boolean,
): void {
  applyEdit({
    label: 'undo.change',
    ids,
    path: `variable:${index}:${variableId}`,
    recipe: (scene, targets) =>
      updateComponents(scene, targets, 'blockScript', index, (component) => {
        const stored = component.values['variables'];
        const variables =
          stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        if (variables[variableId] === value) return component;
        return {
          ...component,
          values: { ...component.values, variables: { ...variables, [variableId]: value } },
        };
      }),
    live: (object) => {
      object.vars[variableId] = value;
    },
  });
}
