import type { TerrainTool } from '@blockwerk/runtime';
import { create } from 'zustand';

/** Settings of the terrain brush (Inspector → Terrain tools). */
export interface TerrainToolState {
  /** The brush is on: the left mouse button shapes or paints the selected terrain. */
  active: boolean;
  tool: TerrainTool;
  /** Radius in meters. */
  radius: number;
  /** Strength 0..1. */
  strength: number;
  /** Layer painted with the paint tool (0..3). */
  layer: number;
  set: (patch: Partial<Omit<TerrainToolState, 'set'>>) => void;
}

/** The terrain brush of the scene view. */
export const useTerrainTool = create<TerrainToolState>()((set) => ({
  active: false,
  tool: 'raise',
  radius: 8,
  strength: 0.5,
  layer: 1,
  set: (patch) => set(patch),
}));
