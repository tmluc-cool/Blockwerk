import { focusPanel, openPanel } from './layout/layoutController';
import { activeSceneView } from './scene/sceneViews';
import type { ConsoleLink } from './state/console';
import { useDocument } from './state/document';
import { useEditor } from './state/editor';
import { playingWorld } from './state/play';

/** Opens a block script in the block editor (double-click on a script, like Unity). */
export function openScriptEditor(assetId: string, objectId: string | null = null): void {
  useEditor.getState().openBlockScript({ assetId, objectId });
  openPanel('blockEditor');
  focusPanel('blockEditor');
}

/** Opens a dialog in the Dialog editor (double-click on a dialog). */
export function openDialogEditor(assetId: string): void {
  useEditor.getState().openDialogAsset(assetId);
  openPanel('dialogEditor');
  focusPanel('dialogEditor');
}

/** Follows a console entry: selects the object and shows the block. */
export function revealLink(link: ConsoleLink): void {
  const editor = useEditor.getState();
  if (link.objectId) {
    const exists =
      playingWorld()?.getObject(link.objectId) !== undefined ||
      link.objectId in (useDocument.getState().scene?.objects ?? {});
    if (exists) {
      editor.select(link.objectId);
      activeSceneView()?.focus([link.objectId]);
    }
  }
  if (link.assetId) {
    openScriptEditor(link.assetId, link.objectId ?? null);
    if (link.blockId) editor.showBlock(link.assetId, link.blockId);
  }
}
