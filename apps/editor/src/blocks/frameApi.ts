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
  /** Dialogs of the project (for "start dialog"). */
  readonly dialogs: readonly { readonly id: string; readonly name: string }[];
  /** Scenes of the project (for "load scene"). */
  readonly scenes: readonly { readonly id: string; readonly name: string }[];
  /** UI canvases of the project (for "show UI"). */
  readonly uis: readonly { readonly id: string; readonly name: string }[];
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
    readonly chooseDialog: string;
    readonly chooseScene: string;
    readonly chooseUi: string;
    readonly createVariable: string;
    readonly noVariables: string;
    readonly makeBlock: string;
    readonly editBlock: string;
    readonly goToDefinition: string;
    readonly extractBlock: string;
    readonly missingBlock: string;
    readonly noInput: string;
    readonly quickInsert: string;
  };
}

/** A parameter of a custom block. */
export interface FrameParam {
  readonly name: string;
  /** `any`, `number`, `string`, `boolean`, `list` or `dictionary`. */
  readonly type: string;
}

/** A custom block (SPEC 7.6) that scripts of the open project can call. */
export interface FrameCustomBlock {
  /** ID of the definition block. */
  readonly fn: string;
  /** Asset ID of the script that holds the definition; empty for the open script. */
  readonly library: string;
  readonly name: string;
  readonly kind: 'command' | 'value' | 'condition';
  readonly params: readonly FrameParam[];
  /** Type of the result (value blocks). */
  readonly returns: string;
}

/** What the "Make a block" dialog edits: everything about a definition. */
export interface CustomBlockSpec {
  readonly kind: 'command' | 'value' | 'condition';
  readonly name: string;
  readonly params: readonly FrameParam[];
  readonly returns: string;
  /** Run without screen refresh. */
  readonly warp: boolean;
  /** `project`: all block scripts may use it. */
  readonly scope: 'script' | 'project';
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
  /** Custom blocks the open script can call (its own and the project-wide ones). */
  readonly customBlocks: readonly FrameCustomBlock[];
  /** The "Make a block" button of the palette was clicked. */
  readonly onMakeBlock: () => void;
  /** "Edit custom block" on a definition block. */
  readonly onEditBlock: (blockId: string, spec: CustomBlockSpec) => void;
  /** "Go to definition" on a call block (`library` is empty for the open script). */
  readonly onGoToDefinition: (library: string, fn: string) => void;
  /** Asks for the name of a new custom block (resolves to `null` when cancelled). */
  readonly askName: () => Promise<string | null>;
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
  /** The custom blocks that exist now; calls in the workspace follow their definitions. */
  setCustomBlocks(blocks: readonly FrameCustomBlock[]): void;
  /** Puts a new custom block definition into the visible part of the workspace. */
  createDefinition(spec: CustomBlockSpec): void;
  /** Changes a definition block (name, inputs, result type, options). */
  updateDefinition(blockId: string, spec: CustomBlockSpec): void;
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
