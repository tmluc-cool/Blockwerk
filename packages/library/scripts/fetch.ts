/**
 * `pnpm assets:fetch`: builds the asset library (SPEC 6.2).
 *
 * For every source description in `packages/library/sources/`:
 * 1. download the package (Git at a fixed commit, or a ZIP with a fixed SHA-256),
 * 2. check that it is CC0 (the license file must contain the stated phrase),
 * 3. optimize every model (deduplicate, weld, Meshopt) and normalize it (meters, pivot at the
 *    bottom center), measure triangles, size and animations, suggest a collider,
 * 4. render a preview image,
 * and write `library/index.json` and `library/LICENSES.md`. Unchanged models are skipped.
 *
 * Options: `--only <source-id>` (repeatable), `--no-previews`, `--limit <n>` (per source).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Document } from '@gltf-transform/core';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { center, dedup, getBounds, meshopt, prune, weld } from '@gltf-transform/functions';
import { unzipSync } from 'fflate';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { chromium } from 'playwright';
import { displayNames, slug } from '../src/naming';
import { LIBRARY_FORMAT_VERSION, libraryIndexSchema, sourceDescriptionSchema } from '../src/schema';
import type {
  ColliderSuggestion,
  LibraryEntry,
  LibraryIndex,
  LibrarySourceInfo,
  SourceDescription,
  SourceGroup,
} from '../src/schema';
import { globBase, globToRegExp } from './glob';

/** Bump when the processing changes, so every model is built again. */
const PIPELINE_VERSION = 1;
const PREVIEW_SIZE = 192;

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const libraryRoot = process.env['BLOCKWERK_LIBRARY'] ?? join(repoRoot, 'library');
const cacheRoot = join(libraryRoot, '.cache');

interface Options {
  readonly only: readonly string[];
  readonly previews: boolean;
  readonly limit: number;
}

function parseOptions(argv: readonly string[]): Options {
  const only: string[] = [];
  let previews = true;
  let limit = Infinity;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only') only.push(argv[++i] ?? '');
    else if (arg === '--no-previews') previews = false;
    else if (arg === '--limit') limit = Number(argv[++i] ?? 'Infinity');
  }
  return { only, previews, limit };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sortKeys(value), null, 2)}\n`);
}

function git(args: readonly string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Downloads a source package into the cache and returns its folder. */
async function download(source: SourceDescription): Promise<{ folder: string; version: string }> {
  const folder = join(cacheRoot, source.id);
  if (source.download.type === 'git') {
    const { url, commit } = source.download;
    // Only the folders the groups need (and the license file) are checked out.
    const patterns = [
      `/${source.licenseFile}`,
      ...source.groups.flatMap((group) => group.include.map((pattern) => `/${globBase(pattern)}`)),
    ];
    if (!existsSync(join(folder, '.git'))) {
      mkdirSync(folder, { recursive: true });
      git(['init', '-q'], folder);
      git(['remote', 'add', 'origin', url], folder);
    }
    git(['sparse-checkout', 'set', '--no-cone', ...patterns], folder);
    let head = '';
    try {
      head = git(['rev-parse', 'HEAD'], folder);
    } catch {
      // Fresh repository without commits.
    }
    if (head !== commit) {
      log(`  downloading ${url} @ ${commit.slice(0, 8)}`);
      git(['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', commit], folder);
      git(['checkout', '-q', '--force', commit], folder);
    }
    return { folder, version: commit };
  }
  const { url, sha256 } = source.download;
  const archive = join(cacheRoot, `${source.id}.zip`);
  if (!existsSync(archive)) {
    log(`  downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    mkdirSync(cacheRoot, { recursive: true });
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = readFileSync(archive);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha256)
    throw new Error(`${source.id}: checksum ${actual} does not match ${sha256}`);
  if (!existsSync(folder)) {
    for (const [name, data] of Object.entries(unzipSync(bytes))) {
      if (name.endsWith('/')) continue;
      const target = resolve(folder, name);
      if (!target.startsWith(folder + sep)) continue;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
    }
  }
  return { folder, version: sha256 };
}

function listFiles(folder: string): string[] {
  const result: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      if (name === '.git') continue;
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else result.push(relative(folder, path).split(sep).join('/'));
    }
  };
  walk(folder);
  return result.sort();
}

/** Files of a group (models only). */
function matchGroup(files: readonly string[], group: SourceGroup): string[] {
  const include = group.include.map(globToRegExp);
  const exclude = (group.exclude ?? []).map(globToRegExp);
  return files.filter(
    (file) =>
      /\.(gltf|glb)$/i.test(file) &&
      include.some((pattern) => pattern.test(file)) &&
      !exclude.some((pattern) => pattern.test(file)),
  );
}

