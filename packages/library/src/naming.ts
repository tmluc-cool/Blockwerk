/** Word translations for display names, shared by all sources (lower-case English → German). */
export type Dictionary = Readonly<Record<string, string>>;

/** Splits a file name into lower-case words: `building_home_A-blue2` → building, home, a, blue, 2. */
export function words(fileName: string): string[] {
  const base = fileName.replace(/\.[^.]*$/, '').replace(/\.gltf$/i, '');
  return base
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** Lower-case slug for IDs: `Building_Home_A` → `building-home-a`. */
export function slug(fileName: string): string {
  return words(fileName).join('-');
}

function capitalize(word: string): string {
  return word.length <= 1 ? word.toUpperCase() : word[0]?.toUpperCase() + word.slice(1);
}

/**
 * Display names in English and German from a file name. Single letters and numbers are kept as
 * variant markers (`Home A`); words from `drop` are left out unless nothing else remains.
 */
export function displayNames(
  fileName: string,
  dictionary: Dictionary,
  drop: readonly string[] = [],
): { de: string; en: string } {
  const all = words(fileName);
  const kept = all.filter((word) => !drop.includes(word));
  const used = kept.length > 0 ? kept : all;
  const en = used.map(capitalize).join(' ');
  const de = used.map((word) => capitalize(dictionary[word] ?? word)).join(' ');
  return { de, en };
}
