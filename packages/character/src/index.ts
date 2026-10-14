/**
 * @blockwerk/character: Standard skeleton (VRM bone names), skeleton mapping, retargeting and
 * character builder logic (SPEC 5.10, 8.7).
 */
export { mapBones } from './mapping';
export type { BoneInfo, BoneMap, BoneMapping } from './mapping';
export { mappedParent, REQUIRED_BONES, STANDARD_BONES, standardBone } from './skeleton';
export type { BoneSide, StandardBone, StandardBoneName } from './skeleton';
export { boneIndex, forwardPose, rigFromObject } from './rig';
export type { Rig, RigBone } from './rig';
export { retargetClip } from './retarget';
export type { MappedRig, RetargetOptions } from './retarget';
