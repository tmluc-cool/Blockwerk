import type { SkinnedMesh } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { mapBones, readVrm, rigFromObject } from '../src';
import { avatarFbx, avatarGlb, AVATAR_BONES } from './avatars';

function skinnedCount(root: { traverse(callback: (node: object) => void): void }): number {
  let count = 0;
  root.traverse((node) => {
    if ((node as SkinnedMesh).isSkinnedMesh) count++;
  });
  return count;
}

describe('generated test avatar', () => {
  it('loads as a skinned FBX and its humanoid bones are recognized', () => {
    const scene = new FBXLoader().parse(new TextEncoder().encode(avatarFbx()).buffer, '');
    expect(skinnedCount(scene)).toBe(1);
    const rig = rigFromObject(scene);
    expect(rig.bones).toHaveLength(AVATAR_BONES.length);
    expect(mapBones(rig.bones).complete).toBe(true);
  });

  it('loads as a skinned GLB with the VRM humanoid and license', async () => {
    const data = avatarGlb({
      vrm: 1,
      name: (standard) => `b_${AVATAR_BONES.findIndex((b) => b.standard === standard)}`,
    });
    const gltf = await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
      '',
    );
    expect(skinnedCount(gltf.scene)).toBe(1);
    const rig = rigFromObject(gltf.scene);
    // Names no recognition can understand: only the VRM humanoid knows the bones.
    expect(mapBones(rig.bones).complete).toBe(false);
    const vrm = readVrm(data);
    expect(vrm?.license).toContain('publicdomain/zero');
    expect(Object.keys(vrm?.boneMap ?? {})).toHaveLength(AVATAR_BONES.length);
    expect(vrm?.boneMap['hips']).toBe('b_0');
  });
});
