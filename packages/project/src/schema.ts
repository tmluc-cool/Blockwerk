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

/**
 * A changed value of a prefab instance or variant. `object` is the ID of the object inside the
 * prefab; `path` names the value: `name`, `active`, `tag`, `layer`, `static`,
 * `transform.position`, `transform.rotation`, `transform.scale`,
 * `component:<component ID>:enabled` or `component:<component ID>:<field>`.
 */
export const prefabOverrideSchema = z.object({
  object: idSchema,
  path: z.string().min(1),
  value: jsonValueSchema,
});
/** A changed value of a prefab instance or variant. */
export type PrefabOverride = z.infer<typeof prefabOverrideSchema>;

export const prefabLinkSchema = z.object({
  /** Asset ID of the prefab. */
  asset: idSchema,
  /** ID of the corresponding object inside the prefab. */
  object: idSchema,
  /** Only on the root object of an instance: its changed values. */
  overrides: z.array(prefabOverrideSchema).optional(),
});
/** Marks an object as part of a prefab instance (Unity: prefab instance, shown blue). */
export type PrefabLinkData = z.infer<typeof prefabLinkSchema>;

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
  /** Set on every object of a prefab instance. */
  prefab: prefabLinkSchema.optional(),
});
/** An object of a scene (Unity: GameObject). */
export type SceneObjectData = z.infer<typeof sceneObjectSchema>;

export const environmentSchema = z.object({
  /** Strength of the ambient light from the sky. */
  ambientIntensity: z.number(),
  fog: z.object({ enabled: z.boolean(), near: z.number(), far: z.number() }),
  /** Gravity in m/s² (default Earth gravity straight down). */
  gravity: vec3Schema.optional(),
  /**
   * Day cycle: hour of the day, seconds a day takes (0 = the clock stands still) and a compass
   * offset of the sun's path. Without it the sun object's rotation places the sun. Optional so
   * existing scenes stay byte-identical.
   */
  sky: z
    .object({
      timeOfDay: z.number().min(0).max(24),
      dayLength: z.number().min(0),
      sunAzimuth: z.number(),
    })
    .optional(),
  /**
   * Navigation mesh settings (Unity: Navigation window → Bake): the size of the agents the mesh
   * is made for. `cellSize` 0 picks it automatically. Optional so existing scenes stay identical.
   */
  navigation: z
    .object({
      agentRadius: z.number().min(0.05),
      agentHeight: z.number().min(0.5),
      maxClimb: z.number().min(0),
      maxSlope: z.number().min(0).max(80),
      cellSize: z.number().min(0),
    })
    .optional(),
  /** Weather at the start of the scene. */
  weather: z
    .object({
      type: z.enum(['clear', 'rain', 'snow', 'fog']),
      intensity: z.number().min(0).max(1),
      windSpeed: z.number().min(0),
      windDirection: z.number(),
    })
    .optional(),
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

export const prefabSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  /** For prefab variants: asset ID of the base prefab. */
  base: idSchema.nullable(),
  /** ID of the root object (for variants: the root of the base). */
  root: idSchema,
  /** Objects like in scenes. Variants list only objects they add. */
  objects: z.record(idSchema, sceneObjectSchema),
  /** For variants: values changed against the base. */
  overrides: z.array(prefabOverrideSchema),
});
/** Contents of a `*.prefab.json` file. */
export type PrefabData = z.infer<typeof prefabSchema>;

/** A condition on a dialog answer. */
export const dialogConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hasItem'), item: z.string(), count: z.number().int().min(1) }),
  z.object({
    type: z.literal('variable'),
    /** ID of a game variable. */
    variable: z.string(),
    op: z.enum(['==', '!=', '>', '<', '>=', '<=']),
    value: z.union([z.number(), z.string(), z.boolean()]),
  }),
]);
/** A condition on a dialog answer: it only appears if this holds. */
export type DialogCondition = z.infer<typeof dialogConditionSchema>;

