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
  DEFAULT_MODEL_IMPORT_SETTINGS,
  FORMAT_VERSION,
  metaSchema,
  modelImportSettingsSchema,
  prefabSchema,
  projectFileSchema,
  sceneSchema,
  tagsAndLayersSchema,
} from './schema';
import type {
  AssetType,
  BlockScriptData,
  MetaData,
  ModelImportSettings,
  PrefabData,
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
  prefab: '.prefab.json',
  model: '.glb',
  image: '.png',
  terrain: '.terrain.bin',
  audio: '.wav',
};

/** More file name endings of an asset type besides the main one. */
export const EXTRA_ASSET_EXTENSIONS: Readonly<Partial<Record<AssetType, readonly string[]>>> = {
  audio: ['.ogg', '.mp3'],
};

/** Every file name ending of an asset type, the main one first. */
export function assetExtensions(type: AssetType): readonly string[] {
  return [ASSET_EXTENSIONS[type], ...(EXTRA_ASSET_EXTENSIONS[type] ?? [])];
}

/** An image asset (PNG) in memory: the file itself is kept by the project (see {@link Project.assetBytes}). */
export interface ImageData {
  /** Content hash of the file. */
  readonly hash: string;
  readonly byteLength: number;
}

/** A sound asset (WAV, OGG or MP3) in memory: the file is kept by the project. */
export interface AudioAssetData {
  /** Content hash of the file. */
  readonly hash: string;
  readonly byteLength: number;
}

/** A terrain asset (height map and paint) in memory: the file is kept by the project. */
export interface TerrainAssetData {
  /** Content hash of the file. */
  readonly hash: string;
  readonly byteLength: number;
}

/** A model asset in memory: the GLB itself is kept by the project (see {@link Project.modelBytes}). */
export interface ModelData {
  /** Content hash of the GLB file. */
  readonly hash: string;
  readonly byteLength: number;
}

/** Data of each asset type. */
export interface AssetDataByType {
  scene: SceneData;
  blockScript: BlockScriptData;
  prefab: PrefabData;
  model: ModelData;
  image: ImageData;
  terrain: TerrainAssetData;
  audio: AudioAssetData;
}

/** Asset types stored as binary files next to their meta file. */
const BINARY_TYPES = ['model', 'image', 'terrain', 'audio'] as const;
type BinaryAssetType = (typeof BINARY_TYPES)[number];

/** Whether an asset type is a binary file. */
export function isBinaryAssetType(type: AssetType): type is BinaryAssetType {
  return (BINARY_TYPES as readonly string[]).includes(type);
}

/** Asset types stored as JSON (all but binary ones). */
type JsonAssetType = Exclude<AssetType, BinaryAssetType>;

/** 64-bit FNV-1a hash of binary data as 16 hex digits (change detection, not security). */
export function hashBytes(data: Uint8Array): string {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (const byte of data) {
    low = (low ^ byte) >>> 0;
    // Multiply the 64-bit value by the FNV prime 2^40 + 0x1b3.
    const lowProduct = low * 0x1b3;
    const carry = Math.floor(lowProduct / 0x100000000);
    high = (high * 0x1b3 + (low << 8) + carry) >>> 0;
    low = lowProduct >>> 0;
  }
  return high.toString(16).padStart(8, '0') + low.toString(16).padStart(8, '0');
}

/** Import settings of a model asset (defaults for missing or invalid values). */
export function modelImportSettings(meta: MetaData): ModelImportSettings {
  const parsed = modelImportSettingsSchema.safeParse({
    ...DEFAULT_MODEL_IMPORT_SETTINGS,
    ...meta.importSettings,
  });
  return parsed.success ? parsed.data : DEFAULT_MODEL_IMPORT_SETTINGS;
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
  for (const type of Object.keys(ASSET_EXTENSIONS) as AssetType[]) {
    for (const extension of assetExtensions(type)) {
      if (path.toLowerCase().endsWith(extension) && basename(path).length > extension.length) {
        return type;
      }
    }
  }
  return null;
}

/** File name of an asset without its type ending (what the project window shows). */
export function assetDisplayName(path: string): string {
  const name = basename(path);
  const type = assetTypeOfPath(path);
  const extension = type
    ? assetExtensions(type).find((candidate) => name.toLowerCase().endsWith(candidate))
    : undefined;
  return extension ? name.slice(0, -extension.length) : name;
}

