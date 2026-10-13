import type { SceneViewport } from './SceneViewport';

/** Open scene views; the last one the user interacted with receives shortcuts like F. */
const views: SceneViewport[] = [];

/** Registers a scene view (most recent last). */
export function registerSceneView(view: SceneViewport): void {
  unregisterSceneView(view);
  views.push(view);
}

/** Removes a scene view. */
export function unregisterSceneView(view: SceneViewport): void {
  const index = views.indexOf(view);
  if (index >= 0) views.splice(index, 1);
}

/** Marks a scene view as the one the user works with. */
export function activateSceneView(view: SceneViewport): void {
  registerSceneView(view);
}

/** The scene view that receives shortcuts. */
export function activeSceneView(): SceneViewport | null {
  return views[views.length - 1] ?? null;
}
