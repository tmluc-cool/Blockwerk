import {
  AnimationClip,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { describe, expect, it } from 'vitest';
import { boneIndex, forwardPose, mapBones, retargetClip, STANDARD_BONES } from '../src';
import type { BoneMap, MappedRig, Rig, RigBone } from '../src';

/** World rest pose of a T-posed humanoid; `scale` changes the proportions. */
function tPose(scale: number): Record<string, Vector3> {
  const p = (x: number, y: number, z = 0): Vector3 => new Vector3(x * scale, y * scale, z * scale);
  return {
    hips: p(0, 1),
    spine: p(0, 1.1),
    chest: p(0, 1.3),
    neck: p(0, 1.5),
    head: p(0, 1.6),
    leftUpperLeg: p(0.1, 0.95),
    leftLowerLeg: p(0.1, 0.5),
    leftFoot: p(0.1, 0.08),
    leftToes: p(0.1, 0.03, 0.12),
    rightUpperLeg: p(-0.1, 0.95),
    rightLowerLeg: p(-0.1, 0.5),
    rightFoot: p(-0.1, 0.08),
    rightToes: p(-0.1, 0.03, 0.12),
    leftShoulder: p(0.05, 1.45),
    leftUpperArm: p(0.2, 1.45),
    leftLowerArm: p(0.5, 1.45),
    leftHand: p(0.75, 1.45),
    rightShoulder: p(-0.05, 1.45),
    rightUpperArm: p(-0.2, 1.45),
    rightLowerArm: p(-0.5, 1.45),
    rightHand: p(-0.75, 1.45),
  };
}

/**
 * Builds a rig from world rest positions. `twist` gives every bone its own local axes (a fixed
 * rotation per bone), so rigs agree on the pose but not on the bone axes.
 */
function makeRig(names: (standard: string) => string, scale: number, twist: boolean): MappedRig {
  const positions = tPose(scale);
  const present = STANDARD_BONES.filter((bone) => bone.name in positions);
  const worldRotations = new Map<string, Quaternion>();
  present.forEach((bone, index) => {
    worldRotations.set(
      bone.name,
      twist
        ? new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), 0.4 + index * 0.17)
        : new Quaternion(),
    );
  });
  const parentOf = (name: string): string | null => {
    let parent = STANDARD_BONES.find((bone) => bone.name === name)?.parent ?? null;
    while (parent !== null && !(parent in positions))
      parent = STANDARD_BONES.find((bone) => bone.name === parent)?.parent ?? null;
    return parent;
  };
  const bones: RigBone[] = present.map((bone) => {
    const parent = parentOf(bone.name);
    const world = positions[bone.name] as Vector3;
    const worldRotation = worldRotations.get(bone.name) as Quaternion;
    if (parent === null) {
      return {
        name: names(bone.name),
        parent: null,
        position: [world.x, world.y, world.z],
        quaternion: [worldRotation.x, worldRotation.y, worldRotation.z, worldRotation.w],
      };
    }
    const parentRotation = worldRotations.get(parent) as Quaternion;
    const offset = world
      .clone()
      .sub(positions[parent] as Vector3)
      .applyQuaternion(parentRotation.clone().invert());
    const local = parentRotation.clone().invert().multiply(worldRotation);
    return {
      name: names(bone.name),
      parent: present.findIndex((candidate) => candidate.name === parent),
      position: [offset.x, offset.y, offset.z],
      quaternion: [local.x, local.y, local.z, local.w],
    };
  });
  const rig: Rig = { bones };
  const map: Record<string, string> = {};
  for (const bone of present) map[bone.name] = names(bone.name);
  return { rig, map };
}

/** Rotation tracks of a clip given as world-space rotations of bones (parent bones' motion is inherited). */
function worldRotationClip(
  source: MappedRig,
  rotations: Record<string, Quaternion>,
  hips?: Vector3,
): AnimationClip {
  const rest = forwardPose(source.rig, []);
  const index = boneIndex(source.rig);
  const tracks = [];
  // Local rotation that gives the wanted world delta for a bone, assuming parents stay in rest.
  for (const [standard, delta] of Object.entries(rotations)) {
    const i = index.get(source.map[standard] ?? '') as number;
    const parent = source.rig.bones[i]?.parent ?? null;
    const parentWorld = parent === null ? new Quaternion() : (rest.rotation[parent] as Quaternion);
    const world = delta.clone().multiply(rest.rotation[i] as Quaternion);
    const local = parentWorld.clone().invert().multiply(world);
    tracks.push(
      new QuaternionKeyframeTrack(
        `${source.rig.bones[i]?.name}.quaternion`,
        [0, 1],
        [local.x, local.y, local.z, local.w, local.x, local.y, local.z, local.w],
      ),
    );
  }
  if (hips) {
    const i = index.get(source.map['hips'] ?? '') as number;
    const base = source.rig.bones[i]?.position as readonly number[];
    tracks.push(
      new VectorKeyframeTrack(
        `${source.rig.bones[i]?.name}.position`,
        [0, 1],
        [
          base[0] as number,
          base[1] as number,
          base[2] as number,
          (base[0] as number) + hips.x,
          (base[1] as number) + hips.y,
          (base[2] as number) + hips.z,
        ],
      ),
    );
  }
  return new AnimationClip('test', 1, tracks);
}

