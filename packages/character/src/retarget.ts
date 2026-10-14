import {
  AnimationClip,
  QuaternionKeyframeTrack,
  Quaternion,
  VectorKeyframeTrack,
  Vector3,
} from 'three';
import type { KeyframeTrack } from 'three';
import type { BoneMap } from './mapping';
import { boneIndex, forwardPose } from './rig';
import type { Rig } from './rig';
import { mappedParent, STANDARD_BONES } from './skeleton';

/** A skeleton with the mapping of its bones to the standard skeleton. */
export interface MappedRig {
  readonly rig: Rig;
  readonly map: BoneMap;
}

/** Options of {@link retargetClip}. */
export interface RetargetOptions {
  /** Sampling rate of the result in frames per second (default 30). */
  readonly fps?: number;
  /**
   * Brings the target into the rest pose of the source first (A-pose animations on a T-posed
   * avatar and the other way round). On by default.
   */
  readonly alignRest?: boolean;
}

/** The value of a track at a time (rotations are interpolated spherically). */
function sample(track: KeyframeTrack, time: number, size: number): number[] {
  const { times, values } = track;
  const last = times.length - 1;
  const at = (index: number): number[] =>
    Array.from(values.slice(index * size, index * size + size));
  if (last <= 0 || time <= (times[0] ?? 0)) return at(0);
  if (time >= (times[last] ?? 0)) return at(last);
  let next = 1;
  while (next < last && (times[next] ?? 0) < time) next++;
  const t0 = times[next - 1] ?? 0;
  const t1 = times[next] ?? 1;
  const f = t1 > t0 ? (time - t0) / (t1 - t0) : 0;
  const a = at(next - 1);
  const b = at(next);
  if (size === 4) {
    const q = new Quaternion(a[0], a[1], a[2], a[3]).slerp(
      new Quaternion(b[0], b[1], b[2], b[3]),
      f,
    );
    return [q.x, q.y, q.z, q.w];
  }
  return a.map((value, i) => value + ((b[i] ?? 0) - value) * f);
}

/** The track of a node and property, e.g. `hips` and `quaternion`. */
function trackOf(clip: AnimationClip, node: string, property: string): KeyframeTrack | undefined {
  return clip.tracks.find((track) => track.name === `${node}.${property}`);
}

/**
 * Retargets an animation clip from one humanoid skeleton onto another (SPEC 8.7): for every
 * bone known to both skeletons the world-space rotation change of the source bone is applied to
 * the rest pose of the target bone, so differently oriented bone axes do not matter. The hips
 * movement is scaled by the height of the hips. The result only has rotation tracks for the
 * mapped bones (and a position track for the hips); everything else stays in the rest pose.
 * Both skeletons must face the same way and be in a similar rest pose (T- or A-pose).
 */
