import { REQUIRED_BONES, standardBone } from './skeleton';

/** A bone of a loaded skeleton: its name and the index of its parent (`null` for roots). */
export interface BoneInfo {
  readonly name: string;
  readonly parent: number | null;
}

/** Standard bone name (VRM) → name of the bone in the model. */
export type BoneMap = Readonly<Record<string, string>>;

/** Result of the automatic skeleton recognition. */
export interface BoneMapping {
  readonly map: BoneMap;
  /** Required standard bones that were not found. */
  readonly missing: readonly string[];
  /** Model bones that were not used (helper bones, IK, unknown names). */
  readonly unmatched: readonly string[];
  /** All required bones were found. */
  readonly complete: boolean;
}

/** Tokens that carry no meaning in bone names (rig prefixes). */
const NOISE = new Set([
  'mixamorig',
  'mixamorig1',
  'bip01',
  'bip001',
  'bip',
  'armature',
  'def',
  'j',
  'c',
  'cc',
  'rig',
  'bone',
]);

/** Parts of names that mark helper bones (IK targets, twist, controllers, attachment slots). */
const HELPER =
  /(^|_)(ik|ctrl|control|twist|roll|pole|slot|target|end|nub|ik\d*|helper|corrective|socket|root)(_|$|\d)/;
const FINGERS: Readonly<Record<string, string>> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Little',
  little: 'Little',
};
const THUMB_PARTS = ['Metacarpal', 'Proximal', 'Distal'] as const;
const FINGER_PARTS = ['Proximal', 'Intermediate', 'Distal'] as const;

interface Parsed {
  readonly side: 'left' | 'right' | null;
  /** The meaningful words joined (`upperarm`, `spine`, `index`). */
  readonly core: string;
  readonly digit: number | null;
}

/** Splits a bone name into side, core word and a trailing number. */
function parse(name: string): Parsed | null {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Za-z])(\d)/g, '$1_$2')
    .toLowerCase();
  if (HELPER.test(`_${spaced.replace(/[^a-z0-9]+/g, '_')}_`)) return null;
  let side: Parsed['side'] = null;
  const words: string[] = [];
  let digit: number | null = null;
  for (const token of spaced.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (token === 'l' || token === 'left') side = 'left';
    else if (token === 'r' || token === 'right') side = 'right';
    else if (/^\d+$/.test(token)) digit = Number(token);
    else if (!NOISE.has(token)) words.push(token);
  }
  if (words.length === 0) return null;
  let core = words.join('');
  // three.js removes dots from node names, so `upperarm.l` arrives as `upperarml`.
  if (side === null && core.length > 3 && /[lr]$/.test(core)) {
    const base = core.slice(0, -1);
    if (base in ALIASES || Object.keys(FINGERS).some((key) => base.includes(key))) {
      side = core.endsWith('l') ? 'left' : 'right';
      core = base;
    }
  }
  return { side, core, digit };
}

/** Middle-name aliases → standard core names. */
const ALIASES: Readonly<Record<string, string>> = {
  hips: 'hips',
  hip: 'hips',
  pelvis: 'hips',
  spine: 'spine',
  chest: 'chest',
  upperchest: 'upperChest',
  neck: 'neck',
  head: 'head',
  shoulder: 'Shoulder',
  clavicle: 'Shoulder',
  collar: 'Shoulder',
  collarbone: 'Shoulder',
  upperarm: 'UpperArm',
  uparm: 'UpperArm',
  armupper: 'UpperArm',
  arm: 'UpperArm',
  forearm: 'LowerArm',
  lowerarm: 'LowerArm',
  armlower: 'LowerArm',
  hand: 'Hand',
  thigh: 'UpperLeg',
  upleg: 'UpperLeg',
  upperleg: 'UpperLeg',
  legupper: 'UpperLeg',
  calf: 'LowerLeg',
  shin: 'LowerLeg',
  lowerleg: 'LowerLeg',
  leglower: 'LowerLeg',
  leg: 'LowerLeg',
  foot: 'Foot',
  ankle: 'Foot',
  toes: 'Toes',
  toe: 'Toes',
  toebase: 'Toes',
  ball: 'Toes',
  eye: 'Eye',
  jaw: 'jaw',
};

/** The standard bone a parsed name stands for, or `null`. */
function classify(parsed: Parsed): string | null {
  const { side, core, digit } = parsed;
  const sided = (base: string): string | null => (side ? `${side}${base}` : null);
  // Fingers: left hand index 1 …
  for (const [key, finger] of Object.entries(FINGERS)) {
    if (core.includes(key) && side) {
      const parts = finger === 'Thumb' ? THUMB_PARTS : FINGER_PARTS;
      // VRM names spell the segment out (leftIndexProximal); other rigs number it (Index1).
      const named = parts.find((candidate) => core.includes(candidate.toLowerCase()));
      const part = named ?? parts[(digit ?? 1) - 1];
      return part ? `${side}${finger}${part}` : null;
    }
  }
  const alias = ALIASES[core.replace(/^(left|right)/, '')];
  if (!alias) return null;
  if (alias === 'spine') {
    if (digit === 1) return 'chest';
    if (digit === 2) return 'upperChest';
    return digit === null || digit === 0 ? 'spine' : null;
  }
  if (alias === 'neck') return 'neck';
  if (alias[0] === alias[0]?.toLowerCase()) return side ? null : alias;
  return sided(alias);
}

/**
 * Recognizes the humanoid bones of a skeleton by their names (Mixamo, VRM/VRoid, Blender,
 * KayKit and similar) and maps them to the standard skeleton. Helper bones (IK, controllers,
 * hand slots) stay unmatched. The result can be corrected by hand in the Character Studio.
 */
export function mapBones(bones: readonly BoneInfo[]): BoneMapping {
  const depth = (index: number): number => {
    let count = 0;
    for (
      let current = bones[index]?.parent ?? null;
      current !== null;
      current = bones[current]?.parent ?? null
    ) {
      count += 1;
    }
    return count;
  };
  const candidates = new Map<string, number[]>();
  bones.forEach((bone, index) => {
    const parsed = parse(bone.name);
    const target = parsed ? classify(parsed) : null;
    if (!target || !standardBone(target)) return;
    candidates.set(target, [...(candidates.get(target) ?? []), index]);
  });
  const map: Record<string, string> = {};
  const used = new Set<number>();
  for (const [target, indices] of candidates) {
    // Several candidates (e.g. an upper arm and a twist bone): the one nearest to the root wins.
    const best = [...indices].sort((a, b) => depth(a) - depth(b) || a - b)[0];
    if (best === undefined) continue;
    map[target] = bones[best]?.name ?? '';
    used.add(best);
  }
  const missing = REQUIRED_BONES.filter((name) => !(name in map));
  const unmatched = bones.filter((_, index) => !used.has(index)).map((bone) => bone.name);
  return { map, missing, unmatched, complete: missing.length === 0 };
}
