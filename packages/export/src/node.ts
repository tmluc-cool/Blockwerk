import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { libraryIndexSchema } from '@blockwerk/library';
import { fileBytes } from './assemble';
import type { ExportFile, LibrarySource } from './index';

/** The asset library in a folder (`pnpm assets:fetch`), or `null` if it was not built. */
export async function readLibraryFolder(dir: string): Promise<LibrarySource | null> {
  try {
    const index = libraryIndexSchema.parse(
      JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')),
    );
    return { index, read: async (file) => new Uint8Array(await readFile(join(dir, file))) };
  } catch {
    return null;
  }
}

/** Every file below a folder, with `/` paths relative to it, sorted. */
export async function readFolder(dir: string): Promise<ExportFile[]> {
  const files: ExportFile[] = [];
  const walk = async (folder: string): Promise<void> => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const full = join(folder, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        files.push({
          path: relative(dir, full).split(sep).join('/'),
          data: new Uint8Array(await readFile(full)),
        });
      }
    }
  };
  await walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Writes files below a folder (made if missing; an existing `clean` folder is emptied first). */
export async function writeFolder(
  dir: string,
  files: readonly ExportFile[],
  clean = true,
): Promise<void> {
  if (clean) await rm(dir, { recursive: true, force: true });
  for (const file of files) {
    const target = join(dir, ...file.path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, fileBytes(file));
  }
}
