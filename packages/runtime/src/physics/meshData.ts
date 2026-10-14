import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Mesh, Object3D } from 'three';

/** Vertices and triangle indices of an object's own meshes, in its local space (unscaled). */
export interface MeshData {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  /** Key of the meshes the data was made from (changes when a model finished loading). */
  readonly key: string;
  readonly bounds: Box3;
}

/**
 * The meshes that belong to an object itself: shapes and models of its renderer, not those of
 * child objects and not the drawing helpers of automatic instancing.
 */
export function ownMeshes(root: Object3D): Mesh[] {
  const id: unknown = root.userData['gameObjectId'];
  const meshes: Mesh[] = [];
  const visit = (node: Object3D): void => {
    for (const child of node.children) {
      // Child objects have their own colliders.
      const owner: unknown = child.userData['gameObjectId'];
      if (owner !== undefined && owner !== id) continue;
      if ((child as { isMesh?: boolean }).isMesh && !child.userData['instanceBatch']) {
        meshes.push(child as Mesh);
      }
      visit(child);
    }
  };
  visit(root);
  return meshes;
}

/** Key of a set of meshes, to notice when they change. */
export function meshKey(meshes: readonly Mesh[]): string {
  return meshes.map((mesh) => `${mesh.uuid}:${(mesh.geometry as BufferGeometry).uuid}`).join('|');
}

/**
 * Collects the triangles of an object's own meshes in its local space, without the object's
 * own scale (physics applies the world scale itself). `null` if it has no meshes yet.
 */
export function meshData(root: Object3D): MeshData | null {
  const meshes = ownMeshes(root);
  if (meshes.length === 0) return null;
  root.updateWorldMatrix(true, true);
  const toLocal = new Matrix4().copy(root.matrixWorld).invert();
  const position = new Vector3();
  const scale = new Vector3();
  root.matrixWorld.decompose(position, new Quaternion(), scale);
  const unscale = new Matrix4().makeScale(scale.x || 1, scale.y || 1, scale.z || 1);
  const vertices: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();
  const bounds = new Box3();
  for (const mesh of meshes) {
    const geometry = mesh.geometry as BufferGeometry;
    const positions = geometry.getAttribute('position');
    if (!positions) continue;
    const matrix = unscale.clone().multiply(toLocal).multiply(mesh.matrixWorld);
    const offset = vertices.length / 3;
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(matrix);
      vertices.push(point.x, point.y, point.z);
      bounds.expandByPoint(point);
    }
    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(offset + index.getX(i));
    } else {
      for (let i = 0; i < positions.count; i++) indices.push(offset + i);
    }
  }
  if (vertices.length === 0) return null;
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    key: meshKey(meshes),
    bounds,
  };
}
