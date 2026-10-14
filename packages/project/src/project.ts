import type { z } from 'zod';
import {
  basename,
  dirname,
  FileNotFoundError,
  joinPath,
  listFilesRecursive,
  normalizePath,
} from './fs/types';
import type { ProjectFileSystem } from './fs/types';
import { createId } from './ids';
import { stringifyDeterministic } from './json';
import { FormatTooNewError, migrate, MIGRATIONS } from './migrations';
import type { FileKind, MigrationRegistry } from './migrations';
import {
  blockScriptSchema,
  FORMAT_VERSION,
  metaSchema,
  projectFileSchema,
  sceneSchema,
  tagsAndLayersSchema,
} from './schema';
import type {
  AssetType,
  BlockScriptData,
  MetaData,
  ProjectFileData,
  SceneData,
  TagsAndLayersData,
} from './schema';

/** Project file with name, format version and settings. */
export const PROJECT_FILE = 'blockwerk.json';
/** Folder of all assets. */
export const ASSETS_FOLDER = 'Assets';
/** Tags and layers (SPEC 9.1: `Einstellungen/`). */
export const TAGS_AND_LAYERS_FILE = 'Einstellungen/tags-und-ebenen.json';
/** Backups, cache and history; ignored by Git. */
export const CACHE_FOLDER = '.blockwerk';
/** Suffix of meta files: `held.scene.json` → `held.scene.json.meta.json`. */
export const META_SUFFIX = '.meta.json';
/** File name endings of the asset types. */
export const ASSET_EXTENSIONS: Readonly<Record<AssetType, string>> = {
  scene: '.scene.json',
  blockScript: '.blocks.json',
};

/** Data of each asset type. */
export interface AssetDataByType {
  scene: SceneData;
  blockScript: BlockScriptData;
}

/** An asset of the project: file, meta data and parsed content. */
export interface AssetEntry<T extends AssetType = AssetType> {
  readonly id: string;
  readonly type: T;
  /** Path of the asset file relative to the project folder. */
  readonly path: string;
  readonly meta: MetaData;
  readonly data: AssetDataByType[T];
}

/** Any asset, discriminated by `type`. */
export type AnyAsset = { [T in AssetType]: AssetEntry<T> }[AssetType];

/** A problem found while loading. Problems never stop loading; broken files are skipped. */
export interface ProjectProblem {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code:
    | 'invalidFile'
    | 'formatTooNew'
    | 'missingMeta'
    | 'duplicateId'
    | 'orphanMeta'
    | 'typeMismatch'
    | 'migrated';
  readonly path: string;
  readonly detail?: string;
}

/** Thrown when the project itself (not a single asset) cannot be loaded. */
export class ProjectLoadError extends Error {
  override readonly name = 'ProjectLoadError';

  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
  }
}

/** Options for {@link loadProject}. */
export interface LoadOptions {
  /** Time stamp source for backup folder names. */
  readonly now?: () => Date;
  readonly migrations?: MigrationRegistry;
}

/** Result of {@link Project.save}. */
export interface SaveResult {
  readonly written: readonly string[];
  readonly removed: readonly string[];
}

/** The asset type of a path, by its file name ending. */
export function assetTypeOfPath(path: string): AssetType | null {
  for (const [type, extension] of Object.entries(ASSET_EXTENSIONS) as [AssetType, string][]) {
    if (path.endsWith(extension) && basename(path).length > extension.length) return type;
  }
  return null;
}

/** File name of an asset without its type ending (what the project window shows). */
export function assetDisplayName(path: string): string {
  const name = basename(path);
  const type = assetTypeOfPath(path);
  return type ? name.slice(0, -ASSET_EXTENSIONS[type].length) : name;
}

const SCHEMAS = {
  scene: sceneSchema,
  blockScript: blockScriptSchema,
} satisfies Record<AssetType, z.ZodType>;

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

type Parsed<T> =
  { ok: true; value: T; migratedFrom: number | null } | { ok: false; problem: ProjectProblem };

function parseFile<T>(
  path: string,
  text: string,
  kind: FileKind,
  schema: z.ZodType<T>,
  migrations: MigrationRegistry,
): Parsed<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, problem: { severity: 'error', code: 'invalidFile', path, detail } };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      problem: { severity: 'error', code: 'invalidFile', path, detail: 'not a JSON object' },
    };
  }
  let migrated;
  try {
    migrated = migrate(kind, raw as Record<string, unknown>, migrations);
  } catch (error) {
    const code = error instanceof FormatTooNewError ? 'formatTooNew' : 'invalidFile';
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, problem: { severity: 'error', code, path, detail } };
  }
  const result = schema.safeParse(migrated.data);
  if (!result.success) {
    return {
      ok: false,
      problem: {
        severity: 'error',
        code: 'invalidFile',
        path,
        detail: describeIssues(result.error),
      },
    };
  }
  return {
    ok: true,
    value: result.data,
    migratedFrom: migrated.migrated ? migrated.fromVersion : null,
  };
}

