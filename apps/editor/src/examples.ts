/** Example projects bundled with the editor (files of `examples/`, copied into a new project). */
export interface BundledExample {
  readonly id: string;
  readonly files: Readonly<Record<string, string>>;
  /** Binary files (terrains, sounds, models) as data URLs by path. */
  readonly binaries: Readonly<Record<string, string>>;
}

/** Files with these endings are binary (terrains, sounds, models, images) and not read as text. */
const raw = import.meta.glob(
  ['../../../examples/*/**/*', '!../../../examples/*/**/*.{bin,glb,png,wav,ogg,mp3}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const binaryRaw = import.meta.glob('../../../examples/*/**/*.{bin,glb,png,wav,ogg,mp3}', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function collect(): BundledExample[] {
  const examples = new Map<string, Record<string, string>>();
  const binaries = new Map<string, Record<string, string>>();
  const sort = (source: Record<string, string>, target: Map<string, Record<string, string>>) => {
    for (const [path, text] of Object.entries(source)) {
      const match = /examples\/([^/]+)\/(.+)$/.exec(path);
      if (!match?.[1] || !match[2]) continue;
      const files = target.get(match[1]) ?? {};
      files[match[2]] = text;
      target.set(match[1], files);
    }
  };
  sort(raw, examples);
  sort(binaryRaw, binaries);
  return [...examples]
    .filter(([, files]) => 'blockwerk.json' in files)
    .map(([id, files]) => ({ id, files, binaries: binaries.get(id) ?? {} }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** All bundled examples, sorted by folder name. */
export const EXAMPLES: readonly BundledExample[] = collect();

/** Name of an example (from its `blockwerk.json`). */
export function exampleName(example: BundledExample): string {
  try {
    const parsed: unknown = JSON.parse(example.files['blockwerk.json'] ?? '{}');
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'name' in parsed &&
      typeof parsed.name === 'string'
    ) {
      return parsed.name;
    }
  } catch {
    // Fall back to the folder name.
  }
  return example.id;
}
