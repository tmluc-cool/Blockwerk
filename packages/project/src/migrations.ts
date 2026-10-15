import { FORMAT_VERSION } from './schema';

/** Kinds of project files with their own format. */
export type FileKind =
  'project' | 'scene' | 'blockScript' | 'prefab' | 'dialog' | 'meta' | 'tagsAndLayers';

/** Upgrades raw file data from `from` to `from + 1`. */
export interface Migration {
  readonly from: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

/** Migrations per file kind. Add one step whenever {@link FORMAT_VERSION} is raised. */
export type MigrationRegistry = Readonly<Record<FileKind, readonly Migration[]>>;

/** Built-in migrations. Format version 1 is the first one, so there are none yet. */
export const MIGRATIONS: MigrationRegistry = {
  project: [],
  scene: [],
  blockScript: [],
  prefab: [],
  dialog: [],
  meta: [],
  tagsAndLayers: [],
};

/** Thrown when a file was written by a newer Blockwerk version. */
export class FormatTooNewError extends Error {
  override readonly name = 'FormatTooNewError';

  constructor(
    readonly version: number,
    readonly supported: number,
  ) {
    super(`File format ${version} is newer than the supported format ${supported}.`);
  }
}

/** Thrown when no migration path exists. */
export class MigrationError extends Error {
  override readonly name = 'MigrationError';
}

/** Result of {@link migrate}. */
export interface MigrationResult {
  readonly data: Record<string, unknown>;
  /** Format version of the input. */
  readonly fromVersion: number;
  /** Whether migrations ran. */
  readonly migrated: boolean;
}

/**
 * Brings raw file data to the current format version by running migrations step by step.
 * Data without a version counts as version 1.
 */
export function migrate(
  kind: FileKind,
  data: Record<string, unknown>,
  registry: MigrationRegistry = MIGRATIONS,
  target: number = FORMAT_VERSION,
): MigrationResult {
  const raw = data['formatVersion'];
  const fromVersion = typeof raw === 'number' && Number.isInteger(raw) ? raw : 1;
  if (fromVersion > target) throw new FormatTooNewError(fromVersion, target);
  let current = data;
  for (let version = fromVersion; version < target; version++) {
    const step = registry[kind].find((migration) => migration.from === version);
    if (!step) throw new MigrationError(`No ${kind} migration from format ${version}.`);
    current = { ...step.migrate(current), formatVersion: version + 1 };
  }
  return { data: current, fromVersion, migrated: fromVersion !== target };
}
