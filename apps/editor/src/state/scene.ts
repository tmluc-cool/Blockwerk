import type { TranslationKey } from '../i18n';

/** Vector as `[x, y, z]`. */
export type Vec3 = readonly [number, number, number];

/** Kind of a default-scene object; decides how the viewports build it. */
export type SceneObjectKind = 'camera' | 'sun' | 'ground' | 'cube';

/** Component shown in the inspector for a default-scene object. */
export type ComponentKind = 'camera' | 'light' | 'meshRenderer';

/** An object of the built-in sample scene. Phase 1 replaces this with real project data. */
export interface SceneObjectInfo {
  readonly id: string;
  readonly nameKey: TranslationKey;
  readonly kind: SceneObjectKind;
  /** ID of the area tab the object belongs to, or `null` (shown only under "All"). */
  readonly areaId: string | null;
  readonly position: Vec3;
  /** Euler angles in degrees (Unity convention: shown in degrees). */
  readonly rotation: Vec3;
  readonly scale: Vec3;
  readonly components: readonly ComponentKind[];
}

/** Sun direction of the sample scene, in degrees. */
export const SUN = { elevation: 42, azimuth: 322 } as const;

/** Objects of the sample scene in hierarchy order. */
export const SAMPLE_SCENE: readonly SceneObjectInfo[] = [
  {
    id: 'main-camera',
    nameKey: 'object.mainCamera',
    kind: 'camera',
    areaId: null,
    position: [-3.5, 2.2, 7.5],
    rotation: [-11.6, -25, 0],
    scale: [1, 1, 1],
    components: ['camera'],
  },
  {
    id: 'sun',
    nameKey: 'object.sun',
    kind: 'sun',
    areaId: 'environment',
    position: [0, 3, 0],
    rotation: [SUN.elevation, SUN.azimuth, 0],
    scale: [1, 1, 1],
    components: ['light'],
  },
  {
    id: 'ground',
    nameKey: 'object.ground',
    kind: 'ground',
    areaId: 'environment',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    components: ['meshRenderer'],
  },
  {
    id: 'test-cube',
    nameKey: 'object.testCube',
    kind: 'cube',
    areaId: 'player1',
    position: [0, 0.5, 0],
    rotation: [0, 30, 0],
    scale: [1, 1, 1],
    components: ['meshRenderer'],
  },
];

/** Looks up a sample-scene object by ID. */
export function findSceneObject(id: string | null): SceneObjectInfo | undefined {
  return id === null ? undefined : SAMPLE_SCENE.find((object) => object.id === id);
}

/** Objects visible under an area tab ("all" shows everything). */
export function objectsInArea(areaId: string): readonly SceneObjectInfo[] {
  return areaId === 'all'
    ? SAMPLE_SCENE
    : SAMPLE_SCENE.filter((object) => object.areaId === areaId);
}
