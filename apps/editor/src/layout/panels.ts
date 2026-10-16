import type { TranslationKey } from '../i18n';

/** IDs of all dockable windows. Each window exists at most once (its ID is its component). */
export type PanelId =
  | 'figure'
  | 'hierarchy'
  | 'scene'
  | 'game'
  | 'blockEditor'
  | 'dialogEditor'
  | 'uiEditor'
  | 'search'
  | 'inspector'
  | 'lighting'
  | 'navigation'
  | 'profiler'
  | 'buildSettings'
  | 'ai'
  | 'project'
  | 'assetLibrary'
  | 'console';

/** Static description of a dockable window. */
export interface PanelDefinition {
  readonly id: PanelId;
  readonly titleKey: TranslationKey;
  /** Ctrl+number shortcut (Unity: Ctrl+1 … Ctrl+5), if any. */
  readonly focusKey?: string;
}

/** All dockable windows in the order of the Window menu. */
export const PANELS: readonly PanelDefinition[] = [
  { id: 'scene', titleKey: 'panel.scene', focusKey: '1' },
  { id: 'game', titleKey: 'panel.game', focusKey: '2' },
  { id: 'inspector', titleKey: 'panel.inspector', focusKey: '3' },
  { id: 'hierarchy', titleKey: 'panel.hierarchy', focusKey: '4' },
  { id: 'project', titleKey: 'panel.project', focusKey: '5' },
  { id: 'blockEditor', titleKey: 'panel.blockEditor' },
  { id: 'dialogEditor', titleKey: 'panel.dialogEditor' },
  { id: 'uiEditor', titleKey: 'panel.uiEditor' },
  { id: 'search', titleKey: 'panel.search' },
  { id: 'figure', titleKey: 'panel.figure' },
  { id: 'lighting', titleKey: 'panel.lighting' },
  { id: 'navigation', titleKey: 'panel.navigation' },
  { id: 'profiler', titleKey: 'panel.profiler' },
  { id: 'buildSettings', titleKey: 'panel.buildSettings' },
  { id: 'ai', titleKey: 'panel.ai' },
  { id: 'assetLibrary', titleKey: 'panel.assetLibrary' },
  { id: 'console', titleKey: 'panel.console' },
];

/** Looks up a window definition. */
export function panelDefinition(id: string): PanelDefinition | undefined {
  return PANELS.find((panel) => panel.id === id);
}
