import {
  createEmpty,
  deleteSelection,
  duplicateSelection,
  focusSelection,
  renameSelection,
} from './document/actions';
import { focusPanel } from './layout/layoutController';
import { useBrush } from './library/brush';
import { PANELS } from './layout/panels';
import { areaTabIds } from './chrome/AreaTabs';
import { redo, saveProject, undo } from './state/document';
import { TOOL_KEYS, useEditor } from './state/editor';
import { pause, step, stepBlock, togglePlay } from './state/play';

/**
 * Whether keyboard input currently goes to a text field. Uses duck typing because events can
 * come from detached windows and the block editor frame (other JavaScript realms).
 */
function isTyping(target: EventTarget | null): boolean {
  const element = target as Partial<Element> | null;
  if (!element || typeof element.closest !== 'function') return false;
  return element.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

/** Options for {@link handleShortcut}. */
export interface ShortcutOptions {
  /**
   * Inside the block editor: only global commands (save, play, windows, areas); Blockly
   * handles its own undo, copy and delete.
   */
  readonly modifiersOnly?: boolean;
}

function run(event: KeyboardEvent, action: () => void): void {
  event.preventDefault();
  action();
}

/**
 * Handles the global Unity-style shortcuts: Q W E R T Y tools, F frame selection, Ctrl+1–5 focus
 * windows, Alt+1–9 switch area tabs, Ctrl+S save, Ctrl+Z/Y undo/redo, Ctrl+D duplicate,
 * Delete, F2 rename, Ctrl+Shift+N new object, Ctrl+Shift+F search, Ctrl+P play, Ctrl+Shift+P pause, Ctrl+Alt+P step.
 */
export function handleShortcut(event: KeyboardEvent, options: ShortcutOptions = {}): void {
  if (event.defaultPrevented) return;
  const editor = useEditor.getState();
  const ctrl = event.ctrlKey || event.metaKey;
  const digit = /^Digit[1-9]$/.test(event.code) ? Number(event.code.slice(5)) : null;
  const key = event.key.toLowerCase();

  if (event.key === 'Escape' && useBrush.getState().source && !isTyping(event.target)) {
    run(event, () => useBrush.getState().set({ source: null }));
    return;
  }
  if (digit !== null && event.altKey && !ctrl) {
    const area = areaTabIds()[digit - 1];
    if (area) run(event, () => editor.setActiveArea(area));
    return;
  }
  if (ctrl && key === 'p' && !event.repeat) {
    if (event.altKey) run(event, step);
    else if (event.shiftKey) run(event, pause);
    else run(event, togglePlay);
    return;
  }
  if (event.key === 'F10' && !ctrl && !event.altKey && !event.repeat) {
    run(event, stepBlock);
    return;
  }
  if (event.repeat && !(ctrl && (key === 'z' || key === 'y'))) return;
  if (digit !== null && ctrl && !event.altKey && !event.shiftKey) {
    const panel = PANELS.find((definition) => definition.focusKey === String(digit));
    if (panel) run(event, () => focusPanel(panel.id));
    return;
  }
  if (ctrl && event.shiftKey && !event.altKey && key === 'f') {
    run(event, () => focusPanel('search'));
    return;
  }
  if (ctrl && key === 's') {
    run(event, () => void saveProject());
    return;
  }
  if (options.modifiersOnly || isTyping(event.target)) return;
  if (ctrl && !event.altKey) {
    if (key === 'z' && !event.shiftKey) run(event, undo);
    else if (key === 'y' || (key === 'z' && event.shiftKey)) run(event, redo);
    else if (key === 'd') run(event, duplicateSelection);
    else if (key === 'n' && event.shiftKey) run(event, () => createEmpty());
    return;
  }
  if (event.altKey || editor.flying) return;
  if (event.key === 'Delete' || (event.key === 'Backspace' && event.metaKey)) {
    run(event, deleteSelection);
    return;
  }
  if (event.key === 'F2') {
    run(event, renameSelection);
    return;
  }
  const tool = TOOL_KEYS[key];
  if (tool) {
    run(event, () => editor.setTool(tool));
    return;
  }
  if (key === 'f') run(event, focusSelection);
}

/** Installs the shortcuts on a window (the main window and every detached window). */
export function installShortcuts(view: Window): () => void {
  const onKeyDown = (event: KeyboardEvent): void => handleShortcut(event);
  view.addEventListener('keydown', onKeyDown);
  return () => view.removeEventListener('keydown', onKeyDown);
}
