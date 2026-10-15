import type { DockviewApi } from 'dockview-react';
import { create } from 'zustand';
import { useConsole } from '../state/console';
import { t } from '../state/settings';
import { panelDefinition } from './panels';
import type { PanelId } from './panels';
import { applyPreset } from './presets';
import type { LayoutPreset } from './presets';
import { deleteNamedLayout, loadNamedLayouts, saveNamedLayout } from './storage';
import type { NamedLayout } from './storage';

/** Page loaded into detached windows; relative so it works in the browser and in Electron. */
export const POPOUT_URL = 'popout.html';

interface LayoutState {
  api: DockviewApi | null;
  named: NamedLayout[];
}

/** The docking API and the list of saved layouts, for menus and shortcuts. */
export const useLayout = create<LayoutState>()(() => ({
  api: null,
  named: loadNamedLayouts(),
}));

/** Registers the docking API once the layout is ready. */
export function setLayoutApi(api: DockviewApi | null): void {
  useLayout.setState({ api });
}

/** Sets every tab title to the current language. */
export function retitlePanels(): void {
  const api = useLayout.getState().api;
  if (!api) return;
  for (const panel of api.panels) {
    const definition = panelDefinition(panel.id);
    if (definition) panel.api.setTitle(t(definition.titleKey));
  }
}

/** Opens a window (or brings it to the front if it is already open). */
export function openPanel(id: PanelId): void {
  const api = useLayout.getState().api;
  const definition = panelDefinition(id);
  if (!api || !definition) return;
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  // The editors for dialogs and UI need room: they open next to the Scene view, not in the small
  // bottom group the Project window lives in.
  const wide = id === 'dialogEditor' || id === 'uiEditor';
  const group = (wide ? api.getPanel('scene')?.group : undefined) ?? api.activeGroup;
  api.addPanel({
    id,
    component: id,
    title: t(definition.titleKey),
    ...(group ? { position: { referenceGroup: group, direction: 'within' } } : {}),
  });
}

/** Opens a window and moves keyboard focus into it (Ctrl+1 … Ctrl+5). */
export function focusPanel(id: PanelId): void {
  openPanel(id);
  const panel = useLayout.getState().api?.getPanel(id);
  const element = panel?.view.content.element;
  const target =
    element?.querySelector<HTMLElement>('[tabindex], input, button, canvas') ?? element;
  target?.focus({ preventScroll: true });
}

/** Replaces the layout with a built-in one. */
export function applyLayoutPreset(preset: LayoutPreset): void {
  const api = useLayout.getState().api;
  if (!api) return;
  applyPreset(api, preset, t);
}

/** Restores the default layout (Window > Layouts > Restore Default Layout). */
export function resetLayout(): void {
  applyLayoutPreset('standard');
  useConsole.getState().log('info', 'layout.restoredDefault');
}

/** Saves the current layout under a name. */
export function saveLayoutAs(name: string): void {
  const api = useLayout.getState().api;
  const trimmed = name.trim();
  if (!api || !trimmed) return;
  useLayout.setState({ named: saveNamedLayout(trimmed, api.toJSON()) });
  useConsole.getState().log('info', 'layout.saved', { name: trimmed });
}

/** Loads a layout saved under a name. */
export function loadNamedLayout(name: string): void {
  const api = useLayout.getState().api;
  const layout = useLayout.getState().named.find((item) => item.name === name);
  if (!api || !layout) return;
  api.fromJSON(layout.layout);
  retitlePanels();
}

/** Deletes a layout saved under a name. */
export function deleteLayout(name: string): void {
  useLayout.setState({ named: deleteNamedLayout(name) });
}