/** World pose of a rig with a clip applied at a time. */
function pose(
  rigged: MappedRig,
  clip: AnimationClip,
  time: number,
): { rotation: Quaternion[]; position: Vector3[] } {
  const rotations = rigged.rig.bones.map((bone) => {
    const track = clip.tracks.find((candidate) => candidate.name === `${bone.name}.quaternion`);
    if (!track) return new Quaternion(...bone.quaternion);
    const t = track.times;
    const f = Math.min(
      1,
      Math.max(0, (time - (t[0] ?? 0)) / ((t[t.length - 1] ?? 1) - (t[0] ?? 0) || 1)),
    );
    const frame = Math.min(t.length - 1, Math.round(f * (t.length - 1)));
    const v = track.values;
    return new Quaternion(v[frame * 4], v[frame * 4 + 1], v[frame * 4 + 2], v[frame * 4 + 3]);
  });
  const positions = rigged.rig.bones.map((bone) => {
    const track = clip.tracks.find((candidate) => candidate.name === `${bone.name}.position`);
    if (!track) return null;
    const t = track.times;
    const f = Math.min(
      1,
      Math.max(0, (time - (t[0] ?? 0)) / ((t[t.length - 1] ?? 1) - (t[0] ?? 0) || 1)),
    );
    const frame = Math.min(t.length - 1, Math.round(f * (t.length - 1)));
    const v = track.values;
    return new Vector3(v[frame * 3], v[frame * 3 + 1], v[frame * 3 + 2]);
  });
  return forwardPose(rigged.rig, rotations, positions);
}

/** Direction from a bone to another one in a posed rig. */
function direction(
  rigged: MappedRig,
  posed: ReturnType<typeof pose>,
  from: string,
  to: string,
): Vector3 {
  const index = boneIndex(rigged.rig);
  const a = posed.position[index.get(rigged.map[from] ?? '') as number] as Vector3;
  const b = posed.position[index.get(rigged.map[to] ?? '') as number] as Vector3;
  return b.clone().sub(a).normalize();
}

const source = makeRig((name) => `src_${name}`, 1, false);
// Another naming scheme, 15 % smaller proportions and different bone axes.
const target = makeRig((name) => `DEF-${name}`, 0.85, true);

