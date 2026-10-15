import {
  ASSETS_FOLDER,
  assetDisplayName,
  createDefaultScene,
  createProject,
  defaultAssetFolder,
  dirname,
  FORMAT_VERSION,
  joinPath,
  createId,
  instanceRootOf,
  loadProject,
  modelImportSettings,
  prefabFromEdited,
  ProjectLoadError,
  resolvePrefab,
  syncPrefabInstances,
  updateInstanceOverrides,
} from '@blockwerk/project';
import type {
  AnyAsset,
  AssetDataByType,
  AssetEntry,
  AssetType,
  BlockScriptData,
  MetaData,
  ModelImportSettings,
  NewProjectFolders,
  PrefabData,
  PrefabSource,
  Project,
  ProjectFileSystem,
  SceneData,
} from '@blockwerk/project';
import { create } from 'zustand';
import { History } from '../document/history';
import type { TranslationKey } from '../i18n';
import { editorModels, setProjectModelSource } from '../library/models';
import { detectBackend } from '../storage/backends';
import type { ProjectBackend, ProjectListing } from '../storage/backends';
import { useConsole } from './console';
import { useEditor } from './editor';
import { t, useSettings } from './settings';

/** Folder names of new projects, in the user's language. */
function newProjectFolders(): NewProjectFolders {
  return {
    scenes: t('project.folder.scenes'),
    blockScripts: t('project.folder.blockScripts'),
    prefabs: t('project.folder.prefabs'),
    models: t('project.folder.models'),
    images: t('project.folder.images'),
    terrains: t('project.folder.terrains'),
    sounds: t('project.folder.sounds'),
  };
}

/** Blob URLs of project models, by asset ID and content hash. */
const modelUrls = new Map<string, { hash: string; url: string }>();

// Project models are served to the 3D views as blob URLs with their import settings.
setProjectModelSource(async (assetId) => {
  const { project } = useDocument.getState();
  const entry = project?.assetOfType(assetId, 'model');
  const bytes = project?.modelBytes(assetId);
  if (!entry || !bytes) return null;
  let cached = modelUrls.get(assetId);
  if (cached?.hash !== entry.data.hash) {
    if (cached) URL.revokeObjectURL(cached.url);
    cached = {
      hash: entry.data.hash,
      url: URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'model/gltf-binary' })),
    };
    modelUrls.set(assetId, cached);
  }
  const settings = modelImportSettings(entry.meta);
  return {
    url: cached.url,
    scale: settings.scale,
    pivot: settings.pivot,
    yaw: settings.yaw,
    boneMap: settings.boneMap,
    animationMap: settings.animationMap,
  };
});

interface DocumentState {
  status: 'loading' | 'ready' | 'error';
  backend: ProjectBackend | null;
  projectRef: string | null;
  project: Project | null;
  fs: ProjectFileSystem | null;
  sceneId: string | null;
  /** Working copy of the open scene. Replaced (never mutated) on every edit. */
  scene: SceneData | null;
  /** Bumps whenever assets change (created, renamed, edited). */
  assetsVersion: number;
  /** Bumps with every unsaved change; equals `savedRevision` when everything is saved. */
  revision: number;
  savedRevision: number;
  undoLabel: string | null;
  redoLabel: string | null;
  /** Folders created in this session that have no assets yet. */
  extraFolders: string[];
  /**
   * Prefab mode (Unity: Prefab Mode): the prefab being edited in isolation and the scene to go
   * back to. While set, `scene` holds the prefab's objects and `sceneId` is `null`.
   */
  prefabStage: { prefabId: string; returnSceneId: string | null } | null;
}

/** The open project and scene (the editor's document). */
export const useDocument = create<DocumentState>()(() => ({
  status: 'loading',
  backend: null,
  projectRef: null,
  project: null,
  fs: null,
  sceneId: null,
  scene: null,
  assetsVersion: 0,
  revision: 0,
  savedRevision: 0,
  undoLabel: null,
  redoLabel: null,
  extraFolders: [],
  prefabStage: null,
}));

const history = new History<SceneData>();

