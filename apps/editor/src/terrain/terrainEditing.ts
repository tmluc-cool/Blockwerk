import { TERRAIN_TOOLS, TerrainData, setTerrainSource, terrainRegistry } from '@blockwerk/runtime';
import type { GameObject, TerrainRegion } from '@blockwerk/runtime';
import type { JsonValue } from '@blockwerk/project';
import type { Vector3 } from 'three';
import { editComponentValue, editComponentValues } from '../document/edits';
import { currentWorld } from '../scene/worlds';
import { defaultFolder, useDocument } from '../state/document';
import { activeObjectId, useEditor } from '../state/editor';
import { usePlay } from '../state/play';
import { useTerrainTool } from './terrainTool';

/** Height maps open in the editor by asset ID; the live worlds show these very objects. */
const working = new Map<string, TerrainData>();
/** Serialized states by asset ID and revision, so undo and redo can bring them back. */
const snapshots = new Map<string, Map<number, Uint8Array>>();
/** The revision of each terrain object the working data currently shows. */
const applied = new Map<string, number>();
/** Per-stroke state: the revision the stroke started from. */
let stroke: { objectId: string; assetId: string; from: number } | null = null;

const MAX_SNAPSHOTS = 40;

setTerrainSource((assetId) => {
  const known = working.get(assetId);
  if (known) return known;
  const bytes = useDocument.getState().project?.assetBytes(assetId);
  if (!bytes) return null;
  try {
    const data = TerrainData.deserialize(bytes);
    working.set(assetId, data);
    return data;
  } catch {
    return null;
  }
});

// A different project or a reloaded one: forget everything cached.
useDocument.subscribe((state, previous) => {
  if (state.project !== previous.project) {
    working.clear();
    snapshots.clear();
    applied.clear();
    stroke = null;
  }
  if (state.scene !== previous.scene) syncRevisions();
});

function snapshotsOf(assetId: string): Map<number, Uint8Array> {
  let map = snapshots.get(assetId);
  if (!map) {
    map = new Map();
    snapshots.set(assetId, map);
  }
  return map;
}

