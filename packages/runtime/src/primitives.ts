import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';

/** Built-in primitive shapes (Unity: GameObject > 3D Object). */
export type PrimitiveShape = 'cube' | 'sphere';

/** Options for {@link createPrimitive}. */
export interface PrimitiveOptions {
  /** Base color as hex number. */
  color?: number;
  /** Surface roughness 0..1. */
  roughness?: number;
}

function createGeometry(shape: PrimitiveShape): BufferGeometry {
  switch (shape) {
    case 'cube':
      return new BoxGeometry(1, 1, 1);
    case 'sphere':
      return new SphereGeometry(0.5, 48, 24);
  }
}

/**
 * Creates a primitive mesh with a PBR material. Primitives are 1 m in size, centered on
 * their origin, and cast and receive shadows.
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
  const mesh = new Mesh(createGeometry(shape), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
