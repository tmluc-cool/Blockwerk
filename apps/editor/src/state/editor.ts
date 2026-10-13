import type { AreaKind } from '@blockwerk/blocks';
import { create } from 'zustand';
import type { TranslationKey } from '../i18n';

/** Scene tools of the toolbar (Unity: Q W E R T Y). */
export type Tool = 'hand' | 'move' | 'rotate' | 'scale' | 'rect' | 'transform';

/** Keyboard shortcut of every tool. */
export const TOOL_KEYS: Readonly<Record<string, Tool>> = {
  q: 'hand',
  w: 'move',
  e: 'rotate',
  r: 'scale',
  t: 'rect',
  y: 'transform',
};

/** An area tab (SPEC 5.3). Built-in tabs have a translation key, custom tabs a name. */
export interface AreaTab {
  readonly id: string;
  /** Palette area kind, `null` for "All" and custom tabs. */
  readonly kind: AreaKind | null;
  readonly nameKey?: TranslationKey;
  readonly name?: string;
}

/** The built-in area tabs in their default order. */
export const BUILT_IN_AREAS: readonly AreaTab[] = [
  { id: 'all', kind: null, nameKey: 'area.all' },
  { id: 'environment', kind: 'environment', nameKey: 'area.environment' },
  { id: 'player1', kind: 'player', nameKey: 'area.player1' },
  { id: 'player2', kind: 'player', nameKey: 'area.player2' },
  { id: 'npcs', kind: 'npc', nameKey: 'area.npcs' },
  { id: 'items', kind: 'items', nameKey: 'area.items' },
  { id: 'ui', kind: 'ui', nameKey: 'area.ui' },
];

interface EditorState {
  tool: Tool;
  pivotMode: 'pivot' | 'center';
  space: 'local' | 'global';
  areas: AreaTab[];
  activeAreaId: string;
  selectedObjectId: string | null;
  /** True while the scene camera is in fly mode (right mouse button held). */
  flying: boolean;
  setTool: (tool: Tool) => void;
  togglePivotMode: () => void;
  toggleSpace: () => void;
  setActiveArea: (id: string) => void;
  addArea: (name: string) => string;
  renameArea: (id: string, name: string) => void;
  select: (id: string | null) => void;
  setFlying: (flying: boolean) => void;
}

let customAreaCounter = 0;

/** Transient editor state (not persisted). */
export const useEditor = create<EditorState>()((set) => ({
  tool: 'move',
  pivotMode: 'pivot',
  space: 'local',
  areas: [...BUILT_IN_AREAS],
  activeAreaId: 'all',
  selectedObjectId: null,
  flying: false,
  setTool: (tool) => set({ tool }),
  togglePivotMode: () =>
    set((state) => ({ pivotMode: state.pivotMode === 'pivot' ? 'center' : 'pivot' })),
  toggleSpace: () => set((state) => ({ space: state.space === 'local' ? 'global' : 'local' })),
  setActiveArea: (id) =>
    set((state) => (state.areas.some((area) => area.id === id) ? { activeAreaId: id } : {})),
  addArea: (name) => {
    customAreaCounter += 1;
    const id = `custom-${customAreaCounter}`;
    set((state) => ({ areas: [...state.areas, { id, kind: null, name }], activeAreaId: id }));
    return id;
  },
  renameArea: (id, name) =>
    set((state) => ({
      areas: state.areas.map((area) =>
        area.id === id && area.nameKey === undefined ? { ...area, name } : area,
      ),
    })),
  select: (id) => set({ selectedObjectId: id }),
  setFlying: (flying) => set({ flying }),
}));
