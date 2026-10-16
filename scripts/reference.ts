// Generates the reference of all blocks and components (SPEC phase 11) from the single sources:
// the block catalog, the component definitions and the Unity counterparts. Output goes to
// `docs/reference/{en,de}/`. `pnpm docs:reference` writes the files, a test checks they are current.
import { BLOCK_UNITY, CATEGORIES, defaultRegistry } from '../packages/blocks/src/index.ts';
import type { BlockDefinition, BlockInput, Locale } from '../packages/blocks/src/index.ts';
import { COMPONENTS } from '../packages/runtime/src/index.ts';
import type { ComponentDefinition, FieldDefinition } from '../packages/runtime/src/index.ts';

const LOCALES: readonly Locale[] = ['en', 'de'];

const LABELS = {
  en: {
    blocks: 'Blocks',
    components: 'Components',
    intro: 'Generated from the block catalog and the component definitions. Do not edit by hand.',
    unity: 'In Unity',
    noUnity: 'no direct counterpart (a Blockwerk addition)',
    inputs: 'Inputs',
    fields: 'Fields',
    shape: 'Shape',
    since: 'Since catalog version',
    default: 'default',
    options: 'options',
    other: 'Other language',
    none: 'none',
  },
  de: {
    blocks: 'Blöcke',
    components: 'Komponenten',
    intro: 'Erzeugt aus dem Blockkatalog und den Komponentendefinitionen. Nicht von Hand ändern.',
    unity: 'In Unity',
    noUnity: 'kein direktes Gegenstück (eine Blockwerk-Ergänzung)',
    inputs: 'Eingaben',
    fields: 'Felder',
    shape: 'Form',
    since: 'Seit Katalogversion',
    default: 'Standard',
    options: 'Optionen',
    other: 'Andere Sprache',
    none: 'keine',
  },
} as const;

const SHAPES: Record<string, Record<Locale, string>> = {
  hat: { en: 'event (hat)', de: 'Ereignis (Hut)' },
  stack: { en: 'command', de: 'Befehl' },
  cap: { en: 'command (ends the stack)', de: 'Befehl (beendet den Stapel)' },
  c: { en: 'C-shaped command', de: 'C-förmiger Befehl' },
  reporter: { en: 'value', de: 'Wert' },
  boolean: { en: 'condition', de: 'Bedingung' },
};

/** Escapes characters that Markdown would read as formatting inside a table or a line. */
function plain(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

function describeInput(input: BlockInput, locale: Locale): string {
  switch (input.type) {
    case 'number':
    case 'numberField':
      return 'number';
    case 'string':
    case 'textField':
      return 'text';
    case 'boolean':
      return 'true/false';
    case 'any':
      return 'any value';
    case 'statement':
      return 'blocks';
    case 'dropdown':
      return `${LABELS[locale].options}: ${input.options.map((option) => option.text[locale]).join(', ')}`;
    case 'reference':
      return `object, tag or asset (${input.source})`;
    case 'variable':
      return 'variable';
    case 'colorField':
      return 'color';
    default:
      return String((input as { type: string }).type);
  }
}

function blockSection(block: BlockDefinition, locale: Locale): string {
  const labels = LABELS[locale];
  const unity = BLOCK_UNITY[block.id];
  const lines = [
    `#### ${plain(block.text[locale])}`,
    '',
    `\`${block.id}\` · ${labels.shape}: ${SHAPES[block.shape]?.[locale] ?? block.shape} · ${labels.since} ${block.since}`,
    '',
    plain(block.docs[locale]),
    '',
    `**${labels.unity}:** ${unity ? `\`${unity}\`` : labels.noUnity}`,
  ];
  const inputs = Object.entries(block.inputs);
  if (inputs.length > 0) {
    lines.push('', `**${labels.inputs}:**`, '');
    for (const [name, input] of inputs)
      lines.push(`- \`${name}\`: ${describeInput(input, locale)}`);
  }
  return lines.join('\n');
}

function blocksPage(locale: Locale): string {
  const labels = LABELS[locale];
  const out = [`# ${labels.blocks}`, '', labels.intro, ''];
  for (const category of CATEGORIES) {
    const blocks = defaultRegistry.all().filter((b) => b.category === category.id && !b.hidden);
    if (blocks.length === 0) continue;
    out.push(`## ${category.name[locale]}`, '');
    for (const block of blocks) out.push(blockSection(block, locale), '');
  }
  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

function describeField(field: FieldDefinition, locale: Locale): string {
  const labels = LABELS[locale];
  let text: string = field.type;
  if (field.type === 'enum') {
    text = `${labels.options}: ${field.options.map((option) => option.text[locale]).join(', ')}`;
  } else if (field.type === 'asset') {
    text = `asset (${field.assetType})`;
  } else if (field.type === 'object') {
    text = 'object';
  }
  const fallback = field.default === null ? labels.none : JSON.stringify(field.default);
  return `${text}, ${labels.default}: ${fallback}`;
}

function componentSection(component: ComponentDefinition, locale: Locale): string {
  const labels = LABELS[locale];
  const lines = [
    `### ${plain(component.text[locale])}`,
    '',
    `\`${component.type}\``,
    '',
    plain(component.docs[locale]),
    '',
    `**${labels.unity}:** ${component.unity ? `\`${component.unity}\`` : labels.noUnity}`,
  ];
  const fields = Object.entries(component.fields).filter(
    ([, field]) => !('hidden' in field && field.hidden),
  );
  if (fields.length > 0) {
    lines.push('', `**${labels.fields}:**`, '');
    for (const [name, field] of fields) {
      lines.push(`- ${plain(field.text[locale])} (\`${name}\`): ${describeField(field, locale)}`);
    }
  }
  return lines.join('\n');
}

function componentsPage(locale: Locale): string {
  const labels = LABELS[locale];
  const out = [`# ${labels.components}`, '', labels.intro, ''];
  for (const component of COMPONENTS) out.push(componentSection(component, locale), '');
  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

function indexPage(locale: Locale): string {
  const labels = LABELS[locale];
  const other = LOCALES.find((candidate) => candidate !== locale) ?? 'en';
  return [
    `# Reference`,
    '',
    labels.intro,
    '',
    `- [${labels.blocks}](blocks.md)`,
    `- [${labels.components}](components.md)`,
    `- ${labels.other}: [${other}](../${other}/README.md)`,
    '',
  ].join('\n');
}

/** All generated files by path relative to `docs/reference/`. */
export function buildReference(): Map<string, string> {
  const files = new Map<string, string>();
  for (const locale of LOCALES) {
    files.set(`${locale}/README.md`, indexPage(locale));
    files.set(`${locale}/blocks.md`, blocksPage(locale));
    files.set(`${locale}/components.md`, componentsPage(locale));
  }
  return files;
}
