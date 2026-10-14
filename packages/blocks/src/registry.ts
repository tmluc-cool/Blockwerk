import { BLOCK_CATALOG } from './catalog';
import type { BlockDefinition } from './types';

/** Lookup of block definitions by ID. */
export class BlockRegistry {
  private readonly byId = new Map<string, BlockDefinition>();

  /** Creates a registry. Throws if two definitions share an ID. */
  constructor(definitions: readonly BlockDefinition[]) {
    for (const definition of definitions) {
      if (this.byId.has(definition.id)) {
        throw new Error(`Duplicate block id "${definition.id}".`);
      }
      this.byId.set(definition.id, definition);
    }
  }

  /** Returns the definition with this ID, or `undefined`. */
  get(id: string): BlockDefinition | undefined {
    return this.byId.get(id);
  }

  /** All definitions in registration order. */
  all(): readonly BlockDefinition[] {
    return Array.from(this.byId.values());
  }
}

/** Registry of the built-in block catalog. */
export const defaultRegistry = new BlockRegistry(BLOCK_CATALOG);
