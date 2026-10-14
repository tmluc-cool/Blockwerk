import { FileNotFoundError, normalizePath } from '@blockwerk/project';
import type { FileEntry, ProjectFileSystem } from '@blockwerk/project';

function isNotFound(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
  );
}

/**
 * Project files in the browser's Origin Private File System. Projects stay in this browser
 * profile; the desktop app saves to real folders instead.
 */
export class OpfsFileSystem implements ProjectFileSystem {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  private async folder(
    parts: readonly string[],
    create: boolean,
  ): Promise<FileSystemDirectoryHandle> {
    let handle = this.root;
    for (const part of parts) handle = await handle.getDirectoryHandle(part, { create });
    return handle;
  }

  private split(path: string): { folders: string[]; name: string } {
    const parts = normalizePath(path).split('/').filter(Boolean);
    const name = parts.pop() ?? '';
    return { folders: parts, name };
  }

  async readText(path: string): Promise<string> {
    try {
      const { folders, name } = this.split(path);
      const file = await (await this.folder(folders, false)).getFileHandle(name);
      return await (await file.getFile()).text();
    } catch (error) {
      if (isNotFound(error)) throw new FileNotFoundError(path);
      throw error;
    }
  }

  async writeText(path: string, text: string): Promise<void> {
    const { folders, name } = this.split(path);
    const file = await (await this.folder(folders, true)).getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async readBytes(path: string): Promise<Uint8Array> {
    try {
      const { folders, name } = this.split(path);
      const file = await (await this.folder(folders, false)).getFileHandle(name);
      return new Uint8Array(await (await file.getFile()).arrayBuffer());
    } catch (error) {
      if (isNotFound(error)) throw new FileNotFoundError(path);
      throw error;
    }
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    const { folders, name } = this.split(path);
    const file = await (await this.folder(folders, true)).getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(new Uint8Array(data));
    await writable.close();
  }

  async exists(path: string): Promise<boolean> {
    const { folders, name } = this.split(path);
    if (name === '') return true;
    try {
      const parent = await this.folder(folders, false);
      for await (const entryName of parent.keys()) if (entryName === name) return true;
      return false;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async list(path: string): Promise<FileEntry[]> {
    try {
      const parts = normalizePath(path).split('/').filter(Boolean);
      const folder = await this.folder(parts, false);
      const entries: FileEntry[] = [];
      for await (const [name, handle] of folder.entries()) {
        entries.push({ name, kind: handle.kind === 'directory' ? 'directory' : 'file' });
      }
      return entries.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    const { folders, name } = this.split(path);
    try {
      await (await this.folder(folders, false)).removeEntry(name, { recursive: true });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const data = await this.readBytes(from);
    await this.writeBytes(to, data);
    if (normalizePath(from).toLowerCase() !== normalizePath(to).toLowerCase())
      await this.remove(from);
  }
}
