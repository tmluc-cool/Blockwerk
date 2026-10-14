import { ModelCache } from '@blockwerk/runtime';
import type { ModelSource } from '@blockwerk/runtime';
import { LIBRARY_PREFIX, libraryUrl, loadAssetLibrary } from './assetLibrary';

/** Resolves project model assets (by asset ID) to a URL; set by the document store. */
type ProjectModelSource = (assetId: string) => Promise<ModelSource | null>;

let projectModels: ProjectModelSource = () => Promise.resolve(null);

/** Sets where project model assets are read from. */
export function setProjectModelSource(source: ProjectModelSource): void {
  projectModels = source;
}

/** Models for all worlds of the editor (edit world, play mode): each file is loaded once. */
export const editorModels = new ModelCache(async (ref) => {
  if (ref.startsWith(LIBRARY_PREFIX)) {
    const library = await loadAssetLibrary();
    const entry = library.byId.get(ref.slice(LIBRARY_PREFIX.length));
    return entry ? libraryUrl(entry.file) : null;
  }
  return projectModels(ref);
});
