import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** A file of the game pack to write (`game/…` and `CREDITS.txt` as the exporter names them). */
export interface AppFile {
  readonly path: string;
  readonly data: Uint8Array | string;
}

/** What {@link buildWindowsApp} needs. */
export interface WindowsAppOptions {
  /** The player template: the unpacked player shell (`pnpm player-template`). */
  readonly template: string;
  /** The folder of the finished app (emptied first). */
  readonly folder: string;
  /** Name of the game: the exe is `<name>.exe`. */
  readonly name: string;
  readonly files: readonly AppFile[];
  /** PNG of the app icon; applied on Windows only. */
  readonly icon?: Uint8Array | null;
}

/** The finished app. */
export interface WindowsApp {
  readonly exe: string;
  readonly warnings: readonly string[];
}

/** The note the template carries about itself. */
export const TEMPLATE_INFO = 'blockwerk-player.json';

interface TemplateInfo {
  readonly platform?: string;
  /** File name of the player's executable in the template. */
  readonly executable?: string;
}

async function readTemplateInfo(template: string): Promise<TemplateInfo | null> {
  try {
    return JSON.parse(await readFile(join(template, TEMPLATE_INFO), 'utf8')) as TemplateInfo;
  } catch {
    return null;
  }
}

/** Whether a folder is a player template made on Windows (only those make a Windows app). */
export async function isWindowsTemplate(template: string): Promise<boolean> {
  return (await readTemplateInfo(template))?.platform === 'win32';
}

/** The PNG as the single image of an ICO file (Windows reads PNG inside ICO since Vista). */
export function pngToIco(png: Uint8Array): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.byteLength >= 24 ? view.getUint32(16) : 0;
  const height = view.byteLength >= 24 ? view.getUint32(20) : 0;
  const ico = new Uint8Array(22 + png.byteLength);
  const out = new DataView(ico.buffer);
  out.setUint16(2, 1, true); // type: icon
  out.setUint16(4, 1, true); // one image
  ico[6] = width >= 256 ? 0 : width;
  ico[7] = height >= 256 ? 0 : height;
  out.setUint16(10, 1, true); // planes
  out.setUint16(12, 32, true); // bits per pixel
  out.setUint32(14, png.byteLength, true);
  out.setUint32(18, 22, true); // offset of the image
  ico.set(png, 22);
  return ico;
}

/** Names the exe after the game and sets its icon, on Windows. */
async function setIcon(exe: string, icon: Uint8Array, warnings: string[]): Promise<void> {
  if (process.platform !== 'win32') {
    warnings.push('The icon can only be set when building on Windows.');
    return;
  }
  const icoPath = `${exe}.ico`;
  try {
    await writeFile(icoPath, pngToIco(icon));
    const { rcedit } = await import('rcedit');
    await rcedit(exe, { icon: icoPath });
  } catch (error) {
    warnings.push(`The icon could not be set: ${String(error)}`);
  } finally {
    await rm(icoPath, { force: true });
  }
}

/**
 * Makes a Windows app from the player template (SPEC 9.3): copies it, puts the game pack in
 * `resources/game`, `CREDITS.txt` next to the exe, renames the exe after the game and sets the
 * icon. The folder can be zipped or copied as it is: no install needed.
 */
export async function buildWindowsApp(options: WindowsAppOptions): Promise<WindowsApp> {
  const warnings: string[] = [];
  const info = await readTemplateInfo(options.template);
  if (!info?.executable) throw new Error(`${options.template} is not a player template.`);
  await rm(options.folder, { recursive: true, force: true });
  await mkdir(dirname(options.folder), { recursive: true });
  await cp(options.template, options.folder, { recursive: true });
  // A Windows template gives `<name>.exe`; a template of another system (tests) `<name>`.
  const exe = join(options.folder, `${options.name}${info.platform === 'win32' ? '.exe' : ''}`);
  await rename(join(options.folder, info.executable), exe);
  await rm(join(options.folder, TEMPLATE_INFO), { force: true });
  for (const file of options.files) {
    const target = file.path.startsWith('game/')
      ? join(options.folder, 'resources', 'game', ...file.path.slice('game/'.length).split('/'))
      : join(options.folder, ...file.path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.data);
  }
  if (options.icon) {
    // The window shows the same picture: the shell reads `resources/icon.png`.
    await writeFile(join(options.folder, 'resources', 'icon.png'), options.icon);
    await setIcon(exe, options.icon, warnings);
  }
  return { exe, warnings };
}
