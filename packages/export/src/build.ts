import { buildLibrary, compileBlockScript, CompileError } from '@blockwerk/compiler';
import type { ProjectLibrary, ProjectScript } from '@blockwerk/compiler';
import type { LibraryEntry, LibraryIndex } from '@blockwerk/library';
import { assetDisplayName, stringifyDeterministic } from '@blockwerk/project';
import type { AnyAsset, Project } from '@blockwerk/project';
import { buildCredits } from './credits';
import type { LicensedAsset } from './credits';
import { GAME_PACK_FILE, GAME_PACK_VERSION } from './pack';
import type { GamePack, PackFile, PackScript } from './pack';

/** Where the files of the asset library are read from (the built `library/` folder). */
export interface LibrarySource {
  readonly index: LibraryIndex;
  /** Reads a file by its path relative to the library folder. */
  read(file: string): Promise<Uint8Array>;
}

/** A problem found while exporting. Data only: the editor translates it (`export.problem.<code>`). */
export interface ExportProblem {
  readonly severity: 'error' | 'warning';
  readonly code:
    | 'noStartScene'
    | 'missingScene'
    | 'sceneAdded'
    | 'scriptFailed'
    | 'libraryMissing'
    | 'libraryModelMissing';
  readonly params: Readonly<Record<string, string>>;
}

/** One file of the export. */
export interface ExportFile {
  /** Path relative to the export folder (`game/game.json`, `CREDITS.txt`). */
  readonly path: string;
  readonly data: Uint8Array | string;
}

/** The result of {@link buildGame}. */
export interface ExportResult {
  readonly pack: GamePack;
  /** Everything to write: the game folder and `CREDITS.txt`. */
  readonly files: readonly ExportFile[];
  readonly problems: readonly ExportProblem[];
}

/** The export cannot be made; `problems` says why. */
export class ExportError extends Error {
  override readonly name = 'ExportError';
  constructor(readonly problems: readonly ExportProblem[]) {
    super(
      problems
        .filter((problem) => problem.severity === 'error')
        .map((problem) => `${problem.code} ${JSON.stringify(problem.params)}`)
        .join('; ') || 'Export failed.',
    );
  }
}

/** What {@link buildGame} reads. */
export interface ExportInput {
  readonly project: Project;
  /** The asset library; without it, library models cannot be exported (a warning each). */
  readonly library?: LibrarySource | null;
}

const ID_PATTERN = /(?<![a-z0-9])[a-z0-9]{12}(?![a-z0-9])/g;
const LIBRARY_PATTERN =
  /library:([a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9/-])/g;

/** Every ID-looking token and every library model reference in the strings of a JSON value. */
function referencesIn(value: unknown, ids: Set<string>, models: Set<string>): void {
  if (typeof value === 'string') {
    for (const match of value.matchAll(ID_PATTERN)) ids.add(match[0]);
    for (const match of value.matchAll(LIBRARY_PATTERN)) models.add(match[1] ?? '');
  } else if (Array.isArray(value)) {
    for (const item of value) referencesIn(item, ids, models);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) referencesIn(item, ids, models);
  }
}

/** File extension of a binary asset in the pack. */
function extensionOf(asset: AnyAsset): string {
  switch (asset.type) {
    case 'model':
      return '.glb';
    case 'image':
      return '.png';
    case 'terrain':
      return '.bin';
    default: {
      const dot = asset.path.lastIndexOf('.');
      return dot >= 0 ? asset.path.slice(dot) : '.wav';
    }
  }
}

/** Compact, key-sorted JSON (the pack is read by machines). */
function compactJson(value: unknown): string {
  return JSON.stringify(JSON.parse(stringifyDeterministic(value)));
}

/**
 * Builds a game pack from a project (SPEC 9.3): finds the scenes of the build, everything they
 * use (prefabs, dialogs, UI canvases, scripts, models, sounds, images, terrains), compiles the
 * scripts and returns the files to write. Assets nothing refers to are left out. Throws
 * {@link ExportError} if the game cannot be built; warnings come back in `problems`.
 */
