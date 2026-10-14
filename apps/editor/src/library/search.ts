import type { LibraryCategory, LibraryEntry } from '@blockwerk/library';

/** Filters of the asset library window. */
export interface LibraryFilter {
  readonly query: string;
  /** A category, or the favorites / recently used lists. */
  readonly category: LibraryCategory | 'all' | 'favorites' | 'recent';
  readonly animatedOnly: boolean;
  /** Highest triangle count, or `null` for any. */
  readonly maxTriangles: number | null;
}

/** The empty filter. */
export const NO_FILTER: LibraryFilter = {
  query: '',
  category: 'all',
  animatedOnly: false,
  maxTriangles: null,
};

/** Lower-case text without accents, `ß` as `ss`, umlauts also as `ae`/`oe`/`ue` variants. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Whether the letters of `needle` appear in `hay` in order (typo-tolerant prefix search). */
function subsequence(needle: string, hay: string): boolean {
  let index = 0;
  for (const char of hay) {
    if (char === needle[index]) index++;
    if (index === needle.length) return true;
  }
  return needle.length === 0;
}

/**
 * How well one query word matches the words of an entry: 3 for a word that starts with it,
 * 2 for a word that contains it, 1 for the letters in order within one word, 0 for no match.
 */
function wordScore(token: string, words: readonly string[]): number {
  let best = 0;
  for (const word of words) {
    if (word.startsWith(token)) return 3;
    if (word.includes(token)) best = Math.max(best, 2);
    else if (token.length >= 3 && word[0] === token[0] && subsequence(token, word)) {
      best = Math.max(best, 1);
    }
  }
  return best;
}

/** Search words of an entry: German and English name, tags and category. */
export function entryWords(entry: LibraryEntry): string[] {
  return normalize(
    [entry.name.de, entry.name.en, ...entry.tags, entry.category, entry.source].join(' '),
  )
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Fuzzy search in German and English (SPEC 6.1): every query word must match a word of the
 * entry. Returns the score (higher is better) or 0 if the entry does not match.
 */
export function matchScore(entry: LibraryEntry, query: string): number {
  const tokens = normalize(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) return 1;
  const words = entryWords(entry);
  let total = 0;
  for (const token of tokens) {
    const score = wordScore(token, words);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

/** Entries matching the filter, best matches first (by name within equal scores). */
export function searchLibrary(
  entries: readonly LibraryEntry[],
  filter: LibraryFilter,
  lists: { favorites: readonly string[]; recent: readonly string[] },
  locale: 'de' | 'en',
): LibraryEntry[] {
  let pool: readonly LibraryEntry[] = entries;
  if (filter.category === 'favorites' || filter.category === 'recent') {
    const ids = filter.category === 'favorites' ? lists.favorites : lists.recent;
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    pool = ids.map((id) => byId.get(id)).filter((entry): entry is LibraryEntry => !!entry);
  } else if (filter.category !== 'all') {
    pool = entries.filter((entry) => entry.category === filter.category);
  }
  const scored: [LibraryEntry, number][] = [];
  for (const entry of pool) {
    if (filter.animatedOnly && entry.animations.length === 0) continue;
    if (filter.maxTriangles !== null && entry.triangles > filter.maxTriangles) continue;
    const score = matchScore(entry, filter.query);
    if (score > 0) scored.push([entry, score]);
  }
  // The recent list keeps its order unless searching.
  if (filter.category === 'recent' && !filter.query.trim()) return scored.map(([entry]) => entry);
  return scored
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].name[locale].localeCompare(b[0].name[locale], locale, { numeric: true }),
    )
    .map(([entry]) => entry);
}
