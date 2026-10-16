import type { LibraryEntry, LibraryIndex } from '@blockwerk/library';

/** Engine parts that ship inside every exported game, with their licenses. */
const ENGINE_CREDITS: readonly { name: string; license: string; homepage: string }[] = [
  { name: 'Blockwerk', license: 'MIT', homepage: 'https://github.com/tmluc-cool/Blockwerk' },
  { name: 'three.js', license: 'MIT', homepage: 'https://threejs.org' },
  { name: 'Rapier', license: 'Apache-2.0', homepage: 'https://rapier.rs' },
  {
    name: 'recast-navigation-js',
    license: 'MIT',
    homepage: 'https://github.com/isaac-mason/recast-navigation-js',
  },
  { name: 'postprocessing', license: 'Zlib', homepage: 'https://github.com/pmndrs/postprocessing' },
  { name: 'N8AO', license: 'ISC', homepage: 'https://github.com/N8python/n8ao' },
];

/** A project asset with a license of its own (an import from elsewhere). */
export interface LicensedAsset {
  readonly path: string;
  readonly license: string;
}

/** What goes into `CREDITS.txt`. */
export interface CreditsInput {
  readonly productName: string;
  /** Library models the game uses. */
  readonly libraryEntries: readonly LibraryEntry[];
  /** The library's index (for the source packages). */
  readonly libraryIndex: LibraryIndex | null;
  /** Imported project assets that carry a license. */
  readonly licensedAssets: readonly LicensedAsset[];
}

/**
 * Writes `CREDITS.txt` (SPEC 9.3): every third-party asset of the game with author, license and
 * source, then the engine parts. The text is sorted and free of dates, so a build is repeatable.
 */
export function buildCredits(input: CreditsInput): string {
  const lines: string[] = [`${input.productName}`, '='.repeat(input.productName.length), ''];
  lines.push('Made with Blockwerk (https://github.com/tmluc-cool/Blockwerk).', '');
  lines.push('Third-party assets', '------------------');
  const bySource = new Map<string, LibraryEntry[]>();
  for (const entry of input.libraryEntries) {
    const list = bySource.get(entry.source) ?? [];
    list.push(entry);
    bySource.set(entry.source, list);
  }
  if (bySource.size === 0 && input.licensedAssets.length === 0) {
    lines.push('This game uses no third-party assets.');
  }
  for (const source of [...bySource.keys()].sort()) {
    const info = input.libraryIndex?.sources.find((candidate) => candidate.id === source);
    const entries = (bySource.get(source) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    const first = entries[0];
    lines.push('');
    lines.push(`${info?.name ?? source}`);
    lines.push(`  Author:  ${info?.author ?? first?.author ?? 'unknown'}`);
    lines.push(`  License: ${info?.license ?? first?.license ?? 'unknown'}`);
    if (info?.homepage) lines.push(`  Source:  ${info.homepage}`);
    lines.push(`  Used:    ${entries.map((entry) => entry.name.en).join(', ')}`);
  }
  const licensed = [...input.licensedAssets].sort((a, b) => a.path.localeCompare(b.path));
  if (licensed.length > 0) {
    lines.push('', 'Imported files with their own license');
    for (const asset of licensed) lines.push(`  ${asset.path}: ${asset.license}`);
  }
  lines.push('', 'Engine', '------');
  for (const part of ENGINE_CREDITS) {
    lines.push(`${part.name} (${part.license}): ${part.homepage}`);
  }
  return `${lines.join('\n')}\n`;
}
