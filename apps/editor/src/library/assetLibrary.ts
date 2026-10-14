import { libraryIndexSchema } from '@blockwerk/library';
import type { LibraryEntry, LibraryIndex } from '@blockwerk/library';
import { create } from 'zustand';

/** Base URL of the asset library built by `pnpm assets:fetch` (served next to the editor). */
export const LIBRARY_BASE = 'library/';

/** Prefix of model references that point into the asset library. */
export const LIBRARY_PREFIX = 'library:';

/** State of the asset library. */
export interface AssetLibraryState {
  /** `missing`: the library was not built (`pnpm assets:fetch`) or could not be read. */
  readonly status: 'loading' | 'ready' | 'missing';
  readonly index: LibraryIndex | null;
  readonly byId: ReadonlyMap<string, LibraryEntry>;
}

/** The asset library index, loaded once at startup. */
export const useAssetLibrary = create<AssetLibraryState>(() => ({
  status: 'loading',
  index: null,
  byId: new Map(),
}));

let loading: Promise<AssetLibraryState> | null = null;

/** Loads the library index (once). Resolves when it is loaded or known to be missing. */
export function loadAssetLibrary(): Promise<AssetLibraryState> {
  loading ??= (async () => {
    try {
      const response = await fetch(`${LIBRARY_BASE}index.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const index = libraryIndexSchema.parse(await response.json());
      useAssetLibrary.setState({
        status: 'ready',
        index,
        byId: new Map(index.entries.map((entry) => [entry.id, entry])),
      });
    } catch {
      useAssetLibrary.setState({ status: 'missing', index: null, byId: new Map() });
    }
    return useAssetLibrary.getState();
  })();
  return loading;
}

/** URL of a file of the library (model or preview image). */
export function libraryUrl(file: string): string {
  return `${LIBRARY_BASE}${file}`;
}

/** Model reference (Mesh Renderer field value) of a library entry. */
export function libraryRef(entry: LibraryEntry): string {
  return `${LIBRARY_PREFIX}${entry.id}`;
}

/** The library entry a model reference points to, if it is a library reference. */
export function libraryEntryOf(ref: string | null): LibraryEntry | undefined {
  if (!ref?.startsWith(LIBRARY_PREFIX)) return undefined;
  return useAssetLibrary.getState().byId.get(ref.slice(LIBRARY_PREFIX.length));
}
