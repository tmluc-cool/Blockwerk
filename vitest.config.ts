import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/editor',
      'apps/desktop',
      { test: { name: 'scripts', include: ['scripts/**/*.test.mjs'] } },
    ],
  },
});
