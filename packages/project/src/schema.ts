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
  /** Part of a save slot (game-scoped variables only). Optional so older files stay unchanged. */
  saved: z.boolean().optional(),
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

/** Something a UI button does when it is clicked. */
export const uiActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sendMessage'), message: z.string() }),
  /** Shows a canvas that was opened by hand (`UI Canvas` with visibility "manual"). */
  z.object({ type: z.literal('showUi'), ui: z.string() }),
  z.object({ type: z.literal('hideUi'), ui: z.string() }),
  z.object({ type: z.literal('loadScene'), scene: z.string(), spawn: z.string() }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('restart') }),
  z.object({ type: z.literal('saveGame'), slot: z.number().int().min(1).max(3) }),
  z.object({ type: z.literal('loadGame'), slot: z.number().int().min(1).max(3) }),
  z.object({ type: z.literal('quit') }),
]);
/** An action of a UI button. */
export type UiAction = z.infer<typeof uiActionSchema>;

/** What a UI element shows: a number between 0 and its maximum. */
export const uiBindingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('variable'), variable: z.string() }),
  z.object({ kind: z.literal('health') }),
  z.object({ kind: z.literal('stamina') }),
  z.object({ kind: z.literal('item'), item: z.string() }),
  z.object({ kind: z.literal('loading') }),
]);
/** The data a UI element is bound to. */
export type UiBinding = z.infer<typeof uiBindingSchema>;

/** Player settings a slider, toggle or drop-down can change. */
export const UI_SETTINGS = [
  'masterVolume',
  'musicVolume',
  'effectsVolume',
  'voicesVolume',
  'mouseSensitivity',
  'fullscreen',
  'graphicsLevel',
] as const;
export const uiSettingSchema = z.enum(UI_SETTINGS);
/** A player setting. */
export type UiSetting = z.infer<typeof uiSettingSchema>;

/** Kinds of UI elements (SPEC 8.12). */
export const UI_ELEMENT_TYPES = [
  'panel',
  'text',
  'image',
  'bar',
  'button',
  'slider',
  'toggle',
  'dropdown',
  'hint',
  'crosshair',
  'inventory',
  'dialog',
  'keybindings',
] as const;
export const uiElementTypeSchema = z.enum(UI_ELEMENT_TYPES);
/** A kind of UI element. */
export type UiElementType = z.infer<typeof uiElementTypeSchema>;

const uiPairSchema = z.tuple([z.number(), z.number()]);

/**
 * An element of a UI canvas. The rectangle works like Unity's RectTransform: the anchors
 * (0..1 of the parent, y down) give two corners, the offsets move them in reference pixels, the
 * pivot is where scaling and rotation happen.
 */
export interface UiElement {
  id: string;
  name: string;
  type: UiElementType;
  visible: boolean;
  anchorMin: [number, number];
  anchorMax: [number, number];
  pivot: [number, number];
  offsetMin: [number, number];
  offsetMax: [number, number];
  /** Text of text and button elements; `{value}` is replaced by the bound value. */
  text?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  /** CSS color of the text or, for bars, of the fill. */
  color?: string;
  /** CSS color of the background; empty for none. */
  background?: string;
  opacity?: number;
  /** Image asset ID (image elements). */
  image?: string | null;
  bind?: UiBinding;
  /** Value that counts as full for bars and sliders bound to a variable or an item. */
  max?: number;
  min?: number;
  step?: number;
  setting?: UiSetting;
  actions?: UiAction[];
  columns?: number;
  children?: UiElement[];
}

export const uiElementSchema: z.ZodType<UiElement> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string(),
    type: uiElementTypeSchema,
    visible: z.boolean(),
    anchorMin: uiPairSchema,
    anchorMax: uiPairSchema,
    pivot: uiPairSchema,
    offsetMin: uiPairSchema,
    offsetMax: uiPairSchema,
    text: z.string().optional(),
    fontSize: z.number().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    color: z.string().optional(),
    background: z.string().optional(),
    opacity: z.number().optional(),
    image: z.string().nullable().optional(),
    bind: uiBindingSchema.optional(),
    max: z.number().optional(),
    min: z.number().optional(),
    step: z.number().optional(),
    setting: uiSettingSchema.optional(),
    actions: z.array(uiActionSchema).optional(),
    columns: z.number().optional(),
    children: z.array(uiElementSchema).optional(),
  }),
);

export const uiSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  /** Size the offsets and font sizes refer to; the canvas scales with the screen. */
  referenceWidth: z.number().positive(),
  referenceHeight: z.number().positive(),
  elements: z.array(uiElementSchema),
});
/** Contents of a `*.ui.json` file: one UI canvas (SPEC 8.12). */
export type UiData = z.infer<typeof uiSchema>;

/** One player's state in a save slot. */
export const savedPlayerSchema = z.object({
  position: vec3Schema,
  /** Rotation around the up axis, in degrees. */
  yaw: z.number(),
  items: z.record(z.string(), z.number()),
  health: z.object({ current: z.number(), max: z.number() }).nullable(),
  /** Stamina in percent; `null` if the player has none. */
  stamina: z.number().nullable(),
});
/** A player in a save slot. */
export type SavedPlayer = z.infer<typeof savedPlayerSchema>;

export const saveSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  slot: z.number().int().min(1).max(3),
  /** Asset ID of the scene to continue in. */
  scene: z.string(),
  sceneName: z.string(),
  /** When the game was saved (ISO 8601). */
  savedAt: z.string(),
  /** Game variables marked "saved". */
  vars: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  players: z.array(savedPlayerSchema),
});
/** A save slot (SPEC 8.14). */
export type SaveData = z.infer<typeof saveSchema>;

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
  'ui',
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
