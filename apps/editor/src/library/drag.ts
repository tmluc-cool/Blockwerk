import type { LibraryEntry } from '@blockwerk/library';
import type { DragEvent } from 'react';

/** Drag-and-drop data type of library entries. */
export const LIBRARY_DRAG_TYPE = 'application/x-blockwerk-library';

let dragged: LibraryEntry | null = null;

/**
 * Starts dragging a library entry. Drop targets cannot read drag data while hovering, so the
 * entry is also kept here for the live preview in the scene view.
 */
export function startLibraryDrag(event: DragEvent, entry: LibraryEntry): void {
  dragged = entry;
  event.dataTransfer.setData(LIBRARY_DRAG_TYPE, entry.id);
  event.dataTransfer.effectAllowed = 'copy';
}

/** The library entry being dragged, if any. */
export function draggedLibraryEntry(): LibraryEntry | null {
  return dragged;
}

/** Ends a library drag (drop or cancel). */
export function endLibraryDrag(): void {
  dragged = null;
  draggedMine = null;
}

let draggedMine: string | null = null;

/** Starts dragging a prefab of "My Prefabs" (by its asset ID). */
export function startMyPrefabDrag(event: DragEvent, id: string): void {
  draggedMine = id;
  event.dataTransfer.setData(LIBRARY_DRAG_TYPE, id);
  event.dataTransfer.effectAllowed = 'copy';
}

/** The prefab of "My Prefabs" being dragged, if any. */
export function draggedMyPrefab(): string | null {
  return draggedMine;
}
