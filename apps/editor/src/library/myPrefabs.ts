import { assetDependencies, assetDisplayName, isBinaryAssetType } from '@blockwerk/project';
import type { JsonValue, MetaData } from '@blockwerk/project';
import { create } from 'zustand';
import { useConsole } from '../state/console';
import { adoptAssets, useDocument } from '../state/document';

/** One file of a saved prefab: an asset with its meta data (IDs stay the same). */
export interface MyPrefabFile {
  readonly path: string;
  readonly meta: MetaData;
  readonly json?: JsonValue;
  readonly bytes?: Uint8Array;
}

/** A prefab in "My Prefabs" with everything it needs (SPEC 6.4). */
export interface MyPrefabPackage {
  /** Asset ID of the prefab. */
  readonly id: string;
  readonly name: string;
  readonly savedAt: string;
  readonly files: readonly MyPrefabFile[];
}

/** What the library window lists. */
export interface MyPrefabSummary {
  readonly id: string;
  readonly name: string;
  readonly savedAt: string;
  readonly files: number;
}

const DATABASE = 'blockwerk-my-prefabs';
const STORE = 'packages';

/** Opens the database of "My Prefabs" (per user, shared by all projects; no network). */
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

interface MyPrefabsState {
  readonly packages: readonly MyPrefabSummary[];
}

/** The list of "My Prefabs". */
export const useMyPrefabs = create<MyPrefabsState>()(() => ({ packages: [] }));

/** Reloads the list of "My Prefabs". */
export async function refreshMyPrefabs(): Promise<void> {
  try {
    const all = await transaction(
      'readonly',
      (store) => store.getAll() as IDBRequest<MyPrefabPackage[]>,
    );
    useMyPrefabs.setState({
      packages: all
        .map((item) => ({
          id: item.id,
          name: item.name,
          savedAt: item.savedAt,
          files: item.files.length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch {
    useMyPrefabs.setState({ packages: [] });
  }
}

/** Saves a prefab of the open project with all its dependencies to "My Prefabs". */
export async function saveToMyPrefabs(prefabId: string): Promise<boolean> {
  const { project } = useDocument.getState();
  const prefab = project?.assetOfType(prefabId, 'prefab');
  if (!project || !prefab) return false;
  const ids = assetDependencies(
    prefabId,
    (id) => {
      const asset = project.asset(id);
      return asset && !isBinaryAssetType(asset.type)
        ? (asset.data as unknown as JsonValue)
        : undefined;
    },
    (id) => project.asset(id) !== undefined,
  );
  const files: MyPrefabFile[] = [];
  for (const id of ids) {
    const asset = project.asset(id);
    if (!asset) continue;
    if (isBinaryAssetType(asset.type)) {
      const bytes = project.assetBytes(id);
      if (bytes) files.push({ path: asset.path, meta: asset.meta, bytes });
    } else {
      files.push({ path: asset.path, meta: asset.meta, json: asset.data as unknown as JsonValue });
    }
  }
  const item: MyPrefabPackage = {
    id: prefabId,
    name: assetDisplayName(prefab.path),
    savedAt: new Date().toISOString(),
    files,
  };
  await transaction('readwrite', (store) => store.put(item));
  await refreshMyPrefabs();
  useConsole.getState().log('info', 'myPrefabs.saved', { name: item.name, files: files.length });
  return true;
}

/**
 * Brings a prefab from "My Prefabs" into the open project with its dependencies. Assets the
 * project already has (same ID) are kept. Returns the prefab's asset ID.
 */
export async function importMyPrefab(id: string): Promise<string | null> {
  const item = await transaction(
    'readonly',
    (store) => store.get(id) as IDBRequest<MyPrefabPackage | undefined>,
  );
  if (!item) return null;
  const added = adoptAssets(item.files);
  if (added > 0) {
    useConsole.getState().log('info', 'myPrefabs.imported', { name: item.name, files: added });
  }
  return useDocument.getState().project?.assetOfType(id, 'prefab') ? id : null;
}

/** Removes a prefab from "My Prefabs" (projects that use it keep their copy). */
export async function deleteMyPrefab(id: string): Promise<void> {
  await transaction('readwrite', (store) => store.delete(id));
  await refreshMyPrefabs();
}
