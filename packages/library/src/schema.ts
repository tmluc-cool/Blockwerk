import { z } from 'zod';

/** Format version of `library/index.json`. */
export const LIBRARY_FORMAT_VERSION = 1;

/** Categories of the asset library (SPEC 6.1), in display order. */
export const LIBRARY_CATEGORIES = [
  'primitives',
  'nature',
  'terrain',
  'buildings',
  'interior',
  'characters',
  'animals',
  'vehicles',
  'items',
  'dungeon',
  'scifi',
  'effects',
  'materials',
  'skies',
  'sounds',
] as const;
export const libraryCategorySchema = z.enum(LIBRARY_CATEGORIES);
/** A category of the asset library. */
export type LibraryCategory = z.infer<typeof libraryCategorySchema>;

/** Licenses accepted for the bundled library (SPEC 6.2: CC0 only). */
export const LIBRARY_LICENSES = ['CC0-1.0'] as const;

const localizedSchema = z.object({ de: z.string().min(1), en: z.string().min(1) });
const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

/** Suggested collider of a model, in model space (meters, pivot at the bottom center). */
export const colliderSuggestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('box'), center: vec3Schema, size: vec3Schema }),
  z.object({
    type: z.literal('capsule'),
    center: vec3Schema,
    radius: z.number(),
    height: z.number(),
  }),
  z.object({ type: z.literal('none') }),
]);
export type ColliderSuggestion = z.infer<typeof colliderSuggestionSchema>;

/** One model of the library. */
export const libraryEntrySchema = z.object({
  /** Stable ID used by projects (`library:<id>`). Never changes once published. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: localizedSchema,
  category: libraryCategorySchema,
  tags: z.array(z.string()),
  /** Source package ID (see `sources`). */
  source: z.string(),
  license: z.enum(LIBRARY_LICENSES),
  author: z.string(),
  /** GLB file relative to the library folder. */
  file: z.string(),
  /** Preview image relative to the library folder. */
  preview: z.string(),
  triangles: z.number().int().nonnegative(),
  /** Size in meters (x, y, z). */
  size: vec3Schema,
  collider: colliderSuggestionSchema,
  /** Names of the animations in the file. */
  animations: z.array(z.string()),
  /** Hash of the original files and the pipeline version (skips unchanged models). */
  hash: z.string(),
});
export type LibraryEntry = z.infer<typeof libraryEntrySchema>;

/** A source package as listed in the index. */
export const librarySourceInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  author: z.string(),
  license: z.enum(LIBRARY_LICENSES),
  homepage: z.string(),
  /** Exact version (Git commit or archive checksum). */
  version: z.string(),
  models: z.number().int(),
});
export type LibrarySourceInfo = z.infer<typeof librarySourceInfoSchema>;

/** Contents of `library/index.json`. */
export const libraryIndexSchema = z.object({
  formatVersion: z.literal(LIBRARY_FORMAT_VERSION),
  sources: z.array(librarySourceInfoSchema),
  entries: z.array(libraryEntrySchema),
});
export type LibraryIndex = z.infer<typeof libraryIndexSchema>;

/** Which files of a package become which library entries. */
export const sourceGroupSchema = z.object({
  /** Glob patterns relative to the package root (`*` within a folder, `**` across folders). */
  include: z.array(z.string()).min(1),
  exclude: z.array(z.string()).optional(),
  category: libraryCategorySchema,
  tags: z.array(z.string()).default([]),
  /** Uniform scale applied to bring the models to meters. */
  scale: z.number().positive().default(1),
  collider: z.enum(['box', 'capsule', 'none']).default('box'),
});
export type SourceGroup = z.infer<typeof sourceGroupSchema>;

/** Description of a source package in `packages/library/sources/*.json` (SPEC 6.2). */
export const sourceDescriptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string(),
  author: z.string(),
  homepage: z.string().url(),
  license: z.enum(LIBRARY_LICENSES),
  download: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('git'),
      url: z.string().url(),
      commit: z.string().regex(/^[0-9a-f]{40}$/),
    }),
    z.object({
      type: z.literal('zip'),
      url: z.string().url(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ]),
  /** File in the package that states the license, and a phrase it must contain. */
  licenseFile: z.string(),
  licensePhrase: z.string(),
  groups: z.array(sourceGroupSchema).min(1),
  /** Words of file names that are dropped from display names (e.g. `building`). */
  dropWords: z.array(z.string()).default([]),
});
export type SourceDescription = z.infer<typeof sourceDescriptionSchema>;
