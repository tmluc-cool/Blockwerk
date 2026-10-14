import type { FileEntry } from '@blockwerk/project';

/** A project folder known to the desktop app. */
export interface DesktopProjectFolder {
  readonly path: string;
  readonly name: string;
}

/** Services of the Electron shell (`apps/desktop/src/preload.ts`). */
export interface DesktopApi {
  readonly platform: string;
  readonly electron: string;
  readonly projects?: {
    list(): Promise<DesktopProjectFolder[]>;
    create(name: string): Promise<string>;
    choose(): Promise<string | null>;
    open(root: string): Promise<string>;
  };
  readonly files?: {
    read(root: string, path: string): Promise<string>;
    write(root: string, path: string, text: string): Promise<void>;
    exists(root: string, path: string): Promise<boolean>;
    list(root: string, path: string): Promise<FileEntry[]>;
    remove(root: string, path: string): Promise<void>;
    rename(root: string, from: string, to: string): Promise<void>;
  };
}

declare global {
  interface Window {
    blockwerkDesktop?: DesktopApi;
  }
}
