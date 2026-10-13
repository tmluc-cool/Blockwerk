import { focusPanel } from './layout/layoutController';
import { PANELS } from './layout/panels';
import { TOOL_KEYS, useEditor } from './state/editor';
import { activeSceneView } from './scene/sceneViews';

/** Whether keyboard input currently goes to a text field or the block editor. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return true;
  return target.closest('.blocklyWidgetDiv, .blocklyDropDownDiv, .block-editor') !== null;
}

/**
 * Global Unity-style shortcuts: Q W E R T Y tools, F frame selection, Ctrl+1–5 focus windows,
 * Alt+1–9 switch area tabs. Installed on the main window and every detached window.
 */
export function installShortcuts(view: Window): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.repeat) return;
    const editor = useEditor.getState();
    if (event.altKey && !event.ctrlKey && !event.metaKey && /^Digit[1-9]$/.test(event.code)) {
      const index = Number(event.code.slice(5)) - 1;
      const area = editor.areas[index];
      if (area) {
        event.preventDefault();
        editor.setActiveArea(area.id);
      }
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      /^Digit[1-9]$/.test(event.code)
    ) {
      const panel = PANELS.find((definition) => definition.focusKey === event.code.slice(5));
      if (panel) {
        event.preventDefault();
        focusPanel(panel.id);
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || editor.flying || isTyping(event.target))
      return;
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
  };
  view.addEventListener('keydown', onKeyDown);
  return () => view.removeEventListener('keydown', onKeyDown);
}
