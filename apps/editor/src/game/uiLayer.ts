import { UiRenderer } from '@blockwerk/runtime';
import type { Game, UiLoading, UiStrings } from '@blockwerk/runtime';
import { t } from '../state/settings';
import { gameSettings } from './settingsStore';

let renderer: UiRenderer | null = null;

/** Translates the built-in texts of the UI layer with the editor's language. */
export const uiStrings: UiStrings = (key, params) => t(`ui.${key}` as never, params as never);

/** The Game view hands its UI layer over (and `null` when it closes). */
export function setUiRenderer(next: UiRenderer | null): void {
  renderer = next;
}

/** The UI layer of the Game view, if it is open. */
export function currentUiRenderer(): UiRenderer | null {
  return renderer;
}

/** Brings the UI layer up to date; called once per frame by the play loop. */
export function updateUiLayer(game: Game | null, loading: UiLoading | null): void {
  if (!renderer) return;
  const views = game?.views();
  renderer.update({
    game,
    loading,
    ...(views
      ? {
          views: {
            players: views.views.map((view): 1 | 2 => (view.player === '2' ? 2 : 1)),
            split: views.split,
          },
        }
      : {}),
  });
  // Menus and dialogs need the mouse.
  if (game && (game.gamePaused || game.talking || game.uiCanvases().some((c) => c.modal))) {
    renderer.parentDocument().exitPointerLock?.();
  }
}

/** Creates the UI layer for the Game view's element. */
export function createUiRenderer(host: HTMLElement): UiRenderer {
  const created = new UiRenderer(host, { strings: uiStrings }, gameSettings);
  const stop = gameSettings.onChange((key) => {
    if (key !== 'fullscreen') return;
    const document = host.ownerDocument;
    if (gameSettings.get('fullscreen')) void host.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  });
  const dispose = created.dispose.bind(created);
  created.dispose = () => {
    stop();
    dispose();
  };
  return created;
}
