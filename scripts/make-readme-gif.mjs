// Makes docs/screenshots/editor-tour.gif for the README: records a few editor screens with
// Playwright (e2e/editor/readmeTour.spec.ts) and joins them with ffmpeg.
// Run with `pnpm tour`. Needs ffmpeg on the PATH. The GIF is checked in, not generated in CI.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const frames = join(root, 'test-results', 'tour');
const output = join(root, 'docs', 'screenshots', 'editor-tour.gif');
rmSync(frames, { recursive: true, force: true });

const run = (command, args, env = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('pnpm', ['--filter', '@blockwerk/editor', 'build']);
run('pnpm', ['exec', 'playwright', 'test', '--project', 'editor', '-g', 'README tour frames'], {
  BLOCKWERK_TOUR: '1',
});
// Two seconds per frame, 960 pixels wide, one shared palette so the file stays small.
run('ffmpeg', [
  '-y',
  '-framerate',
  '0.5',
  '-i',
  join(frames, 'frame-%02d.png'),
  '-vf',
  'scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
  '-loop',
  '0',
  output,
]);
console.log(`Written ${output}`);
