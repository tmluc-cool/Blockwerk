import type { DockviewApi } from 'dockview-react';
import type { Translate } from '../i18n';
import { panelDefinition } from './panels';
import type { PanelId } from './panels';

/** Built-in layouts (Unity: Layout dropdown). */
export type LayoutPreset = 'standard' | 'largeBlocks';

type Placement =
  | { referencePanel: PanelId; direction: 'within' | 'left' | 'right' | 'above' | 'below' }
  | { direction: 'left' | 'right' | 'above' | 'below' }
  | null;

interface PlacementStep {
  readonly id: PanelId;
  readonly position: Placement;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Standard layout as in SPEC 5.2 / Unity's default: Hierarchy left, Scene/Game/Block Editor
 * as tabs in the center, Inspector on the right over the full height, Project/Asset Library/
 * Console at the bottom.
 */
const STANDARD: readonly PlacementStep[] = [
  { id: 'scene', position: null },
  { id: 'game', position: { referencePanel: 'scene', direction: 'within' } },
  { id: 'blockEditor', position: { referencePanel: 'scene', direction: 'within' } },
  { id: 'project', position: { referencePanel: 'scene', direction: 'below' }, height: 230 },
  { id: 'assetLibrary', position: { referencePanel: 'project', direction: 'within' } },
  { id: 'console', position: { referencePanel: 'project', direction: 'within' } },
  { id: 'hierarchy', position: { referencePanel: 'scene', direction: 'left' }, width: 250 },
  { id: 'inspector', position: { direction: 'right' }, width: 320 },
];

/** "Large Blocks": the Block Editor takes the center, Scene and Inspector share the right side. */
const LARGE_BLOCKS: readonly PlacementStep[] = [
  { id: 'blockEditor', position: null },
  { id: 'console', position: { referencePanel: 'blockEditor', direction: 'below' }, height: 170 },
  { id: 'project', position: { referencePanel: 'console', direction: 'within' } },
  { id: 'assetLibrary', position: { referencePanel: 'console', direction: 'within' } },
  { id: 'hierarchy', position: { referencePanel: 'blockEditor', direction: 'left' }, width: 220 },
  { id: 'scene', position: { direction: 'right' }, width: 440 },
  { id: 'game', position: { referencePanel: 'scene', direction: 'within' } },
  { id: 'inspector', position: { referencePanel: 'scene', direction: 'below' }, height: 360 },
];

const PRESETS: Readonly<Record<LayoutPreset, readonly PlacementStep[]>> = {
  standard: STANDARD,
  largeBlocks: LARGE_BLOCKS,
};

/** Panels that should be active (front tab) after applying a preset. */
const ACTIVE: Readonly<Record<LayoutPreset, readonly PanelId[]>> = {
  standard: ['scene', 'project'],
  largeBlocks: ['blockEditor', 'console', 'scene'],
};

/** Replaces the current layout with a built-in layout. */
export function applyPreset(api: DockviewApi, preset: LayoutPreset, t: Translate): void {
  api.clear();
  for (const step of PRESETS[preset]) {
    const definition = panelDefinition(step.id);
    const title = definition ? t(definition.titleKey) : step.id;
    api.addPanel({
      id: step.id,
      component: step.id,
      title,
      ...(step.position ? { position: step.position } : {}),
      ...(step.width !== undefined ? { initialWidth: step.width } : {}),
      ...(step.height !== undefined ? { initialHeight: step.height } : {}),
    });
  }
  for (const id of ACTIVE[preset]) api.getPanel(id)?.api.setActive();
}
