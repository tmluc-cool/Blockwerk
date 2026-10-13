import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Built-in primitive shapes (Unity: GameObject > 3D Object, plus ramp and stairs). */
export const PRIMITIVE_SHAPES = [
  'cube',
  'sphere',
  'cylinder',
  'capsule',
  'plane',
  'ramp',
  'stairs',
] as const;
export type PrimitiveShape = (typeof PRIMITIVE_SHAPES)[number];

/** Options for {@link createPrimitive}. */
export interface PrimitiveOptions {
  /** Base color as hex number. */
  color?: number;
  /** Surface roughness 0..1. */
  roughness?: number;
}

/** Number of steps of the stairs primitive. */
const STAIR_STEPS = 5;

/** Wedge of 1×1×1 m rising towards +Z (low edge at -Z), with flat-shaded faces. */
function createRampGeometry(): BufferGeometry {
  const a = [-0.5, -0.5, -0.5];
  const b = [0.5, -0.5, -0.5];
  const c = [0.5, -0.5, 0.5];
  const d = [-0.5, -0.5, 0.5];
  const e = [-0.5, 0.5, 0.5];
  const f = [0.5, 0.5, 0.5];
  // Counter-clockwise triangles seen from outside.
  const triangles = [
    [a, b, c],
    [a, c, d], // bottom
    [d, c, f],
    [d, f, e], // back (+Z)
    [a, e, f],
    [a, f, b], // slope
    [a, d, e], // side -X
    [b, f, c], // side +X
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(triangles.flat(2), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Stairs of 1×1×1 m rising towards +Z. */
function createStairsGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const depth = 1 / STAIR_STEPS;
  for (let step = 0; step < STAIR_STEPS; step++) {
    const height = (step + 1) / STAIR_STEPS;
    const box = new BoxGeometry(1, height, depth);
    box.translate(0, -0.5 + height / 2, -0.5 + depth * (step + 0.5));
    parts.push(box);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}

/** Creates the geometry of a primitive. All primitives are about 1 m in size, centered on their origin. */
export function createPrimitiveGeometry(shape: PrimitiveShape): BufferGeometry {
  switch (shape) {
    case 'cube':
      return new BoxGeometry(1, 1, 1);
    case 'sphere':
      return new SphereGeometry(0.5, 48, 24);
    case 'cylinder':
      return new CylinderGeometry(0.5, 0.5, 2, 40);
    case 'capsule':
      return new CapsuleGeometry(0.5, 1, 8, 24);
    case 'plane': {
      // 10 × 10 m like Unity's plane, lying flat and facing up.
      const plane = new PlaneGeometry(10, 10);
      plane.rotateX(-Math.PI / 2);
      return plane;
    }
    case 'ramp':
      return createRampGeometry();
    case 'stairs':
      return createStairsGeometry();
  }
}

/**
 * Creates a primitive mesh with a PBR material. The mesh casts and receives shadows.
 */
export function createPrimitive(
  shape: PrimitiveShape,
  options: PrimitiveOptions = {},
): Mesh<BufferGeometry, MeshStandardMaterial> {
  const material = new MeshStandardMaterial({
    color: options.color ?? 0xd9d9d9,
    roughness: options.roughness ?? 0.55,
    metalness: 0,
  });
  const mesh = new Mesh(createPrimitiveGeometry(shape), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