function defaultTagsAndLayers(): TagsAndLayersData {
  return { formatVersion: FORMAT_VERSION, tags: [], layers: [] };
}

function newMeta(type: AssetType, id = createId()): MetaData {
  return { formatVersion: FORMAT_VERSION, id, type, importSettings: {}, license: null };
}

/**
 * A project in memory. Asset data objects are treated as immutable: changes replace them
 * (see {@link Project.updateAsset}), which keeps undo and change detection cheap. Saving
 * writes only files whose content changed, so an unchanged project produces no Git diffs.
 */
export class Project {
  settings: ProjectFileData;
  tagsAndLayers: TagsAndLayersData;
  readonly problems: ProjectProblem[] = [];
  private readonly entries = new Map<string, AnyAsset>();
  /** Managed files as last read from or written to disk. */
  private readonly disk = new Map<string, string>();
  /** Files below `Assets/` that are not managed (broken or unknown), never overwritten. */
  private readonly foreign = new Set<string>();

  constructor(
    settings: ProjectFileData,
    tagsAndLayers: TagsAndLayersData = defaultTagsAndLayers(),
  ) {
    this.settings = settings;
    this.tagsAndLayers = tagsAndLayers;
  }

  /** All assets, sorted by path. */
  get assets(): AnyAsset[] {
    return [...this.entries.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Looks up an asset by ID. */
  asset(id: string): AnyAsset | undefined {
    return this.entries.get(id);
  }

  /** Looks up an asset of a given type by ID. */
  assetOfType<T extends AssetType>(id: string, type: T): AssetEntry<T> | undefined {
    const entry = this.entries.get(id);
    return entry?.type === type ? (entry as AssetEntry<T>) : undefined;
  }

  /** Looks up an asset by path. */
  assetAt(path: string): AnyAsset | undefined {
    const normalized = normalizePath(path);
    return this.assets.find((entry) => entry.path === normalized);
  }

  /** All assets of a type, sorted by path. */
  assetsOfType<T extends AssetType>(type: T): AssetEntry<T>[] {
    return this.assets.filter((entry): entry is AssetEntry<T> & AnyAsset => entry.type === type);
  }

  /**
   * Returns a free asset path: `folder/name.ext`, or `folder/name 1.ext`, `name 2` … like
   * Unity when the name is taken.
   */
  uniqueAssetPath(folder: string, name: string, type: AssetType): string {
    const extension = ASSET_EXTENSIONS[type];
    const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim() || type;
    for (let index = 0; ; index++) {
      const candidate = joinPath(
        folder,
        `${index === 0 ? cleaned : `${cleaned} ${index}`}${extension}`,
      );
      if (!this.isPathTaken(candidate)) return candidate;
    }
  }

  /** Adds a new asset with a new stable ID. The path must be free and end with the type's ending. */
  createAsset<T extends AssetType>(type: T, path: string, data: AssetDataByType[T]): AssetEntry<T> {
    const normalized = this.checkAssetPath(type, path);
    const meta = newMeta(type);
    const entry = { id: meta.id, type, path: normalized, meta, data } as AssetEntry<T>;
    this.entries.set(entry.id, entry as unknown as AnyAsset);
    return entry;
  }

  /** Replaces the data of an asset. */
  updateAsset<T extends AssetType>(id: string, type: T, data: AssetDataByType[T]): void {
    const entry = this.assetOfType(id, type);
    if (!entry) throw new Error(`Unknown ${type} asset ${id}.`);
    this.entries.set(id, { ...entry, data } as unknown as AnyAsset);
  }

  /** Renames or moves an asset. Its ID stays the same, so no reference breaks. */
  moveAsset(id: string, path: string): AnyAsset {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown asset ${id}.`);
    const normalized = normalizePath(path);
    if (normalized === entry.path) return entry;
    const moved = { ...entry, path: this.checkAssetPath(entry.type, normalized, id) } as AnyAsset;
    this.entries.set(id, moved);
    return moved;
  }

  /** Removes an asset; its files are deleted on the next save. */
  deleteAsset(id: string): void {
    this.entries.delete(id);
  }

  /** The text of every managed file as it should be on disk. */
  files(): Map<string, string> {
    const files = new Map<string, string>();
    files.set(PROJECT_FILE, stringifyDeterministic(this.settings));
    files.set(TAGS_AND_LAYERS_FILE, stringifyDeterministic(this.tagsAndLayers));
    for (const entry of this.assets) {
      files.set(entry.path, stringifyDeterministic(entry.data));
      files.set(entry.path + META_SUFFIX, stringifyDeterministic(entry.meta));
    }
    return files;
  }

  /** Whether saving would change any file. */
  get dirty(): boolean {
    const files = this.files();
    if ([...this.disk.keys()].some((path) => !files.has(path))) return true;
    return [...files].some(([path, text]) => this.disk.get(path) !== text);
  }

  /** Writes changed files and deletes files of removed or moved assets. */
  async save(fs: ProjectFileSystem): Promise<SaveResult> {
    const files = this.files();
    const written: string[] = [];
    const removed: string[] = [];
    // Case-only renames: on case-insensitive file systems, writing the new name and deleting
    // the old one would delete the file, so these are renamed first.
    for (const oldPath of [...this.disk.keys()]) {
      if (files.has(oldPath)) continue;
      const newPath = [...files.keys()].find(
        (path) => !this.disk.has(path) && path.toLowerCase() === oldPath.toLowerCase(),
      );
      if (newPath === undefined) continue;
      await fs.rename(oldPath, newPath);
      this.disk.set(newPath, this.disk.get(oldPath) ?? '');
      this.disk.delete(oldPath);
    }
    for (const [path, text] of files) {
      if (this.disk.get(path) === text) continue;
      await fs.writeText(path, text);
      this.disk.set(path, text);
      written.push(path);
    }
    for (const path of [...this.disk.keys()]) {
      if (files.has(path)) continue;
      await fs.remove(path);
      this.disk.delete(path);
      removed.push(path);
    }
    return { written, removed };
  }

  /** Remembers file contents as present on disk (used while loading). */
  private remember(path: string, text: string): void {
    this.disk.set(path, text);
  }

  private isPathTaken(path: string, ignoreId?: string): boolean {
    // Case-insensitive, because Windows and macOS file systems usually are.
    const lower = path.toLowerCase();
    const meta = `${lower}${META_SUFFIX}`;
    return (
      this.assets.some((entry) => entry.id !== ignoreId && entry.path.toLowerCase() === lower) ||
      [...this.foreign].some((item) => {
        const other = item.toLowerCase();
        return other === lower || other === meta;
      })
    );
  }

  private checkAssetPath(type: AssetType, path: string, ignoreId?: string): string {
    const normalized = normalizePath(path);
    if (!normalized.startsWith(`${ASSETS_FOLDER}/`)) {
      throw new Error(`Assets must be inside ${ASSETS_FOLDER}/: ${normalized}`);
    }
    if (assetTypeOfPath(normalized) !== type) {
      throw new Error(`A ${type} asset must end with ${ASSET_EXTENSIONS[type]}: ${normalized}`);
    }
    if (this.isPathTaken(normalized, ignoreId)) throw new Error(`Path is taken: ${normalized}`);
    return normalized;
  }

  /** Loads a project folder. See {@link loadProject}. */
  static async load(fs: ProjectFileSystem, options: LoadOptions = {}): Promise<Project> {
    const migrations = options.migrations ?? MIGRATIONS;
    const stamp = (options.now ?? (() => new Date()))().toISOString().replace(/[:.]/g, '-');
    const backup = async (path: string, text: string): Promise<void> => {
      await fs.writeText(joinPath(CACHE_FOLDER, 'backup', stamp, path), text);
    };

    let projectText: string;
    try {
      projectText = await fs.readText(PROJECT_FILE);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        throw new ProjectLoadError(`${PROJECT_FILE} is missing.`, PROJECT_FILE);
      }
      throw error;
    }
    const settings = parseFile(PROJECT_FILE, projectText, 'project', projectFileSchema, migrations);
    if (!settings.ok) {
      throw new ProjectLoadError(settings.problem.detail ?? 'invalid', PROJECT_FILE);
    }
    const project = new Project(settings.value);
    project.remember(PROJECT_FILE, projectText);
    if (settings.migratedFrom !== null) {
      await backup(PROJECT_FILE, projectText);
      project.problems.push({ severity: 'info', code: 'migrated', path: PROJECT_FILE });
    }

    if (await fs.exists(TAGS_AND_LAYERS_FILE)) {
      const text = await fs.readText(TAGS_AND_LAYERS_FILE);
      const parsed = parseFile(
        TAGS_AND_LAYERS_FILE,
        text,
        'tagsAndLayers',
        tagsAndLayersSchema,
        migrations,
      );
      if (parsed.ok) {
        project.tagsAndLayers = parsed.value;
        project.remember(TAGS_AND_LAYERS_FILE, text);
        if (parsed.migratedFrom !== null) await backup(TAGS_AND_LAYERS_FILE, text);
      } else {
        project.problems.push(parsed.problem);
      }
    }

    const files = await listFilesRecursive(fs, ASSETS_FOLDER);
    const fileSet = new Set(files);
    for (const path of files) {
      if (path.endsWith(META_SUFFIX)) {
        if (!fileSet.has(path.slice(0, -META_SUFFIX.length))) {
          project.problems.push({ severity: 'warning', code: 'orphanMeta', path });
          project.foreign.add(path);
        }
        continue;
      }
      const type = assetTypeOfPath(path);
      if (!type) {
        // Other files (models, textures …) arrive with later phases.
        project.foreign.add(path);
        continue;
      }
      const text = await fs.readText(path);
      const parsed = parseFile(
        path,
        text,
        type,
        SCHEMAS[type] as z.ZodType<AssetDataByType[typeof type]>,
        migrations,
      );
      if (!parsed.ok) {
        project.problems.push(parsed.problem);
        project.foreign.add(path);
        if (fileSet.has(path + META_SUFFIX)) project.foreign.add(path + META_SUFFIX);
        continue;
      }
      if (parsed.migratedFrom !== null) {
        await backup(path, text);
        project.problems.push({ severity: 'info', code: 'migrated', path });
      }
      project.remember(path, text);

      let meta: MetaData | null = null;
      const metaPath = path + META_SUFFIX;
      if (fileSet.has(metaPath)) {
        const metaText = await fs.readText(metaPath);
        const parsedMeta = parseFile(metaPath, metaText, 'meta', metaSchema, migrations);
        if (parsedMeta.ok) {
          project.remember(metaPath, metaText);
          meta = parsedMeta.value;
          if (meta.type !== type) {
            project.problems.push({ severity: 'warning', code: 'typeMismatch', path: metaPath });
            meta = { ...meta, type };
          }
        } else {
          project.problems.push(parsedMeta.problem);
          // Keep the old text so the repaired meta file is written on save.
          project.remember(metaPath, metaText);
        }
      } else {
        project.problems.push({ severity: 'info', code: 'missingMeta', path });
      }
      if (meta && project.entries.has(meta.id)) {
        // A copied file with its meta file: the copy gets a new identity (like Unity).
        project.problems.push({ severity: 'warning', code: 'duplicateId', path, detail: meta.id });
        meta = { ...meta, id: createId() };
      }
      meta ??= newMeta(type);
      const entry = { id: meta.id, type, path, meta, data: parsed.value } as AnyAsset;
      project.entries.set(entry.id, entry);
    }
    return project;
  }
}

/**
 * Loads a project folder: `blockwerk.json`, tags and layers and every asset below `Assets/`
 * with its meta file. Missing meta files are created (on the next save), old formats are
 * migrated after a backup to `.blockwerk/backup/`. Broken assets are skipped and listed in
 * {@link Project.problems}. Throws {@link ProjectLoadError} if `blockwerk.json` is unusable.
 */
export function loadProject(fs: ProjectFileSystem, options: LoadOptions = {}): Promise<Project> {
  return Project.load(fs, options);
}

/** Folder of new scenes and block scripts. */
export function defaultAssetFolder(type: AssetType, folders: NewProjectFolders): string {
  return joinPath(ASSETS_FOLDER, type === 'scene' ? folders.scenes : folders.blockScripts);
}

/** Folder names below `Assets/` for a new project, in the user's language. */
export interface NewProjectFolders {
  readonly scenes: string;
  readonly blockScripts: string;
}

/** Options for {@link createProject}. */
export interface NewProjectOptions {
  readonly name: string;
  readonly sceneName: string;
  readonly folders: NewProjectFolders;
  readonly scene: SceneData;
}

/** Text of the `.gitignore` of new projects. */
export const PROJECT_GITIGNORE = `${CACHE_FOLDER}/\n`;

/**
 * Creates a new project with one scene (the start scene) and writes it to the file system.
 */
export async function createProject(
  fs: ProjectFileSystem,
  options: NewProjectOptions,
): Promise<Project> {
  const project = new Project({
    formatVersion: FORMAT_VERSION,
    name: options.name,
    startScene: null,
  });
  const scene = project.createAsset(
    'scene',
    project.uniqueAssetPath(
      defaultAssetFolder('scene', options.folders),
      options.sceneName,
      'scene',
    ),
    options.scene,
  );
  project.settings = { ...project.settings, startScene: scene.id };
  await project.save(fs);
  if (!(await fs.exists('.gitignore'))) await fs.writeText('.gitignore', PROJECT_GITIGNORE);
  return project;
}

/** Folder of an asset path (for the project window tree). */
export function assetFolder(path: string): string {
  return dirname(path);
}
