import type { AreaKind, Locale } from '@blockwerk/blocks';
import type { Theme } from '../state/settings';

/** A variable as the block page needs it. */
export interface FrameVariable {
  readonly id: string;
  readonly name: string;
}

/**
 * Objects and tags of the open scene for scene reference dropdowns ("go to [Object]"), with
 * translated fixed entries.
 */
export interface FrameReferences {
  readonly objects: readonly { readonly id: string; readonly name: string }[];
  readonly tags: readonly string[];
  /** Prefabs of the project (for "create [prefab] at"). */
  readonly prefabs: readonly { readonly id: string; readonly name: string }[];
  /** Built-in sounds and sound files (`value` is `builtin:<name>` or `audio:<asset ID>`). */
  readonly sounds: readonly { readonly value: string; readonly name: string }[];
  readonly labels: {
    readonly self: string;
    readonly any: string;
    readonly all: string;
    readonly loop: string;
    readonly mouse: string;
    readonly origin: string;
    readonly tag: string;
    readonly missing: string;
    readonly choosePrefab: string;
    readonly createVariable: string;
    readonly noVariables: string;
  };
}

/**
 * Contract between the block editor window and the Blockly page in its iframe. Blockly runs in
 * its own document so that dragging, menus and text fields keep working wherever the window is
 * docked, floated or detached. Data crosses the boundary as JSON strings and plain objects.
 */
export interface BlockFrameOptions {
  readonly locale: Locale;
  readonly theme: Theme;
  readonly area: AreaKind | null;
  /** Serialized Blockly workspace (JSON) or `null` when no script is open. */
  readonly state: string | null;
  readonly variables: readonly FrameVariable[];
  readonly references: FrameReferences;
  /** Called with the serialized workspace (JSON) after every change. */
  readonly onChange: (state: string) => void;
  /** Variables were created, renamed or deleted inside Blockly. */
  readonly onVariablesChange: (variables: FrameVariable[]) => void;
  /** The "Create variable" button of the palette was clicked. */
  readonly onCreateVariable: () => void;
  /** Keyboard events inside Blockly that the editor may handle as global shortcuts. */
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

/** Control handle returned by {@link BlockFrameApi.mount}. */
export interface BlockFrameController {
  setLocale(locale: Locale): void;
  setTheme(theme: Theme): void;
  setArea(area: AreaKind | null): void;
  /** Shows another script (or none). */
  load(state: string | null, variables: readonly FrameVariable[]): void;
  setVariables(variables: readonly FrameVariable[]): void;
  setReferences(references: FrameReferences): void;
  /** Lets the stacks of running hat blocks glow (play mode). */
  setRunning(hatIds: readonly string[]): void;
  /** Scrolls to a block and selects it. */
  reveal(blockId: string): void;
  dispose(): void;
}

/** API the Blockly page exposes as `window.blockwerkBlockFrame`. */
export interface BlockFrameApi {
  mount(options: BlockFrameOptions): BlockFrameController;
}

declare global {
  interface Window {
    blockwerkBlockFrame?: BlockFrameApi;
  }
}
