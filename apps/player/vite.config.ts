import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths: the page runs from any folder, from itch.io and from the Windows app.
  base: './',
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
});
