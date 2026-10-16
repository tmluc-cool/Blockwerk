import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.cur': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
};

/** Serves the files under `dir` at `prefix`; other requests go on to the next handler. */
function serveFolder(dir: string) {
  return (
    request: { url?: string },
    response: { setHeader(name: string, value: string): void } & NodeJS.WritableStream,
    next: () => void,
  ): void => {
    const file = normalize(join(dir, decodeURIComponent((request.url ?? '').split('?')[0] ?? '')));
    if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) {
      next();
      return;
    }
    response.setHeader('Content-Type', MEDIA_TYPES[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(response);
  };
}

/**
 * Serves Blockly's media files (sprites, cursors, sounds) from the local package instead of
 * Blockly's default CDN, so the editor never needs the network. Available at `blockly-media/`.
 */
function blocklyMedia(): Plugin {
  const require = createRequire(import.meta.url);
  const mediaDir = join(dirname(require.resolve('blockly')), 'media');
  return {
    name: 'blockwerk:blockly-media',
    configureServer(server) {
      server.middlewares.use('/blockly-media', serveFolder(mediaDir));
    },
    generateBundle() {
      for (const name of readdirSync(mediaDir)) {
        this.emitFile({
          type: 'asset',
          fileName: `blockly-media/${name}`,
          source: readFileSync(join(mediaDir, name)),
        });
      }
    },
  };
}

/**
 * Serves the asset library built by `pnpm assets:fetch` (repository folder `library/`) at
 * `library/` in the dev and preview servers. It is not copied into the build: the desktop app
 * serves it from its own folder.
 */
function assetLibrary(): Plugin {
  const dir = resolve(import.meta.dirname, '..', '..', 'library');
  return {
    name: 'blockwerk:asset-library',
    configureServer(server) {
      server.middlewares.use('/library', serveFolder(dir));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/library', serveFolder(dir));
    },
  };
}

/** Every file below a folder, as `/` paths relative to it, sorted. */
function listFiles(dir: string, base = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(dir, base), { withFileTypes: true })) {
    const path = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...listFiles(dir, path));
    else found.push(path);
  }
  return found.sort();
}

/**
 * Ships the built player (`apps/player`, run `pnpm --filter @blockwerk/player build` first) next
 * to the editor in `player/`, with `player/files.json` listing its files: "Build" for the web
 * puts the game next to a copy of it. Without a built player the editor still works and the
 * Build Settings window says that the web build is not available.
 */
function playerTemplate(): Plugin {
  const dir = resolve(import.meta.dirname, '..', 'player', 'dist');
  return {
    name: 'blockwerk:player',
    configureServer(server) {
      server.middlewares.use('/player/files.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(existsSync(dir) ? listFiles(dir) : []));
      });
      server.middlewares.use('/player', serveFolder(dir));
    },
    generateBundle() {
      if (!existsSync(dir)) return;
      const files = listFiles(dir);
      for (const name of files) {
        this.emitFile({
          type: 'asset',
          fileName: `player/${name}`,
          source: readFileSync(join(dir, name)),
        });
      }
      this.emitFile({
        type: 'asset',
        fileName: 'player/files.json',
        source: JSON.stringify(files),
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths so the build also works from Electron's custom protocol.
  base: './',
  plugins: [react(), blocklyMedia(), assetLibrary(), playerTemplate()],
  // Terrain files of the bundled examples are binary assets.
  assetsInclude: ['**/*.bin'],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      // The block editor runs Blockly in its own page (iframe), see src/blocks/frame.ts.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        blocks: resolve(import.meta.dirname, 'blocks.html'),
      },
    },
  },
});
