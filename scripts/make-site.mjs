// Assembles the GitHub Pages site into a folder (default `site/`):
//   index.html        the start page (docs/site/index.html)
//   editor/           the web version of the editor, with the asset library in editor/library/
//   play/<slug>/      web builds of the games listed in scripts/site-games.json
//   screenshots/      the screenshots the start page shows
// Needs the built editor and player (`pnpm build`) and the asset library (`pnpm assets:fetch`).
// Run with `node scripts/make-site.mjs [out folder]`.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(process.argv[2] ?? join(root, 'site'));
const games = JSON.parse(await readFile(join(root, 'scripts', 'site-games.json'), 'utf8'));

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(join(root, 'apps', 'editor', 'dist'), join(out, 'editor'), { recursive: true });
await cp(join(root, 'library'), join(out, 'editor', 'library'), { recursive: true });
await cp(join(root, 'docs', 'screenshots'), join(out, 'screenshots'), { recursive: true });

const cards = games
  .map(
    (game) =>
      `<li><a href="play/${game.slug}/"><strong>${game.title}</strong></a><span>${game.about}</span></li>`,
  )
  .join('\n        ');
const page = (await readFile(join(root, 'docs', 'site', 'index.html'), 'utf8')).replace(
  '<!-- games -->',
  cards,
);
await writeFile(join(out, 'index.html'), page);

for (const game of games) {
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join(root, 'scripts', 'export-game.ts'),
      join(root, game.folder),
      '--out',
      join(out, 'play', game.slug),
    ],
    { stdio: 'inherit', cwd: root },
  );
  if (result.status !== 0) throw new Error(`Export of ${game.folder} failed.`);
}
console.log(`Site written to ${out}`);
