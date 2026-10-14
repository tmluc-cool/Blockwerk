/** Example projects bundled with the editor (files of `examples/`, copied into a new project). */
export interface BundledExample {
  readonly id: string;
  readonly files: Readonly<Record<string, string>>;
}

const raw = import.meta.glob('../../../examples/*/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function collect(): BundledExample[] {
  const examples = new Map<string, Record<string, string>>();
  for (const [path, text] of Object.entries(raw)) {
    const match = /examples\/([^/]+)\/(.+)$/.exec(path);
    if (!match?.[1] || !match[2]) continue;
    const files = examples.get(match[1]) ?? {};
    files[match[2]] = text;
    examples.set(match[1], files);
  }
  return [...examples]
    .filter(([, files]) => 'blockwerk.json' in files)
    .map(([id, files]) => ({ id, files }))
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
