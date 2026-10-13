import type { BlockRegistry } from './registry';
import type { BlockInput, Locale } from './types';

/** One entry of the block search index. */
export interface BlockSearchEntry {
  readonly id: string;
  /** Block text with value slots shown as `( )`, conditions as `< >` and fields as `[default]`. */
  readonly label: string;
  /** Lower-case search terms: words of the label plus keywords. */
  readonly terms: readonly string[];
}

/** Builds the search index for typing blocks (SPEC 7.8). Hidden blocks are excluded. */
export function buildSearchIndex(registry: BlockRegistry, locale: Locale): BlockSearchEntry[] {
  return registry
    .all()
    .filter((definition) => !definition.hidden)
    .map((definition) => {
      const label = definition.text[locale].replace(/\{([^}]+)\}/g, (_match, name: string) =>
        slotLabel(definition.inputs[name], locale),
      );
      const options = Object.values(definition.inputs).flatMap((input) =>
        input.type === 'dropdown' ? input.options.map((option) => option.text[locale]) : [],
      );
      const words = [label, ...options]
        .join(' ')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 0);
      const keywords = (definition.keywords?.[locale] ?? []).map((word) => word.toLowerCase());
      return { id: definition.id, label, terms: Array.from(new Set([...words, ...keywords])) };
    });
}

function slotLabel(input: BlockInput | undefined, locale: Locale): string {
  switch (input?.type) {
    case 'boolean':
      return '< >';
    case 'dropdown':
      return `[${input.options.find((option) => option.value === input.default)?.text[locale] ?? ''}]`;
    case 'reference':
    case 'variable':
    case 'colorField':
      return '[ ]';
    default:
      return '( )';
  }
}

/** Returns index entries whose terms start with every word of the query, best matches first. */
export function searchBlocks(
  index: readonly BlockSearchEntry[],
  query: string,
): BlockSearchEntry[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return [];
  return index
    .map((entry) => {
      let score = 0;
      for (const word of words) {
        const exact = entry.terms.includes(word);
        const prefix = entry.terms.some((term) => term.startsWith(word));
        if (!prefix) return null;
        score += exact ? 2 : 1;
      }
      return { entry, score };
    })
    .filter((result): result is { entry: BlockSearchEntry; score: number } => result !== null)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.entry);
}
