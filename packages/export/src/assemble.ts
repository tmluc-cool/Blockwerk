import { zipSync } from 'fflate';
import type { ExportFile, ExportResult } from './build';

const encoder = new TextEncoder();

/** The bytes of a file of an export. */
function bytesOf(file: ExportFile): Uint8Array {
  return typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * The files of a web build (SPEC 9.3): the player page (`template`, the built `apps/player`)
 * with the game pack and `CREDITS.txt` next to it. The page title becomes the name of the game.
 * Upload the folder to itch.io or any web server.
 */
export function assembleWebBuild(
  template: readonly ExportFile[],
  result: ExportResult,
): ExportFile[] {
  const files = template.map((file): ExportFile => {
    if (file.path !== 'index.html') return file;
    const html = typeof file.data === 'string' ? file.data : new TextDecoder().decode(file.data);
    return {
      path: file.path,
      data: html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(result.pack.name)}</title>`),
    };
  });
  return [...files, ...result.files];
}

/** A fixed time stamp, so zipping the same files twice gives the same bytes. */
const ZIP_TIME = new Date(Date.UTC(2000, 0, 1)).getTime();

/** Packs files into a ZIP archive (repeatable: no time stamps from the clock). */
export function zipFiles(files: readonly ExportFile[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { mtime: number; level: 0 | 6 }]> = {};
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    // Models and sounds are compressed already; text compresses well.
    const packed = /\.(glb|png|mp3|ogg)$/.test(file.path);
    entries[file.path] = [bytesOf(file), { mtime: ZIP_TIME, level: packed ? 0 : 6 }];
  }
  return zipSync(entries);
}

/** A file's bytes (for writers that need bytes whatever the file holds). */
export function fileBytes(file: ExportFile): Uint8Array {
  return bytesOf(file);
}
