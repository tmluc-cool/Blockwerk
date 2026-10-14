import { describe, expect, it } from 'vitest';
import { mapBones, REQUIRED_BONES, STANDARD_BONES } from '../src';
import type { BoneInfo } from '../src';

/** A chain-like skeleton from a flat list of names (parents do not matter for naming). */
function bones(names: string[]): BoneInfo[] {
  return names.map((name, index) => ({ name, parent: index === 0 ? null : index - 1 }));
}

describe('standard skeleton', () => {
  it('uses the VRM humanoid names with 15 required bones and consistent parents', () => {
    expect(STANDARD_BONES).toHaveLength(55);
    expect(REQUIRED_BONES).toHaveLength(15);
    const names = new Set(STANDARD_BONES.map((bone) => bone.name));
    for (const bone of STANDARD_BONES) {
      if (bone.parent !== null) expect(names.has(bone.parent), bone.name).toBe(true);
    }
    expect(
      names.has('leftUpperArm') && names.has('rightToes') && names.has('leftIndexDistal'),
    ).toBe(true);
  });
});

describe('bone mapping', () => {
  it('maps KayKit Rig_Medium (no neck, no shoulders, many helper bones)', () => {
    const names =
      'root,hips,spine,chest,upperarm.l,lowerarm.l,wrist.l,hand.l,handslot.l,upperarm.r,lowerarm.r,wrist.r,hand.r,handslot.r,head,upperleg.l,lowerleg.l,foot.l,toes.l,upperleg.r,lowerleg.r,foot.r,toes.r,kneeIK.l,control-toe-roll.l,control-heel-roll.l,control-foot-roll.l,heelIK.l,IK-foot.l,IK-toe.l,kneeIK.r,control-toe-roll.r,control-heel-roll.r,control-foot-roll.r,heelIK.r,IK-foot.r,IK-toe.r,elbowIK.l,handIK.l,elbowIK.r,handIK.r'.split(
        ',',
      );
    const result = mapBones(bones(names));
    expect(result.complete).toBe(true);
    expect(result.map).toMatchObject({
      hips: 'hips',
      spine: 'spine',
      chest: 'chest',
      head: 'head',
      leftUpperArm: 'upperarm.l',
      rightLowerArm: 'lowerarm.r',
      leftHand: 'hand.l',
      rightUpperLeg: 'upperleg.r',
      leftFoot: 'foot.l',
      rightToes: 'toes.r',
    });
    expect(result.unmatched).toEqual(expect.arrayContaining(['root', 'handslot.l', 'IK-foot.l']));
    expect(result.map).not.toHaveProperty('neck');
  });

  it('maps names as three.js loads them (dots and colons removed)', () => {
    const kaykit =
      'root,hips,spine,chest,upperarml,lowerarml,wristl,handl,handslotl,upperarmr,lowerarmr,wristr,handr,handslotr,head,upperlegl,lowerlegl,footl,toesl,upperlegr,lowerlegr,footr,toesr,kneeIKl,controltoerolll,heelIKl,IKfootl'.split(
        ',',
      );
    const result = mapBones(bones(kaykit));
    expect(result.complete).toBe(true);
    expect(result.map).toMatchObject({
      leftUpperArm: 'upperarml',
      rightToes: 'toesr',
      leftFoot: 'footl',
    });
    const mixamo = mapBones(
      bones([
        'mixamorigHips',
        'mixamorigSpine',
        'mixamorigSpine1',
        'mixamorigHead',
        'mixamorigLeftArm',
        'mixamorigLeftForeArm',
        'mixamorigLeftHand',
        'mixamorigRightArm',
        'mixamorigRightForeArm',
        'mixamorigRightHand',
        'mixamorigLeftUpLeg',
        'mixamorigLeftLeg',
        'mixamorigLeftFoot',
        'mixamorigRightUpLeg',
        'mixamorigRightLeg',
        'mixamorigRightFoot',
      ]),
    );
    expect(mixamo.complete).toBe(true);
    expect(mixamo.map['chest']).toBe('mixamorigSpine1');
  });

  it('maps Mixamo names with the prefix and numbered spine bones', () => {
    const names = [
      'mixamorig:Hips',
      'mixamorig:Spine',
      'mixamorig:Spine1',
      'mixamorig:Spine2',
      'mixamorig:Neck',
      'mixamorig:Head',
      'mixamorig:LeftShoulder',
      'mixamorig:LeftArm',
      'mixamorig:LeftForeArm',
      'mixamorig:LeftHand',
      'mixamorig:LeftHandIndex1',
      'mixamorig:LeftHandIndex2',
      'mixamorig:LeftHandIndex3',
      'mixamorig:LeftHandIndex4',
      'mixamorig:LeftHandThumb1',
      'mixamorig:RightShoulder',
      'mixamorig:RightArm',
      'mixamorig:RightForeArm',
      'mixamorig:RightHand',
      'mixamorig:LeftUpLeg',
      'mixamorig:LeftLeg',
      'mixamorig:LeftFoot',
      'mixamorig:LeftToeBase',
      'mixamorig:LeftToe_End',
      'mixamorig:RightUpLeg',
      'mixamorig:RightLeg',
      'mixamorig:RightFoot',
      'mixamorig:RightToeBase',
    ];
    const result = mapBones(bones(names));
    expect(result.complete).toBe(true);
    expect(result.map).toMatchObject({
      hips: 'mixamorig:Hips',
      spine: 'mixamorig:Spine',
      chest: 'mixamorig:Spine1',
      upperChest: 'mixamorig:Spine2',
      neck: 'mixamorig:Neck',
      leftShoulder: 'mixamorig:LeftShoulder',
      leftUpperArm: 'mixamorig:LeftArm',
      leftLowerArm: 'mixamorig:LeftForeArm',
      leftUpperLeg: 'mixamorig:LeftUpLeg',
      leftLowerLeg: 'mixamorig:LeftLeg',
      rightToes: 'mixamorig:RightToeBase',
      leftIndexProximal: 'mixamorig:LeftHandIndex1',
      leftIndexIntermediate: 'mixamorig:LeftHandIndex2',
      leftIndexDistal: 'mixamorig:LeftHandIndex3',
      leftThumbMetacarpal: 'mixamorig:LeftHandThumb1',
    });
    expect(result.unmatched).toEqual(
      expect.arrayContaining(['mixamorig:LeftHandIndex4', 'mixamorig:LeftToe_End']),
    );
  });

  it('maps VRoid / VRM style names and Blender rigify style names', () => {
    const vroid = mapBones(
      bones([
        'J_Bip_C_Hips',
        'J_Bip_C_Spine',
        'J_Bip_C_Chest',
        'J_Bip_C_UpperChest',
        'J_Bip_C_Neck',
        'J_Bip_C_Head',
        'J_Bip_L_Shoulder',
        'J_Bip_L_UpperArm',
        'J_Bip_L_LowerArm',
        'J_Bip_L_Hand',
        'J_Bip_R_UpperArm',
        'J_Bip_R_LowerArm',
        'J_Bip_R_Hand',
        'J_Bip_L_UpperLeg',
        'J_Bip_L_LowerLeg',
        'J_Bip_L_Foot',
        'J_Bip_L_ToeBase',
        'J_Bip_R_UpperLeg',
        'J_Bip_R_LowerLeg',
        'J_Bip_R_Foot',
      ]),
    );
    expect(vroid.complete).toBe(true);
    expect(vroid.map['leftUpperArm']).toBe('J_Bip_L_UpperArm');
    expect(vroid.map['upperChest']).toBe('J_Bip_C_UpperChest');
    const rigify = mapBones(
      bones([
        'pelvis',
        'spine',
        'spine.001',
        'neck',
        'head',
        'shoulder.L',
        'upper_arm.L',
        'forearm.L',
        'hand.L',
        'shoulder.R',
        'upper_arm.R',
        'forearm.R',
        'hand.R',
        'thigh.L',
        'shin.L',
        'foot.L',
        'toe.L',
        'thigh.R',
        'shin.R',
        'foot.R',
        'toe.R',
      ]),
    );
    expect(rigify.complete).toBe(true);
    expect(rigify.map).toMatchObject({
      hips: 'pelvis',
      chest: 'spine.001',
      leftUpperArm: 'upper_arm.L',
      rightLowerLeg: 'shin.R',
    });
  });

  it('is the identity for VRM bone names and reports missing required bones', () => {
    const names = STANDARD_BONES.map((bone) => bone.name);
    const full = mapBones(bones(names));
    expect(full.complete).toBe(true);
    expect(Object.keys(full.map)).toHaveLength(55);
    const partial = mapBones(bones(names.filter((name) => name !== 'leftFoot' && name !== 'head')));
    expect(partial.complete).toBe(false);
    expect(partial.missing).toEqual(expect.arrayContaining(['leftFoot', 'head']));
  });

  it('prefers the bone nearest to the root when two names fit (twist bones are helpers)', () => {
    const result = mapBones([
      { name: 'upperarm.l', parent: null },
      { name: 'upperarm_twist.l', parent: 0 },
      { name: 'lowerarm.l', parent: 1 },
    ]);
    expect(result.map['leftUpperArm']).toBe('upperarm.l');
    expect(result.unmatched).toContain('upperarm_twist.l');
  });
});
