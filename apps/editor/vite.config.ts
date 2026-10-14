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
};

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
      server.middlewares.use('/blockly-media', (request, response, next) => {
        const file = normalize(
          join(mediaDir, decodeURIComponent((request.url ?? '').split('?')[0] ?? '')),
        );
        if (!file.startsWith(mediaDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
          next();
          return;
        }
        response.setHeader(
          'Content-Type',
          MEDIA_TYPES[extname(file)] ?? 'application/octet-stream',
        );
        createReadStream(file).pipe(response);
      });
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

export default defineConfig({
  // Relative asset paths so the build also works from Electron's custom protocol.
  base: './',
  plugins: [react(), blocklyMedia()],
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
