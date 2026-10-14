/** An entry of a directory listing. */
export interface FileEntry {
  readonly name: string;
  readonly kind: 'file' | 'directory';
}

/**
 * File access for a project. Paths are relative to the project folder and always use `/`.
 * Implementations: in memory (tests), Node.js (desktop, scripts), browser storage (editor).
 */
export interface ProjectFileSystem {
  /** Reads a text file. Throws {@link FileNotFoundError} if it does not exist. */
  readText(path: string): Promise<string>;
  /** Writes a text file, creating missing folders. */
  writeText(path: string, text: string): Promise<void>;
  /** Reads a binary file (models). Throws {@link FileNotFoundError} if it does not exist. */
  readBytes(path: string): Promise<Uint8Array>;
  /** Writes a binary file, creating missing folders. */
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  /** Whether a file or folder exists. */
  exists(path: string): Promise<boolean>;
  /** Lists a folder. Returns an empty list if it does not exist. */
  list(path: string): Promise<FileEntry[]>;
  /** Deletes a file or a folder with its contents. Missing paths are ignored. */
  remove(path: string): Promise<void>;
  /** Moves a file, creating missing folders. */
  rename(from: string, to: string): Promise<void>;
}

/** Thrown when a file does not exist. */
export class FileNotFoundError extends Error {
  override readonly name = 'FileNotFoundError';

  constructor(readonly path: string) {
    super(`File not found: ${path}`);
  }
}

/** Normalizes a project path: `/` separators, no leading or trailing slash, no `.` parts. */
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') throw new Error(`Paths may not leave the project folder: ${path}`);
    parts.push(part);
  }
  return parts.join('/');
}

/** Joins path parts. */
export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter((part) => part !== '').join('/'));
}

/** Folder part of a path (`''` for files in the project root). */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}

/** File name part of a path. */
export function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

/** Lists all files below a folder, recursively, sorted. */
export async function listFilesRecursive(fs: ProjectFileSystem, folder: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await fs.list(folder);
  for (const entry of entries) {
    const path = joinPath(folder, entry.name);
    if (entry.kind === 'directory') result.push(...(await listFilesRecursive(fs, path)));
    else result.push(path);
  }
  return result.sort();
}
