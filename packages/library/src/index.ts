/**
 * @blockwerk/library: the asset library (SPEC 6): source descriptions, index format, naming and
 * licenses. The build pipeline (`pnpm assets:fetch`) is in `scripts/`.
 */
export * from './schema';
export { displayNames, slug, words } from './naming';
export type { Dictionary } from './naming';