export function retargetClip(
  clip: AnimationClip,
  source: MappedRig,
  target: MappedRig,
  options: RetargetOptions = {},
): AnimationClip {
  const fps = options.fps ?? 30;
  const sourceIndex = boneIndex(source.rig);
  const targetIndex = boneIndex(target.rig);
  const shared = STANDARD_BONES.filter(
    (bone) =>
      bone.name in source.map &&
      bone.name in target.map &&
      sourceIndex.has(source.map[bone.name] ?? '') &&
      targetIndex.has(target.map[bone.name] ?? ''),
  ).map((bone) => ({
    standard: bone.name,
    s: sourceIndex.get(source.map[bone.name] ?? '') as number,
    t: targetIndex.get(target.map[bone.name] ?? '') as number,
  }));
  const sourceRest = forwardPose(source.rig, []);
  const targetRest = forwardPose(target.rig, []);
  const sourceRotationTracks = source.rig.bones.map((bone) =>
    trackOf(clip, bone.name, 'quaternion'),
  );
  const hips = shared.find((entry) => entry.standard === 'hips');
  const sourceHipsTrack = hips
    ? trackOf(clip, source.rig.bones[hips.s]?.name ?? '', 'position')
    : undefined;
  const hipHeightRatio =
    hips && (sourceRest.position[hips.s]?.y ?? 0) > 1e-6
      ? (targetRest.position[hips.t]?.y ?? 1) / (sourceRest.position[hips.s]?.y ?? 1)
      : 1;

  // Rest-pose alignment: the rotation that turns each target bone onto the direction of the
  // matching source bone (towards its first mapped child). Leaf bones inherit their parent's.
  const alignment = new Map<string, Quaternion>();
  const sharedNames = new Set(shared.map((entry) => entry.standard));
  for (const entry of shared) {
    let aligned = new Quaternion();
    if (options.alignRest !== false) {
      const child = shared.find(
        (other) => mappedParent(other.standard, sharedNames) === entry.standard,
      );
      if (child) {
        const sourceDirection = (sourceRest.position[child.s] as Vector3)
          .clone()
          .sub(sourceRest.position[entry.s] as Vector3)
          .normalize();
        const targetDirection = (targetRest.position[child.t] as Vector3)
          .clone()
          .sub(targetRest.position[entry.t] as Vector3)
          .normalize();
        aligned = new Quaternion().setFromUnitVectors(targetDirection, sourceDirection);
      } else {
        const parent = mappedParent(entry.standard, sharedNames);
        aligned = (parent && alignment.get(parent)?.clone()) || aligned;
      }
    }
    alignment.set(entry.standard, aligned);
  }

  const frames = Math.max(1, Math.round(clip.duration * fps));
  const times: number[] = [];
  for (let frame = 0; frame <= frames; frame++) times.push((frame / frames) * clip.duration);
  const rotationValues = new Map<number, number[]>(shared.map((entry) => [entry.t, []]));
  const hipsValues: number[] = [];
  // Scale: where the donor's clip scales a bone away from its rest scale, the target bone is
  // scaled by the same factor from its own rest scale.
  const scaleTracks = new Map<number, KeyframeTrack>();
  for (const entry of shared) {
    const bone = source.rig.bones[entry.s];
    const track = bone ? trackOf(clip, bone.name, 'scale') : undefined;
    if (!bone || !track) continue;
    const sourceRest = bone.scale ?? [1, 1, 1];
    const targetRest = target.rig.bones[entry.t]?.scale ?? [1, 1, 1];
    const values: number[] = [];
    let changes = false;
    for (const time of times) {
      const value = sample(track, time, 3);
      for (let axis = 0; axis < 3; axis++) {
        const rest = sourceRest[axis] || 1;
        const ratio = (value[axis] ?? 1) / rest;
        if (Math.abs(ratio - 1) > 1e-3) changes = true;
        values.push((targetRest[axis] ?? 1) * ratio);
      }
    }
    if (changes) {
      scaleTracks.set(
        entry.t,
        new VectorKeyframeTrack(`${target.rig.bones[entry.t]?.name}.scale`, times, values),
      );
    }
  }

  for (const time of times) {
    const rotations = source.rig.bones.map((bone, index) => {
      const track = sourceRotationTracks[index];
      if (!track) return new Quaternion(...bone.quaternion);
      const value = sample(track, time, 4);
      return new Quaternion(value[0], value[1], value[2], value[3]);
    });
    const positions = source.rig.bones.map(() => null as Vector3 | null);
    if (hips && sourceHipsTrack) {
      const value = sample(sourceHipsTrack, time, 3);
      positions[hips.s] = new Vector3(value[0], value[1], value[2]);
    }
    const posed = forwardPose(source.rig, rotations, positions);

    // Target world rotations: the source's world delta applied to the target's rest.
    const worldTarget = new Map<number, Quaternion>();
    const localTarget: Quaternion[] = [];
    target.rig.bones.forEach((bone, index) => {
      const entry = shared.find((candidate) => candidate.t === index);
      const parentWorld =
        bone.parent === null ? new Quaternion() : (worldTarget.get(bone.parent) as Quaternion);
      let local: Quaternion;
      if (entry) {
        const delta = (posed.rotation[entry.s] as Quaternion)
          .clone()
          .multiply((sourceRest.rotation[entry.s] as Quaternion).clone().invert());
        const world = delta
          .multiply(alignment.get(entry.standard) as Quaternion)
          .multiply(targetRest.rotation[index] as Quaternion);
        local = parentWorld.clone().invert().multiply(world);
        rotationValues.get(index)?.push(local.x, local.y, local.z, local.w);
      } else {
        local = new Quaternion(...bone.quaternion);
      }
      localTarget.push(local);
      worldTarget.set(index, parentWorld.clone().multiply(local));
    });

    if (hips && sourceHipsTrack) {
      const sourceParent = source.rig.bones[hips.s]?.parent ?? null;
      const targetParent = target.rig.bones[hips.t]?.parent ?? null;
      const sourceParentRotation =
        sourceParent === null ? new Quaternion() : (posed.rotation[sourceParent] as Quaternion);
      const targetParentRotation =
        targetParent === null ? new Quaternion() : (worldTarget.get(targetParent) as Quaternion);
      const restPosition = new Vector3(...(source.rig.bones[hips.s]?.position ?? [0, 0, 0]));
      const moved = (positions[hips.s] as Vector3).clone().sub(restPosition);
      const worldDelta = moved.applyQuaternion(sourceParentRotation).multiplyScalar(hipHeightRatio);
      const local = new Vector3(...(target.rig.bones[hips.t]?.position ?? [0, 0, 0])).add(
        worldDelta.applyQuaternion(targetParentRotation.clone().invert()),
      );
      hipsValues.push(local.x, local.y, local.z);
    }
  }

  const tracks: KeyframeTrack[] = shared.map(
    (entry) =>
      new QuaternionKeyframeTrack(
        `${target.rig.bones[entry.t]?.name}.quaternion`,
        times,
        rotationValues.get(entry.t) ?? [],
      ),
  );
  if (hips && sourceHipsTrack) {
    tracks.push(
      new VectorKeyframeTrack(`${target.rig.bones[hips.t]?.name}.position`, times, hipsValues),
    );
  }
  tracks.push(...scaleTracks.values());
  return new AnimationClip(clip.name, clip.duration, tracks);
}
