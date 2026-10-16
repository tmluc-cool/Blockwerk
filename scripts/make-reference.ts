// Writes the generated block and component reference to docs/reference/ (`pnpm docs:reference`).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildReference } from './reference.ts';

const root = join(import.meta.dirname, '..', 'docs', 'reference');
for (const [path, text] of buildReference()) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text, 'utf8');
}
console.log(`docs/reference written (${buildReference().size} files)`);
