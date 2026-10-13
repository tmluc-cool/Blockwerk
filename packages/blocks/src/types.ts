/** Languages of the user interface. */
export type Locale = 'de' | 'en';

/** All supported languages. */
export const LOCALES: readonly Locale[] = ['de', 'en'];

/** A text in every supported language. */
export type LocalizedText = Readonly<Record<Locale, string>>;

/**
 * Block shapes as in SPEC 7.2: hat (event), stack (command), reporter (round value),
 * boolean (pointed condition), c (control structure with body), cap (ends a script).
 */
export type BlockShape = 'hat' | 'stack' | 'reporter' | 'boolean' | 'c' | 'cap';

/** Data types of SPEC 7.3. */
export type ValueType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'list'
  | 'dictionary'
  | 'object'
  | 'asset'
  | 'vector3'
  | 'color';

/** Area kinds (SPEC 5.3). Both player tabs share the `player` kind. */
export type AreaKind = 'environment' | 'player' | 'npc' | 'items' | 'ui';

/** Palette categories (SPEC Appendix A). */
export type CategoryId =
  | 'events'
  | 'motion'
  | 'player'
  | 'camera'
  | 'looks'
  | 'character'
  | 'physics'
  | 'npc'
  | 'environment'
  | 'items'
  | 'sound'
  | 'effects'
  | 'control'
  | 'sensing'
  | 'operators'
  | 'variables'
  | 'ui'
  | 'scenes'
  | 'myBlocks'
  | 'debug';

/** Round slot for a number value. Other number reporters can be plugged in. */
export interface NumberSocket {
  readonly type: 'number';
  readonly default: number;
}

/** Round slot for a text value. */
export interface TextSocket {
  readonly type: 'string';
  readonly default: string;
}

/** Pointed slot for a condition. */
export interface BooleanSocket {
  readonly type: 'boolean';
}

/** Body of a C-shaped block. */
export interface StatementSocket {
  readonly type: 'statement';
}

/** Editable number written directly on the block (no plugging). */
export interface NumberField {
  readonly type: 'numberField';
  readonly default: number;
}

/** Editable text written directly on the block. */
export interface TextField {
  readonly type: 'textField';
  readonly default: string;
}

/** One choice of a dropdown field. */
export interface DropdownOption {
  readonly value: string;
  readonly text: LocalizedText;
}

/** Dropdown written on the block. */
export interface DropdownField {
  readonly type: 'dropdown';
  readonly options: readonly DropdownOption[];
  readonly default: string;
}

/** Any block input. Sockets accept other blocks, fields are edited in place. */
export type BlockInput =
  | NumberSocket
  | TextSocket
  | BooleanSocket
  | StatementSocket
  | NumberField
  | TextField
  | DropdownField;

/** Named inputs of a block. */
export type BlockInputs = Readonly<Record<string, BlockInput>>;

/** Inputs whose value is fixed in the block itself (no plugged block). */
export type FieldInput = NumberField | TextField | DropdownField;

/**
 * Arguments passed to `compile`: for every input the JavaScript code of its value.
 * Socket values are expressions, field values are literals, statement sockets are
 * placeholders that the compiler replaces with the compiled body.
 */
export type CompileArgs<I extends BlockInputs> = { readonly [K in keyof I]: string };

/** Raw values of the fields of a hat block. */
export type FieldValues<I extends BlockInputs> = {
  readonly [K in keyof I]: I[K] extends NumberField
    ? number
    : I[K] extends TextField | DropdownField
      ? string
      : string | number;
};

/** The event a hat block listens to. */
export interface EventBinding {
  readonly type: string;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
}

interface BlockDefinitionBase<I extends BlockInputs> {
  /** Stable, globally unique ID such as `motion.moveForward`. Never rename after release. */
  readonly id: string;
  readonly category: CategoryId;
  readonly inputs: I;
  /** Block label with `{input}` placeholders, per language. */
  readonly text: LocalizedText;
  /** Extra search words, per language. */
  readonly keywords?: Partial<Readonly<Record<Locale, readonly string[]>>>;
  /** Areas in which the block is shown at the top of the palette. */
  readonly areas?: readonly AreaKind[];
  /** Help text, per language. */
  readonly docs: LocalizedText;
  /** Block catalog version that introduced the block. */
  readonly since: number;
  /** Hidden blocks are not shown in the palette (e.g. literal shadow blocks). */
  readonly hidden?: boolean;
}

/** Hat block: starts a script when its event fires. */
export interface HatBlockDefinition<
  I extends BlockInputs = BlockInputs,
> extends BlockDefinitionBase<I> {
  readonly shape: 'hat';
  event(fields: FieldValues<I>): EventBinding;
}

/** Command block (stack, cap or C-shaped). `compile` returns JavaScript statements. */
export interface StatementBlockDefinition<
  I extends BlockInputs = BlockInputs,
> extends BlockDefinitionBase<I> {
  readonly shape: 'stack' | 'cap' | 'c';
  compile(args: CompileArgs<I>): string;
}

/** Value block (reporter or boolean). `compile` returns a JavaScript expression. */
export interface ValueBlockDefinition<
  I extends BlockInputs = BlockInputs,
> extends BlockDefinitionBase<I> {
  readonly shape: 'reporter' | 'boolean';
  readonly output: ValueType;
  compile(args: CompileArgs<I>): string;
}

/** Any block definition. */
export type BlockDefinition<I extends BlockInputs = BlockInputs> =
  HatBlockDefinition<I> | StatementBlockDefinition<I> | ValueBlockDefinition<I>;
