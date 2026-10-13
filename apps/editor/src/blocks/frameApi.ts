import type { AreaKind, Locale } from '@blockwerk/blocks';
import type { Theme } from '../state/settings';

/**
 * Contract between the block editor window and the Blockly page in its iframe. Blockly runs in
 * its own document so that dragging, menus and text fields keep working wherever the window is
 * docked, floated or detached. Data crosses the boundary as JSON strings.
 */
export interface BlockFrameOptions {
  readonly locale: Locale;
  readonly theme: Theme;
  readonly area: AreaKind | null;
  /** Serialized Blockly workspace (JSON). */
  readonly state: string;
  /** Called with the serialized workspace (JSON) after every change. */
  readonly onChange: (state: string) => void;
  /** Keyboard events inside Blockly that the editor may handle as global shortcuts. */
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

/** Control handle returned by {@link BlockFrameApi.mount}. */
export interface BlockFrameController {
  setLocale(locale: Locale): void;
  setTheme(theme: Theme): void;
  setArea(area: AreaKind | null): void;
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
