/** Side of a bone in a humanoid skeleton. */
export type BoneSide = 'left' | 'right' | null;

/** One bone of the standard skeleton (VRM 1.0 humanoid bone names). */
export interface StandardBone {
  /** VRM bone name, e.g. `leftUpperArm`. */
  readonly name: string;
  /** Parent bone in the standard hierarchy, `null` for the hips. */
  readonly parent: string | null;
  /** The VRM standard requires this bone. */
  readonly required: boolean;
  readonly side: BoneSide;
}

function bone(name: string, parent: string | null, required: boolean): StandardBone {
  const side: BoneSide = name.startsWith('left')
    ? 'left'
    : name.startsWith('right')
      ? 'right'
      : null;
  return { name, parent, required, side };
}

/** The finger bones of one hand, in VRM naming. */
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const;

function arm(side: 'left' | 'right'): StandardBone[] {
  const hand = `${side}Hand`;
  const result = [
    bone(`${side}Shoulder`, 'upperChest', false),
    bone(`${side}UpperArm`, `${side}Shoulder`, true),
    bone(`${side}LowerArm`, `${side}UpperArm`, true),
    bone(hand, `${side}LowerArm`, true),
  ];
  for (const finger of FINGERS) {
    const chain =
      finger === 'Thumb'
        ? ['Metacarpal', 'Proximal', 'Distal']
        : ['Proximal', 'Intermediate', 'Distal'];
    let parent = hand;
    for (const part of chain) {
      const name = `${side}${finger}${part}`;
      result.push(bone(name, parent, false));
      parent = name;
    }
  }
  return result;
}

function leg(side: 'left' | 'right'): StandardBone[] {
  return [
    bone(`${side}UpperLeg`, 'hips', true),
    bone(`${side}LowerLeg`, `${side}UpperLeg`, true),
    bone(`${side}Foot`, `${side}LowerLeg`, true),
    bone(`${side}Toes`, `${side}Foot`, false),
  ];
}

/**
 * The internal standard skeleton (SPEC 8.7): the human bone names of the VRM 1.0 standard.
 * 15 bones are required (hips, spine, head, both arms and legs with hands and feet); chest,
 * upper chest, neck, shoulders, eyes, jaw, toes and fingers are optional.
 */
export const STANDARD_BONES: readonly StandardBone[] = [
  bone('hips', null, true),
  bone('spine', 'hips', true),
  bone('chest', 'spine', false),
  bone('upperChest', 'chest', false),
  bone('neck', 'upperChest', false),
  bone('head', 'neck', true),
  bone('leftEye', 'head', false),
  bone('rightEye', 'head', false),
  bone('jaw', 'head', false),
  ...leg('left'),
  ...leg('right'),
  ...arm('left'),
  ...arm('right'),
];

/** Names of the standard bones. */
export type StandardBoneName = string;

const BY_NAME = new Map(STANDARD_BONES.map((entry) => [entry.name, entry]));

/** Looks up a standard bone. */
export function standardBone(name: string): StandardBone | undefined {
  return BY_NAME.get(name);
}

/** The required bones. */
export const REQUIRED_BONES: readonly string[] = STANDARD_BONES.filter(
  (entry) => entry.required,
).map((entry) => entry.name);

/**
 * The nearest ancestor of a standard bone that exists in a map (optional bones such as
 * the chest or neck may be missing; their children then hang from the next bone up).
 */
export function mappedParent(name: string, present: ReadonlySet<string>): string | null {
  let current = BY_NAME.get(name)?.parent ?? null;
  while (current !== null && !present.has(current)) current = BY_NAME.get(current)?.parent ?? null;
  return current;
}
