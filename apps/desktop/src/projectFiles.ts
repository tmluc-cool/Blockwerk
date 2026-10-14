import { app, dialog, ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

/**
 * Project folders for the desktop editor. The renderer may only touch folders the user
 * created or chose here (plus recently opened ones); every path is checked to stay inside
 * its project folder.
 */

/** A project folder known to the desktop app. */
export interface ProjectFolder {
  readonly path: string;
  readonly name: string;
}

const PROJECT_FILE = 'blockwerk.json';
const allowedRoots = new Set<string>();

function projectsDirectory(): string {
  return process.env['BLOCKWERK_PROJECTS_DIR'] ?? join(app.getPath('documents'), 'Blockwerk');
}

function recentFile(): string {
  return join(app.getPath('userData'), 'recent-projects.json');
}

async function readRecent(): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(recentFile(), 'utf8'));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

async function remember(root: string): Promise<void> {
  allowedRoots.add(root);
  const recent = [root, ...(await readRecent()).filter((item) => item !== root)].slice(0, 20);
  await mkdir(dirname(recentFile()), { recursive: true });
  await writeFile(recentFile(), JSON.stringify(recent, null, 2) + '\n', 'utf8');
}

async function isProject(folder: string): Promise<boolean> {
  try {
    return (await stat(join(folder, PROJECT_FILE))).isFile();
  } catch {
    return false;
  }
}

async function projectName(folder: string): Promise<string> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(folder, PROJECT_FILE), 'utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'name' in parsed &&
      typeof parsed.name === 'string'
    ) {
      return parsed.name;
    }
  } catch {
    // Fall back to the folder name.
  }
  return basename(folder);
}

async function listProjects(): Promise<ProjectFolder[]> {
  const folders = new Set<string>(await readRecent());
  const directory = projectsDirectory();
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) folders.add(join(directory, entry.name));
    }
  } catch {
    // No projects folder yet.
  }
  const result: ProjectFolder[] = [];
  for (const folder of folders) {
    if (!(await isProject(folder))) continue;
    allowedRoots.add(folder);
    result.push({ path: folder, name: await projectName(folder) });
  }
  return result;
}

async function createProjectFolder(name: string): Promise<string> {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Projekt';
  const directory = projectsDirectory();
  await mkdir(directory, { recursive: true });
  for (let index = 0; ; index++) {
    const folder = join(directory, index === 0 ? cleaned : `${cleaned} ${index}`);
    try {
      await mkdir(folder);
      await remember(folder);
      return folder;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
  }
}

/** Resolves a project-relative path and makes sure it stays inside an allowed project folder. */
function resolveInside(root: string, path: string): string {
  const normalizedRoot = normalize(root);
  if (!isAbsolute(normalizedRoot) || !allowedRoots.has(normalizedRoot)) {
    throw new Error('Project folder is not open.');
  }
  const target = resolve(normalizedRoot, ...path.split('/').filter(Boolean));
  const rel = relative(normalizedRoot, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path leaves the project folder.');
  return target;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** Rejections cross IPC as plain messages; `ENOENT:` marks missing files for the renderer. */
async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isMissing(error)) throw new Error('ENOENT: file not found', { cause: error });
    throw error;
  }
}

/** Registers the IPC handlers used by the preload script. */
export function registerProjectFiles(mainWindow: () => BrowserWindow | null): void {
  const handle = (
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: string[]) => Promise<unknown>,
  ): void => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!args.every((arg) => typeof arg === 'string')) throw new Error('Invalid arguments.');
      return listener(event, ...(args as string[]));
    });
  };
  handle('projects:list', () => listProjects());
  handle('projects:create', (_event, name = '') => createProjectFolder(name));
  handle('projects:choose', async () => {
    const window = mainWindow();
    const options = { properties: ['openDirectory' as const, 'createDirectory' as const] };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    const folder = result.canceled ? undefined : result.filePaths[0];
    if (!folder) return null;
    await remember(normalize(folder));
    return normalize(folder);
  });
  handle('projects:open', async (_event, root = '') => {
    const folder = normalize(root);
    if (!allowedRoots.has(folder)) throw new Error('Project folder is not known.');
    await remember(folder);
    return folder;
  });
  handle('fs:read', (_event, root = '', path = '') =>
    guard(() => readFile(resolveInside(root, path), 'utf8')),
  );
  handle('fs:write', (_event, root = '', path = '', text = '') =>
    guard(async () => {
      const target = resolveInside(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text, 'utf8');
    }),
  );
  handle('fs:readBytes', (_event, root = '', path = '') =>
    guard(async () => new Uint8Array(await readFile(resolveInside(root, path)))),
  );
  // Binary writes carry a Uint8Array, so they are checked here instead of by `handle`.
  ipcMain.handle('fs:writeBytes', (_event, root: unknown, path: unknown, data: unknown) => {
    if (typeof root !== 'string' || typeof path !== 'string' || !(data instanceof Uint8Array)) {
      throw new Error('Invalid arguments.');
    }
    return guard(async () => {
      const target = resolveInside(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    });
  });
  handle('fs:exists', async (_event, root = '', path = '') => {
    try {
      await stat(resolveInside(root, path));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  });
  handle('fs:list', async (_event, root = '', path = '') => {
    try {
      const entries = await readdir(resolveInside(root, path), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() || entry.isDirectory())
        .map((entry) => ({ name: entry.name, kind: entry.isDirectory() ? 'directory' : 'file' }));
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  });
  handle('fs:remove', (_event, root = '', path = '') =>
    guard(() => {
      const target = resolveInside(root, path);
      if (target === normalize(root)) throw new Error('Refusing to delete the project folder.');
      return rm(target, { recursive: true, force: true });
    }),
  );
  handle('fs:rename', (_event, root = '', from = '', to = '') =>
    guard(async () => {
      const target = resolveInside(root, to);
      await mkdir(dirname(target), { recursive: true });
      await rename(resolveInside(root, from), target);
    }),
  );
}