function syncHistoryLabels(): void {
  useDocument.setState({ undoLabel: history.undoLabel, redoLabel: history.redoLabel });
}

function touch(assets = false): void {
  useDocument.setState((state) => ({
    revision: state.revision + 1,
    ...(assets ? { assetsVersion: state.assetsVersion + 1 } : {}),
  }));
}

/** Whether there are unsaved changes. */
export function hasUnsavedChanges(): boolean {
  const state = useDocument.getState();
  return state.revision !== state.savedRevision;
}

/**
 * Changes the open scene. `recipe` returns new scene data (see `document/sceneOps`); the
 * previous state becomes an undo step. Edits with the same `mergeKey` in quick succession
 * (dragging a gizmo, typing a number) become one step.
 */
export function editScene(
  label: TranslationKey,
  recipe: (scene: SceneData) => SceneData,
  mergeKey?: string,
  untilSealed = false,
): void {
  const { scene } = useDocument.getState();
  if (!scene) return;
  const edited = recipe(scene);
  if (edited === scene) return;
  const next = trackOverrides(scene, edited);
  history.record(scene, label, mergeKey, untilSealed);
  useDocument.setState({ scene: next });
  syncHistoryLabels();
  touch();
}

/** Looks up prefab data in the open project. */
export function prefabSource(): PrefabSource {
  const { project } = useDocument.getState();
  return (id) => project?.assetOfType(id, 'prefab')?.data;
}

/**
 * After an edit, recomputes the overrides of every prefab instance with a changed object
 * (Unity marks changed values of instances as overrides automatically).
 */
function trackOverrides(before: SceneData, after: SceneData): SceneData {
  const roots = new Set<string>();
  for (const [id, object] of Object.entries(after.objects)) {
    if (!object.prefab || before.objects[id] === object) continue;
    const root = instanceRootOf(after.objects, id);
    if (root) roots.add(root);
  }
  if (roots.size === 0) return after;
  const source = prefabSource();
  let objects = after.objects;
  for (const root of roots) objects = updateInstanceOverrides(objects, root, source);
  return objects === after.objects ? after : { ...after, objects };
}

/** Ends merging of quick edits (e.g. when a gizmo drag ends). */
export function sealHistory(): void {
  history.seal();
}

function restore(step: { state: SceneData } | null): void {
  if (!step) return;
  useDocument.setState({ scene: step.state });
  const editor = useEditor.getState();
  editor.setSelection(editor.selection.filter((id) => id in step.state.objects));
  syncHistoryLabels();
  touch();
}

/** Undo (Ctrl+Z). */
export function undo(): void {
  const { scene } = useDocument.getState();
  if (scene) restore(history.undo(scene));
}

/** Redo (Ctrl+Y, Ctrl+Shift+Z). */
export function redo(): void {
  const { scene } = useDocument.getState();
  if (scene) restore(history.redo(scene));
}

/** Writes the working scene (or the prefab in prefab mode) into the project. */
function flushScene(): void {
  const { project, sceneId, scene, prefabStage } = useDocument.getState();
  if (project && sceneId && scene && project.asset(sceneId)?.data !== scene) {
    project.updateAsset(sceneId, 'scene', scene);
  }
  if (project && prefabStage && scene) {
    const entry = project.assetOfType(prefabStage.prefabId, 'prefab');
    if (!entry) return;
    const data = prefabFromEdited(entry.data, scene.objects, prefabSource());
    if (JSON.stringify(data) !== JSON.stringify(entry.data)) {
      project.updateAsset(entry.id, 'prefab', data);
    }
  }
}

/** Environment of the prefab stage: bright ambient light, no fog. */
const STAGE_ENVIRONMENT: SceneData['environment'] = {
  ambientIntensity: 1,
  fog: { enabled: false, near: 10, far: 100 },
};

/** The objects of a prefab as a scene for prefab mode (variants: with the base applied). */
function prefabStageScene(prefabId: string): SceneData | null {
  const resolved = resolvePrefab(prefabId, prefabSource());
  if (!resolved) return null;
  return {
    formatVersion: FORMAT_VERSION,
    environment: STAGE_ENVIRONMENT,
    objects: resolved.objects,
  };
}

