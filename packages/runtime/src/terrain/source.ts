import type { TerrainData } from './TerrainData';

/** Where terrain height maps come from: a terrain asset ID to its data, or `null` if missing. */
export type TerrainSource = (assetId: string) => TerrainData | null;

let source: TerrainSource = () => null;

/** Sets where terrain components find their data (the project in the editor, the game files in exports). */
export function setTerrainSource(next: TerrainSource): void {
  source = next;
}

/** Looks up the data of a terrain asset. */
export function loadTerrain(assetId: string): TerrainData | null {
  return source(assetId);
}