export async function buildGame(input: ExportInput): Promise<ExportResult> {
  const { project } = input;
  const problems: ExportProblem[] = [];
  const build = project.settings.build ?? {};
  const requested =
    build.scenes ?? (project.settings.startScene ? [project.settings.startScene] : []);
  const roots: string[] = [];
  for (const id of requested) {
    if (project.assetOfType(id, 'scene')) roots.push(id);
    else problems.push({ severity: 'warning', code: 'missingScene', params: { scene: id } });
  }
  const startScene =
    project.settings.startScene && roots.includes(project.settings.startScene)
      ? project.settings.startScene
      : roots[0];
  if (!startScene) {
    problems.push({ severity: 'error', code: 'noStartScene', params: {} });
    throw new ExportError(problems);
  }

  // The walk: every asset that something in the build refers to, and every library model.
  const used = new Map<string, AnyAsset>();
  const libraryRefs = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift() ?? '';
    const asset = project.asset(id);
    if (!asset || used.has(id)) continue;
    used.set(id, asset);
    if (asset.type === 'model' || asset.type === 'image' || asset.type === 'terrain') continue;
    if (asset.type === 'audio') continue;
    const ids = new Set<string>();
    referencesIn(asset.data, ids, libraryRefs);
    for (const reference of [...ids].sort()) queue.push(reference);
  }
  // A scene that scripts lead to but the build list does not name still has to be in the game.
  const order = [...roots];
  for (const asset of [...used.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    if (asset.type === 'scene' && !order.includes(asset.id)) {
      order.push(asset.id);
      problems.push({
        severity: 'warning',
        code: 'sceneAdded',
        params: { scene: assetDisplayName(asset.path) },
      });
    }
  }

  // Scripts: compiled once, with the project-wide custom blocks linked in. No debug hooks.
  const allScripts: ProjectScript[] = project.assetsOfType('blockScript').map((entry) => ({
    assetId: entry.id,
    assetName: assetDisplayName(entry.path),
    workspace: entry.data.workspace,
    variables: entry.data.variables,
  }));
  const library: ProjectLibrary = buildLibrary(allScripts);
  const scripts: Record<string, PackScript> = {};
  const savedVariables = new Set<string>();
  for (const asset of used.values()) {
    if (asset.type !== 'blockScript') continue;
    const name = assetDisplayName(asset.path);
    try {
      const result = compileBlockScript(asset.data.workspace, {
        assetName: name,
        assetId: asset.id,
        variables: asset.data.variables,
        library,
      });
      for (const diagnostic of result.diagnostics) {
        if (diagnostic.severity !== 'error') continue;
        problems.push({
          severity: 'error',
          code: 'scriptFailed',
          params: { script: name, message: diagnostic.code },
        });
      }
      scripts[asset.id] = { name, code: result.code, variables: asset.data.variables };
      for (const variable of asset.data.variables) {
        if (variable.scope === 'game' && variable.saved) savedVariables.add(variable.id);
      }
    } catch (error) {
      const message =
        error instanceof CompileError || error instanceof Error ? error.message : String(error);
      problems.push({ severity: 'error', code: 'scriptFailed', params: { script: name, message } });
    }
  }
  if (problems.some((problem) => problem.severity === 'error')) throw new ExportError(problems);

  // Binary assets and library models.
  const files: ExportFile[] = [];
  const packFiles: Record<string, PackFile> = {};
  for (const asset of [...used.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (
      asset.type !== 'model' &&
      asset.type !== 'image' &&
      asset.type !== 'terrain' &&
      asset.type !== 'audio'
    ) {
      continue;
    }
    const bytes = project.assetBytes(asset.id);
    if (!bytes) continue;
    const path = `files/${asset.id}${extensionOf(asset)}`;
    packFiles[asset.id] = { path, type: asset.type };
    files.push({ path: `game/${path}`, data: bytes });
  }
  const packLibrary: Record<string, string> = {};
  const usedEntries: LibraryEntry[] = [];
  const source = input.library ?? null;
  for (const id of [...libraryRefs].sort()) {
    const entry = source?.index.entries.find((candidate) => candidate.id === id);
    if (!source || !entry) {
      problems.push({
        severity: 'warning',
        code: source ? 'libraryModelMissing' : 'libraryMissing',
        params: { model: id },
      });
      continue;
    }
    try {
      files.push({ path: `game/library/${entry.file}`, data: await source.read(entry.file) });
    } catch {
      problems.push({ severity: 'warning', code: 'libraryModelMissing', params: { model: id } });
      continue;
    }
    packLibrary[id] = `library/${entry.file}`;
    usedEntries.push(entry);
  }

  const scenes: Record<string, GamePack['scenes'][string]> = {};
  const prefabs: Record<string, GamePack['prefabs'][string]> = {};
  const dialogs: Record<string, GamePack['dialogs'][string]> = {};
  const uis: Record<string, GamePack['uis'][string]> = {};
  for (const asset of used.values()) {
    if (asset.type === 'scene')
      scenes[asset.id] = { name: assetDisplayName(asset.path), data: asset.data };
    else if (asset.type === 'prefab') prefabs[asset.id] = asset.data;
    else if (asset.type === 'dialog') dialogs[asset.id] = asset.data;
    else if (asset.type === 'ui') uis[asset.id] = asset.data;
  }
  const imageId = (id: string | null | undefined): string | undefined =>
    id && packFiles[id]?.type === 'image' ? id : undefined;
  // The splash and the icon are images the walk cannot know about: add them now.
  for (const id of [build.splash, build.icon]) {
    const asset = id ? project.assetOfType(id, 'image') : undefined;
    const bytes = asset ? project.assetBytes(asset.id) : undefined;
    if (!asset || !bytes || packFiles[asset.id]) continue;
    const path = `files/${asset.id}.png`;
    packFiles[asset.id] = { path, type: 'image' };
    files.push({ path: `game/${path}`, data: bytes });
    used.set(asset.id, asset);
  }
  const productName = build.productName ?? project.settings.name;
  const splash = imageId(build.splash);
  const icon = imageId(build.icon);
  const pack: GamePack = {
    formatVersion: GAME_PACK_VERSION,
    name: productName,
    startScene,
    ...(project.settings.graphicsLevel ? { graphicsLevel: project.settings.graphicsLevel } : {}),
    window: build.window ?? 'fullscreen',
    ...(splash ? { splash } : {}),
    ...(icon ? { icon } : {}),
    layers: ['Default', ...project.tagsAndLayers.layers],
    ignoredCollisions: project.tagsAndLayers.ignoredCollisions ?? [],
    scenes,
    order,
    prefabs,
    dialogs,
    uis,
    scripts,
    savedVariables: [...savedVariables].sort(),
    files: packFiles,
    library: packLibrary,
  };
  files.unshift({ path: `game/${GAME_PACK_FILE}`, data: compactJson(pack) });

  const licensedAssets: LicensedAsset[] = [];
  for (const asset of used.values()) {
    if (asset.meta.license) licensedAssets.push({ path: asset.path, license: asset.meta.license });
  }
  files.push({
    path: 'CREDITS.txt',
    data: buildCredits({
      productName,
      libraryEntries: usedEntries,
      libraryIndex: source?.index ?? null,
      licensedAssets,
    }),
  });
  return { pack, files, problems };
}