/**
 * Brings every prefab instance in all scenes and prefabs up to date (after a prefab changed).
 * The open scene is updated in place; this is not an undo step.
 */
export function syncPrefabUsages(): void {
  const { project, sceneId, scene, prefabStage } = useDocument.getState();
  if (!project) return;
  const source = prefabSource();
  let anyChange = false;
  for (const entry of project.assetsOfType('prefab')) {
    if (entry.id === prefabStage?.prefabId) continue;
    const objects = syncPrefabInstances(entry.data.objects, source, createId);
    if (
      Object.entries(objects).some(([id, object]) => entry.data.objects[id] !== object) ||
      Object.keys(objects).length !== Object.keys(entry.data.objects).length
    ) {
      project.updateAsset(entry.id, 'prefab', { ...entry.data, objects });
      anyChange = true;
    }
  }
  for (const entry of project.assetsOfType('scene')) {
    const data = entry.id === sceneId && scene ? scene : entry.data;
    const objects = syncPrefabInstances(data.objects, source, createId);
    const changed =
      Object.keys(objects).length !== Object.keys(data.objects).length ||
      Object.entries(objects).some(([id, object]) => data.objects[id] !== object);
    if (!changed) continue;
    anyChange = true;
    const next = { ...data, objects };
    if (entry.id === sceneId) {
      useDocument.setState({ scene: next });
      const editor = useEditor.getState();
      editor.setSelection(editor.selection.filter((id) => id in objects));
    } else {
      project.updateAsset(entry.id, 'scene', next);
    }
  }
  if (anyChange) touch(true);
}

/** Opens a prefab in prefab mode (double-click on a prefab, "Open" in the inspector). */
export function openPrefab(prefabId: string): void {
  const { project, sceneId, prefabStage } = useDocument.getState();
  if (!project?.assetOfType(prefabId, 'prefab') || prefabStage?.prefabId === prefabId) return;
  flushScene();
  if (prefabStage) syncPrefabUsages();
  const stage = prefabStageScene(prefabId);
  if (!stage) return;
  history.clear();
  useDocument.setState({
    prefabStage: { prefabId, returnSceneId: prefabStage?.returnSceneId ?? sceneId },
    sceneId: null,
    scene: stage,
    undoLabel: null,
    redoLabel: null,
  });
  useEditor.getState().resetForScene();
}

/** Leaves prefab mode: the prefab is stored and every instance follows. */
export function closePrefab(): void {
  const { project, prefabStage } = useDocument.getState();
  if (!project || !prefabStage) return;
  flushScene();
  const returnId = prefabStage.returnSceneId;
  const entry = returnId ? project.assetOfType(returnId, 'scene') : undefined;
  history.clear();
  useDocument.setState({
    prefabStage: null,
    sceneId: entry?.id ?? null,
    scene: entry?.data ?? null,
    undoLabel: null,
    redoLabel: null,
  });
  syncPrefabUsages();
  useEditor.getState().resetForScene();
}

/** Replaces the data of a prefab and updates every instance. */
export function updatePrefab(id: string, data: PrefabData): void {
  const { project } = useDocument.getState();
  if (!project?.assetOfType(id, 'prefab')) return;
  flushScene();
  project.updateAsset(id, 'prefab', data);
  syncPrefabUsages();
}

/** Creates a prefab asset. */
export function createPrefabAsset(folder: string, name: string, data: PrefabData): AnyAsset | null {
  const { project } = useDocument.getState();
  if (!project) return null;
  const entry = project.createAsset(
    'prefab',
    project.uniqueAssetPath(folder, name, 'prefab'),
    data,
  );
  assetsChanged();
  return entry as AnyAsset;
}

let saving: Promise<void> | null = null;

