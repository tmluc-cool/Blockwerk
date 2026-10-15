import { functionKey, workspaceSignatures } from '@blockwerk/compiler';
import type { AssetType } from '@blockwerk/project';

/** An asset as the search and the refactoring functions read it. */
export interface AssetView {
  readonly id: string;
  readonly type: Extract<AssetType, 'scene' | 'blockScript' | 'dialog' | 'ui' | 'prefab'>;
  readonly name: string;
  readonly data: unknown;
}

/** What a search result can be about. */
export type ThingKind = 'variable' | 'message' | 'customBlock' | 'tag' | 'object' | 'text';

/** One place where a thing is used. */
export interface Usage {
  readonly assetId: string;
  readonly assetType: AssetView['type'];
  readonly assetName: string;
  /** Blockly block of a block script. */
  readonly blockId?: string;
  /** Object of a scene or prefab. */
  readonly objectId?: string;
  /** Short description: the kind of block, component or dialog part. */
  readonly context: string;
}

/** Something with a name that the project uses in several places (SPEC 7.8). */
export interface Thing {
  readonly kind: ThingKind;
  /** Identity: the ID of a variable or object, the key of a custom block, otherwise the name. */
  readonly key: string;
  readonly name: string;
  readonly usages: readonly Usage[];
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Message names live in these block fields. */
const MESSAGE_BLOCKS: Readonly<Record<string, string>> = {
  'events.whenMessage': 'message',
  'control.sendMessage': 'message',
};

/** Where a scan is: the asset and the object or block it is looking at. */
interface Position {
  readonly asset: AssetView;
  readonly blockId?: string;
  readonly objectId?: string;
  readonly context: string;
}

type Visit = (node: Json, position: Position) => void;

/** Visits every object of an asset's JSON, with the nearest block, scene object and context. */
function walk(value: unknown, position: Position, visit: Visit): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, position, visit);
    return;
  }
  if (!isRecord(value)) return;
  let here = position;
  const type = value['type'];
  if (typeof type === 'string' && typeof value['id'] === 'string' && type.includes('.')) {
    here = { ...position, blockId: value['id'], context: type };
  } else if (typeof type === 'string' && position.asset.type !== 'blockScript') {
    here = { ...position, context: type };
  }
  visit(value, here);
  for (const [key, item] of Object.entries(value)) {
    if (
      (position.asset.type === 'scene' || position.asset.type === 'prefab') &&
      key === 'objects' &&
      isRecord(item)
    ) {
      for (const [objectId, object] of Object.entries(item)) {
        walk(object, { ...here, objectId, context: 'object' }, visit);
      }
    } else {
      walk(item, here, visit);
    }
  }
}

function usageOf(position: Position): Usage {
  return {
    assetId: position.asset.id,
    assetType: position.asset.type,
    assetName: position.asset.name,
    ...(position.blockId === undefined ? {} : { blockId: position.blockId }),
    ...(position.objectId === undefined ? {} : { objectId: position.objectId }),
    context: position.context,
  };
}

/** The name of a variable field `{ id }` or a plain ID. */
function variableIdOf(value: unknown): string {
  if (typeof value === 'string') return value;
  return isRecord(value) && typeof value['id'] === 'string' ? value['id'] : '';
}

/** Whether a scene object's component field holds a message name. */
function isMessageField(key: string): boolean {
  return /message/i.test(key);
}