/** Hash of a model and every file it references, plus the pipeline version. */
function hashModel(path: string, group: SourceGroup): string {
  const hash = createHash('sha256');
  hash.update(`pipeline ${PIPELINE_VERSION}|scale ${group.scale}|collider ${group.collider}\n`);
  hash.update(readFileSync(path));
  if (extname(path).toLowerCase() === '.gltf') {
    const json = JSON.parse(readFileSync(path, 'utf8')) as {
      buffers?: { uri?: string }[];
      images?: { uri?: string }[];
    };
    for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) {
      if (item.uri && !item.uri.startsWith('data:')) {
        const referenced = join(dirname(path), decodeURIComponent(item.uri));
        if (existsSync(referenced)) hash.update(readFileSync(referenced));
      }
    }
  }
  return hash.digest('hex').slice(0, 16);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function countTriangles(document: Document): number {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      // 4 = TRIANGLES (strips and fans are not used by the sources).
      if (primitive.getMode() !== 4) continue;
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      triangles += Math.floor((indices ? indices.getCount() : (position?.getCount() ?? 0)) / 3);
    }
  }
  return triangles;
}

function suggestCollider(
  kind: SourceGroup['collider'],
  size: [number, number, number],
): ColliderSuggestion {
  const [x, y, z] = size;
  if (kind === 'none') return { type: 'none' };
  if (kind === 'capsule') {
    return {
      type: 'capsule',
      center: [0, round(y / 2), 0],
      radius: round(Math.max(x, z) / 2),
      height: round(y),
    };
  }
  return { type: 'box', center: [0, round(y / 2), 0], size: [round(x), round(y), round(z)] };
}

