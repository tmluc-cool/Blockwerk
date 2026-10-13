import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname as nodeDirname, join } from 'node:path';
import { FileNotFoundError, normalizePath } from './fs/types';
import type { FileEntry, ProjectFileSystem } from './fs/types';

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** Project file system on disk (Node.js: desktop app, scripts, tests). */
export class NodeFileSystem implements ProjectFileSystem {
  /** @param root Absolute path of the project folder. */
  constructor(readonly root: string) {}

  private resolve(path: string): string {
    return join(this.root, ...normalizePath(path).split('/').filter(Boolean));
  }

  async readText(path: string): Promise<string> {
    try {
      return await readFile(this.resolve(path), 'utf8');
    } catch (error) {
      if (isMissing(error)) throw new FileNotFoundError(path);
      throw error;
    }
  }

  async writeText(path: string, text: string): Promise<void> {
    const target = this.resolve(path);
    await mkdir(nodeDirname(target), { recursive: true });
    await writeFile(target, text, 'utf8');
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(this.resolve(path));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async list(path: string): Promise<FileEntry[]> {
    try {
      const entries = await readdir(this.resolve(path), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() || entry.isDirectory())
        .map((entry): FileEntry => ({
          name: entry.name,
          kind: entry.isDirectory() ? 'directory' : 'file',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    await rm(this.resolve(path), { recursive: true, force: true });
  }

  async rename(from: string, to: string): Promise<void> {
    const target = this.resolve(to);
    await mkdir(nodeDirname(target), { recursive: true });
    try {
      await rename(this.resolve(from), target);
    } catch (error) {
      if (isMissing(error)) throw new FileNotFoundError(from);
      throw error;
    }
  }
}
