import { focusPanel } from './layout/layoutController';
import { PANELS } from './layout/panels';
import { TOOL_KEYS, useEditor } from './state/editor';
import { activeSceneView } from './scene/sceneViews';

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
  /** Only handle shortcuts with Ctrl or Alt (used inside the block editor, where letters are typed). */
  readonly modifiersOnly?: boolean;
}

/**
 * Handles the global Unity-style shortcuts: Q W E R T Y tools, F frame selection, Ctrl+1–5 focus
 * windows, Alt+1–9 switch area tabs.
 */
export function handleShortcut(event: KeyboardEvent, options: ShortcutOptions = {}): void {
  if (event.defaultPrevented || event.repeat) return;
  const editor = useEditor.getState();
  const digit = /^Digit[1-9]$/.test(event.code) ? Number(event.code.slice(5)) : null;

  if (digit !== null && event.altKey && !event.ctrlKey && !event.metaKey) {
    const area = editor.areas[digit - 1];
    if (area) {
      event.preventDefault();
      editor.setActiveArea(area.id);
    }
    return;
  }
  if (digit !== null && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
    const panel = PANELS.find((definition) => definition.focusKey === String(digit));
    if (panel) {
      event.preventDefault();
      focusPanel(panel.id);
    }
    return;
  }
  if (options.modifiersOnly) return;
  if (event.ctrlKey || event.metaKey || event.altKey || editor.flying || isTyping(event.target)) {
    return;
  }
  const key = event.key.toLowerCase();
  const tool = TOOL_KEYS[key];
  if (tool) {
    event.preventDefault();
    editor.setTool(tool);
    return;
  }
  if (key === 'f') {
    event.preventDefault();
    activeSceneView()?.focus(editor.selectedObjectId);
  }
}

/** Installs the shortcuts on a window (the main window and every detached window). */
export function installShortcuts(view: Window): () => void {
  const onKeyDown = (event: KeyboardEvent): void => handleShortcut(event);
  view.addEventListener('keydown', onKeyDown);
  return () => view.removeEventListener('keydown', onKeyDown);
}
