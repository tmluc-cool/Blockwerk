import { parseList } from '@blockwerk/runtime';
import {
  applyInstanceOverrides,
  createPrefabFromObject,
  createPrefabVariant,
  instantiatePrefabAsset,
  prefabInstanceOf,
} from '../document/prefabActions';
import { areaRoots, createObject, setComponentValue } from '../document/sceneOps';
import { saveToMyPrefabs } from '../library/myPrefabs';
import { editScene, useDocument } from '../state/document';
import { useEditor } from '../state/editor';
import { t } from '../state/settings';
import { PALETTES, partGroup, paletteSlot } from './BodySections';
import { setValues, valuesOf } from './studio';

/** Every figure is a prefab: makes one from the figure object if it is none yet. */
export function ensureFigurePrefab(figureId: string): string | null {
  const existing = prefabInstanceOf(useDocument.getState().scene, figureId);
  if (existing) return existing.prefabId;
  return createPrefabFromObject(figureId);
}

/** "Save to My Characters": the figure prefab with everything it needs goes to the user library. */
export async function saveFigureToMine(figureId: string): Promise<boolean> {
  const prefabId = ensureFigurePrefab(figureId);
  return prefabId ? saveToMyPrefabs(prefabId) : false;
}

/** The palette whose colors the figure's tints use the most (to pick a different one). */
function paletteInUse(tints: ReadonlyMap<string, string>): number {
  let best = 0;
  let bestScore = -1;
  PALETTES.forEach((palette, index) => {
    let score = 0;
    for (const [part, color] of tints) {
      if (palette[paletteSlot(partGroup(part))] === color) score++;
    }
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

/**
 * "Like player 1, but other colors" (SPEC 5.10): makes the figure a prefab, creates a variant
 * of it with the next color palette and steering for player 2, places it in the Player 2 area
 * and gives it its own camera. Returns the ID of the new instance.
 */
export function createPlayerTwo(figureId: string, parts: readonly string[]): string | null {
  const prefabId = ensureFigurePrefab(figureId);
  const variantId = prefabId ? createPrefabVariant(prefabId) : null;
  const scene = useDocument.getState().scene;
  const figure = scene?.objects[figureId];
  if (!variantId || !scene || !figure) return null;
  const area = areaRoots(scene).find((root) => root.object.area === 'player2')?.id ?? null;
  const [x, y, z] = figure.transform.position;
  const instanceId = instantiatePrefabAsset(variantId, [x + 1.5, y, z], area);
  if (!instanceId) return null;

  // Other colors, and the keys of player 2.
  const current = new Map(parseList(String(valuesOf(figure, 'character')['tints'] ?? '')));
  const palette = PALETTES[(paletteInUse(current) + 1) % PALETTES.length];
  const tints = palette
    ? parts.map((part) => `${part}=${palette[paletteSlot(partGroup(part))]}`).join(';')
    : '';
  const created = useDocument.getState().scene?.objects[instanceId];
  const control = created?.components.find((component) => component.type.endsWith('Control'));
  setValues(instanceId, 'character', { tints });
  if (control) setValues(instanceId, control.type, { player: '2' });
  applyInstanceOverrides(instanceId);

  // Its own camera: like the one of player 1 (which now shows player 1 only), for player 2.
  const latest = useDocument.getState().scene;
  const sourceId = latest
    ? Object.keys(latest.objects).find((id) =>
        latest.objects[id]?.components.some((component) => component.type === 'thirdPersonCamera'),
      )
    : undefined;
  const behavior = sourceId
    ? latest?.objects[sourceId]?.components.find(
        (component) => component.type === 'thirdPersonCamera',
      )
    : undefined;
  editScene('undo.studio', (data) => {
    const first = sourceId ? setComponentValue(data, [sourceId], 'camera', 0, 'player', '1') : data;
    return createObject(first, {
      name: t('studio.player2Camera'),
      parent: area,
      components: [
        { type: 'camera', enabled: true, values: { player: '2' } },
        { type: 'thirdPersonCamera', enabled: true, values: { ...(behavior?.values ?? {}) } },
      ],
    }).scene;
  });
  useEditor.getState().select(instanceId);
  return instanceId;
}
