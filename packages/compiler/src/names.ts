/** 32-bit FNV-1a hash of a string as 8 lowercase hex digits. Stable across runs and platforms. */
export function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Turns an arbitrary name into a JavaScript identifier with the given prefix. */
export function identifier(prefix: string, name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  return cleaned === name
    ? `${prefix}${cleaned}`
    : `${prefix}${cleaned}_${stableHash(name).slice(0, 4)}`;
}

/** Hands out unique identifiers derived from stable IDs. */
export class NameTable {
  private readonly used = new Set<string>();
  private readonly byKey = new Map<string, string>();

  /** Returns the identifier for a key, creating it on first use. */
  get(prefix: string, key: string): string {
    const mapKey = `${prefix}\u0000${key}`;
    const existing = this.byKey.get(mapKey);
    if (existing) return existing;
    const base = `${prefix}${stableHash(key)}`;
    let name = base;
    for (let suffix = 2; this.used.has(name); suffix++) {
      name = `${base}_${suffix}`;
    }
    this.used.add(name);
    this.byKey.set(mapKey, name);
    return name;
  }
}
