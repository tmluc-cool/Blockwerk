import { STANDARD_BONES } from '../src';

/**
 * A tiny rigged humanoid for tests (CC0, generated here): the 15 required bones in a T-pose and
 * one box for a body, skinned to the hips. Written as GLB (optionally with VRM extensions) and as
 * ASCII FBX, so the import of both formats can be tested without shipping a third-party model.
 */

/** World rest positions (meters) of the required bones. */
const POSITIONS: Readonly<Record<string, readonly [number, number, number]>> = {
  hips: [0, 1, 0],
  spine: [0, 1.2, 0],
  head: [0, 1.6, 0],
  leftUpperArm: [0.2, 1.45, 0],
  leftLowerArm: [0.5, 1.45, 0],
  leftHand: [0.75, 1.45, 0],
  rightUpperArm: [-0.2, 1.45, 0],
  rightLowerArm: [-0.5, 1.45, 0],
  rightHand: [-0.75, 1.45, 0],
  leftUpperLeg: [0.1, 0.95, 0],
  leftLowerLeg: [0.1, 0.5, 0],
  leftFoot: [0.1, 0.08, 0],
  rightUpperLeg: [-0.1, 0.95, 0],
  rightLowerLeg: [-0.1, 0.5, 0],
  rightFoot: [-0.1, 0.08, 0],
};

/** The bones in parent-before-child order with their parent among them. */
export const AVATAR_BONES: readonly { standard: string; parent: string | null }[] =
  STANDARD_BONES.filter((bone) => bone.name in POSITIONS).map((bone) => {
    let parent = bone.parent;
    while (parent !== null && !(parent in POSITIONS)) {
      parent = STANDARD_BONES.find((candidate) => candidate.name === parent)?.parent ?? null;
    }
    return { standard: bone.name, parent };
  });

/** Height of the box body in meters. */
export const AVATAR_HEIGHT = 1.7;

const BOX_HALF = [0.25, 0.125] as const;

function local(standard: string, parent: string | null): [number, number, number] {
  const p = POSITIONS[standard] ?? [0, 0, 0];
  const q = parent ? (POSITIONS[parent] ?? [0, 0, 0]) : [0, 0, 0];
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
}

/** The 8 corners and 6 quads of the body box. */
function boxMesh(): { positions: number[]; quads: number[][] } {
  const [hx, hz] = BOX_HALF;
  const positions: number[] = [];
  for (const y of [0, AVATAR_HEIGHT]) {
    for (const [x, z] of [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ] as const) {
      positions.push(x, y, z);
    }
  }
  const quads = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  return { positions, quads };
}

export interface AvatarOptions {
  /** Bone names for the standard bones (default: the standard names). */
  readonly name?: (standard: string) => string;
}

/** A skinned GLB; with `vrm` it carries the VRM humanoid and license extensions. */
export function avatarGlb(
  options: AvatarOptions & {
    vrm?: 0 | 1;
    /** No skeleton: a plain mesh (a rigid figure). */ rigid?: boolean;
  } = {},
): Uint8Array {
  const name = options.name ?? ((standard) => standard);
  const { positions, quads } = boxMesh();
  const indices = quads.flatMap(([a = 0, b = 0, c = 0, d = 0]) => [a, b, c, a, c, d]);
  const boneCount = AVATAR_BONES.length;

  const buffers: Uint8Array[] = [];
  const views: object[] = [];
  const accessors: object[] = [];
  const push = (data: ArrayBufferView, target?: number): number => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes);
    const offset = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    buffers.push(padded);
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    return views.length - 1;
  };
  const accessor = (
    view: number,
    componentType: number,
    count: number,
    type: string,
    extra = {},
  ) => {
    accessors.push({ bufferView: view, componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  const position = accessor(push(new Float32Array(positions), 34962), 5126, 8, 'VEC3', {
    min: [-BOX_HALF[0], 0, -BOX_HALF[1]],
    max: [BOX_HALF[0], AVATAR_HEIGHT, BOX_HALF[1]],
  });
  const joints = accessor(push(new Uint8Array(8 * 4), 34962), 5121, 8, 'VEC4');
  const weights = accessor(
    push(new Float32Array(Array.from({ length: 32 }, (_, i) => (i % 4 === 0 ? 1 : 0))), 34962),
    5126,
    8,
    'VEC4',
  );
  const index = accessor(push(new Uint16Array(indices), 34963), 5123, indices.length, 'SCALAR');
  const inverse = new Float32Array(boneCount * 16);
  AVATAR_BONES.forEach((bone, i) => {
    const p = POSITIONS[bone.standard] ?? [0, 0, 0];
    inverse.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1], i * 16);
  });
  const ibm = accessor(push(inverse), 5126, boneCount, 'MAT4');

  const nodes: object[] = options.rigid
    ? [{ name: 'Body', mesh: 0 }]
    : AVATAR_BONES.map((bone) => ({
        name: name(bone.standard),
        translation: local(bone.standard, bone.parent),
        children: AVATAR_BONES.flatMap((child, i) => (child.parent === bone.standard ? [i] : [])),
      }));
  if (!options.rigid) nodes.push({ name: 'Body', mesh: 0, skin: 0 });
  const json: Record<string, unknown> = {
    asset: { version: '2.0', generator: 'blockwerk test avatar (CC0)' },
    scene: 0,
    scenes: [{ nodes: options.rigid ? [0] : [0, boneCount] }],
    nodes,
    meshes: [
      {
        name: 'Body',
        primitives: [
          {
            attributes: { POSITION: position, JOINTS_0: joints, WEIGHTS_0: weights },
            indices: index,
          },
        ],
      },
    ],
    ...(options.rigid
      ? {}
      : { skins: [{ joints: AVATAR_BONES.map((_, i) => i), inverseBindMatrices: ibm }] }),
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: buffers.reduce((sum, buffer) => sum + buffer.length, 0) }],
  };
  if (options.vrm === 1) {
    json['extensionsUsed'] = ['VRMC_vrm'];
    json['extensions'] = {
      VRMC_vrm: {
        specVersion: '1.0',
        meta: {
          name: 'Testavatar',
          authors: ['Blockwerk'],
          licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        },
        humanoid: {
          humanBones: Object.fromEntries(
            AVATAR_BONES.map((bone, i) => [bone.standard, { node: i }]),
          ),
        },
      },
    };
  }
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonChunk = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20);
  jsonChunk.set(text);
  const binary = new Uint8Array(buffers.reduce((sum, buffer) => sum + buffer.length, 0));
  let at = 0;
  for (const buffer of buffers) {
    binary.set(buffer, at);
    at += buffer.length;
  }
  const out = new Uint8Array(12 + 8 + jsonChunk.length + 8 + binary.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  const binStart = 20 + jsonChunk.length;
  view.setUint32(binStart, binary.length, true);
  view.setUint32(binStart + 4, 0x004e4942, true);
  out.set(binary, binStart + 8);
  return out;
}

