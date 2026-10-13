import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry, Object3D, Texture } from 'three';
import { ModelCache } from '../models/ModelCache';
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

/** Prepares a model copy: picking, shadows and automatic instancing. */
function setUpModel(root: Object3D, objectId: string, cast: boolean, receive: boolean): Mesh[] {
  root.userData['model'] = true;
  root.userData['gameObjectId'] = objectId;
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (!(node as { isMesh?: boolean }).isMesh) return;
    const mesh = node as Mesh;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    if (!(node as { isSkinnedMesh?: boolean }).isSkinnedMesh) meshes.push(mesh);
  });
  return meshes;
}

/**
 * Mesh Renderer: shows a model (from the asset library or the project) or a built-in shape with
 * a PBR material (SPEC 8.15). Models keep their own materials; equal models are instanced.
 */
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
    model: {
      type: 'asset',
      default: null,
      assetType: 'model',
      text: { de: 'Modell', en: 'Model' },
    },
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
  create({ object, world }) {
    const material = new MeshStandardMaterial();
    const mesh = new Mesh(sharedGeometry('cube'), material);
    mesh.userData['gameObjectId'] = object.id;
    mesh.visible = object.visible;
    object.object3d.add(mesh);
    let texture: Texture | null = null;
    let enabled = true;
    let destroyed = false;
    let modelRef: string | null = null;
    let model: Object3D | null = null;
    let modelMeshes: Mesh[] = [];
    let shadows = { cast: true, receive: true };

    const removeModel = (): void => {
      for (const part of modelMeshes) world.batcher.remove(part);
      modelMeshes = [];
      model?.removeFromParent();
      model = null;
    };
    /** The shape is only part of the object while no model replaces it. */
    const useShape = (on: boolean): void => {
      if (on && !mesh.parent) {
        mesh.visible = enabled && object.visible;
        object.object3d.add(mesh);
      } else if (!on) {
        mesh.removeFromParent();
      }
    };
    const showModel = (ref: string): void => {
      world.requestModel(ref, (template) => {
        if (destroyed || modelRef !== ref || model) return;
        // A missing model shows the shape instead, like Unity's placeholder.
        useShape(template === null);
        if (!template) return;
        model = ModelCache.instantiate(template);
        modelMeshes = setUpModel(model, object.id, shadows.cast, shadows.receive);
        model.visible = enabled && object.visible;
        object.object3d.add(model);
        for (const part of modelMeshes) world.batcher.add(part);
      });
    };

    return {
      apply(values) {
        shadows = { cast: values.castShadows, receive: values.receiveShadows };
        if (values.model !== modelRef) {
          removeModel();
          modelRef = values.model;
          useShape(!modelRef);
          if (modelRef) showModel(modelRef);
        } else if (model) {
          setUpModel(model, object.id, shadows.cast, shadows.receive);
          world.batcher.invalidate();
        }
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
      setEnabled(value) {
        enabled = value;
        if (model) model.visible = value;
        mesh.visible = value;
      },
      destroy() {
        destroyed = true;
        removeModel();
        mesh.removeFromParent();
        material.dispose();
        texture?.dispose();
      },
    };
  },
});
