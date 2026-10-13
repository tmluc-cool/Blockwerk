import type { JsonValue, Vec3 } from '@blockwerk/project';
import type { LocalizedText } from '../text';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';

/** Units shown next to number fields in the inspector. */
export type FieldUnit = 'meters' | 'degrees' | 'seconds' | 'percent';

interface FieldBase {
  /** Label in the inspector. */
  readonly text: LocalizedText;
  /** Inspector group, e.g. `material` (shown as its own foldout). */
  readonly group?: string;
}

/** Number field. */
export interface NumberFieldDefinition extends FieldBase {
  readonly type: 'number';
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: FieldUnit;
}

/** Checkbox. */
export interface BooleanFieldDefinition extends FieldBase {
  readonly type: 'boolean';
  readonly default: boolean;
}

/** Text field. */
export interface StringFieldDefinition extends FieldBase {
  readonly type: 'string';
  readonly default: string;
}

/** Color as `#rrggbb`. */
export interface ColorFieldDefinition extends FieldBase {
  readonly type: 'color';
  readonly default: string;
}

/** Three numbers (position, size, …). */
export interface VectorFieldDefinition extends FieldBase {
  readonly type: 'vector3';
  readonly default: Vec3;
  readonly unit?: FieldUnit;
}

/** One choice of an enum field. */
export interface EnumOption {
  readonly value: string;
  readonly text: LocalizedText;
}

/** Dropdown. */
export interface EnumFieldDefinition extends FieldBase {
  readonly type: 'enum';
  readonly default: string;
  readonly options: readonly EnumOption[];
}

/** Asset kinds an asset field can point to. */
export type AssetFieldType = 'blockScript' | 'model';

/** Reference to an asset by its stable ID (models also by `library:<id>`). */
export interface AssetFieldDefinition extends FieldBase {
  readonly type: 'asset';
  readonly default: null;
  readonly assetType: AssetFieldType;
}

/** Any inspector field of a component. */
export type FieldDefinition =
  | NumberFieldDefinition
  | BooleanFieldDefinition
  | StringFieldDefinition
  | ColorFieldDefinition
  | VectorFieldDefinition
  | EnumFieldDefinition
  | AssetFieldDefinition;

/** Field definitions of a component by field name. */
export type FieldDefinitions = Readonly<Record<string, FieldDefinition>>;

/** Runtime value of a field. */
export type FieldValue<F extends FieldDefinition> = F extends NumberFieldDefinition
  ? number
  : F extends BooleanFieldDefinition
    ? boolean
    : F extends VectorFieldDefinition
      ? Vec3
      : F extends AssetFieldDefinition
        ? string | null
        : string;

/** All field values of a component. */
export type FieldValues<F extends FieldDefinitions> = { [K in keyof F]: FieldValue<F[K]> };

/** Categories of the "Add Component" menu (SPEC 8.15). */
export type ComponentCategory = 'rendering' | 'physics' | 'logic' | 'audio' | 'gameplay';

/** What a component instance can access when it is created. */
export interface ComponentContext {
  readonly object: GameObject;
  readonly world: World;
}

/** The live part of a component on an object. */
export interface ComponentBehavior<F extends FieldDefinitions = FieldDefinitions> {
  /** Applies new field values (called after creation and whenever values change). */
  apply(values: FieldValues<F>): void;
  /** Called when the component is enabled or disabled. */
  setEnabled?(enabled: boolean): void;
  /** Frees resources and removes everything the component added to the object. */
  destroy(): void;
}

/** Definition of a component type: the single source for inspector, runtime and docs. */
export interface ComponentDefinition<F extends FieldDefinitions = FieldDefinitions> {
  /** Stable type name stored in scene files, e.g. `meshRenderer`. */
  readonly type: string;
  readonly category: ComponentCategory;
  /** Name in the inspector and the "Add Component" menu. */
  readonly text: LocalizedText;
  /** Help text. */
  readonly docs: LocalizedText;
  /** Name of the Unity counterpart for the docs. */
  readonly unity?: string;
  readonly fields: F;
  /** At most one component of this type per object. */
  readonly unique?: boolean;
  /** Search words for "Add Component". */
  readonly keywords?: Partial<Readonly<Record<'de' | 'en', readonly string[]>>>;
  create(context: ComponentContext, values: FieldValues<F>): ComponentBehavior<F>;
}

/** Defines a component type. Returns the definition unchanged after basic validation. */
export function defineComponent<const F extends FieldDefinitions>(
  definition: ComponentDefinition<F>,
): ComponentDefinition<F> {
  if (!/^[a-z][A-Za-z0-9]*$/.test(definition.type)) {
    throw new Error(`Component type "${definition.type}" must be camelCase.`);
  }
  for (const [name, field] of Object.entries(definition.fields)) {
    if (field.type === 'enum' && !field.options.some((option) => option.value === field.default)) {
      throw new Error(`Component "${definition.type}": default of "${name}" is not an option.`);
    }
  }
  return definition;
}

/** Whether a JSON value is valid for a field. */
function isValidValue(field: FieldDefinition, value: JsonValue | undefined): boolean {
  switch (field.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
    case 'color':
      return typeof value === 'string';
    case 'enum':
      return typeof value === 'string' && field.options.some((option) => option.value === value);
    case 'vector3':
      return (
        Array.isArray(value) &&
        value.length === 3 &&
        value.every((item) => typeof item === 'number')
      );
    case 'asset':
      return value === null || typeof value === 'string';
  }
}

/** Resolves stored values against the definition: missing or invalid values become defaults. */
export function resolveValues<F extends FieldDefinitions>(
  definition: ComponentDefinition<F>,
  stored: Readonly<Record<string, JsonValue>>,
): FieldValues<F> {
  const values: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(definition.fields)) {
    const value = stored[name];
    values[name] = isValidValue(field, value) ? value : field.default;
  }
  return values as FieldValues<F>;
}
