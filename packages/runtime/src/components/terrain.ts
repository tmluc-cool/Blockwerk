import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';
import { registerCollider } from './colliders';
import type { ColliderState } from './colliders';
import { onQualityChange, qualitySettings } from '../rendering/quality';
import { loadTerrain } from '../terrain/source';
import { TerrainGrass } from '../terrain/TerrainGrass';
import { TerrainMesh } from '../terrain/TerrainMesh';
import type { TerrainLayerColors } from '../terrain/TerrainMesh';
import type { TerrainData, TerrainRegion } from '../terrain/TerrainData';
import type { GameObject } from '../world/GameObject';

/** The live state of a terrain component (for the editor's brushes and for blocks). */
export interface TerrainState {
  readonly data: TerrainData;
  /** Redraws after the height map or the paint changed; `null` redraws everything. */
  refresh(region: TerrainRegion | null): void;
}

/** Terrain states by object. */
export const terrainRegistry = new WeakMap<GameObject, TerrainState>();

const fields = {
  terrain: {
    type: 'asset',
    assetType: 'terrain',
    default: null,
    text: { de: 'Gelände-Datei', en: 'Terrain Data' },
  },
  revision: { type: 'number', default: 0, hidden: true, text: { de: 'Stand', en: 'Revision' } },
  layer0: {
    type: 'color',
    default: '#5f8f3c',
    group: 'layers',
    text: { de: 'Schicht 1 (Gras)', en: 'Layer 1 (Grass)' },
  },
  layer1: {
    type: 'color',
    default: '#8b6b47',
    group: 'layers',
    text: { de: 'Schicht 2 (Erde)', en: 'Layer 2 (Dirt)' },
  },
  layer2: {
    type: 'color',
    default: '#807d78',
    group: 'layers',
    text: { de: 'Schicht 3 (Fels)', en: 'Layer 3 (Rock)' },
  },
  layer3: {
    type: 'color',
    default: '#d6c48f',
    group: 'layers',
    text: { de: 'Schicht 4 (Sand)', en: 'Layer 4 (Sand)' },
  },
  grass: {
    type: 'boolean',
    default: true,
    group: 'grass',
    text: { de: 'Gras', en: 'Grass' },
  },
  grassDensity: {
    type: 'number',
    default: 2,
    min: 0,
    max: 8,
    step: 0.25,
    group: 'grass',
    text: { de: 'Büschel pro m²', en: 'Clumps per m²' },
  },
  grassHeight: {
    type: 'number',
    default: 0.55,
    min: 0.05,
    max: 2,
    step: 0.05,
    unit: 'meters',
    group: 'grass',
    text: { de: 'Grashöhe', en: 'Grass Height' },
  },
  grassColor: {
    type: 'color',
    default: '#7fb24a',
    group: 'grass',
    text: { de: 'Grasfarbe', en: 'Grass Color' },
  },
  grassLayer: {
    type: 'number',
    default: 1,
    min: 1,
    max: 4,
    step: 1,
    group: 'grass',
    text: { de: 'Wächst auf Schicht', en: 'Grows on Layer' },
  },
  grassMinHeight: {
    type: 'number',
    default: -1000,
    step: 0.5,
    unit: 'meters',
    group: 'grass',
    text: { de: 'Kein Gras unterhalb', en: 'No Grass Below' },
  },
} as const satisfies FieldDefinitions;

/** Terrain (Unity: Terrain): hills, paint layers, grass and a collider from a terrain file. */
export const terrain = defineComponent({
  type: 'terrain',
  category: 'rendering',
  unique: true,
  unity: 'Terrain',
  text: { de: 'Gelände', en: 'Terrain' },
  docs: {
    de: 'Eine Landschaft aus einer Höhenkarte mit vier Farbschichten, Gras und Kollision. Der Ursprung des Objekts liegt in der Mitte. Mit den Gelände-Werkzeugen im Inspektor formst und malst du sie.',
    en: 'A landscape from a height map with four paint layers, grass and collision. The object’s origin is at the center. Shape and paint it with the terrain tools in the inspector.',
  },
  keywords: {
    de: ['landschaft', 'hügel', 'berg', 'gras', 'boden'],
    en: ['landscape', 'hills', 'mountain', 'grass', 'ground'],
  },
  fields,
  create({ object, world }) {
    let mesh: TerrainMesh | null = null;
    let grass: TerrainGrass | null = null;
    let colors: TerrainLayerColors = [
      fields.layer0.default,
      fields.layer1.default,
      fields.layer2.default,
      fields.layer3.default,
    ];
    let grassSettings = {
      enabled: true,
      density: 2,
      height: 0.55,
      color: '#7fb24a',
      layer: 0,
      minHeight: -1000,
    };
    const collider: ColliderState = {
      shape: {
        kind: 'heightfield',
        center: [0, 0, 0],
        resolution: 2,
        size: 1,
        heights: new Float32Array(4),
        minHeight: 0,
        maxHeight: 0,
      },
      isTrigger: false,
      enabled: true,
      friction: 0.8,
      bounciness: 0,
      version: 0,
    };
    const unregister = registerCollider(object, collider);
    let loadedId: string | null | undefined;
    const makeGrass = (): void => {
      grass?.dispose();
      grass = null;
      if (!mesh || !grassSettings.enabled) return;
      grass = new TerrainGrass(
        mesh.terrain,
        {
          density: grassSettings.density,
          height: grassSettings.height,
          color: grassSettings.color,
          layer: grassSettings.layer,
          minHeight: grassSettings.minHeight,
          quality: qualitySettings().grassDensity,
          distance: qualitySettings().detailDistance,
        },
        () => world.environment.weather.state.windSpeed,
      );
      mesh.mesh.add(grass.root);
    };
    const updateCollider = (): void => {
      if (!mesh) return;
      const data = mesh.terrain;
      const { min, max } = data.heightRange();
      collider.shape = {
        kind: 'heightfield',
        center: [0, 0, 0],
        resolution: data.resolution,
        size: data.size,
        heights: data.heights,
        minHeight: min,
        maxHeight: max,
      };
      collider.version += 1;
    };
    const stopListening = onQualityChange(() => makeGrass());
    const state: TerrainState = {
      get data() {
        if (!mesh) throw new Error('This terrain has no data.');
        return mesh.terrain;
      },
      refresh(region) {
        mesh?.update(region);
        updateCollider();
        grass?.rebuild();
      },
    };
    return {
      apply(values) {
        colors = [values.layer0, values.layer1, values.layer2, values.layer3];
        grassSettings = {
          enabled: values.grass,
          density: values.grassDensity,
          height: values.grassHeight,
          color: values.grassColor,
          layer: Math.round(values.grassLayer) - 1,
          minHeight: values.grassMinHeight,
        };
        if (loadedId !== values.terrain) {
          loadedId = values.terrain;
          mesh?.dispose();
          mesh = null;
          terrainRegistry.delete(object);
          const data = values.terrain ? loadTerrain(values.terrain) : null;
          if (data) {
            mesh = new TerrainMesh(data, colors);
            object.object3d.add(mesh.mesh);
            terrainRegistry.set(object, state);
            updateCollider();
          }
        } else {
          mesh?.setColors(colors);
        }
        makeGrass();
      },
      setEnabled(enabled) {
        collider.enabled = enabled;
        collider.version += 1;
        if (mesh) mesh.mesh.visible = enabled;
      },
      destroy() {
        stopListening();
        grass?.dispose();
        mesh?.dispose();
        terrainRegistry.delete(object);
        unregister();
      },
    };
  },
});
