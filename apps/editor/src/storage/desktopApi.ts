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
    readBytes(root: string, path: string): Promise<Uint8Array>;
    writeBytes(root: string, path: string, data: Uint8Array): Promise<void>;
    exists(root: string, path: string): Promise<boolean>;
    list(root: string, path: string): Promise<FileEntry[]>;
    remove(root: string, path: string): Promise<void>;
    rename(root: string, from: string, to: string): Promise<void>;
  };
  readonly exporter?: DesktopExporter;
  readonly ai?: DesktopAi;
}

/** A file the desktop app writes for an export. */
export interface DesktopExportFile {
  /** Path relative to the export folder, with `/`. */
  readonly path: string;
  readonly data: Uint8Array | string;
}

/** Export services of the desktop app (SPEC 9.3). */
export interface DesktopExporter {
  /** Asks where to put the build; `null` if the user cancels. */
  chooseFolder(): Promise<string | null>;
  /** Writes files below a folder; with `clean` an existing folder is emptied first. */
  writeFiles(folder: string, files: readonly DesktopExportFile[], clean: boolean): Promise<void>;
  /** Whether this app carries a player for Windows (only the Windows app does). */
  windowsAvailable(): Promise<boolean>;
  /** Makes the Windows app: player template, game files, exe named after the game, icon. */
  buildWindows(options: {
    readonly folder: string;
    readonly name: string;
    readonly files: readonly DesktopExportFile[];
    /** PNG of the app icon, if the game has one. */
    readonly icon: Uint8Array | null;
  }): Promise<{ readonly exe: string; readonly warnings: readonly string[] }>;
  /** Starts a built app. */
  run(path: string): Promise<void>;
}

/** The assistant's services in the desktop app: the key stays in the main process. */
export interface DesktopAi {
  hasKey(): Promise<boolean>;
  /** Stores the key; `session` means the system offers no encryption and the key is kept until the app closes. */
  setKey(key: string): Promise<'encrypted' | 'session'>;
  clearKey(): Promise<void>;
  /** Sends a Messages API request with the stored key. */
  send(
    request: unknown,
  ): Promise<
    | { readonly ok: true; readonly body: unknown }
    | { readonly ok: false; readonly status: number; readonly message: string }
  >;
}

declare global {
  interface Window {
    blockwerkDesktop?: DesktopApi;
  }
}