/** Something a dialog does when a line is shown or an answer is chosen. */
export const dialogActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setVariable'),
    variable: z.string(),
    value: z.union([z.number(), z.string(), z.boolean()]),
  }),
  z.object({ type: z.literal('addItem'), item: z.string(), count: z.number().int().min(1) }),
  z.object({ type: z.literal('removeItem'), item: z.string(), count: z.number().int().min(1) }),
  z.object({ type: z.literal('sendMessage'), message: z.string(), target: z.string() }),
  z.object({ type: z.literal('startTimer'), name: z.string(), seconds: z.number().min(0) }),
  z.object({ type: z.literal('changeState'), target: z.string(), state: z.string() }),
]);
/** An action of a dialog. */
export type DialogAction = z.infer<typeof dialogActionSchema>;

export const dialogAnswerSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  /** The node the answer leads to; `null` ends the dialog. */
  next: z.string().nullable(),
  condition: dialogConditionSchema.optional(),
  actions: z.array(dialogActionSchema).optional(),
});
/** An answer of a dialog line. */
export type DialogAnswer = z.infer<typeof dialogAnswerSchema>;

export const dialogNodeSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  /** Without answers the line ends the dialog (or continues with `next`). */
  answers: z.array(dialogAnswerSchema),
  /** For lines without answers: the line that follows. */
  next: z.string().nullable().optional(),
  /** Done when the line is shown. */
  actions: z.array(dialogActionSchema).optional(),
  /** Position of the card in the Dialog editor. */
  x: z.number().optional(),
  y: z.number().optional(),
});
/** One line of a dialog: who says what, with answers. */
export type DialogNode = z.infer<typeof dialogNodeSchema>;

export const dialogSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  /** The node the dialog starts with. */
  start: z.string(),
  nodes: z.record(z.string(), dialogNodeSchema),
});
/** Contents of a `*.dialog.json` file (SPEC 8.8: Dialog editor). */
export type DialogData = z.infer<typeof dialogSchema>;

/** Settings of an imported model (SPEC 6.3), stored in its meta file. */
export const modelImportSettingsSchema = z.object({
  /** Uniform scale to meters. */
  scale: z.number().positive(),
  /** `bottom`: bottom center at the origin (library convention); `center`; `original`. */
  pivot: z.enum(['bottom', 'center', 'original']),
  /** Add a box collider of the model's size when it is placed. */
  generateCollider: z.boolean(),
  /** Turns the model around the vertical axis in degrees (VRM 0.x faces backwards). */
  yaw: z.number().optional(),
  /** Humanoid bones the automatic recognition missed: standard bone name → node name. */
  boneMap: z.record(z.string(), z.string()).optional(),
  /** Clip names for standard animation states: state → clip name. */
  animationMap: z.record(z.string(), z.string()).optional(),
});
/** Import settings of a model. */
export type ModelImportSettings = z.infer<typeof modelImportSettingsSchema>;

/** Import settings of new models. */
export const DEFAULT_MODEL_IMPORT_SETTINGS: ModelImportSettings = {
  scale: 1,
  pivot: 'bottom',
  generateCollider: true,
};

/** Asset types. Models (GLB), images (PNG), terrains and sounds are binary files; all others are JSON. */
export const ASSET_TYPES = [
  'scene',
  'blockScript',
  'prefab',
  'dialog',
  'model',
  'image',
  'terrain',
  'audio',
] as const;
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
  /** Graphics level a game starts with (`low` … `ultra`); players can switch it. Optional. */
  graphicsLevel: z.enum(['low', 'medium', 'high', 'ultra']).optional(),
});
/** Contents of `blockwerk.json`. */
export type ProjectFileData = z.infer<typeof projectFileSchema>;

export const tagsAndLayersSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  /** User tags (Unity: Tags). `Untagged` and `Player` always exist and are not listed. */
  tags: z.array(z.string().min(1)),
  /** User layers. `Default` always exists and is not listed. */
  layers: z.array(z.string().min(1)),
  /**
   * Physics layer matrix (Unity: Layer Collision Matrix): pairs of layers that do not collide.
   * Missing means every layer collides with every layer. Optional so existing projects stay
   * byte-identical when saved.
   */
  ignoredCollisions: z.array(z.tuple([z.string().min(1), z.string().min(1)])).optional(),
});
/** Contents of `Einstellungen/tags-und-ebenen.json`. */
export type TagsAndLayersData = z.infer<typeof tagsAndLayersSchema>;