/** Collects everything in the project that has a name and is used in places. */
export function collectThings(assets: readonly AssetView[]): Thing[] {
  const things = new Map<string, { kind: ThingKind; key: string; name: string; usages: Usage[] }>();
  const thing = (kind: ThingKind, key: string, name: string) => {
    const id = `${kind}\u0000${key}`;
    let entry = things.get(id);
    if (!entry) {
      entry = { kind, key, name, usages: [] };
      things.set(id, entry);
    }
    return entry;
  };
  // Declarations first, so a thing is known before it is used.
  for (const asset of assets) {
    if (asset.type === 'blockScript') {
      const data = asset.data as {
        variables?: { id: string; name: string }[];
        workspace?: unknown;
      };
      for (const variable of data.variables ?? []) thing('variable', variable.id, variable.name);
      for (const signature of workspaceSignatures(data.workspace ?? {}, asset.id)) {
        const entry = thing('customBlock', signature.key, signature.name);
        entry.usages.push({
          assetId: asset.id,
          assetType: asset.type,
          assetName: asset.name,
          blockId: signature.blockId,
          context: 'definition',
        });
      }
    }
    if (asset.type === 'scene' || asset.type === 'prefab') {
      const objects = (asset.data as { objects?: Record<string, { name?: string; tag?: string }> })
        .objects;
      for (const [objectId, object] of Object.entries(objects ?? {})) {
        const entry = thing('object', `${asset.id}/${objectId}`, object.name ?? objectId);
        entry.usages.push({
          assetId: asset.id,
          assetType: asset.type,
          assetName: asset.name,
          objectId,
          context: 'object',
        });
        if (object.tag && object.tag !== 'Untagged') {
          thing('tag', object.tag, object.tag).usages.push({
            assetId: asset.id,
            assetType: asset.type,
            assetName: asset.name,
            objectId,
            context: 'tag',
          });
        }
      }
    }
  }
  for (const asset of assets) {
    walk(asset.data, { asset, context: asset.type }, (node, position) => {
      const type = node['type'];
      const fields = isRecord(node['fields']) ? node['fields'] : undefined;
      // Variables used by blocks, dialogs and UI bindings.
      const used = fields
        ? variableIdOf(fields['variable'])
        : typeof node['variable'] === 'string'
          ? node['variable']
          : '';
      if (used !== '' && things.has(`variable\u0000${used}`)) {
        thing('variable', used, '').usages.push(usageOf(position));
      }
      // Messages.
      if (typeof type === 'string' && fields && MESSAGE_BLOCKS[type]) {
        const message = fields[MESSAGE_BLOCKS[type] ?? ''];
        if (typeof message === 'string' && message !== '') {
          thing('message', message, message).usages.push(usageOf(position));
        }
      }
      if (type === 'sendMessage' && typeof node['message'] === 'string' && node['message'] !== '') {
        thing('message', node['message'], node['message']).usages.push(usageOf(position));
      }
      if (position.asset.type !== 'blockScript' && isRecord(node['values'])) {
        for (const [key, value] of Object.entries(node['values'])) {
          if (isMessageField(key) && typeof value === 'string' && value !== '') {
            thing('message', value, value).usages.push(usageOf(position));
          }
        }
      }
      // Calls of custom blocks.
      if (
        typeof type === 'string' &&
        type.startsWith('custom.call') &&
        isRecord(node['extraState'])
      ) {
        const state = node['extraState'];
        const fn = typeof state['fn'] === 'string' ? state['fn'] : '';
        const library = typeof state['library'] === 'string' ? state['library'] : '';
        const key = functionKey(library || position.asset.id, fn);
        if (things.has(`customBlock\u0000${key}`))
          thing('customBlock', key, '').usages.push(usageOf(position));
      }
      // Tags used by name and objects used by ID.
      for (const value of Object.values(fields ?? {})) {
        if (typeof value !== 'string') continue;
        if (value.startsWith('tag:') && value.length > 4) {
          thing('tag', value.slice(4), value.slice(4)).usages.push(usageOf(position));
        } else if (value.startsWith('object:')) {
          const key = `${position.asset.id}/${value.slice(7)}`;
          if (things.has(`object\u0000${key}`))
            thing('object', key, '').usages.push(usageOf(position));
        }
      }
      // Text of blocks, for a plain text search.
      if (
        type === 'literal.text' &&
        typeof fields?.['TEXT'] === 'string' &&
        fields['TEXT'].trim() !== ''
      ) {
        thing('text', fields['TEXT'], fields['TEXT']).usages.push(usageOf(position));
      }
    });
  }
  return [...things.values()].filter((entry) => entry.name !== '');
}

/** The things whose name contains the query (without case), objects and text last. */
export function searchThings(
  things: readonly Thing[],
  query: string,
  kinds?: readonly ThingKind[],
): Thing[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  const order: ThingKind[] = ['variable', 'customBlock', 'message', 'tag', 'object', 'text'];
  return things
    .filter((entry) => (kinds ? kinds.includes(entry.kind) : true))
    .filter((entry) => entry.name.toLowerCase().includes(needle))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name));
}

// ------------------------------------------------------------------- renaming

/** New data of the assets that changed. */
export type Changes = Map<string, unknown>;

/** Rebuilds a JSON value, giving `change` the chance to replace every object. */
function rebuild(value: unknown, change: (node: Json) => Json | null): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const next = rebuild(item, change);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? items : value;
  }
  if (!isRecord(value)) return value;
  let node: Json = value;
  const replaced = change(value);
  if (replaced) node = replaced;
  let changed = replaced !== null;
  const result: Json = {};
  for (const [key, item] of Object.entries(node)) {
    const next = rebuild(item, change);
    if (next !== item) changed = true;
    result[key] = next;
  }
  return changed ? result : value;
}

