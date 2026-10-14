import {
  ASSETS_FOLDER,
  assetDisplayName,
  createDefaultScene,
  createProject,
  defaultAssetFolder,
  dirname,
  FORMAT_VERSION,
  joinPath,
  loadProject,
  modelImportSettings,
  ProjectLoadError,
} from '@blockwerk/project';
import type {
  AnyAsset,
  AssetEntry,
  AssetType,
  BlockScriptData,
  ModelImportSettings,
  NewProjectFolders,
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
  return { url: cached.url, scale: settings.scale, pivot: settings.pivot };
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
): void {
  const { scene } = useDocument.getState();
  if (!scene) return;
  const next = recipe(scene);
  if (next === scene) return;
  history.record(scene, label, mergeKey);
  useDocument.setState({ scene: next });
  syncHistoryLabels();
  touch();
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

/** Writes the working scene into the project (before saving or switching scenes). */
function flushScene(): void {
  const { project, sceneId, scene } = useDocument.getState();
  if (project && sceneId && scene && project.asset(sceneId)?.data !== scene) {
    project.updateAsset(sceneId, 'scene', scene);
  }
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
  }));
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
): Promise<void> {
  const backend = await backendOrDetect();
  if (useDocument.getState().projectRef && hasUnsavedChanges()) await saveProject({ quiet: true });
  const ref = await backend.create(name);
  const fs = await backend.open(ref);
  for (const [path, text] of Object.entries(files)) await fs.writeText(path, text);
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
  const { project, sceneId } = useDocument.getState();
  const entry = project?.assetOfType(id, 'scene');
  if (!project || !entry || id === sceneId) return;
  flushScene();
  history.clear();
  useDocument.setState({ sceneId: id, scene: entry.data, undoLabel: null, redoLabel: null });
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
  if (!project || id === sceneId || !project.asset(id)) return false;
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
