/**
 * Deterministic JSON for project files: object keys sorted, two-space indentation, LF line
 * endings and a final newline. Saving unchanged data yields byte-identical files.
 */
export function stringifyDeterministic(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) sorted[key] = sortKeys(item);
    }
    return sorted;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return 0;
  return value;
}
