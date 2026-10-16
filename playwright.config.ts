import { defineConfig } from '@playwright/test';

/** Set to test against an already running editor, e.g. `pnpm dev` on http://localhost:5173. */
const externalUrl = process.env['BLOCKWERK_E2E_URL'];

/** Chromium flags for WebGL without a GPU (CI runners, containers). */
export const WEBGL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

/** CI runners without a GPU (Windows) draw in software and are several times slower. */
const slow = process.platform === 'win32' && process.env['CI'] ? 3 : 1;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 90_000 * slow,
  expect: { timeout: 15_000 * slow },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  // The software-rendered Windows runner is so slow that a different 3D-heavy test times out in
  // roughly every other run (phases 1, 3, 3b, never the same). One retry there; a test that only
  // passes on the retry is reported as "flaky" in the log. Linux and local runs stay strict.
  retries: slow > 1 ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: externalUrl ?? 'http://localhost:4173',
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: WEBGL_ARGS },
  },
  projects: [
    { name: 'editor', testDir: 'e2e/editor', use: { browserName: 'chromium' } },
    { name: 'player', testDir: 'e2e/player', use: { browserName: 'chromium' } },
    { name: 'desktop', testDir: 'e2e/desktop' },
  ],
  webServer: externalUrl
    ? undefined
    : {
        command: 'pnpm --filter @blockwerk/editor preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env['CI'],
        timeout: 60_000,
      },
});
