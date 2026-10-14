import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScriptVariable } from '../src';

/** Directory of the golden fixtures. */
export const goldenDir = join(import.meta.dirname, 'golden');

/** Reads a golden fixture: a Blockly workspace or `{ variables, workspace }`. */
export function loadFixture(name: string): {
  workspace: unknown;
  variables: readonly ScriptVariable[];
} {
  const data: unknown = JSON.parse(readFileSync(join(goldenDir, name), 'utf8'));
  if (typeof data === 'object' && data !== null && 'workspace' in data) {
    const document = data as { workspace: unknown; variables?: ScriptVariable[] };
    return { workspace: document.workspace, variables: document.variables ?? [] };
  }
  return { workspace: data, variables: [] };
}
