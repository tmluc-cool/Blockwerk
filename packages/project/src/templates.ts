import { createId } from './ids';
import { FORMAT_VERSION } from './schema';
import type { AreaKindData, ComponentData, SceneData, SceneObjectData } from './schema';

const IDENTITY = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as const;

function object(overrides: Partial<SceneObjectData>): SceneObjectData {
  return {
    name: null,
    parent: null,
    order: 0,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: false,
    transform: {
      position: [...IDENTITY.position],
      rotation: [...IDENTITY.rotation],
      scale: [...IDENTITY.scale],
    },
    components: [],
    ...overrides,
  };
}

function component(type: string, values: ComponentData['values'] = {}): ComponentData {
  return { id: createId(), type, enabled: true, values };
}

/** Area roots of a new scene in tab order (SPEC 5.3). */
export const DEFAULT_AREAS: readonly AreaKindData[] = [
  'environment',
  'player1',
  'player2',
  'npcs',
  'items',
  'ui',
];

/** Names of the objects of a new scene, in the user's language. */
export interface DefaultSceneNames {
  readonly camera: string;
  readonly sun: string;
  readonly ground: string;
}

/**
 * Creates the default scene of a new project: area roots (named by the editor's language
 * because their name is `null`), main camera, sun and ground.
 */
export function createDefaultScene(names: DefaultSceneNames): SceneData {
  const objects: Record<string, SceneObjectData> = {};
  const areaIds = new Map<AreaKindData, string>();
  DEFAULT_AREAS.forEach((area, index) => {
    const id = createId();
    areaIds.set(area, id);
    objects[id] = object({ area, order: index });
  });
  const environment = areaIds.get('environment') ?? null;
  const player = areaIds.get('player1') ?? null;
  objects[createId()] = object({
    name: names.camera,
    parent: player,
    tag: 'MainCamera',
    transform: { position: [0, 3, -8], rotation: [15, 0, 0], scale: [1, 1, 1] },
    components: [component('camera')],
  });
  objects[createId()] = object({
    name: names.sun,
    parent: environment,
    transform: { position: [0, 10, 0], rotation: [50, -30, 0], scale: [1, 1, 1] },
    components: [component('light', { lightType: 'directional' })],
  });
  objects[createId()] = object({
    name: names.ground,
    parent: environment,
    order: 1,
    static: true,
    // The plane primitive is 10 m wide; scaled by 10 it covers 100 × 100 m.
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [10, 1, 10] },
    components: [
      component('meshRenderer', { shape: 'plane', color: '#8a9a7b', texture: 'tiles', tiling: 10 }),
      component('boxCollider', { center: [0, -0.05, 0], size: [10, 0.1, 10] }),
    ],
  });
  return {
    formatVersion: FORMAT_VERSION,
    environment: { ambientIntensity: 0.32, fog: { enabled: true, near: 60, far: 400 } },
    objects,
  };
}