/** Saves all changed files of the project (Ctrl+S). Unchanged files are not touched. */
export async function saveProject(options: { quiet?: boolean } = {}): Promise<void> {
  if (saving) await saving;
  const { project, fs, revision } = useDocument.getState();
  if (!project || !fs) return;
  flushScene();
  saving = (async () => {
    try {
      const result = await project.save(fs);
      useDocument.setState({ savedRevision: revision });
      if (!options.quiet || result.written.length > 0) {
        useConsole
          .getState()
          .log('info', 'console.saved', { files: result.written.length + result.removed.length });
      }
    } catch (error) {
      useConsole.getState().log('error', 'console.saveFailed', { message: String(error) });
    } finally {
      saving = null;
    }
  })();
  await saving;
}

function activate(
  backend: ProjectBackend,
  ref: string,
  project: Project,
  fs: ProjectFileSystem,
): void {
  history.clear();
  const sceneId =
    (project.settings.startScene && project.assetOfType(project.settings.startScene, 'scene')
      ? project.settings.startScene
      : project.assetsOfType('scene')[0]?.id) ?? null;
  const scene = sceneId ? (project.assetOfType(sceneId, 'scene')?.data ?? null) : null;
  useDocument.setState((state) => ({
    status: 'ready',
    backend,
    projectRef: ref,
    project,
    fs,
    sceneId,
    scene,
    assetsVersion: state.assetsVersion + 1,
    revision: 0,
    savedRevision: project.dirty ? -1 : 0,
    undoLabel: null,
    redoLabel: null,
    extraFolders: [],
    prefabStage: null,
  }));
  // Prefabs may have changed outside the editor (e.g. in Git): bring instances up to date.
  syncPrefabUsages();
  useEditor.getState().resetForScene();
  useSettings.getState().setLastProject(ref);
  for (const problem of project.problems) {
    useConsole
      .getState()
      .log(
        problem.severity === 'error'
          ? 'error'
          : problem.severity === 'warning'
            ? 'warning'
            : 'info',
        `console.problem.${problem.code}`,
        {
          path: problem.path,
          detail: problem.detail ?? '',
        },
      );
  }
  useConsole.getState().log('info', 'console.projectOpened', { name: project.settings.name });
}

async function backendOrDetect(): Promise<ProjectBackend> {
  const existing = useDocument.getState().backend;
  if (existing) return existing;
  const backend = await detectBackend();
  useDocument.setState({ backend });
  return backend;
}

/** Opens a project of the current backend. */
export async function openProject(ref: string): Promise<void> {
  const backend = await backendOrDetect();
  if (useDocument.getState().projectRef && hasUnsavedChanges()) await saveProject({ quiet: true });
  const fs = await backend.open(ref);
  const project = await loadProject(fs);
  activate(backend, ref, project, fs);
}

/** Creates and opens a new project with a default scene. */
export async function createNewProject(name: string): Promise<void> {
  const backend = await backendOrDetect();
  if (useDocument.getState().projectRef && hasUnsavedChanges()) await saveProject({ quiet: true });
  const ref = await backend.create(name);
  const fs = await backend.open(ref);
  const project = await createProject(fs, {
    name,
    sceneName: t('project.defaultSceneName'),
    folders: newProjectFolders(),
    scene: createDefaultScene({
      camera: t('object.mainCamera'),
      sun: t('object.sun'),
      ground: t('object.ground'),
    }),
  });
  activate(backend, ref, project, fs);
}

/** Copies a bundled project (e.g. an example) into a new project and opens it. */
export async function importProject(
  name: string,
  files: Readonly<Record<string, string>>,
  binaries: Readonly<Record<string, string>> = {},
): Promise<void> {
  const backend = await backendOrDetect();
  if (useDocument.getState().projectRef && hasUnsavedChanges()) await saveProject({ quiet: true });
  const ref = await backend.create(name);
  const fs = await backend.open(ref);
  for (const [path, text] of Object.entries(files)) await fs.writeText(path, text);
  for (const [path, url] of Object.entries(binaries)) {
    await fs.writeBytes(path, new Uint8Array(await (await fetch(url)).arrayBuffer()));
  }
  const project = await loadProject(fs);
  activate(backend, ref, project, fs);
}

/** Lists the projects of the current backend. */
export async function listProjects(): Promise<ProjectListing[]> {
  return (await backendOrDetect()).list();
}

