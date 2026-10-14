import { dirname, FileNotFoundError, normalizePath } from './types';
import type { FileEntry, ProjectFileSystem } from './types';

/** Project file system in memory, for tests and for projects that are not saved yet. */
export class MemoryFileSystem implements ProjectFileSystem {
  private readonly files = new Map<string, string | Uint8Array>();
  private readonly folders = new Set<string>(['']);

  constructor(files: Readonly<Record<string, string>> = {}) {
    for (const [path, text] of Object.entries(files)) this.put(normalizePath(path), text);
  }

  /** All files as a plain object, sorted by path (for assertions). Binary files as `<N bytes>`. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(
      [...this.files.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, data]) => [
          path,
          typeof data === 'string' ? data : `<${data.byteLength} bytes>`,
        ]),
    );
  }

  async readText(path: string): Promise<string> {
    const data = this.files.get(normalizePath(path));
    if (data === undefined) throw new FileNotFoundError(path);
    return typeof data === 'string' ? data : new TextDecoder().decode(data);
  }

  async writeText(path: string, text: string): Promise<void> {
    this.put(normalizePath(path), text);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const data = this.files.get(normalizePath(path));
    if (data === undefined) throw new FileNotFoundError(path);
    return typeof data === 'string' ? new TextEncoder().encode(data) : data.slice();
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    this.put(normalizePath(path), data.slice());
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
    const data = this.files.get(normalizePath(from));
    if (data === undefined) throw new FileNotFoundError(from);
    this.files.delete(normalizePath(from));
    this.put(normalizePath(to), data);
  }

  private put(path: string, data: string | Uint8Array): void {
    this.files.set(path, data);
    for (let folder = dirname(path); folder !== ''; folder = dirname(folder)) {
      this.folders.add(folder);
    }
  }
}
