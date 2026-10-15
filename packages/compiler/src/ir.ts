import type { EventBinding, ValueType } from '@blockwerk/blocks';

/**
 * Intermediate representation (IR) of block scripts. The compiler never works on Blockly
 * objects; Blockly JSON is converted to IR first, JavaScript is generated from IR.
 * Functions with return values and local variables are part of the IR from the start,
 * even before the editor offers blocks for them.
 */

/** A value-producing node. */
export type IRExpression =
  | { readonly kind: 'literal'; readonly value: number | string | boolean }
  | {
      readonly kind: 'block';
      readonly blockId: string;
      readonly type: string;
      readonly args: Readonly<Record<string, IRExpression>>;
    }
  | { readonly kind: 'local'; readonly name: string }
  | { readonly kind: 'param'; readonly name: string }
  | {
      readonly kind: 'call';
      readonly functionId: string;
      readonly args: readonly IRExpression[];
      readonly blockId?: string;
    };

/** An action node. */
export type IRStatement =
  | {
      readonly kind: 'block';
      readonly blockId: string;
      readonly type: string;
      readonly args: Readonly<Record<string, IRExpression>>;
      readonly substacks: Readonly<Record<string, readonly IRStatement[]>>;
    }
  | {
      readonly kind: 'declareLocal';
      readonly name: string;
      readonly value: IRExpression;
      readonly blockId?: string;
    }
  | {
      readonly kind: 'setLocal';
      readonly name: string;
      readonly value: IRExpression;
      readonly blockId?: string;
    }
  | { readonly kind: 'return'; readonly value: IRExpression | null; readonly blockId?: string }
  | {
      readonly kind: 'call';
      readonly functionId: string;
      readonly args: readonly IRExpression[];
      readonly blockId?: string;
    };

/** A script: a hat block and the statements below it. */
export interface IRScript {
  /** Stable ID of the hat block. */
  readonly id: string;
  readonly event: EventBinding;
  readonly body: readonly IRStatement[];
}

/** A custom block (function) with typed parameters and an optional return value. */
export interface IRFunction {
  /** Unique key of the function: `<asset ID>/<ID of the defining block>`. */
  readonly id: string;
  /** Name shown to the user (for messages and the generated code's comments). */
  readonly name?: string;
  readonly params: readonly string[];
  /** Declared type of every parameter (same order as `params`); `any` if not given. */
  readonly paramTypes?: readonly ValueType[];
  /** Return type, or `null` for command blocks. */
  readonly returns: ValueType | null;
  /** Run without screen refresh (no implicit yields in loops). */
  readonly warp: boolean;
  readonly body: readonly IRStatement[];
  /**
   * Variables of the script that holds the definition, when it is not the script the function
   * is generated into (project-wide blocks): they decide where `variables` blocks read and write.
   */
  readonly variables?: readonly { id: string; name: string; scope: 'object' | 'game' }[];
  /** The definition lives in another script; its lines do not map to blocks of this one. */
  readonly external?: boolean;
}

/** All scripts and functions of one block-script asset. */
export interface IRProgram {
  readonly scripts: readonly IRScript[];
  readonly functions: readonly IRFunction[];
}