/** Opens the last project, or creates a first one. Called once at startup. */
export async function bootstrap(): Promise<void> {
  try {
    const backend = await backendOrDetect();
    const projects = await backend.list();
    const last = useSettings.getState().lastProject;
    const ref = projects.find((item) => item.ref === last)?.ref ?? projects[0]?.ref;
    if (ref) {
      try {
        await openProject(ref);
        return;
      } catch (error) {
        const key =
          error instanceof ProjectLoadError ? 'console.projectBroken' : 'console.openFailed';
        useConsole.getState().log('error', key, { message: String(error) });
      }
    }
    await createNewProject(t('project.defaultName'));
  } catch (error) {
    useDocument.setState({ status: 'error' });
    useConsole.getState().log('error', 'console.openFailed', { message: String(error) });
  }
}

/** Opens another scene of the project (double-click in the project window). */
export function openScene(id: string): void {
  const { project, sceneId, prefabStage } = useDocument.getState();
  const entry = project?.assetOfType(id, 'scene');
  if (!project || !entry || id === sceneId) return;
  flushScene();
  history.clear();
  useDocument.setState({
    sceneId: id,
    scene: entry.data,
    prefabStage: null,
    undoLabel: null,
    redoLabel: null,
  });
  if (prefabStage) syncPrefabUsages();
  useEditor.getState().resetForScene();
}

function assetsChanged(): void {
  touch(true);
}

/** Creates an empty block script. */
export function createBlockScript(folder: string, name: string): AnyAsset | null {
  const { project } = useDocument.getState();
  if (!project) return null;
  const data: BlockScriptData = {
    formatVersion: FORMAT_VERSION,
    variables: [],
    workspace: { blocks: { languageVersion: 0, blocks: [] } },
  };
  const entry = project.createAsset(
    'blockScript',
    project.uniqueAssetPath(folder, name, 'blockScript'),
    data,
  );
  assetsChanged();
  return entry as AnyAsset;
}

/** Creates a new scene with the default objects. */
export function createSceneAsset(folder: string, name: string): AnyAsset | null {
  const { project } = useDocument.getState();
  if (!project) return null;
  const scene = createDefaultScene({
    camera: t('object.mainCamera'),
    sun: t('object.sun'),
    ground: t('object.ground'),
  });
  const entry = project.createAsset('scene', project.uniqueAssetPath(folder, name, 'scene'), scene);
  assetsChanged();
  return entry as AnyAsset;
}

/** Adds an imported model (GLB) to the project. */
export function importModelAsset(
  folder: string,
  name: string,
  data: Uint8Array,
  settings?: ModelImportSettings,
  license: string | null = null,
): AssetEntry<'model'> | null {
  const { project } = useDocument.getState();
  if (!project) return null;
  const entry = project.createModel(
    project.uniqueAssetPath(folder, name, 'model'),
    data,
    settings,
    license,
  );
  assetsChanged();
  return entry;
}

/** Sound file endings the editor imports. */
export const SOUND_FILE_EXTENSIONS = ['.wav', '.ogg', '.mp3'] as const;

/** Adds sound files (WAV, OGG, MP3) to the project folder; returns the new assets. */
export async function importSoundFiles(
  files: readonly File[],
  folder: string,
): Promise<AssetEntry<'audio'>[]> {
  const { project } = useDocument.getState();
  if (!project) return [];
  const added: AssetEntry<'audio'>[] = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    const extension = SOUND_FILE_EXTENSIONS.find((candidate) => lower.endsWith(candidate));
    if (!extension) continue;
    const name = file.name.slice(0, -extension.length);
    const path = project.uniqueAssetPath(folder, name, 'audio').replace(/\.wav$/, extension);
    added.push(project.createAudio(path, new Uint8Array(await file.arrayBuffer())));
  }
  if (added.length > 0) assetsChanged();
  return added;
}

