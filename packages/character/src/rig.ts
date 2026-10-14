import { Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { BoneInfo } from './mapping';

/** A bone of a rig with its rest pose relative to its parent. */
export interface RigBone extends BoneInfo {
  readonly position: readonly [number, number, number];
  readonly quaternion: readonly [number, number, number, number];
  /** Rest scale (default 1). Some exporters keep bones scaled in the rest pose and let the clips set the real scale. */
  readonly scale?: readonly [number, number, number];
}

/** A skeleton: bones in parent-before-child order. */
export interface Rig {
  readonly bones: readonly RigBone[];
}

/** Index of each bone by name. */
export function boneIndex(rig: Rig): Map<string, number> {
  return new Map(rig.bones.map((bone, index) => [bone.name, index]));
}

/** World rotations and positions of all bones for local rotations (and optional positions). */
export function forwardPose(
  rig: Rig,
  rotations: readonly Quaternion[],
  positions: readonly (Vector3 | null)[] = [],
): { rotation: Quaternion[]; position: Vector3[] } {
  const rotation: Quaternion[] = [];
  const position: Vector3[] = [];
  rig.bones.forEach((bone, index) => {
    const local = rotations[index] ?? new Quaternion(...bone.quaternion);
    const offset = positions[index] ?? new Vector3(...bone.position);
    if (bone.parent === null) {
      rotation.push(local.clone());
      position.push(offset.clone());
    } else {
      const parentRotation = rotation[bone.parent] ?? new Quaternion();
      const parentPosition = position[bone.parent] ?? new Vector3();
      rotation.push(parentRotation.clone().multiply(local));
      position.push(offset.clone().applyQuaternion(parentRotation).add(parentPosition));
    }
  });
  return { rotation, position };
}

/**
 * Reads the rig of a loaded model: the bones of its skeleton (or, without skinning, all nodes
 * below the root) in parent-before-child order, with their rest pose.
 */
export function rigFromObject(root: Object3D): Rig {
  const nodes: Object3D[] = [];
  let skinnedBones: Object3D[] | null = null;
  root.traverse((node) => {
    const mesh = node as { isSkinnedMesh?: boolean; skeleton?: { bones: Object3D[] } };
    if (mesh.isSkinnedMesh && mesh.skeleton && !skinnedBones) skinnedBones = mesh.skeleton.bones;
  });
  if (skinnedBones) nodes.push(...(skinnedBones as Object3D[]));
  else root.traverse((node) => node !== root && nodes.push(node));
  const index = new Map(nodes.map((node, i) => [node, i]));
  const bones: RigBone[] = nodes.map((node) => ({
    name: node.name,
    parent: node.parent ? (index.get(node.parent) ?? null) : null,
    position: [node.position.x, node.position.y, node.position.z],
    quaternion: [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w],
    scale: [node.scale.x, node.scale.y, node.scale.z],
  }));
  // Parent before child (skeleton arrays usually are, but not always).
  const order: number[] = [];
  const done = new Set<number>();
  const visit = (i: number): void => {
    if (done.has(i)) return;
    const parent = bones[i]?.parent ?? null;
    if (parent !== null) visit(parent);
    done.add(i);
    order.push(i);
  };
  bones.forEach((_, i) => visit(i));
  const remap = new Map(order.map((old, fresh) => [old, fresh]));
  return {
    bones: order.map((old) => {
      const bone = bones[old] as RigBone;
      return { ...bone, parent: bone.parent === null ? null : (remap.get(bone.parent) ?? null) };
    }),
  };
}
