import { describe, expect, it } from 'vitest';
import { readVrm } from '../src';

/** Packs a glTF JSON object into a GLB file (JSON chunk only). */
function glb(json: unknown): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(0x20);
  padded.set(bytes);
  const out = new Uint8Array(12 + 8 + padded.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, padded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(padded, 20);
  return out;
}

const nodes = [{ name: 'Root' }, { name: 'J_Bip_C_Hips' }, { name: 'J_Bip_L_Upper Arm.001' }];

describe('readVrm', () => {
  it('reads a VRM 1.0 humanoid and its license', () => {
    const info = readVrm(
      glb({
        nodes,
        extensions: {
          VRMC_vrm: {
            specVersion: '1.0',
            meta: { name: 'Hero', authors: ['Mia'], licenseUrl: 'https://vrm.dev/licenses/1.0/' },
            humanoid: {
              humanBones: { hips: { node: 1 }, leftUpperArm: { node: 2 }, unknown: { node: 0 } },
            },
          },
        },
      }),
    );
    expect(info?.version).toBe(1);
    expect(info?.title).toBe('Hero');
    expect(info?.license).toBe('https://vrm.dev/licenses/1.0/ (Mia)');
    // Node names are written like three.js names the loaded bones (spaces, dots).
    expect(info?.boneMap).toEqual({ hips: 'J_Bip_C_Hips', leftUpperArm: 'J_Bip_L_Upper_Arm001' });
  });

  it('reads VRM 0.x and renames the thumb bones', () => {
    const info = readVrm(
      glb({
        nodes,
        extensions: {
          VRM: {
            meta: { title: 'Old', author: 'Ken', licenseName: 'CC0' },
            humanoid: {
              humanBones: [
                { bone: 'hips', node: 1 },
                { bone: 'leftThumbProximal', node: 2 },
              ],
            },
          },
        },
      }),
    );
    expect(info?.version).toBe(0);
    expect(info?.license).toBe('CC0 (Ken)');
    expect(info?.boneMap).toEqual({
      hips: 'J_Bip_C_Hips',
      leftThumbMetacarpal: 'J_Bip_L_Upper_Arm001',
    });
  });

  it('returns null for files that are no VRM', () => {
    expect(readVrm(glb({ nodes }))).toBeNull();
    expect(readVrm(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
