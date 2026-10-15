import type { AreaKind } from '@blockwerk/blocks';
import type { AreaKindData } from '@blockwerk/project';
import { create } from 'zustand';

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

/** The tab "All" (shows every object, like Unity). */
export const ALL_AREAS = 'all';

/** Palette area of an area root (both player tabs share the player palette). */
export function paletteArea(kind: AreaKindData | undefined): AreaKind | null {
  switch (kind) {
    case 'environment':
      return 'environment';
    case 'player1':
    case 'player2':
      return 'player';
    case 'npcs':
      return 'npc';
    case 'items':
      return 'items';
    case 'ui':
      return 'ui';
    default:
      return null;
  }
}

/** The block script open in the block editor and the object it was opened from. */
export interface OpenScript {
  readonly assetId: string;
  readonly objectId: string | null;
}

/** How a click changes the selection. */
export type SelectMode = 'replace' | 'toggle' | 'add';

interface EditorState {
  tool: Tool;
  pivotMode: 'pivot' | 'center';
  space: 'local' | 'global';
  /** `all` or the ID of an area root object. */
  activeAreaId: string;
  /** Selected objects; the last one is the active object (shown first in the inspector). */
  selection: readonly string[];
  /** Selected asset in the project window (when no object is inspected). */
  selectedAssetId: string | null;
  /** Object whose name is being edited in the hierarchy. */
  renamingId: string | null;
  openScript: OpenScript | null;
  /** Dialog open in the Dialog editor (asset ID). */
  openDialog: string | null;
  /** UI canvas open in the UI Editor (asset ID). */
  openUi: string | null;
  /** Block the block editor should scroll to and select (console jump). */
  revealBlock: {
    readonly assetId: string;
    readonly blockId: string;
    readonly nonce: number;
  } | null;
  /** True while the scene camera is in fly mode (right mouse button held). */
  flying: boolean;
  setTool: (tool: Tool) => void;
  togglePivotMode: () => void;
  toggleSpace: () => void;
  setActiveArea: (id: string) => void;
  select: (id: string | null, mode?: SelectMode) => void;
  setSelection: (ids: readonly string[]) => void;
  selectAsset: (id: string | null) => void;
  setRenaming: (id: string | null) => void;
  openBlockScript: (script: OpenScript | null) => void;
  openDialogAsset: (assetId: string | null) => void;
  openUiAsset: (assetId: string | null) => void;
  showBlock: (assetId: string, blockId: string) => void;
  setFlying: (flying: boolean) => void;
  /** Clears selection and area after another scene or project was opened. */
  resetForScene: () => void;
}

/** Transient editor state (not persisted). */
export const useEditor = create<EditorState>()((set) => ({
  tool: 'move',
  pivotMode: 'pivot',
  space: 'local',
  activeAreaId: ALL_AREAS,
  selection: [],
  selectedAssetId: null,
  renamingId: null,
  openScript: null,
  openDialog: null,
  openUi: null,
  revealBlock: null,
  flying: false,
  setTool: (tool) => set({ tool }),
  togglePivotMode: () =>
    set((state) => ({ pivotMode: state.pivotMode === 'pivot' ? 'center' : 'pivot' })),
  toggleSpace: () => set((state) => ({ space: state.space === 'local' ? 'global' : 'local' })),
  setActiveArea: (id) => set({ activeAreaId: id }),
  select: (id, mode = 'replace') =>
    set((state) => {
      if (id === null) return { selection: mode === 'replace' ? [] : state.selection };
      const without = state.selection.filter((item) => item !== id);
      if (mode === 'toggle' && without.length !== state.selection.length) {
        return { selection: without };
      }
      return {
        selection: mode === 'replace' ? [id] : [...without, id],
        selectedAssetId: null,
      };
    }),
  setSelection: (ids) =>
    set({ selection: [...ids], ...(ids.length > 0 ? { selectedAssetId: null } : {}) }),
  selectAsset: (id) => set({ selectedAssetId: id, ...(id ? { selection: [] } : {}) }),
  setRenaming: (id) => set({ renamingId: id }),
  openBlockScript: (script) => set({ openScript: script }),
  openDialogAsset: (assetId) => set({ openDialog: assetId }),
  openUiAsset: (assetId) => set({ openUi: assetId }),
  showBlock: (assetId, blockId) =>
    set((state) => ({
      revealBlock: { assetId, blockId, nonce: (state.revealBlock?.nonce ?? 0) + 1 },
    })),
  setFlying: (flying) => set({ flying }),
  resetForScene: () =>
    set({ selection: [], activeAreaId: ALL_AREAS, renamingId: null, selectedAssetId: null }),
}));

/** The active (last selected) object. */
export function activeObjectId(state: { selection: readonly string[] }): string | null {
  return state.selection[state.selection.length - 1] ?? null;
}