/** Adds an image (PNG), e.g. a character portrait, to the project. */
export function importImageAsset(
  folder: string,
  name: string,
  data: Uint8Array,
): AssetEntry<'image'> | null {
  const { project } = useDocument.getState();
  if (!project) return null;
  const entry = project.createImage(project.uniqueAssetPath(folder, name, 'image'), data);
  assetsChanged();
  return entry;
}

/**
 * Adds assets that keep their IDs (from "My Prefabs"). Assets the project already has are
 * skipped. Returns how many were added.
 */
export function adoptAssets(
  files: readonly { path: string; meta: MetaData; json?: unknown; bytes?: Uint8Array }[],
): number {
  const { project } = useDocument.getState();
  if (!project) return 0;
  let added = 0;
  for (const file of files) {
    const content = file.bytes
      ? { bytes: file.bytes }
      : {
          data: file.json as AssetDataByType[Exclude<
            AssetType,
            'model' | 'image' | 'terrain' | 'audio'
          >],
        };
    if (project.adoptAsset(file.path, file.meta, content)) added++;
  }
  if (added > 0) assetsChanged();
  return added;
}

/** Changes the import settings and license of a model (import inspector). */
export function updateModelSettings(
  id: string,
  settings: ModelImportSettings,
  license: string | null,
): void {
  const { project } = useDocument.getState();
  const entry = project?.assetOfType(id, 'model');
  if (!project || !entry) return;
  project.updateMeta(id, { importSettings: { ...settings }, license });
  editorModels.invalidate(id);
  assetsChanged();
  modelsChanged();
}

type ModelsListener = () => void;
const modelsListeners = new Set<ModelsListener>();

/** Calls `listener` when models changed and the 3D views must load them again. */
export function onModelsChanged(listener: ModelsListener): () => void {
  modelsListeners.add(listener);
  return () => modelsListeners.delete(listener);
}

function modelsChanged(): void {
  for (const listener of [...modelsListeners]) listener();
}

/** Default folder for new assets of a type. */
export function defaultFolder(type: AssetType): string {
  return defaultAssetFolder(type, newProjectFolders());
}

/** Replaces the data of a block script (block editor, variables). */
export function updateBlockScript(id: string, data: BlockScriptData): void {
  const { project } = useDocument.getState();
  if (!project?.assetOfType(id, 'blockScript')) return;
  project.updateAsset(id, 'blockScript', data);
  assetsChanged();
}

/** Renames an asset (the ID stays, so nothing breaks). Returns false if the name is taken. */
export function renameAsset(id: string, name: string): boolean {
  const { project } = useDocument.getState();
  const entry = project?.asset(id);
  if (!project || !entry || !name.trim() || name === assetDisplayName(entry.path)) return false;
  const path = project.uniqueAssetPath(dirname(entry.path), name.trim(), entry.type);
  project.moveAsset(id, path);
  assetsChanged();
  return true;
}

/** Moves an asset into another folder. */
export function moveAssetToFolder(id: string, folder: string): void {
  const { project } = useDocument.getState();
  const entry = project?.asset(id);
  if (!project || !entry || dirname(entry.path) === folder) return;
  project.moveAsset(id, project.uniqueAssetPath(folder, assetDisplayName(entry.path), entry.type));
  assetsChanged();
}

/** Deletes an asset. The open scene cannot be deleted. */
export function deleteAsset(id: string): boolean {
  const { project, sceneId } = useDocument.getState();
  const stage = useDocument.getState().prefabStage;
  if (!project || id === sceneId || id === stage?.prefabId || !project.asset(id)) return false;
  project.deleteAsset(id);
  if (project.settings.startScene === id)
    project.settings = { ...project.settings, startScene: sceneId };
  assetsChanged();
  return true;
}

