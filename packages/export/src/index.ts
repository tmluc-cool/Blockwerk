/**
 * @blockwerk/export: turns a project into a game pack (SPEC 9.3): the used assets, compiled
 * scripts, `game.json` and `CREDITS.txt`. Pure functions; reading and writing files is up to
 * the caller (the editor, the desktop app, `scripts/export-game.ts`).
 */
export { buildGame, ExportError } from './build';
export type { ExportFile, ExportInput, ExportProblem, ExportResult, LibrarySource } from './build';
export { buildCredits } from './credits';
export type { CreditsInput, LicensedAsset } from './credits';
export * from './pack';