describe('retargetClip', () => {
  it('brings a T-posed target into the A-pose of the source (arms down, not in the air)', () => {
    // Source: the T-pose with both upper arms turned down by 45° around the Z axis.
    const a = makeRig((name) => `a_${name}`, 1, false);
    const down = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 4);
    const rigA = { ...a, rig: { bones: a.rig.bones.map((bone) => bone) } };
    const restA = forwardPose(a.rig, []);
    const index = boneIndex(a.rig);
    // Pose the source rig in its rest by baking the rotation into the local rest of the arm.
    const bake = (side: 'left' | 'right', angle: number): void => {
      const i = index.get(a.map[`${side}UpperArm`] ?? '') as number;
      const bone = rigA.rig.bones[i] as RigBone;
      const parentWorld = restA.rotation[bone.parent as number] as Quaternion;
      const world = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle);
      const local = parentWorld.clone().invert().multiply(world);
      (rigA.rig.bones as RigBone[])[i] = {
        ...bone,
        quaternion: [local.x, local.y, local.z, local.w],
      };
    };
    bake('left', -Math.PI / 4);
    bake('right', Math.PI / 4);
    void down;
    const tTarget = makeRig((name) => `t_${name}`, 0.9, true);
    const still = retargetClip(new AnimationClip('idle', 1, []), rigA, tTarget);
    const sourcePose = pose(rigA, new AnimationClip('x', 1, []), 0);
    const targetPose = pose(tTarget, still, 0.5);
    for (const [from, to] of [
      ['leftUpperArm', 'leftLowerArm'],
      ['rightUpperArm', 'rightLowerArm'],
    ] as const) {
      const expected = direction(rigA, sourcePose, from, to);
      expect(expected.y, 'the source arm points down').toBeLessThan(-0.5);
      expect(direction(tTarget, targetPose, from, to).angleTo(expected), from).toBeLessThan(0.03);
    }
    // Without the alignment the target keeps its T-pose.
    const raw = retargetClip(new AnimationClip('idle', 1, []), rigA, tTarget, { alignRest: false });
    expect(
      direction(tTarget, pose(tTarget, raw, 0.5), 'leftUpperArm', 'leftLowerArm').y,
    ).toBeGreaterThan(-0.01);
  });

  it('reproduces the directions of the source bones on a rig with other axes and proportions', () => {
    const clip = worldRotationClip(source, {
      leftUpperArm: new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1.0),
      rightUpperArm: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.6),
      leftUpperLeg: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.7),
      spine: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4),
    });
    const retargeted = retargetClip(clip, source, target);
    const sourcePose = pose(source, clip, 1);
    const targetPose = pose(target, retargeted, 1);
    for (const [from, to] of [
      ['leftUpperArm', 'leftLowerArm'],
      ['leftLowerArm', 'leftHand'],
      ['rightUpperArm', 'rightLowerArm'],
      ['leftUpperLeg', 'leftLowerLeg'],
      ['leftLowerLeg', 'leftFoot'],
      ['hips', 'spine'],
      ['rightUpperLeg', 'rightLowerLeg'],
    ] as const) {
      const a = direction(source, sourcePose, from, to);
      const b = direction(target, targetPose, from, to);
      expect(a.angleTo(b), `${from} → ${to}`).toBeLessThan(0.02);
    }
    // A clip without motion leaves the target in its own rest pose.
    const still = retargetClip(worldRotationClip(source, {}), source, target);
    const rest = pose(target, still, 0.5);
    expect(direction(target, rest, 'leftUpperArm', 'leftLowerArm').x).toBeGreaterThan(0.999);
    expect(direction(target, rest, 'rightUpperLeg', 'rightLowerLeg').y).toBeLessThan(-0.999);
  });

  it('scales the hip movement with the height of the hips', () => {
    const clip = worldRotationClip(source, {}, new Vector3(0.2, 0.1, 0.4));
    const retargeted = retargetClip(clip, source, target);
    const hipsName = target.map['hips'] as string;
    const track = retargeted.tracks.find((candidate) => candidate.name === `${hipsName}.position`);
    expect(track).toBeDefined();
    const values = Array.from(track?.values ?? []);
    const rest = target.rig.bones[boneIndex(target.rig).get(hipsName) as number]
      ?.position as readonly number[];
    const last = values.slice(-3);
    // World delta (0.2, 0.1, 0.4) · 0.85, expressed in the (twisted) frame of the parent: use the world pose.
    const posed = pose(target, retargeted, 1);
    const hipsPosition = posed.position[boneIndex(target.rig).get(hipsName) as number] as Vector3;
    const expected = new Vector3(0, 1 * 0.85, 0).add(
      new Vector3(0.2, 0.1, 0.4).multiplyScalar(0.85),
    );
    expect(hipsPosition.distanceTo(expected)).toBeLessThan(1e-3);
    expect(last).toHaveLength(3);
    expect(rest).toHaveLength(3);
  });

  it('keeps the clip name and duration and writes a track per mapped bone', () => {
    const mapped = mapBones(
      target.rig.bones.map((bone) => ({
        name: bone.name.replace('DEF-', ''),
        parent: bone.parent,
      })),
    );
    expect(mapped.complete).toBe(true);
    const clip = worldRotationClip(source, {});
    const retargeted = retargetClip(clip, source, target, { fps: 10 });
    expect(retargeted.name).toBe('test');
    expect(retargeted.duration).toBe(1);
    expect(retargeted.tracks.length).toBe(Object.keys(target.map).length);
    const _unused: BoneMap = target.map;
    void _unused;
  });

  it('transfers bone scale from the clip relative to the rest scale of both skeletons', () => {
    // Some exporters keep bones scaled in the rest pose (0.5) and let the clips set 1.
    const scaled = (rig: MappedRig, factor: number): MappedRig => ({
      ...rig,
      rig: {
        bones: rig.rig.bones.map((bone) => ({ ...bone, scale: [factor, factor, factor] as const })),
      },
    });
    const donor = scaled(source, 0.5);
    const receiver = scaled(target, 0.7);
    const spineName = donor.map['spine'] as string;
    const base = worldRotationClip(donor, {});
    const clip = new AnimationClip(base.name, base.duration, [
      ...base.tracks,
      new VectorKeyframeTrack(`${spineName}.scale`, [0, 1], [1, 1, 1, 1, 1, 1]),
    ]);
    const retargeted = retargetClip(clip, donor, receiver);
    const track = retargeted.tracks.find(
      (candidate) => candidate.name === `${receiver.map['spine']}.scale`,
    );
    expect(track).toBeDefined();
    // 1 / 0.5 = 2 times the donor's rest scale, so 2 × 0.7 on the receiver.
    expect(Array.from(track?.values.slice(0, 3) ?? [])).toEqual([
      expect.closeTo(1.4, 5),
      expect.closeTo(1.4, 5),
      expect.closeTo(1.4, 5),
    ]);
    // Bones the clip does not scale get no scale track.
    expect(retargeted.tracks.filter((candidate) => candidate.name.endsWith('.scale'))).toHaveLength(
      1,
    );
  });
});
