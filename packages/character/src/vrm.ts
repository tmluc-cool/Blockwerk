import { STANDARD_BONES } from './skeleton';

/** What a VRM avatar file says about itself. */
export interface VrmInfo {
  /** VRM major version: 0 (faces −Z, needs a half turn) or 1 (faces +Z like Blockwerk). */
  readonly version: 0 | 1;
  readonly title: string;
  readonly authors: readonly string[];
  /** License text for the asset's meta file, e.g. "CC0 (Author)"; empty if the file names none. */
  readonly license: string;
  /** Standard bone name → node name (as three.js names the bone after loading). */
  readonly boneMap: Readonly<Record<string, string>>;
}

/** VRM 0.x thumb bones were named differently from VRM 1.0. */
const VRM0_RENAMES: Readonly<Record<string, string>> = {
  leftThumbProximal: 'leftThumbMetacarpal',
  leftThumbIntermediate: 'leftThumbProximal',
  rightThumbProximal: 'rightThumbMetacarpal',
  rightThumbIntermediate: 'rightThumbProximal',
};

const STANDARD_NAMES: ReadonlySet<string> = new Set(STANDARD_BONES.map((bone) => bone.name));

interface GltfNode {
  readonly name?: string;
}

interface VrmHumanBone {
  readonly node?: number;
}

/** The JSON chunk of a GLB file, or `null` if the data is not a GLB. */
function glbJson(data: Uint8Array): Record<string, unknown> | null {
  if (data.byteLength < 20) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) return null;
  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (type === 0x4e4f534a) {
      const text = new TextDecoder().decode(data.subarray(offset + 8, offset + 8 + length));
      try {
        const json: unknown = JSON.parse(text);
        return typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  return null;
}

/** The node name as three.js's GLTFLoader gives it to the object (no dots, spaces → "_"). */
function sanitizeNodeName(name: string): string {
  return name.replace(/\s/g, '_').replace(/[[\].:/]/g, '');
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Reads the humanoid bone assignment and the license note of a VRM avatar (VRM 0.x and 1.0).
 * Returns `null` if the data is no GLB or has no VRM humanoid. The file stays an ordinary GLB:
 * the VRM extensions are only read here, for the import settings.
 */
export function readVrm(data: Uint8Array): VrmInfo | null {
  const json = glbJson(data);
  if (!json) return null;
  const extensions = record(json['extensions']);
  const nodes = Array.isArray(json['nodes']) ? (json['nodes'] as GltfNode[]) : [];
  const nodeName = (index: unknown): string | null => {
    const name = typeof index === 'number' ? nodes[index]?.name : undefined;
    return name ? sanitizeNodeName(name) : null;
  };

  const boneMap: Record<string, string> = {};
  let version: 0 | 1 = 1;
  let title: string;
  let authors: string[];
  let license: string;

  const v1 = record(extensions['VRMC_vrm']);
  const v0 = record(extensions['VRM']);
  if (Object.keys(v1).length > 0) {
    const meta = record(v1['meta']);
    title = text(meta['name']);
    authors = Array.isArray(meta['authors']) ? meta['authors'].map(text).filter(Boolean) : [];
    license = text(meta['licenseUrl']);
    const humanBones = record(record(v1['humanoid'])['humanBones']);
    for (const [bone, entry] of Object.entries(humanBones)) {
      const name = nodeName((entry as VrmHumanBone).node);
      if (name && STANDARD_NAMES.has(bone)) boneMap[bone] = name;
    }
  } else if (Object.keys(v0).length > 0) {
    version = 0;
    const meta = record(v0['meta']);
    title = text(meta['title']);
    authors = text(meta['author']) ? [text(meta['author'])] : [];
    license = text(meta['licenseName']) || text(meta['otherLicenseUrl']);
    const humanBones = record(v0['humanoid'])['humanBones'];
    for (const entry of Array.isArray(humanBones) ? humanBones : []) {
      const item = record(entry);
      const bone = VRM0_RENAMES[text(item['bone'])] ?? text(item['bone']);
      const name = nodeName(item['node']);
      if (name && STANDARD_NAMES.has(bone)) boneMap[bone] = name;
    }
  } else {
    return null;
  }
  const by = authors.length > 0 ? ` (${authors.join(', ')})` : '';
  return {
    version,
    title,
    authors,
    license: license ? `${license}${by}` : by.trim(),
    boneMap,
  };
}