const SCHEMAS = {
  scene: sceneSchema,
  blockScript: blockScriptSchema,
  prefab: prefabSchema,
} satisfies Record<JsonAssetType, z.ZodType>;

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
  /** GLB files of model assets by asset ID. */
  private readonly bytes = new Map<string, Uint8Array>();
  /** Binary files on disk with their content hash. */
  private readonly diskBinary = new Map<string, string>();

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
  createAsset<T extends JsonAssetType>(
    type: T,
    path: string,
    data: AssetDataByType[T],
  ): AssetEntry<T> {
    const normalized = this.checkAssetPath(type, path);
    const meta = newMeta(type);
    const entry = { id: meta.id, type, path: normalized, meta, data } as AssetEntry<T>;
    this.entries.set(entry.id, entry as unknown as AnyAsset);
    return entry;
  }

  /**
   * Adds an imported model (GLB) with import settings and license (SPEC 6.3). The path must be
   * free and end with `.glb`.
   */
  createModel(
    path: string,
    data: Uint8Array,
    settings: ModelImportSettings = DEFAULT_MODEL_IMPORT_SETTINGS,
    license: string | null = null,
  ): AssetEntry<'model'> {
    const normalized = this.checkAssetPath('model', path);
    const meta: MetaData = { ...newMeta('model'), importSettings: { ...settings }, license };
    const entry: AssetEntry<'model'> = {
      id: meta.id,
      type: 'model',
      path: normalized,
      meta,
      data: { hash: hashBytes(data), byteLength: data.byteLength },
    };
    this.bytes.set(entry.id, data);
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Adds an image (PNG), e.g. a character portrait. The path must be free and end with `.png`. */
  createImage(path: string, data: Uint8Array, license: string | null = null): AssetEntry<'image'> {
    const normalized = this.checkAssetPath('image', path);
    const meta: MetaData = { ...newMeta('image'), license };
    const entry: AssetEntry<'image'> = {
      id: meta.id,
      type: 'image',
      path: normalized,
      meta,
      data: { hash: hashBytes(data), byteLength: data.byteLength },
    };
    this.bytes.set(entry.id, data);
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Adds a terrain (height map and paint layers). The path must be free and end with `.terrain.bin`. */
  createTerrain(
    path: string,
    data: Uint8Array,
    license: string | null = null,
  ): AssetEntry<'terrain'> {
    const normalized = this.checkAssetPath('terrain', path);
    const meta: MetaData = { ...newMeta('terrain'), license };
    const entry: AssetEntry<'terrain'> = {
      id: meta.id,
      type: 'terrain',
      path: normalized,
      meta,
      data: { hash: hashBytes(data), byteLength: data.byteLength },
    };
    this.bytes.set(entry.id, data);
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Adds a sound (WAV, OGG or MP3). The path must be free and end with `.wav`, `.ogg` or `.mp3`. */
  createAudio(path: string, data: Uint8Array, license: string | null = null): AssetEntry<'audio'> {
    const normalized = this.checkAssetPath('audio', path);
    const meta: MetaData = { ...newMeta('audio'), license };
    const entry: AssetEntry<'audio'> = {
      id: meta.id,
      type: 'audio',
      path: normalized,
      meta,
      data: { hash: hashBytes(data), byteLength: data.byteLength },
    };
    this.bytes.set(entry.id, data);
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Replaces the file of a binary asset (e.g. a terrain after sculpting); the ID stays. */
  updateAssetBytes(id: string, bytes: Uint8Array): void {
    const entry = this.entries.get(id);
    if (!entry || !isBinaryAssetType(entry.type)) throw new Error(`Unknown binary asset ${id}.`);
    this.bytes.set(id, bytes);
    this.entries.set(id, {
      ...entry,
      data: { hash: hashBytes(bytes), byteLength: bytes.byteLength },
    } as AnyAsset);
  }

  /**
   * Adds an asset that keeps its identity (meta data with ID), e.g. from "My Prefabs". The path is
   * made unique if taken. Returns `null` if an asset with this ID already exists.
   */
  adoptAsset(
    path: string,
    meta: MetaData,
    content: { data: AssetDataByType[JsonAssetType] } | { bytes: Uint8Array },
  ): AnyAsset | null {
    if (this.entries.has(meta.id)) return null;
    const type = meta.type;
    const normalized = normalizePath(path);
    const free = this.isPathTaken(normalized)
      ? this.uniqueAssetPath(dirname(normalized), assetDisplayName(normalized), type)
      : this.checkAssetPath(type, normalized);
    let entry: AnyAsset;
    if ('bytes' in content) {
      if (!isBinaryAssetType(type))
        throw new Error(`Only models, images, terrains and sounds are binary: ${normalized}`);
      entry = {
        id: meta.id,
        type,
        path: free,
        meta,
        data: { hash: hashBytes(content.bytes), byteLength: content.bytes.byteLength },
      };
      this.bytes.set(meta.id, content.bytes);
    } else {
      if (isBinaryAssetType(type)) throw new Error(`Binary assets need their bytes: ${normalized}`);
      entry = { id: meta.id, type, path: free, meta, data: content.data } as AnyAsset;
    }
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** The GLB file of a model asset. */
  modelBytes(id: string): Uint8Array | undefined {
    return this.bytes.get(id);
  }

  /** The file of a binary asset (model or image). */
  assetBytes(id: string): Uint8Array | undefined {
    return this.bytes.get(id);
  }

  /** Replaces the meta data of an asset (import settings, license); the ID stays. */
  updateMeta(id: string, meta: Omit<MetaData, 'id' | 'type' | 'formatVersion'>): void {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown asset ${id}.`);
    this.entries.set(id, { ...entry, meta: { ...entry.meta, ...meta } } as AnyAsset);
  }

  /** Replaces the data of an asset. */
  updateAsset<T extends JsonAssetType>(id: string, type: T, data: AssetDataByType[T]): void {
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
    this.bytes.delete(id);
  }

  /** The text of every managed text file as it should be on disk. */
  files(): Map<string, string> {
    const files = new Map<string, string>();
    files.set(PROJECT_FILE, stringifyDeterministic(this.settings));
    files.set(TAGS_AND_LAYERS_FILE, stringifyDeterministic(this.tagsAndLayers));
    for (const entry of this.assets) {
      if (!isBinaryAssetType(entry.type)) {
        files.set(entry.path, stringifyDeterministic(entry.data));
      }
      files.set(entry.path + META_SUFFIX, stringifyDeterministic(entry.meta));
    }
    return files;
  }

  /** Binary files (models) as they should be on disk: path → asset ID and content hash. */
  binaryFiles(): Map<string, { id: string; hash: string }> {
    const files = new Map<string, { id: string; hash: string }>();
    for (const entry of this.assets) {
      if (isBinaryAssetType(entry.type)) {
        files.set(entry.path, { id: entry.id, hash: (entry.data as ModelData).hash });
      }
    }
    return files;
  }

  /** Whether saving would change any file. */
  get dirty(): boolean {
    const files = this.files();
    if ([...this.disk.keys()].some((path) => !files.has(path))) return true;
    if ([...files].some(([path, text]) => this.disk.get(path) !== text)) return true;
    const binaries = this.binaryFiles();
    if ([...this.diskBinary.keys()].some((path) => !binaries.has(path))) return true;
    return [...binaries].some(([path, file]) => this.diskBinary.get(path) !== file.hash);
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
    const binaries = this.binaryFiles();
    // Moved models are renamed on disk (no need to write the bytes again).
    for (const [path, file] of binaries) {
      if (this.diskBinary.get(path) === file.hash) continue;
      const old = [...this.diskBinary].find(
        ([oldPath, hash]) => hash === file.hash && !binaries.has(oldPath),
      );
      if (old) {
        await fs.rename(old[0], path);
        this.diskBinary.delete(old[0]);
      } else {
        const data = this.bytes.get(file.id);
        if (!data) continue;
        await fs.writeBytes(path, data);
      }
      this.diskBinary.set(path, file.hash);
      written.push(path);
    }
    for (const path of [...this.diskBinary.keys()]) {
      if (binaries.has(path)) continue;
      await fs.remove(path);
      this.diskBinary.delete(path);
      removed.push(path);
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
      throw new Error(
        `A ${type} asset must end with ${assetExtensions(type).join(' or ')}: ${normalized}`,
      );
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
        // Other files (textures, sounds …) arrive with later phases.
        project.foreign.add(path);
        continue;
      }
      let data: AssetDataByType[AssetType];
      let bytes: Uint8Array | null = null;
      if (isBinaryAssetType(type)) {
        bytes = await fs.readBytes(path);
        data = { hash: hashBytes(bytes), byteLength: bytes.byteLength };
        project.diskBinary.set(path, data.hash);
      } else {
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
        data = parsed.value;
      }

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
      const entry = { id: meta.id, type, path, meta, data } as AnyAsset;
      project.entries.set(entry.id, entry);
      if (bytes) project.bytes.set(entry.id, bytes);
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

/** Folder of new assets of a type. */
export function defaultAssetFolder(type: AssetType, folders: NewProjectFolders): string {
  const names: Readonly<Record<AssetType, string>> = {
    scene: folders.scenes,
    blockScript: folders.blockScripts,
    prefab: folders.prefabs,
    model: folders.models,
    image: folders.images,
    terrain: folders.terrains ?? 'Terrains',
    audio: folders.sounds ?? 'Sounds',
  };
  return joinPath(ASSETS_FOLDER, names[type]);
}

/** Folder names below `Assets/` for a new project, in the user's language. */
export interface NewProjectFolders {
  readonly scenes: string;
  readonly blockScripts: string;
  readonly prefabs: string;
  readonly models: string;
  readonly images: string;
  /** Folder of terrains (default `Terrains`). */
  readonly terrains?: string;
  /** Folder of sounds (default `Sounds`). */
  readonly sounds?: string;
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
