import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry, Texture } from 'three';
import { createGroundTexture } from '../environment/groundTexture';
import { createPrimitiveGeometry, PRIMITIVE_SHAPES } from '../primitives';
import type { PrimitiveShape } from '../primitives';
import { defineComponent } from './defineComponent';

const SHAPE_TEXT: Readonly<Record<PrimitiveShape, { de: string; en: string }>> = {
  cube: { de: 'Würfel', en: 'Cube' },
  sphere: { de: 'Kugel', en: 'Sphere' },
  cylinder: { de: 'Zylinder', en: 'Cylinder' },
  capsule: { de: 'Kapsel', en: 'Capsule' },
  plane: { de: 'Ebene', en: 'Plane' },
  ramp: { de: 'Rampe', en: 'Ramp' },
  stairs: { de: 'Treppe', en: 'Stairs' },
};

/** Geometries are shared by all renderers of the same shape (and later instanced). */
const geometryCache = new Map<PrimitiveShape, BufferGeometry>();

function sharedGeometry(shape: PrimitiveShape): BufferGeometry {
  let geometry = geometryCache.get(shape);
  if (!geometry) {
    geometry = createPrimitiveGeometry(shape);
    geometryCache.set(shape, geometry);
  }
  return geometry;
}

let tilesTexture: Texture | null = null;

function tiles(): Texture {
  tilesTexture ??= createGroundTexture();
  return tilesTexture;
}

/** Mesh Renderer: shows a primitive shape with a PBR material (SPEC 8.15, phase 1 uses built-in shapes). */
export const meshRenderer = defineComponent({
  type: 'meshRenderer',
  category: 'rendering',
  unique: true,
  unity: 'MeshRenderer + MeshFilter',
  text: { de: 'Modell-Renderer', en: 'Mesh Renderer' },
  docs: {
    de: 'Zeigt eine Form mit einem Material an.',
    en: 'Displays a shape with a material.',
  },
  keywords: { de: ['form', 'modell', 'material'], en: ['mesh', 'shape', 'material'] },
  fields: {
    shape: {
      type: 'enum',
      default: 'cube',
      options: PRIMITIVE_SHAPES.map((value) => ({ value, text: SHAPE_TEXT[value] })),
      text: { de: 'Form', en: 'Shape' },
    },
    castShadows: {
      type: 'boolean',
      default: true,
      text: { de: 'Wirft Schatten', en: 'Cast Shadows' },
    },
    receiveShadows: {
      type: 'boolean',
      default: true,
      text: { de: 'Empfängt Schatten', en: 'Receive Shadows' },
    },
    color: {
      type: 'color',
      default: '#d9d9d9',
      group: 'material',
      text: { de: 'Farbe', en: 'Color' },
    },
    metallic: {
      type: 'number',
      default: 0,
      min: 0,
      max: 1,
      step: 0.05,
      group: 'material',
      text: { de: 'Metallisch', en: 'Metallic' },
    },
    smoothness: {
      type: 'number',
      default: 0.45,
      min: 0,
      max: 1,
      step: 0.05,
      group: 'material',
      text: { de: 'Glätte', en: 'Smoothness' },
    },
    texture: {
      type: 'enum',
      default: 'none',
      options: [
        { value: 'none', text: { de: 'Keine', en: 'None' } },
        { value: 'tiles', text: { de: 'Fliesen', en: 'Tiles' } },
      ],
      group: 'material',
      text: { de: 'Textur', en: 'Texture' },
    },
    tiling: {
      type: 'number',
      default: 1,
      min: 0.01,
      step: 0.5,
      group: 'material',
      text: { de: 'Kachelung', en: 'Tiling' },
    },
  },
  create({ object }) {
    const material = new MeshStandardMaterial();
    const mesh = new Mesh(sharedGeometry('cube'), material);
    mesh.userData['gameObjectId'] = object.id;
    object.object3d.add(mesh);
    let texture: Texture | null = null;
    return {
      apply(values) {
        mesh.geometry = sharedGeometry(values.shape as PrimitiveShape);
        mesh.castShadow = values.castShadows;
        mesh.receiveShadow = values.receiveShadows;
        material.color = new Color(values.color);
        material.metalness = values.metallic;
        material.roughness = 1 - values.smoothness;
        if (values.texture === 'tiles') {
          texture ??= tiles().clone();
          // The plane is 10 m wide, everything else about 1 m: tiles stay 1 m at tiling 1.
          const meters = values.shape === 'plane' ? 10 : 1;
          texture.repeat.set(meters * values.tiling, meters * values.tiling);
          texture.needsUpdate = true;
          material.map = texture;
        } else {
          material.map = null;
        }
        material.needsUpdate = true;
      },
      setEnabled(enabled) {
        mesh.visible = enabled;
      },
      destroy() {
        mesh.removeFromParent();
        material.dispose();
        texture?.dispose();
      },
    };
  },
});