/** The same avatar as ASCII FBX 7.4 (a skinned mesh with one cluster per bone). */
export function avatarFbx(options: AvatarOptions = {}): string {
  const name = options.name ?? ((standard) => standard);
  const { positions, quads } = boxMesh();
  const polygon = quads.flatMap((quad) =>
    quad.map((v, i) => (i === quad.length - 1 ? -(v + 1) : v)),
  );
  const GEOMETRY = 1000;
  const MESH = 1001;
  const SKIN = 1002;
  const boneId = (i: number): number => 2000 + i;
  const clusterId = (i: number): number => 3000 + i;
  const translation = (v: readonly number[]): string =>
    `\t\tProperties70:  {\n\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",${v.join(',')}\n\t\t}\n`;
  const lines: string[] = [
    '; FBX 7.4.0 project file',
    'FBXHeaderExtension:  {',
    '\tFBXHeaderVersion: 1003',
    '\tFBXVersion: 7400',
    '}',
    'GlobalSettings:  {',
    '\tVersion: 1000',
    '\tProperties70:  {',
    '\t\tP: "UpAxis", "int", "Integer", "",1',
    '\t\tP: "UpAxisSign", "int", "Integer", "",1',
    '\t\tP: "UnitScaleFactor", "double", "Number", "",1',
    '\t}',
    '}',
    'Objects:  {',
    `\tGeometry: ${GEOMETRY}, "Geometry::Body", "Mesh" {`,
    `\t\tVertices: *${positions.length} {\n\t\t\ta: ${positions.join(',')}\n\t\t}`,
    `\t\tPolygonVertexIndex: *${polygon.length} {\n\t\t\ta: ${polygon.join(',')}\n\t\t}`,
    '\t\tGeometryVersion: 124',
    '\t}',
    `\tModel: ${MESH}, "Model::Body", "Mesh" {`,
    '\t\tVersion: 232',
    translation([0, 0, 0]).trimEnd(),
    '\t}',
  ];
  AVATAR_BONES.forEach((bone, i) => {
    lines.push(
      `\tModel: ${boneId(i)}, "Model::${name(bone.standard)}", "LimbNode" {`,
      '\t\tVersion: 232',
      translation(local(bone.standard, bone.parent)).trimEnd(),
      '\t}',
    );
  });
  lines.push(`\tDeformer: ${SKIN}, "Deformer::Skin", "Skin" {`, '\t\tVersion: 101', '\t}');
  AVATAR_BONES.forEach((bone, i) => {
    const p = POSITIONS[bone.standard] ?? [0, 0, 0];
    const link = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1];
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    // The box follows the hips; the other bones carry no vertices.
    const own = i === 0 ? '0,1,2,3,4,5,6,7' : '';
    lines.push(
      `\tDeformer: ${clusterId(i)}, "SubDeformer::${name(bone.standard)}", "Cluster" {`,
      '\t\tVersion: 100',
      ...(i === 0
        ? [
            `\t\tIndexes: *8 {\n\t\t\ta: ${own}\n\t\t}`,
            `\t\tWeights: *8 {\n\t\t\ta: 1,1,1,1,1,1,1,1\n\t\t}`,
          ]
        : []),
      `\t\tTransform: *16 {\n\t\t\ta: ${identity.join(',')}\n\t\t}`,
      `\t\tTransformLink: *16 {\n\t\t\ta: ${link.join(',')}\n\t\t}`,
      '\t}',
    );
  });
  lines.push('}', 'Connections:  {');
  lines.push(
    `\tC: "OO",${MESH},0`,
    `\tC: "OO",${GEOMETRY},${MESH}`,
    `\tC: "OO",${SKIN},${GEOMETRY}`,
  );
  AVATAR_BONES.forEach((bone, i) => {
    const parent = AVATAR_BONES.findIndex((candidate) => candidate.standard === bone.parent);
    lines.push(
      `\tC: "OO",${clusterId(i)},${SKIN}`,
      `\tC: "OO",${boneId(i)},${clusterId(i)}`,
      `\tC: "OO",${boneId(i)},${parent >= 0 ? boneId(parent) : 0}`,
    );
  });
  lines.push('}', '');
  return lines.join('\n');
}
