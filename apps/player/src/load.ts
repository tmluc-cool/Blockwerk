import { parseGamePack } from '@blockwerk/export/pack';
import type { GamePack } from '@blockwerk/export/pack';

/** A game pack with its files read into memory (so the game never waits for the disk later). */
export interface LoadedGame {
  readonly pack: GamePack;
  /** Object URLs of models and images by asset ID. */
  readonly urls: ReadonlyMap<string, string>;
  /** Object URLs of library models by library ID. */
  readonly libraryUrls: ReadonlyMap<string, string>;
  /** Sound files by asset ID. */
  readonly audio: ReadonlyMap<string, ArrayBuffer>;
  /** Terrain files by asset ID. */
  readonly terrains: ReadonlyMap<string, ArrayBuffer>;
}

const PARALLEL = 6;

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

/**
 * Loads the pack in `base` (a URL that ends with `/`): `game.json`, then every file in it.
 * `progress` gets the share that is done (0..1) after each file; `manifest` is called as soon as
 * the pack is known, so the loading screen can show the name and the splash image.
 */
export async function loadGame(
  base: string,
  progress: (done: number) => void,
  manifest: (pack: GamePack) => void,
): Promise<LoadedGame> {
  const response = await fetch(`${base}game.json`);
  if (!response.ok) throw new Error(`game.json: HTTP ${response.status}`);
  const pack = parseGamePack(await response.text());
  manifest(pack);
  const jobs: (() => Promise<void>)[] = [];
  const urls = new Map<string, string>();
  const libraryUrls = new Map<string, string>();
  const audio = new Map<string, ArrayBuffer>();
  const terrains = new Map<string, ArrayBuffer>();
  const blobUrl = (bytes: ArrayBuffer, type: string): string =>
    URL.createObjectURL(new Blob([bytes], { type }));
  for (const [id, file] of Object.entries(pack.files)) {
    jobs.push(async () => {
      const bytes = await fetchBytes(`${base}${file.path}`);
      if (file.type === 'model') urls.set(id, blobUrl(bytes, 'model/gltf-binary'));
      else if (file.type === 'image') urls.set(id, blobUrl(bytes, 'image/png'));
      else if (file.type === 'audio') audio.set(id, bytes);
      else terrains.set(id, bytes);
    });
  }
  for (const [id, path] of Object.entries(pack.library)) {
    jobs.push(async () => {
      libraryUrls.set(id, blobUrl(await fetchBytes(`${base}${path}`), 'model/gltf-binary'));
    });
  }
  let done = 0;
  progress(0);
  const queue = [...jobs];
  const worker = async (): Promise<void> => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      await job();
      done += 1;
      progress(done / Math.max(1, jobs.length));
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  progress(1);
  return { pack, urls, libraryUrls, audio, terrains };
}