/** Optimizes and normalizes one model and writes it as GLB. */
async function processModel(
  io: NodeIO,
  input: string,
  output: string,
  group: SourceGroup,
): Promise<{ triangles: number; size: [number, number, number]; animations: string[] }> {
  const document = await io.read(input);
  document.setLogger(new Logger(Logger.Verbosity.WARN));
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new Error('no scene');
  if (group.scale !== 1) {
    // One root node carries the unit conversion.
    const wrapper = document.createNode('scale').setScale([group.scale, group.scale, group.scale]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      wrapper.addChild(child);
    }
    scene.addChild(wrapper);
  }
  await document.transform(
    dedup(),
    prune(),
    weld(),
    center({ pivot: 'below' }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const bounds = getBounds(scene);
  const size: [number, number, number] = [
    round(bounds.max[0] - bounds.min[0]),
    round(bounds.max[1] - bounds.min[1]),
    round(bounds.max[2] - bounds.min[2]),
  ];
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, await io.writeBinary(document));
  return {
    triangles: countTriangles(document),
    size,
    animations: root
      .listAnimations()
      .map((animation) => animation.getName())
      .filter(Boolean),
  };
}

/** Renders preview images with a headless browser and three.js. */
async function renderPreviews(entries: readonly LibraryEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const require = createRequire(import.meta.url);
  const threeRoot = resolve(dirname(require.resolve('three')), '..');
  const page = readFileSync(join(here, 'preview.html'));
  const server = createServer((request, response) => {
    const url = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
    let file: string | null = null;
    if (url === '/' || url === '/preview.html') {
      response.writeHead(200, { 'content-type': 'text/html' }).end(page);
      return;
    }
    if (url.startsWith('/three/')) file = resolve(threeRoot, `.${url.slice(6)}`);
    else if (url.startsWith('/library/')) file = resolve(libraryRoot, `.${url.slice(8)}`);
    const allowed =
      file && (file.startsWith(threeRoot + sep) || file.startsWith(libraryRoot + sep));
    if (!file || !allowed || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    const type = file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
    response.writeHead(200, { 'content-type': type }).end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const tab = await browser.newPage({ viewport: { width: PREVIEW_SIZE, height: PREVIEW_SIZE } });
    await tab.goto(`http://127.0.0.1:${port}/preview.html?size=${PREVIEW_SIZE}`);
    await tab.waitForFunction(
      () => (globalThis as { previewReady?: boolean }).previewReady === true,
    );
    let done = 0;
    for (const entry of entries) {
      const data = await tab.evaluate(
        (url) =>
          (globalThis as unknown as { renderModel(url: string): Promise<string> }).renderModel(url),
        `/library/${entry.file}`,
      );
      const target = join(libraryRoot, entry.preview);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64'));
      done++;
      if (done % 50 === 0) log(`  previews ${done}/${entries.length}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

function readPreviousIndex(): LibraryIndex | null {
  const path = join(libraryRoot, 'index.json');
  if (!existsSync(path)) return null;
  const parsed = libraryIndexSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  return parsed.success ? parsed.data : null;
}

function licensesMarkdown(sources: readonly LibrarySourceInfo[], total: number): string {
  const rows = sources.map(
    (source) =>
      `| ${source.name} | ${source.author} | ${source.license} | ${source.models} | <${source.homepage}> | \`${source.version.slice(0, 12)}\` |`,
  );
  return [
    '# Licenses of the asset library',
    '',
    'Generated by `pnpm assets:fetch`. Every bundled asset is CC0 (public domain dedication): it may be',
    'used in any game, also commercially, without attribution. Credits are listed anyway.',
    '',
    `Models: ${total}`,
    '',
    '| Package | Author | License | Models | Source | Version |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const dictionary = JSON.parse(
    readFileSync(join(packageRoot, 'sources', 'words.json'), 'utf8'),
  ) as Record<string, string>;
  const sourceFiles = readdirSync(join(packageRoot, 'sources'))
    .filter((name) => name.endsWith('.json') && name !== 'words.json')
    .sort();
  const sources = sourceFiles.map((name) =>
    sourceDescriptionSchema.parse(
      JSON.parse(readFileSync(join(packageRoot, 'sources', name), 'utf8')),
    ),
  );
  const previous = readPreviousIndex();
  const previousEntries = new Map((previous?.entries ?? []).map((entry) => [entry.id, entry]));
  const entries = new Map<string, LibraryEntry>();
  const sourceInfos: LibrarySourceInfo[] = [];
  const needPreview: LibraryEntry[] = [];

  for (const source of sources) {
    if (options.only.length > 0 && !options.only.includes(source.id)) {
      // Keep what an earlier full run produced.
      for (const entry of previous?.entries ?? [])
        if (entry.source === source.id) entries.set(entry.id, entry);
      const info = previous?.sources.find((item) => item.id === source.id);
      if (info) sourceInfos.push(info);
      continue;
    }
    log(`${source.name}`);
    const { folder, version } = await download(source);
    const licensePath = join(folder, source.licenseFile);
    if (
      !existsSync(licensePath) ||
      !readFileSync(licensePath, 'utf8').includes(source.licensePhrase)
    ) {
      throw new Error(
        `${source.id}: ${source.licenseFile} does not state "${source.licensePhrase}"`,
      );
    }
    const files = listFiles(folder);
    const claimed = new Set<string>();
    let count = 0;
    for (const group of source.groups) {
      for (const file of matchGroup(files, group).slice(0, options.limit)) {
        if (claimed.has(file)) continue;
        claimed.add(file);
        const fileName = file.slice(file.lastIndexOf('/') + 1);
        const id = `${source.id}/${slug(fileName)}`;
        if (entries.has(id)) throw new Error(`${source.id}: duplicate model id ${id} (${file})`);
        const input = join(folder, file);
        const hash = hashModel(input, group);
        const output = `models/${source.id}/${slug(fileName)}.glb`;
        const preview = `previews/${source.id}/${slug(fileName)}.png`;
        const old = previousEntries.get(id);
        let measured: { triangles: number; size: [number, number, number]; animations: string[] };
        if (old && old.hash === hash && existsSync(join(libraryRoot, output))) {
          measured = { triangles: old.triangles, size: old.size, animations: old.animations };
        } else {
          measured = await processModel(io, input, join(libraryRoot, output), group);
        }
        const entry: LibraryEntry = {
          id,
          name: displayNames(fileName, dictionary, source.dropWords),
          category: group.category,
          tags: group.tags,
          source: source.id,
          license: source.license,
          author: source.author,
          file: output,
          preview,
          triangles: measured.triangles,
          size: measured.size,
          collider: suggestCollider(group.collider, measured.size),
          animations: measured.animations,
          hash,
        };
        entries.set(id, entry);
        if (
          options.previews &&
          (!old || old.hash !== hash || !existsSync(join(libraryRoot, preview)))
        ) {
          needPreview.push(entry);
        }
        count++;
      }
    }
    log(`  ${count} models`);
    sourceInfos.push({
      id: source.id,
      name: source.name,
      author: source.author,
      license: source.license,
      homepage: source.homepage,
      version,
      models: count,
    });
  }

  if (needPreview.length > 0) {
    log(`Rendering ${needPreview.length} previews`);
    await renderPreviews(needPreview);
  }

  // Remove outputs of models that no longer exist.
  for (const old of previousEntries.values()) {
    if (entries.has(old.id)) continue;
    rmSync(join(libraryRoot, old.file), { force: true });
    rmSync(join(libraryRoot, old.preview), { force: true });
  }

  const index: LibraryIndex = {
    formatVersion: LIBRARY_FORMAT_VERSION,
    sources: sourceInfos.sort((a, b) => a.id.localeCompare(b.id)),
    entries: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
  libraryIndexSchema.parse(index);
  writeJson(join(libraryRoot, 'index.json'), index);
  writeFileSync(
    join(libraryRoot, 'LICENSES.md'),
    licensesMarkdown(index.sources, index.entries.length),
  );
  log(
    `Library: ${index.entries.length} models from ${index.sources.length} packages in ${libraryRoot}`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
