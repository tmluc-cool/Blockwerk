import type { ComponentData, JsonValue, SceneData, SceneObjectData } from '@blockwerk/project';
import { getComponentDefinition, MOVEMENT_PROFILES, resolveValues } from '@blockwerk/runtime';
import type { ProfileName } from '@blockwerk/runtime';
import { create } from 'zustand';
import {
  addComponent,
  setComponentEnabled,
  setComponentValue,
  updateObjects,
} from '../document/sceneOps';
import { objectName } from '../scene/worlds';
import { editScene, useDocument } from '../state/document';

/** Sections of the left column of the Character Studio (SPEC 5.10). */
export const STUDIO_SECTIONS = [
  'model',
  'builder',
  'colors',
  'equipment',
  'movement',
  'collision',
  'sounds',
  'portrait',
] as const;
export type StudioSection = (typeof STUDIO_SECTIONS)[number];

interface StudioState {
  /** The object the studio edits (a figure). `null` picks the first figure of the scene. */
  targetId: string | null;
  section: StudioSection;
  /** The animation playing on the turntable (state or clip name). */
  animation: string | null;
  /** Playback speed factor of the preview. */
  speed: number;
  loop: boolean;
  setTarget(id: string | null): void;
  setSection(section: StudioSection): void;
  setAnimation(name: string | null): void;
  setSpeed(speed: number): void;
  setLoop(loop: boolean): void;
}

/** State of the Character Studio window. */
export const useStudio = create<StudioState>((set) => ({
  targetId: null,
  section: 'model',
  animation: 'idle',
  speed: 1,
  loop: true,
  setTarget: (targetId) => set({ targetId }),
  setSection: (section) => set({ section }),
  setAnimation: (animation) => set({ animation }),
  setSpeed: (speed) => set({ speed }),
  setLoop: (loop) => set({ loop }),
}));

/** Component types that make an object steerable. */
const CONTROL_TYPES = new Set(['thirdPersonControl', 'firstPersonControl', 'topDownControl']);

/** Whether an object is a figure: it has a Character component or a character controller. */
function isFigure(object: SceneObjectData): boolean {
  return object.components.some(
    (component) => component.type === 'character' || component.type === 'characterController',
  );
}

/** The figures of a scene for the studio's drop-down. */
export function figureCandidates(scene: SceneData): { id: string; name: string }[] {
  return Object.entries(scene.objects)
    .filter(([, object]) => isFigure(object))
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, object]) => ({ id, name: objectName(object, id) }));
}

/** The figure the studio edits: the chosen one if it still exists, else the first one. */
export function resolveTarget(scene: SceneData | null, targetId: string | null): string | null {
  if (!scene) return null;
  if (targetId && scene.objects[targetId]) return targetId;
  return figureCandidates(scene)[0]?.id ?? null;
}

/** The first component of a type on an object. */
export function componentOf(object: SceneObjectData, type: string): ComponentData | undefined {
  return object.components.find((component) => component.type === type);
}

/** The values of a component with defaults filled in. */
export function valuesOf(object: SceneObjectData, type: string): Record<string, unknown> {
  const definition = getComponentDefinition(type);
  const stored = componentOf(object, type)?.values ?? {};
  return definition ? { ...resolveValues(definition, stored) } : { ...stored };
}

/** Changes one field of a component (one undo step per field while dragging a slider). */
export function setValue(id: string, type: string, field: string, value: JsonValue): void {
  editScene(
    'undo.studio',
    (scene) => setComponentValue(scene, [id], type, 0, field, value),
    `studio|${id}|${type}|${field}`,
  );
}

/** Changes several fields of a component at once. */
export function setValues(
  id: string,
  type: string,
  patch: Readonly<Record<string, JsonValue>>,
): void {
  editScene('undo.studio', (scene) =>
    Object.entries(patch).reduce(
      (current, [field, value]) => setComponentValue(current, [id], type, 0, field, value),
      scene,
    ),
  );
}

/** Adds a component to a figure if it does not have one. */
export function ensureComponent(
  id: string,
  type: string,
  values: Readonly<Record<string, JsonValue>> = {},
): void {
  editScene('undo.studio', (scene) => addComponent(scene, [id], type, true, values));
}

/**
 * Makes an object a figure: Character component and Animator. A Mesh Renderer with a model is
 * replaced by the Character component showing the same model (both would draw it twice).
 */
export function makeFigure(id: string): void {
  editScene('undo.studio', (scene) => {
    const object = scene.objects[id];
    if (!object) return scene;
    const renderer = object.components.find((component) => component.type === 'meshRenderer');
    const model = renderer?.values['model'];
    let next = scene;
    if (renderer && typeof model === 'string') {
      next = updateObjects(next, [id], (current) => ({
        ...current,
        components: current.components.filter((component) => component !== renderer),
      }));
    }
    next = addComponent(next, [id], 'character', true, typeof model === 'string' ? { model } : {});
    return addComponent(next, [id], 'animator', true);
  });
}

/** Turns an ability card on (adding its component) or off. */
export function setAbilityOn(id: string, type: string, on: boolean): void {
  editScene('undo.studio', (scene) => {
    const object = scene.objects[id];
    if (!object) return scene;
    if (!componentOf(object, type)) return on ? addComponent(scene, [id], type, true) : scene;
    return setComponentEnabled(scene, [id], type, 0, on);
  });
}

/** Whether a figure has an ability and it is turned on. */
export function abilityIsOn(object: SceneObjectData, type: string): boolean {
  return componentOf(object, type)?.enabled === true;
}

/** The type of the figure's walking control, if it has one. */
export function controlType(object: SceneObjectData): string | null {
  return object.components.find((component) => CONTROL_TYPES.has(component.type))?.type ?? null;
}

/** Applies a movement profile: all movement sliders take the profile's values (SPEC 5.10). */
export function applyProfile(id: string, name: ProfileName): void {
  const object = useDocument.getState().scene?.objects[id];
  if (!object) return;
  const control = controlType(object);
  editScene('undo.studio', (scene) => {
    let next = scene;
    if (control) {
      for (const [field, value] of Object.entries(MOVEMENT_PROFILES[name])) {
        next = setComponentValue(next, [id], control, 0, field, value);
      }
    }
    return setComponentValue(next, [id], 'character', 0, 'profile', name);
  });
}

/** Replaces the data of an object (used by the builder for presets). */
export function updateFigureObject(
  id: string,
  update: (object: SceneObjectData) => SceneObjectData,
): void {
  editScene('undo.studio', (scene) => updateObjects(scene, [id], update));
}
