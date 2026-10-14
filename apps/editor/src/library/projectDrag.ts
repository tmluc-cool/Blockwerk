import type { DragEvent } from 'react';

/** Drag-and-drop data type of project assets (project window → folders, scene, fields). */
export const ASSET_DRAG_TYPE = 'application/x-blockwerk-asset';

/** Drag-and-drop data type of scene objects (hierarchy → hierarchy, project window). */
export const OBJECTS_DRAG_TYPE = 'application/x-blockwerk-objects';

let draggedAsset: string | null = null;

/**
 * Starts dragging a project asset. Drop targets cannot read drag data while hovering, so the
 * ID is also kept here (for the scene view's drop preview).
 */
export function startAssetDrag(event: DragEvent, assetId: string): void {
  draggedAsset = assetId;
  event.dataTransfer.setData(ASSET_DRAG_TYPE, assetId);
  event.dataTransfer.effectAllowed = 'copyMove';
}

/** The project asset being dragged, if any. */
export function draggedAssetId(): string | null {
  return draggedAsset;
}

/** Ends a project asset drag. */
export function endAssetDrag(): void {
  draggedAsset = null;
}
