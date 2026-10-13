import { z } from 'zod';

/** Current version of every file format in a project. Bumped together with a migration. */
export const FORMAT_VERSION = 1;

/** A JSON value (what component fields and Blockly workspaces may contain). */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/** Stable ID: 12 lower-case letters and digits. */
export const idSchema = z.string().regex(/^[a-z0-9]{12}$/, 'invalid id');

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
/** Vector as `[x, y, z]`. */
export type Vec3 = z.infer<typeof vec3Schema>;

export const transformSchema = z.object({
  position: vec3Schema,
  /** Euler angles in degrees, applied in Unity order (Z, X, Y). */
  rotation: vec3Schema,
  scale: vec3Schema,
});
/** Local transform of an object relative to its parent. */
export type TransformData = z.infer<typeof transformSchema>;

export const componentSchema = z.object({
  id: idSchema,
  /** Component type as registered with `defineComponent`, e.g. `meshRenderer`. */
  type: z.string().min(1),
  enabled: z.boolean(),
  /** Field values; missing fields use the defaults of the component definition. */
  values: z.record(z.string(), jsonValueSchema),
});
/** A component attached to an object. */
export type ComponentData = z.infer<typeof componentSchema>;

/** Kinds of area root objects (SPEC 5.3). */
export const AREA_KINDS = [
  'environment',
  'player1',
  'player2',
  'npcs',
  'items',
  'ui',
  'custom',
] as const;
export const areaKindSchema = z.enum(AREA_KINDS);
/** Kind of an area root object. */
export type AreaKindData = z.infer<typeof areaKindSchema>;

export const sceneObjectSchema = z.object({
  /** Display name; `null` on built-in area roots means "use the translated default name". */
  name: z.string().nullable(),
  parent: idSchema.nullable(),
  /** Position among siblings (ascending). */
  order: z.number(),
  active: z.boolean(),
  tag: z.string(),
  layer: z.string(),
  static: z.boolean(),
  /** Set on area root objects (the area tabs). */
  area: areaKindSchema.optional(),
  /** Area tab color (CSS color), only on area roots. */
  color: z.string().optional(),
  transform: transformSchema,
  components: z.array(componentSchema),
});
/** An object of a scene (Unity: GameObject). */
export type SceneObjectData = z.infer<typeof sceneObjectSchema>;

export const environmentSchema = z.object({
  /** Strength of the ambient light from the sky. */
  ambientIntensity: z.number(),
  fog: z.object({ enabled: z.boolean(), near: z.number(), far: z.number() }),
});
/** Sky, ambient light and fog of a scene. The sun is a light component on an object. */
export type EnvironmentData = z.infer<typeof environmentSchema>;

export const sceneSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  environment: environmentSchema,
  objects: z.record(idSchema, sceneObjectSchema),
});
/** Contents of a `*.scene.json` file. */
export type SceneData = z.infer<typeof sceneSchema>;

/** Value types of block-script variables. */
export const VARIABLE_TYPES = ['number', 'string', 'boolean'] as const;
export const variableTypeSchema = z.enum(VARIABLE_TYPES);
export type VariableType = z.infer<typeof variableTypeSchema>;

export const variableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: variableTypeSchema,
  /** `object`: one value per object (can be shown in the inspector); `game`: shared by all scripts. */
  scope: z.enum(['object', 'game']),
  default: z.union([z.number(), z.string(), z.boolean()]),
  /** Show as a field of the block-script component in the inspector. */
  inspector: z.boolean(),
});
/** A variable of a block script. */
export type VariableData = z.infer<typeof variableSchema>;

export const blockScriptSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  variables: z.array(variableSchema),
  /** Blockly workspace serialization (`Blockly.serialization.workspaces.save`). */
  workspace: z.record(z.string(), jsonValueSchema),
});
/** Contents of a `*.blocks.json` file. */
export type BlockScriptData = z.infer<typeof blockScriptSchema>;

/** Asset types known in phase 1. */
export const ASSET_TYPES = ['scene', 'blockScript'] as const;
export const assetTypeSchema = z.enum(ASSET_TYPES);
export type AssetType = z.infer<typeof assetTypeSchema>;

export const metaSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  id: idSchema,
  type: assetTypeSchema,
  importSettings: z.record(z.string(), jsonValueSchema),
  /** License of imported assets (SPEC 6.3); `null` for own work. */
  license: z.string().nullable(),
});
/** Contents of a `*.meta.json` file next to every asset. */
export type MetaData = z.infer<typeof metaSchema>;

export const projectFileSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  name: z.string().min(1),
  /** Asset ID of the scene that opens first. */
  startScene: idSchema.nullable(),
});
/** Contents of `blockwerk.json`. */
export type ProjectFileData = z.infer<typeof projectFileSchema>;

export const tagsAndLayersSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  /** User tags (Unity: Tags). `Untagged` and `Player` always exist and are not listed. */
  tags: z.array(z.string().min(1)),
  /** User layers. `Default` always exists and is not listed. */
  layers: z.array(z.string().min(1)),
});
/** Contents of `Einstellungen/tags-und-ebenen.json`. */
export type TagsAndLayersData = z.infer<typeof tagsAndLayersSchema>;
