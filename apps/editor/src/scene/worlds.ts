import type { SceneData, SceneObjectData } from '@blockwerk/project';
import { World } from '@blockwerk/runtime';
import { useDocument } from '../state/document';
import { t, useSettings } from '../state/settings';
import type { TranslationKey } from '../i18n';

/**
 * The worlds the views render: one edit world kept in sync with the open scene and, while
 * playing, the game's world. Scene and Game views render the same world, so editing is
 * cheap and play mode shows the live game everywhere (like Unity).
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let editWorld: World | null = null;
let editScene: SceneData | null = null;
let playWorld: World | null = null;

/** Display name of objects without a stored name (built-in area roots). */
export function defaultObjectName(_id: string, data: SceneObjectData): string {
  return data.area && data.area !== 'custom' ? t(`area.${data.area}` as TranslationKey) : '';
}

/** Name of an object as the hierarchy shows it. */
export function objectName(data: SceneObjectData, id = ''): string {
  return data.name ?? defaultObjectName(id, data);
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function rebuild(): void {
  editWorld?.dispose();
  editWorld = null;
  editScene = null;
  sync();
}

function sync(): void {
  const { scene } = useDocument.getState();
  if (scene === editScene) return;
  if (!scene) {
    editWorld?.dispose();
    editWorld = null;
  } else if (!editWorld || !editScene || !sharesObjects(editScene, scene)) {
    // Another scene was opened: start over instead of diffing unrelated data.
    editWorld?.dispose();
    editWorld = new World(scene, { displayName: defaultObjectName });
  } else {
    editWorld.sync(scene);
  }
  editScene = scene;
  notify();
}

/** Whether two scenes are versions of the same scene (share at least one object ID). */
function sharesObjects(a: SceneData, b: SceneData): boolean {
  for (const id of Object.keys(b.objects)) if (id in a.objects) return true;
  return Object.keys(a.objects).length === 0 && Object.keys(b.objects).length === 0;
}

useDocument.subscribe((state, previous) => {
  if (state.scene !== previous.scene) sync();
});
useSettings.subscribe((state, previous) => {
  if (state.locale !== previous.locale) rebuild();
});

/** The world views should render now (the game's world while playing). */
export function currentWorld(): World | null {
  if (playWorld) return playWorld;
  if (!editWorld) sync();
  return editWorld;
}

/** The edit world (independent of play mode). */
export function currentEditWorld(): World | null {
  if (!editWorld) sync();
  return editWorld;
}

/** Whether the views currently show a running game. */
export function showingPlayWorld(): boolean {
  return playWorld !== null;
}

/** Switches the views to a game's world, or back to the edit world with `null`. */
export function setPlayWorld(world: World | null): void {
  if (world === playWorld) return;
  playWorld = world;
  notify();
}

/** Calls `listener` whenever the world changes or is replaced. Returns an unsubscribe function. */
export function onWorldChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tells the views that the shown world changed without a scene edit (e.g. a game tick). */
export function worldUpdated(): void {
  notify();
}

/** A view that can draw the current world on demand. */
export interface RenderView {
  render(): void;
}

const views = new Set<RenderView>();

/** Registers a view that the play loop renders every game frame. */
export function registerRenderView(view: RenderView): () => void {
  views.add(view);
  return () => views.delete(view);
}

/** Renders all views now (called by the play loop inside the interpolated state). */
export function renderViews(): void {
  for (const view of views) view.render();
}
