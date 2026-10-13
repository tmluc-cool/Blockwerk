import { defineConfig } from '@playwright/test';

/** Set to test against an already running editor, e.g. `pnpm dev` on http://localhost:5173. */
const externalUrl = process.env['BLOCKWERK_E2E_URL'];

/** Chromium flags for WebGL without a GPU (CI runners, containers). */
export const WEBGL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
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
