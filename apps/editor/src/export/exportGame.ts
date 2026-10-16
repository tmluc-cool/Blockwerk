import { assembleWebBuild, buildGame, ExportError, zipFiles } from '@blockwerk/export';
import type { ExportFile, ExportProblem, LibrarySource } from '@blockwerk/export';
import { create } from 'zustand';
import { libraryUrl, loadAssetLibrary, useAssetLibrary } from '../library/assetLibrary';
import { flushScene, saveProject, useDocument } from '../state/document';
import '../storage/desktopApi';

/** Where a game can be built for. */
export type BuildPlatform = 'windows' | 'web';

/** A message of a build: the export's own problems and the editor's (`export.problem.<code>`). */
export interface BuildProblem {
  readonly severity: 'error' | 'warning';
  readonly code: ExportProblem['code'] | 'noPlayer' | 'noDesktop' | 'noWindowsApp' | 'writeFailed';
  readonly params: Readonly<Record<string, string>>;
}

/** What the last build made. */
export interface BuildOutcome {
  readonly ok: boolean;
  readonly platform: BuildPlatform;
  /** Where it went: a folder (desktop), or `download` in a browser. */
  readonly target: string;
  readonly fileCount: number;
  readonly bytes: number;
  readonly problems: readonly BuildProblem[];
}

interface BuildState {
  readonly status: 'idle' | 'building';
  readonly outcome: BuildOutcome | null;
  /** Names of the files of the last build (tests read them). */
  readonly files: readonly string[];
}

/** State of the Build Settings window. */
export const useBuild = create<BuildState>()(() => ({
  status: 'idle',
  outcome: null,
  files: [],
}));

/** The desktop app's export services, if this editor runs in it. */
export function desktopExporter() {
  return window.blockwerkDesktop?.exporter ?? null;
}

/** The asset library as the exporter reads it (`library/` next to the editor). */
async function librarySource(): Promise<LibrarySource | null> {
  await loadAssetLibrary();
  const { index } = useAssetLibrary.getState();
  if (!index) return null;
  return {
    index,
    read: async (file) => {
      const response = await fetch(libraryUrl(file));
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/** The built player (`apps/player`), shipped next to the editor in `player/`. */
async function playerTemplate(): Promise<ExportFile[] | null> {
  try {
    const list = await fetch('player/files.json');
    if (!list.ok) return null;
    const paths = (await list.json()) as string[];
    return await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(`player/${path}`);
        if (!response.ok) throw new Error(path);
        return { path, data: new Uint8Array(await response.arrayBuffer()) };
      }),
    );
  } catch {
    return null;
  }
}

/** A name that is safe as a file name. */
export function safeFileName(name: string): string {
  const cleaned = [...name]
    .filter((char) => char.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '' ? 'game' : cleaned;
}

function download(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function sizeOf(files: readonly ExportFile[]): number {
  return files.reduce(
    (sum, file) => sum + (typeof file.data === 'string' ? file.data.length : file.data.byteLength),
    0,
  );
}

function finish(outcome: BuildOutcome, files: readonly string[]): BuildOutcome {
  useBuild.setState({ status: 'idle', outcome, files });
  return outcome;
}

/**
 * Builds the open project for a platform (SPEC 9.3). In a browser the web build is a ZIP download;
 * in the desktop app a folder is chosen and the web build (folder and ZIP) or the Windows app is
 * written there. With `run` the Windows app starts afterwards.
 */
export async function buildProject(platform: BuildPlatform, run = false): Promise<BuildOutcome> {
  const { project } = useDocument.getState();
  const empty = (problems: BuildProblem[]): BuildOutcome =>
    finish({ ok: false, platform, target: '', fileCount: 0, bytes: 0, problems }, []);
  if (!project || useBuild.getState().status === 'building') return empty([]);
  useBuild.setState({ status: 'building' });
  const desktop = desktopExporter();
  try {
    if (platform === 'windows') {
      if (!desktop) return empty([{ severity: 'error', code: 'noDesktop', params: {} }]);
      if (!(await desktop.windowsAvailable())) {
        return empty([{ severity: 'error', code: 'noWindowsApp', params: {} }]);
      }
    }
    flushScene();
    await saveProject({ quiet: true });
    let result;
    try {
      result = await buildGame({ project, library: await librarySource() });
    } catch (error) {
      if (error instanceof ExportError) return empty([...error.problems]);
      throw error;
    }
    const problems: BuildProblem[] = [...result.problems];
    const name = safeFileName(result.pack.name);
    const gameFiles = result.files;

    if (platform === 'web') {
      const template = await playerTemplate();
      if (!template)
        return empty([...problems, { severity: 'error', code: 'noPlayer', params: {} }]);
      const files = assembleWebBuild(template, result);
      const zip = zipFiles(files);
      let target = 'download';
      if (desktop) {
        const folder = await desktop.chooseFolder();
        if (!folder) {
          return finish({ ok: false, platform, target: '', fileCount: 0, bytes: 0, problems }, []);
        }
        target = `${folder}/${name}-web`;
        await desktop.writeFiles(target, files, true);
        await desktop.writeFiles(folder, [{ path: `${name}-web.zip`, data: zip }], false);
      } else {
        download(`${name}-web.zip`, zip);
      }
      return finish(
        { ok: true, platform, target, fileCount: files.length, bytes: zip.byteLength, problems },
        files.map((file) => file.path),
      );
    }

    if (!desktop) return empty([...problems, { severity: 'error', code: 'noDesktop', params: {} }]);
    const folder = await desktop.chooseFolder();
    if (!folder)
      return finish({ ok: false, platform, target: '', fileCount: 0, bytes: 0, problems }, []);
    const iconId = result.pack.icon;
    const iconBytes = iconId ? (project.assetBytes(iconId) ?? null) : null;
    const target = `${folder}/${name}`;
    const built = await desktop.buildWindows({
      folder: target,
      name,
      files: gameFiles,
      icon: iconBytes,
    });
    for (const warning of built.warnings) {
      problems.push({ severity: 'warning', code: 'writeFailed', params: { message: warning } });
    }
    if (run) await desktop.run(built.exe);
    return finish(
      {
        ok: true,
        platform,
        target,
        fileCount: gameFiles.length,
        bytes: sizeOf(gameFiles),
        problems,
      },
      gameFiles.map((file) => file.path),
    );
  } catch (error) {
    return empty([{ severity: 'error', code: 'writeFailed', params: { message: String(error) } }]);
  }
}
