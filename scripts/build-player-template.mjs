// Builds the player template (SPEC 9.3): the unpacked Electron player that "Build" for Windows
// copies and adds a game to. Run on the platform the template is for (Windows for a Windows app):
//   pnpm player-template            (after `pnpm build`)
// The result is `apps/desktop/player-template/` with
//   <Blockwerk Player.exe>            the Electron runtime, renamed
//   resources/app/                    the player shell (apps/desktop/dist/playerMain.js)
//   resources/player/                 the player page (apps/player/dist)
//   blockwerk-player.json             platform and version, read by the editor
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const desktop = join(root, 'apps', 'desktop');
const playerDist = join(root, 'apps', 'player', 'dist');
const shellDist = join(desktop, 'dist');
const out = process.argv[2] ? resolve(process.argv[2]) : join(desktop, 'player-template');

const require = createRequire(join(desktop, 'package.json'));
// `require('electron')` is the path of the runtime's executable.
const electronExe = require('electron');
const electronDir = dirname(electronExe);
const windows = process.platform === 'win32';
const exeName = windows ? 'Blockwerk Player.exe' : 'blockwerk-player';

for (const needed of [join(playerDist, 'index.html'), join(shellDist, 'playerMain.js')]) {
  await readFile(needed).catch(() => {
    console.error(`Missing ${needed}: run \`pnpm build\` first.`);
    process.exit(1);
  });
}

await rm(out, { recursive: true, force: true });
await cp(electronDir, out, { recursive: true });
await rename(join(out, windows ? 'electron.exe' : 'electron'), join(out, exeName));
// Our app replaces Electron's demo app.
await rm(join(out, 'resources', 'default_app.asar'), { force: true });
// Language files the game does not need (German and English stay).
const locales = join(out, 'locales');
for (const file of await readdir(locales).catch(() => [])) {
  if (!/^(en-US|de)\.pak$/.test(file)) await rm(join(locales, file), { force: true });
}

const app = join(out, 'resources', 'app');
await mkdir(app, { recursive: true });
await cp(join(shellDist, 'playerMain.js'), join(app, 'main.js'));
await cp(join(shellDist, 'playerPreload.js'), join(app, 'playerPreload.js'));
await writeFile(
  join(app, 'package.json'),
  JSON.stringify({ name: 'blockwerk-player', version: '0.0.0', main: 'main.js' }, null, 2),
);
await cp(playerDist, join(out, 'resources', 'player'), { recursive: true });
await writeFile(
  join(out, 'blockwerk-player.json'),
  JSON.stringify({ platform: process.platform, executable: exeName }),
);
console.log(`Player template for ${process.platform}: ${out}`);
