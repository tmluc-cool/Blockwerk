// Exports a Blockwerk project as a game (SPEC 9.3) without the editor.
//   pnpm export <project folder> --out <folder> [--platform web|windows] [--zip]
//        [--template <player template folder>]
//   --platform windows|app: the player template plus the game (see docs/export.md).
// Web needs the built player (`pnpm --filter @blockwerk/player build`). Windows needs the player
// template (the unpacked Electron player; `pnpm dist` builds it, see docs/export.md).
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  assembleWebBuild,
  buildGame,
  ExportError,
  zipFiles,
} from '../packages/export/src/index.ts';
import { readFolder, readLibraryFolder, writeFolder } from '../packages/export/src/node.ts';
import { buildWindowsApp, isWindowsTemplate } from '../apps/desktop/src/windowsApp.ts';
import { loadProject } from '../packages/project/src/index.ts';
import { NodeFileSystem } from '../packages/project/src/node.ts';

const root = resolve(import.meta.dirname, '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    platform: { type: 'string', default: 'web' },
    zip: { type: 'boolean', default: false },
    template: { type: 'string' },
  },
});

const projectDir = positionals[0];
if (!projectDir || !values.out) {
  console.error('Usage: pnpm export <project folder> --out <folder> [--platform web] [--zip]');
  process.exit(2);
}
if (values.platform !== 'web' && values.platform !== 'windows' && values.platform !== 'app') {
  console.error(`Platform "${values.platform}" is not known: web, windows or app.`);
  process.exit(2);
}

const project = await loadProject(new NodeFileSystem(resolve(projectDir)));
const library = await readLibraryFolder(join(root, 'library'));
let result;
try {
  result = await buildGame({ project, library });
} catch (error) {
  if (error instanceof ExportError) {
    for (const problem of error.problems) {
      console.error(`${problem.severity}: ${problem.code} ${JSON.stringify(problem.params)}`);
    }
    process.exit(1);
  }
  throw error;
}
for (const problem of result.problems) {
  console.warn(`${problem.severity}: ${problem.code} ${JSON.stringify(problem.params)}`);
}
if (values.platform !== 'web') {
  // The app: the player template plus the game. `windows` needs a template made on Windows;
  // `app` takes any template (a test of the export on another system).
  const templateDir = resolve(values.template ?? join(root, 'apps', 'desktop', 'player-template'));
  if (values.platform === 'windows' && !(await isWindowsTemplate(templateDir))) {
    console.error(
      'A Windows app needs a player template built on Windows (`pnpm player-template`).',
    );
    process.exit(1);
  }
  const iconId = result.pack.icon;
  const built = await buildWindowsApp({
    template: templateDir,
    folder: resolve(values.out),
    name: result.pack.name,
    files: result.files,
    icon: iconId ? (project.assetBytes(iconId) ?? null) : null,
  });
  for (const warning of built.warnings) console.warn(`warning: ${warning}`);
  console.log(built.exe);
  process.exit(0);
}
const template = await readFolder(join(root, 'apps', 'player', 'dist')).catch(() => []);
if (template.length === 0) {
  console.error('The player is not built: run `pnpm --filter @blockwerk/player build` first.');
  process.exit(1);
}
const files = assembleWebBuild(template, result);
const out = resolve(values.out);
await writeFolder(out, files);
if (values.zip) {
  await mkdir(resolve(out, '..'), { recursive: true });
  await writeFile(`${out}.zip`, zipFiles(files));
}
console.log(`${basename(out)}: ${files.length} files${values.zip ? ' and a ZIP' : ''}`);
