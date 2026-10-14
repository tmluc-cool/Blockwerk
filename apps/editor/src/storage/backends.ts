import { MemoryFileSystem, PROJECT_FILE, projectFileSchema } from '@blockwerk/project';
import type { ProjectFileSystem } from '@blockwerk/project';
import { DesktopFileSystem } from './desktopFs';
import { OpfsFileSystem } from './opfs';

/** A project the editor can open. `ref` identifies it within its backend. */
export interface ProjectListing {
  readonly ref: string;
  readonly name: string;
}

/** Where projects live: browser storage, real folders (desktop) or memory (fallback). */
export interface ProjectBackend {
  readonly kind: 'browser' | 'desktop' | 'memory';
  list(): Promise<ProjectListing[]>;
  open(ref: string): Promise<ProjectFileSystem>;
  /** Creates an empty project folder and returns its reference. */
  create(name: string): Promise<string>;
  /** Lets the user pick a folder (desktop only). */
  choose?(): Promise<string | null>;
}

const PROJECTS_FOLDER = 'projects';

function slug(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'projekt';
}

async function readName(fs: ProjectFileSystem, fallback: string): Promise<string> {
  try {
    const parsed = projectFileSchema.safeParse(JSON.parse(await fs.readText(PROJECT_FILE)));
    return parsed.success ? parsed.data.name : fallback;
  } catch {
    return fallback;
  }
}

class BrowserBackend implements ProjectBackend {
  readonly kind = 'browser';

  constructor(private readonly root: FileSystemDirectoryHandle) {}

  private async projects(): Promise<FileSystemDirectoryHandle> {
    return this.root.getDirectoryHandle(PROJECTS_FOLDER, { create: true });
  }

  async list(): Promise<ProjectListing[]> {
    const result: ProjectListing[] = [];
    for await (const [ref, handle] of (await this.projects()).entries()) {
      if (handle.kind !== 'directory') continue;
      const fs = new OpfsFileSystem(handle as FileSystemDirectoryHandle);
      if (!(await fs.exists(PROJECT_FILE))) continue;
      result.push({ ref, name: await readName(fs, ref) });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async open(ref: string): Promise<ProjectFileSystem> {
    return new OpfsFileSystem(await (await this.projects()).getDirectoryHandle(ref));
  }

  async create(name: string): Promise<string> {
    const folder = await this.projects();
    const base = slug(name);
    const taken = new Set<string>();
    for await (const key of folder.keys()) taken.add(key);
    let ref = base;
    for (let index = 1; taken.has(ref); index++) ref = `${base}-${index}`;
    await folder.getDirectoryHandle(ref, { create: true });
    return ref;
  }
}

class DesktopBackend implements ProjectBackend {
  readonly kind = 'desktop';

  constructor(
    private readonly projects: NonNullable<NonNullable<Window['blockwerkDesktop']>['projects']>,
    private readonly files: NonNullable<NonNullable<Window['blockwerkDesktop']>['files']>,
  ) {}

  async list(): Promise<ProjectListing[]> {
    return (await this.projects.list()).map((folder) => ({ ref: folder.path, name: folder.name }));
  }

  async open(ref: string): Promise<ProjectFileSystem> {
    return new DesktopFileSystem(this.files, await this.projects.open(ref));
  }

  create(name: string): Promise<string> {
    return this.projects.create(name);
  }

  choose(): Promise<string | null> {
    return this.projects.choose();
  }
}

class MemoryBackend implements ProjectBackend {
  readonly kind = 'memory';
  private readonly folders = new Map<string, MemoryFileSystem>();

  async list(): Promise<ProjectListing[]> {
    const result: ProjectListing[] = [];
    for (const [ref, fs] of this.folders) {
      if (await fs.exists(PROJECT_FILE)) result.push({ ref, name: await readName(fs, ref) });
    }
    return result;
  }

  async open(ref: string): Promise<ProjectFileSystem> {
    const fs = this.folders.get(ref);
    if (!fs) throw new Error(`Unknown project ${ref}`);
    return fs;
  }

  async create(name: string): Promise<string> {
    let ref = slug(name);
    for (let index = 1; this.folders.has(ref); index++) ref = `${slug(name)}-${index}`;
    this.folders.set(ref, new MemoryFileSystem());
    return ref;
  }
}

/** Picks the storage for this environment: desktop folders, browser storage or memory. */
export async function detectBackend(): Promise<ProjectBackend> {
  const desktop = window.blockwerkDesktop;
  if (desktop?.projects && desktop.files)
    return new DesktopBackend(desktop.projects, desktop.files);
  try {
    const root = await navigator.storage.getDirectory();
    return new BrowserBackend(root);
  } catch {
    return new MemoryBackend();
  }
}
