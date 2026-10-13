import { FileNotFoundError } from '@blockwerk/project';
import type { FileEntry, ProjectFileSystem } from '@blockwerk/project';
import type { DesktopApi } from './desktopApi';

type Files = NonNullable<DesktopApi['files']>;

async function translateErrors<T>(path: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT'))
      throw new FileNotFoundError(path);
    throw error;
  }
}

/** Project files in a real folder, through the desktop shell. */
export class DesktopFileSystem implements ProjectFileSystem {
  constructor(
    private readonly files: Files,
    readonly root: string,
  ) {}

  readText(path: string): Promise<string> {
    return translateErrors(path, () => this.files.read(this.root, path));
  }

  writeText(path: string, text: string): Promise<void> {
    return this.files.write(this.root, path, text);
  }

  exists(path: string): Promise<boolean> {
    return this.files.exists(this.root, path);
  }

  list(path: string): Promise<FileEntry[]> {
    return this.files.list(this.root, path);
  }

  remove(path: string): Promise<void> {
    return this.files.remove(this.root, path);
  }

  rename(from: string, to: string): Promise<void> {
    return translateErrors(from, () => this.files.rename(this.root, from, to));
  }
}
