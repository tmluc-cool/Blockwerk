import { contextBridge, ipcRenderer } from 'electron';

/** An entry of a folder listing. */
interface FileEntry {
  readonly name: string;
  readonly kind: 'file' | 'directory';
}

/** A project folder known to the desktop app. */
interface ProjectFolder {
  readonly path: string;
  readonly name: string;
}

/** Information and services the desktop shell exposes to the editor as `window.blockwerkDesktop`. */
export interface DesktopApi {
  readonly platform: string;
  readonly electron: string;
  readonly projects: {
    list(): Promise<ProjectFolder[]>;
    create(name: string): Promise<string>;
    choose(): Promise<string | null>;
    open(root: string): Promise<string>;
  };
  readonly files: {
    read(root: string, path: string): Promise<string>;
    write(root: string, path: string, text: string): Promise<void>;
    exists(root: string, path: string): Promise<boolean>;
    list(root: string, path: string): Promise<FileEntry[]>;
    remove(root: string, path: string): Promise<void>;
    rename(root: string, from: string, to: string): Promise<void>;
  };
}

const api: DesktopApi = {
  platform: process.platform,
  electron: process.versions['electron'] ?? '',
  projects: {
    list: () => ipcRenderer.invoke('projects:list') as Promise<ProjectFolder[]>,
    create: (name) => ipcRenderer.invoke('projects:create', name) as Promise<string>,
    choose: () => ipcRenderer.invoke('projects:choose') as Promise<string | null>,
    open: (root) => ipcRenderer.invoke('projects:open', root) as Promise<string>,
  },
  files: {
    read: (root, path) => ipcRenderer.invoke('fs:read', root, path) as Promise<string>,
    write: (root, path, text) => ipcRenderer.invoke('fs:write', root, path, text) as Promise<void>,
    exists: (root, path) => ipcRenderer.invoke('fs:exists', root, path) as Promise<boolean>,
    list: (root, path) => ipcRenderer.invoke('fs:list', root, path) as Promise<FileEntry[]>,
    remove: (root, path) => ipcRenderer.invoke('fs:remove', root, path) as Promise<void>,
    rename: (root, from, to) => ipcRenderer.invoke('fs:rename', root, from, to) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('blockwerkDesktop', api);
