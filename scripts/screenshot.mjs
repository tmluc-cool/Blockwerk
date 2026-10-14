// Writes the screenshot of the current phase's example scene to docs/screenshots/ (run via `pnpm screenshot`,
// which builds first). Uses the "example scene screenshot" Playwright test.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--project', 'editor', '-g', 'example scene screenshot'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, BLOCKWERK_SCREENSHOT: '1' },
  },
);
process.exit(result.status ?? 1);
