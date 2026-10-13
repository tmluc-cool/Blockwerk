import { dirname, FileNotFoundError, normalizePath } from './types';
import type { FileEntry, ProjectFileSystem } from './types';

/** Project file system in memory, for tests and for projects that are not saved yet. */
export class MemoryFileSystem implements ProjectFileSystem {
  private readonly files = new Map<string, string>();
  private readonly folders = new Set<string>(['']);

  constructor(files: Readonly<Record<string, string>> = {}) {
    for (const [path, text] of Object.entries(files)) this.put(normalizePath(path), text);
  }

  /** All files as a plain object, sorted by path (for assertions). */
  snapshot(): Record<string, string> {
    return Object.fromEntries([...this.files.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  async readText(path: string): Promise<string> {
    const text = this.files.get(normalizePath(path));
    if (text === undefined) throw new FileNotFoundError(path);
    return text;
  }

  async writeText(path: string, text: string): Promise<void> {
    this.put(normalizePath(path), text);
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    return this.files.has(normalized) || this.folders.has(normalized);
  }

  async list(path: string): Promise<FileEntry[]> {
    const folder = normalizePath(path);
    const prefix = folder === '' ? '' : `${folder}/`;
    const entries = new Map<string, FileEntry['kind']>();
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix) && !file.slice(prefix.length).includes('/')) {
        entries.set(file.slice(prefix.length), 'file');
      }
    }
    for (const sub of this.folders) {
      if (sub !== folder && sub.startsWith(prefix) && !sub.slice(prefix.length).includes('/')) {
        entries.set(sub.slice(prefix.length), 'directory');
      }
    }
    return [...entries]
      .map(([name, kind]) => ({ name, kind }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async remove(path: string): Promise<void> {
    const target = normalizePath(path);
    this.files.delete(target);
    for (const file of [...this.files.keys()]) {
      if (file.startsWith(`${target}/`)) this.files.delete(file);
    }
    for (const folder of [...this.folders]) {
      if (folder !== '' && (folder === target || folder.startsWith(`${target}/`))) {
        this.folders.delete(folder);
      }
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const text = await this.readText(from);
    this.files.delete(normalizePath(from));
    this.put(normalizePath(to), text);
  }

  private put(path: string, text: string): void {
    this.files.set(path, text);
    for (let folder = dirname(path); folder !== ''; folder = dirname(folder)) {
      this.folders.add(folder);
    }
  }
}