/** Creates a folder (kept in this session until an asset is saved in it). */
export function createFolder(parent: string, name: string): string {
  const path = joinPath(
    parent,
    name.replace(/[\\/:*?"<>|]/g, '_').trim() || t('project.newFolder'),
  );
  useDocument.setState((state) => ({ extraFolders: [...new Set([...state.extraFolders, path])] }));
  return path;
}

/** All folders below `Assets/`, sorted. */
export function projectFolders(project: Project | null, extra: readonly string[]): string[] {
  const folders = new Set<string>([ASSETS_FOLDER]);
  const add = (folder: string): void => {
    for (let current = folder; current.startsWith(ASSETS_FOLDER); current = dirname(current)) {
      folders.add(current);
      if (current === ASSETS_FOLDER) break;
    }
  };
  for (const entry of project?.assets ?? []) add(dirname(entry.path));
  for (const folder of extra) add(folder);
  return [...folders].sort((a, b) => a.localeCompare(b));
}

/** Built-in tags (Unity) that every project has. */
export const BUILT_IN_TAGS = ['Untagged', 'MainCamera', 'Player'] as const;

/** Built-in layer. */
export const DEFAULT_LAYER = 'Default';

/** Adds a tag or layer to the project settings. */
export function addTagOrLayer(kind: 'tags' | 'layers', name: string): boolean {
  const { project } = useDocument.getState();
  const trimmed = name.trim();
  if (!project || !trimmed) return false;
  const builtIn: readonly string[] = kind === 'tags' ? BUILT_IN_TAGS : [DEFAULT_LAYER];
  if (builtIn.includes(trimmed) || project.tagsAndLayers[kind].includes(trimmed)) return true;
  project.tagsAndLayers = {
    ...project.tagsAndLayers,
    [kind]: [...project.tagsAndLayers[kind], trimmed],
  };
  assetsChanged();
  return true;
}

/** All physics layers of the project (`Default` first). */
export function physicsLayers(): string[] {
  const { project } = useDocument.getState();
  return [DEFAULT_LAYER, ...(project?.tagsAndLayers.layers ?? [])];
}

/** Whether objects of two layers collide (the physics layer matrix). */
export function layersCollide(a: string, b: string): boolean {
  const { project } = useDocument.getState();
  return !(project?.tagsAndLayers.ignoredCollisions ?? []).some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

/** Turns collisions between two layers on or off. */
export function setLayersCollide(a: string, b: string, collide: boolean): void {
  const { project } = useDocument.getState();
  if (!project) return;
  const others = (project.tagsAndLayers.ignoredCollisions ?? []).filter(
    ([x, y]) => !((x === a && y === b) || (x === b && y === a)),
  );
  const ignored: [string, string][] = collide ? others : [...others, [a, b]];
  const { ignoredCollisions: _before, ...rest } = project.tagsAndLayers;
  project.tagsAndLayers = ignored.length > 0 ? { ...rest, ignoredCollisions: ignored } : rest;
  assetsChanged();
}

/** Gravity of the open scene in m/s² (negative is down). */
export function sceneGravity(): number {
  return useDocument.getState().scene?.environment.gravity?.[1] ?? -9.81;
}

/** Sets the gravity of the open scene (Y component, in m/s²). */
export function setSceneGravity(y: number): void {
  editScene(
    'undo.change',
    (scene) => ({ ...scene, environment: { ...scene.environment, gravity: [0, y, 0] } }),
    'scene-gravity',
  );
}

/** Changes the environment of the open scene (sky, fog, weather, ambient light) with undo. */
export function setEnvironment(
  patch: Partial<SceneData['environment']>,
  mergeKey = 'environment',
): void {
  editScene(
    'undo.lighting',
    (scene) => ({ ...scene, environment: { ...scene.environment, ...patch } }),
    mergeKey,
  );
}

/** Changes the navigation mesh settings of the open scene with undo (Navigation window). */
export function setNavigationSettings(
  navigation: NonNullable<SceneData['environment']['navigation']>,
): void {
  editScene(
    'undo.navigation',
    (scene) => ({ ...scene, environment: { ...scene.environment, navigation } }),
    'navigation',
  );
}

/** Sets the graphics level new games of the project start with (`null` = none chosen). */
export function setProjectGraphicsLevel(level: 'low' | 'medium' | 'high' | 'ultra' | null): void {
  const { project } = useDocument.getState();
  if (!project) return;
  const { graphicsLevel: _before, ...rest } = project.settings;
  project.settings = level ? { ...rest, graphicsLevel: level } : rest;
  assetsChanged();
}