function remember(assetId: string, revision: number, data: TerrainData): void {
  const map = snapshotsOf(assetId);
  map.set(revision, data.serialize());
  while (map.size > MAX_SNAPSHOTS) {
    const oldest = [...map.keys()].sort((a, b) => a - b)[0];
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

/** The terrain component values of an object in the open scene. */
function terrainValues(objectId: string): { asset: string; revision: number } | null {
  const object = useDocument.getState().scene?.objects[objectId];
  const component = object?.components.find((item) => item.type === 'terrain');
  const asset = component?.values['terrain'];
  if (typeof asset !== 'string' || !asset) return null;
  const revision = component?.values['revision'];
  return { asset, revision: typeof revision === 'number' ? revision : 0 };
}

function liveObject(objectId: string): GameObject | undefined {
  return currentWorld()?.getObject(objectId);
}

/** Writes the working data of a terrain into the project file. */
function store(assetId: string, data: TerrainData): void {
  useDocument.getState().project?.updateAssetBytes(assetId, data.serialize());
  useDocument.setState((state) => ({
    revision: state.revision + 1,
    assetsVersion: state.assetsVersion + 1,
  }));
}

/** After undo or redo: shows the terrain state that belongs to each object's revision. */
function syncRevisions(): void {
  const scene = useDocument.getState().scene;
  if (!scene) return;
  for (const id of Object.keys(scene.objects)) {
    const values = terrainValues(id);
    if (!values) continue;
    const seen = applied.get(id);
    if (seen === undefined) {
      applied.set(id, values.revision);
      continue;
    }
    if (seen === values.revision) continue;
    const bytes = snapshotsOf(values.asset).get(values.revision);
    const data = working.get(values.asset);
    applied.set(id, values.revision);
    if (!bytes || !data) continue;
    const restored = TerrainData.deserialize(bytes);
    data.heights.set(restored.heights);
    data.splat.set(restored.splat);
    store(values.asset, data);
    const state = liveObject(id) && terrainRegistry.get(liveObject(id) as GameObject);
    state?.refresh(null);
  }
}

/** Whether the terrain brush is on for the selected terrain (and the game is not running). */
export function terrainBrushActive(): boolean {
  if (!useTerrainTool.getState().active || usePlay.getState().status !== 'stopped') return false;
  const id = activeObjectId(useEditor.getState());
  return !!id && terrainValues(id) !== null;
}

/** Radius of the brush in meters. */
export function terrainBrushRadius(): number {
  return useTerrainTool.getState().radius;
}

/** A brush stroke at a world position: `start`, `move` while dragging, `end` when released. */
export function terrainStroke(point: Vector3 | null, phase: 'start' | 'move' | 'end'): void {
  const objectId = activeObjectId(useEditor.getState());
  if (phase === 'end') {
    if (stroke) finishStroke(stroke);
    stroke = null;
    return;
  }
  if (!objectId || !point) return;
  const values = terrainValues(objectId);
  const object = liveObject(objectId);
  const state = object ? terrainRegistry.get(object) : undefined;
  if (!values || !object || !state) return;
  if (phase === 'start' || !stroke) {
    const snapshot = snapshotsOf(values.asset);
    if (!snapshot.has(values.revision)) remember(values.asset, values.revision, state.data);
    stroke = { objectId, assetId: values.asset, from: values.revision };
  }
  const settings = useTerrainTool.getState();
  const local = object.object3d.worldToLocal(point.clone());
  const target = state.data.heightAt(local.x, local.z);
  const region = state.data.apply({
    tool: settings.tool,
    x: local.x,
    z: local.z,
    radius: settings.radius,
    strength: settings.strength * (settings.tool === 'paint' ? 0.25 : 0.2),
    layer: settings.layer,
    height: target,
  });
  if (region) state.refresh(region);
}

/** A whole-terrain operation (hills, flatten all) as one undo step. */
export function changeTerrain(
  objectId: string,
  change: (data: TerrainData) => TerrainRegion | null,
): void {
  const values = terrainValues(objectId);
  const object = liveObject(objectId);
  const state = object ? terrainRegistry.get(object) : undefined;
  if (!values || !state) return;
  if (!snapshotsOf(values.asset).has(values.revision)) {
    remember(values.asset, values.revision, state.data);
  }
  change(state.data);
  finishStroke({ objectId, assetId: values.asset, from: values.revision });
  state.refresh(null);
}

function finishStroke(current: { objectId: string; assetId: string; from: number }): void {
  const data = working.get(current.assetId);
  if (!data) return;
  const revision = (terrainValues(current.objectId)?.revision ?? current.from) + 1;
  remember(current.assetId, revision, data);
  applied.set(current.objectId, revision);
  store(current.assetId, data);
  editComponentValue([current.objectId], 'terrain', 0, 'revision', revision);
}

/** Creates a flat terrain file in the project and returns its asset ID. */
export function createTerrainAsset(size: number, resolution: number, name: string): string | null {
  const { project } = useDocument.getState();
  if (!project) return null;
  const data = new TerrainData(resolution, size);
  const path = project.uniqueAssetPath(defaultFolder('terrain'), name, 'terrain');
  const entry = project.createTerrain(path, data.serialize());
  working.set(entry.id, data);
  useDocument.setState((state) => ({
    revision: state.revision + 1,
    assetsVersion: state.assetsVersion + 1,
  }));
  return entry.id;
}

/** Assigns a terrain file to a terrain component (and starts its revision count). */
export function assignTerrain(objectId: string, assetId: string): void {
  editComponentValues([objectId], 'terrain', 0, { terrain: assetId, revision: 0 } as Record<
    string,
    JsonValue
  >);
}

/** The tools in the order of the inspector. */
export const TERRAIN_TOOL_ORDER = TERRAIN_TOOLS;
