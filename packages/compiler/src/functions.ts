import type { ValueType } from '@blockwerk/blocks';
import type { SerializedBlock } from './toIR';

/** Types a parameter of a custom block can have (SPEC 7.6). */
export const PARAM_TYPES = ['any', 'number', 'string', 'boolean', 'list', 'dictionary'] as const;
/** Type of a parameter of a custom block. */
export type ParamType = (typeof PARAM_TYPES)[number];

/** What a custom block is: a command, a value or a condition. */
export type CustomKind = 'command' | 'value' | 'condition';

/** A parameter of a custom block. */
export interface CustomParam {
  readonly name: string;
  readonly type: ParamType;
}

/** How a custom block can be used, read from its definition block. */
export interface CustomSignature {
  /** Unique key: `<asset ID>/<ID of the definition block>`. */
  readonly key: string;
  readonly assetId: string;
  /** ID of the definition block. */
  readonly blockId: string;
  readonly name: string;
  readonly kind: CustomKind;
  readonly params: readonly CustomParam[];
  /** Type of the result; `null` for commands. */
  readonly returns: ValueType | null;
  /** Run without screen refresh (loops do not wait for the next frame). */
  readonly warp: boolean;
  /** `project`: every block script may call it; `script`: only the script that defines it. */
  readonly scope: 'script' | 'project';
}

/** Definition block types and the kind of block they define. */
export const DEFINITION_KINDS: Readonly<Record<string, CustomKind>> = {
  'custom.defineCommand': 'command',
  'custom.defineValue': 'value',
  'custom.defineCondition': 'condition',
};

/** Call block types and the kind of block they call. */
export const CALL_KINDS: Readonly<Record<string, CustomKind>> = {
  'custom.callCommand': 'command',
  'custom.callValue': 'value',
  'custom.callCondition': 'condition',
};

/** Key of a function: where it is defined and which block defines it. */
export function functionKey(assetId: string, blockId: string): string {
  return `${assetId}/${blockId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isParamType(value: unknown): value is ParamType {
  return PARAM_TYPES.some((type) => type === value);
}

/**
 * Reads the signature of a definition block (`custom.define*`). The name is a field; the
 * parameters (`params`), the result type (`returns`), `warp` and `scope` are in the block's
 * extra state. Returns `null` for other blocks.
 */
export function signatureOf(block: SerializedBlock, assetId: string): CustomSignature | null {
  const kind = DEFINITION_KINDS[block.type];
  if (!kind) return null;
  const state = isRecord(block.extraState) ? block.extraState : {};
  const rawName = block.fields?.['name'];
  const params: CustomParam[] = [];
  if (Array.isArray(state['params'])) {
    for (const item of state['params'] as unknown[]) {
      if (!isRecord(item) || typeof item['name'] !== 'string') continue;
      const name = item['name'].trim();
      if (name === '' || params.some((param) => param.name === name)) continue;
      params.push({ name, type: isParamType(item['type']) ? item['type'] : 'any' });
    }
  }
  const returnsRaw = state['returns'];
  return {
    key: functionKey(assetId, block.id),
    assetId,
    blockId: block.id,
    name: (typeof rawName === 'string' ? rawName.trim() : '') || 'block',
    kind,
    params,
    returns:
      kind === 'command'
        ? null
        : kind === 'condition'
          ? 'boolean'
          : isParamType(returnsRaw)
            ? returnsRaw
            : 'any',
    warp: state['warp'] === true,
    scope: state['scope'] === 'project' ? 'project' : 'script',
  };
}
