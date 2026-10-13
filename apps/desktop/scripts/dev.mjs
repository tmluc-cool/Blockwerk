// Starts the editor dev server and opens it in Electron (`pnpm dev:desktop`).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const editorDir = join(desktopDir, '..', 'editor');
const require = createRequire(import.meta.url);
const electronBinary = require('electron');

const build = spawnSync(
  process.execPath,
  [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'],
  {
    cwd: desktopDir,
    stdio: 'inherit',
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

// strictPort off: `pnpm dev` may already use the default port.
const server = await createServer({
  root: editorDir,
  configFile: join(editorDir, 'vite.config.ts'),
  server: { strictPort: false },
});
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite dev server has no local URL.');
console.log(`Editor dev server: ${url}`);

// Linux containers often run as root, where Chromium's sandbox is unavailable.
const extraArgs = process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : [];
const child = spawn(electronBinary, [...extraArgs, '.'], {
  cwd: desktopDir,
  stdio: 'inherit',
  env: { ...process.env, BLOCKWERK_EDITOR_URL: url },
});
child.on('exit', (code) => {
  void server.close().then(() => process.exit(code ?? 0));
});
