/**
 * @blockwerk/project: project format (SPEC 9.1), schemas, stable IDs, deterministic JSON,
 * loading, saving and migrations. Node.js file access is in `@blockwerk/project/node`.
 */
export * from './schema';
export { stringifyDeterministic } from './json';
export { createId, ID_LENGTH, isId } from './ids';
export {
  basename,
  dirname,
  FileNotFoundError,
  joinPath,
  listFilesRecursive,
  normalizePath,
} from './fs/types';
export type { FileEntry, ProjectFileSystem } from './fs/types';
export { MemoryFileSystem } from './fs/memory';
export { FormatTooNewError, migrate, MigrationError, MIGRATIONS } from './migrations';
export type { FileKind, Migration, MigrationRegistry, MigrationResult } from './migrations';
export {
  ASSET_EXTENSIONS,
  ASSETS_FOLDER,
  assetDisplayName,
  assetFolder,
  assetTypeOfPath,
  CACHE_FOLDER,
  createProject,
  defaultAssetFolder,
  hashBytes,
  loadProject,
  META_SUFFIX,
  modelImportSettings,
  Project,
  PROJECT_FILE,
  PROJECT_GITIGNORE,
  ProjectLoadError,
  TAGS_AND_LAYERS_FILE,
} from './project';
export type {
  AnyAsset,
  AssetDataByType,
  AssetEntry,
  LoadOptions,
  ModelData,
  NewProjectFolders,
  NewProjectOptions,
  ProjectProblem,
  SaveResult,
} from './project';
export { createDefaultScene, DEFAULT_AREAS } from './templates';
export {
  applyOverrides,
  applyOverridesToPrefab,
  createPrefabData,
  createVariantData,
  derivedId,
  diffObjects,
  IMPLICIT_ROOT_PATHS,
  instanceMembers,
  instanceRootOf,
  instantiatePrefab,
  isInstanceRoot,
  linkToPrefab,
  objectValues,
  assetDependencies,
  prefabFromEdited,
  resolvePrefab,
  revertOverrides,
  setObjectValue,
  syncPrefabInstances,
  updateAllInstanceOverrides,
  updateInstanceOverrides,
} from './prefabs';
export type { InstantiateOptions, ObjectMap, PrefabSource, ResolvedPrefab } from './prefabs';
export type { DefaultSceneNames } from './templates';
