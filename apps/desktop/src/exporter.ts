import { app, dialog, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import { buildWindowsApp, isWindowsTemplate } from './windowsApp';
import type { AppFile } from './windowsApp';

/**
 * Where the player template is: in the installed app next to the editor, in a checkout the folder
 * `pnpm player-template` makes. `BLOCKWERK_PLAYER_TEMPLATE` overrides it (tests).
 */
export function playerTemplateDir(): string {
  return normalize(
    process.env['BLOCKWERK_PLAYER_TEMPLATE'] ??
      (app.isPackaged
        ? join(process.resourcesPath, 'player-template')
        : join(__dirname, '..', 'player-template')),
  );
}

/** A path from the editor that must stay below a folder the user chose. */
function inside(folder: string, relative: string): string {
  const target = normalize(join(folder, ...relative.split('/')));
  if (!target.startsWith(normalize(folder) + sep))
    throw new Error(`Path leaves the folder: ${relative}`);
  return target;
}

/** Registers the export services the editor uses (`window.blockwerkDesktop.exporter`). */
export function registerExporter(): void {
  ipcMain.handle('export:chooseFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle(
    'export:writeFiles',
    async (_event, folder: string, files: readonly AppFile[], clean: boolean) => {
      if (clean) await rm(folder, { recursive: true, force: true });
      for (const file of files) {
        const target = inside(folder, file.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.data);
      }
    },
  );
  ipcMain.handle('export:windowsAvailable', () => isWindowsTemplate(playerTemplateDir()));
  ipcMain.handle(
    'export:buildWindows',
    (
      _event,
      options: { folder: string; name: string; files: readonly AppFile[]; icon: Uint8Array | null },
    ) => buildWindowsApp({ ...options, template: playerTemplateDir() }),
  );
  ipcMain.handle('export:run', (_event, exe: string) => {
    spawn(exe, [], { detached: true, stdio: 'ignore', cwd: dirname(exe) }).unref();
  });
}