function recordChange(
  changes: Changes,
  asset: AssetView,
  recipe: (node: Json) => Json | null,
): void {
  const next = rebuild(asset.data, recipe);
  if (next !== asset.data) changes.set(asset.id, next);
}

/** Renames a message in blocks, dialogs, UI buttons and component fields ("Rename everywhere"). */
export function renameMessage(assets: readonly AssetView[], from: string, to: string): Changes {
  const changes: Changes = new Map();
  if (from === to || to.trim() === '') return changes;
  for (const asset of assets) {
    recordChange(changes, asset, (node) => {
      const type = node['type'];
      if (typeof type === 'string' && MESSAGE_BLOCKS[type] && isRecord(node['fields'])) {
        const field = MESSAGE_BLOCKS[type] ?? '';
        if (node['fields'][field] === from) {
          return { ...node, fields: { ...node['fields'], [field]: to } };
        }
      }
      if (type === 'sendMessage' && node['message'] === from) return { ...node, message: to };
      if (type !== undefined && isRecord(node['values']) && asset.type !== 'blockScript') {
        const values = node['values'];
        if (Object.entries(values).some(([key, value]) => isMessageField(key) && value === from)) {
          return {
            ...node,
            values: Object.fromEntries(
              Object.entries(values).map(([key, value]) => [
                key,
                isMessageField(key) && value === from ? to : value,
              ]),
            ),
          };
        }
      }
      return null;
    });
  }
  return changes;
}

/** Renames a tag in scene objects and in `tag:<name>` references of blocks and components. */
export function renameTag(assets: readonly AssetView[], from: string, to: string): Changes {
  const changes: Changes = new Map();
  if (from === to || to.trim() === '') return changes;
  for (const asset of assets) {
    recordChange(changes, asset, (node) => {
      let result: Json | null = null;
      if (node['tag'] === from && typeof node['transform'] === 'object')
        result = { ...node, tag: to };
      for (const key of ['fields', 'values']) {
        const group = (result ?? node)[key];
        if (isRecord(group) && Object.values(group).some((value) => value === `tag:${from}`)) {
          result = {
            ...(result ?? node),
            [key]: Object.fromEntries(
              Object.entries(group).map(([name, value]) => [
                name,
                value === `tag:${from}` ? `tag:${to}` : value,
              ]),
            ),
          };
        }
      }
      return result;
    });
  }
  return changes;
}

/**
 * Renames a custom block: the name lives in its definition block; the copies that calls keep
 * of it are updated too, so nothing shows the old name.
 */
export function renameCustomBlock(
  assets: readonly AssetView[],
  key: string,
  name: string,
): Changes {
  const changes: Changes = new Map();
  if (name.trim() === '') return changes;
  for (const asset of assets) {
    if (asset.type !== 'blockScript') continue;
    recordChange(changes, asset, (node) => {
      const type = node['type'];
      if (typeof type !== 'string') return null;
      if (
        type.startsWith('custom.define') &&
        typeof node['id'] === 'string' &&
        functionKey(asset.id, node['id']) === key
      ) {
        return { ...node, fields: { ...(isRecord(node['fields']) ? node['fields'] : {}), name } };
      }
      if (type.startsWith('custom.call') && isRecord(node['extraState'])) {
        const state = node['extraState'];
        const fn = typeof state['fn'] === 'string' ? state['fn'] : '';
        const library = typeof state['library'] === 'string' ? state['library'] : '';
        if (functionKey(library || asset.id, fn) === key && state['name'] !== name) {
          return { ...node, extraState: { ...state, name } };
        }
      }
      return null;
    });
  }
  return changes;
}

/** Renames a variable of one script (an object variable; game variables use the project helper). */
export function renameVariableIn(asset: AssetView, variableId: string, name: string): Changes {
  const changes: Changes = new Map();
  if (asset.type !== 'blockScript' || name.trim() === '') return changes;
  const data = asset.data as { variables?: { id: string; name: string }[] };
  if (!data.variables?.some((variable) => variable.id === variableId && variable.name !== name)) {
    return changes;
  }
  changes.set(asset.id, {
    ...data,
    variables: data.variables.map((variable) =>
      variable.id === variableId ? { ...variable, name } : variable,
    ),
  });
  return changes;
}
