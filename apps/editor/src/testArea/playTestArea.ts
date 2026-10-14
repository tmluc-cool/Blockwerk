import type { SceneObjectData } from '@blockwerk/project';
import { t } from '../state/settings';
import { showMessage } from '../state/dialogs';
import { useDocument } from '../state/document';
import { useEditor } from '../state/editor';
import { play } from '../state/play';
import { buildTestArea, subtreeOf } from './testArea';

/** Component types that make an object a player character. */
const PLAYER_COMPONENTS = new Set([
  'characterController',
  'thirdPersonControl',
  'firstPersonControl',
  'topDownControl',
  'vehicleControl',
]);

function isPlayer(object: SceneObjectData): boolean {
  return object.components.some((component) => PLAYER_COMPONENTS.has(component.type));
}

/**
 * The player object to test: the selected object (or the topmost parent of it that is a
 * player), else the first player of the scene.
 */
export function findPlayerRoot(
  objects: Readonly<Record<string, SceneObjectData>>,
  selection: readonly string[],
): string | null {
  for (const start of selection) {
    let found: string | null = null;
    for (let id: string | null = start; id; id = objects[id]?.parent ?? null) {
      const object = objects[id];
      if (object && isPlayer(object)) found = id;
    }
    if (found) return found;
  }
  return Object.keys(objects).find((id) => isPlayer(objects[id] as SceneObjectData)) ?? null;
}

/**
 * "Play in Test Area" (SPEC 5.6): plays the built-in test scene with the chosen player object,
 * including all its components and block scripts. The open scene is not touched.
 */
export function playInTestArea(): void {
  const { scene } = useDocument.getState();
  if (!scene) return;
  const rootId = findPlayerRoot(scene.objects, useEditor.getState().selection);
  if (!rootId) {
    showMessage(t('testArea.title'), t('testArea.noPlayer'));
    return;
  }
  const area = buildTestArea((key) => t(key), subtreeOf(scene.objects, rootId), rootId);
  play({ scene: area.scene, extraScripts: area.scripts });
}
