import type { BlockRegistry, Locale } from '@blockwerk/blocks';
import type { LibraryEntry } from '@blockwerk/library';

/** The block catalog as text for the prompt: ID, shape, label with its slots, and the fields. */
export function blockCatalogText(registry: BlockRegistry, locale: Locale = 'en'): string {
  const lines: string[] = [];
  const printed = new Map<string, string>();
  let category = '';
  for (const definition of registry.all()) {
    if (definition.hidden || definition.code || definition.id.startsWith('custom.')) continue;
    if (definition.category !== category) {
      category = definition.category;
      lines.push(`# ${category}`);
    }
    const parts: string[] = [];
    for (const [name, input] of Object.entries(definition.inputs)) {
      switch (input.type) {
        case 'dropdown': {
          const values = input.options.map((option) => option.value);
          const signature = values.join('|');
          const seen = printed.get(signature);
          if (values.length > 12 && seen) parts.push(`${name}: one of the values of ${seen}`);
          else {
            parts.push(`${name}: ${values.join('|')}`);
            if (values.length > 12) printed.set(signature, `${definition.id}.${name}`);
          }
          break;
        }
        case 'numberField':
          parts.push(`${name}: number`);
          break;
        case 'textField':
          parts.push(`${name}: text`);
          break;
        case 'reference':
          parts.push(`${name}: reference (default ${input.default})`);
          break;
        case 'variable':
          parts.push(`${name}: variable name`);
          break;
        case 'colorField':
          parts.push(`${name}: #rrggbb`);
          break;
        case 'statement':
          parts.push(`${name}: body`);
          break;
        default:
          parts.push(`${name}: ${input.type} slot`);
      }
    }
    const output =
      definition.shape === 'reporter' || definition.shape === 'boolean'
        ? ` -> ${definition.output}`
        : '';
    lines.push(
      `${definition.id} [${definition.shape}${output}] ${definition.text[locale]}${parts.length > 0 ? ` | ${parts.join('; ')}` : ''}`,
    );
  }
  return lines.join('\n');
}

/** The asset library as text: one line per model, grouped by source package. */
export function libraryCatalogText(
  entries: readonly LibraryEntry[],
  locale: Locale = 'en',
): string {
  const bySource = new Map<string, LibraryEntry[]>();
  for (const entry of entries) {
    const list = bySource.get(entry.source) ?? [];
    list.push(entry);
    bySource.set(entry.source, list);
  }
  const lines: string[] = [
    'Library ID = <package>/<name>. Format: name | English name | category | size in meters (x y z)',
  ];
  for (const source of [...bySource.keys()].sort()) {
    lines.push(`# ${source}`);
    for (const entry of bySource.get(source) ?? []) {
      const name = entry.id.slice(source.length + 1);
      const size = entry.size.map((value) => Math.round(value * 10) / 10).join(' ');
      lines.push(`${name} | ${entry.name[locale]} | ${entry.category} | ${size}`);
    }
  }
  return lines.join('\n');
}

/** What the model may know about a component type. */
export interface ComponentInfo {
  readonly type: string;
  readonly label: string;
  /** Names of its fields with their kind, e.g. `speed: number`. */
  readonly fields: readonly string[];
}

/** The component list as text for the prompt. */
export function componentCatalogText(components: readonly ComponentInfo[]): string {
  return components
    .map(
      (component) =>
        `${component.type} (${component.label})${component.fields.length > 0 ? `: ${component.fields.join(', ')}` : ''}`,
    )
    .join('\n');
}

/** What the editor tells the assistant about the open project (kept small). */
export interface ProjectFacts {
  readonly projectName: string;
  readonly sceneName: string;
  readonly objects: readonly {
    readonly id: string;
    readonly name: string;
    readonly tag: string;
    readonly position: readonly [number, number, number];
    readonly scale: readonly [number, number, number];
    readonly components: readonly string[];
    readonly scripts: readonly string[];
  }[];
  readonly scripts: readonly {
    readonly name: string;
    readonly variables: readonly {
      readonly name: string;
      readonly type: string;
      readonly scope: string;
    }[];
  }[];
  readonly tags: readonly string[];
  /** The object that is selected now, if any. */
  readonly selectedObject?: string;
  /** Height of the ground in meters (objects stand at this y). */
  readonly groundY: number;
}

const MAX_OBJECTS_IN_SUMMARY = 120;

/** The project summary as text for the prompt. */
export function projectSummaryText(facts: ProjectFacts): string {
  const round = (value: number): number => Math.round(value * 10) / 10;
  const lines = [
    `Project "${facts.projectName}", open scene "${facts.sceneName}". Ground level: y = ${facts.groundY}.`,
    `Tags: ${['Player', 'Untagged', ...facts.tags.filter((tag) => tag !== 'Player' && tag !== 'Untagged')].join(', ')}`,
  ];
  if (facts.selectedObject) lines.push(`Selected object: ${facts.selectedObject}`);
  lines.push(
    `Objects (${facts.objects.length}): id | name | tag | position | scale | components | scripts`,
  );
  for (const object of facts.objects.slice(0, MAX_OBJECTS_IN_SUMMARY)) {
    lines.push(
      `${object.id} | ${object.name} | ${object.tag} | ${object.position.map(round).join(' ')} | ${object.scale.map(round).join(' ')} | ${object.components.join(',')} | ${object.scripts.join(',')}`,
    );
  }
  if (facts.objects.length > MAX_OBJECTS_IN_SUMMARY)
    lines.push(`… and ${facts.objects.length - MAX_OBJECTS_IN_SUMMARY} more objects`);
  if (facts.scripts.length > 0) {
    lines.push('Block scripts:');
    for (const script of facts.scripts) {
      const variables = script.variables
        .map((variable) => `${variable.name} (${variable.scope} ${variable.type})`)
        .join(', ');
      lines.push(`- ${script.name}${variables ? `: variables ${variables}` : ''}`);
    }
  }
  return lines.join('\n');
}
