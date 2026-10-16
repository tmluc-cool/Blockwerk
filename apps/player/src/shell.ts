/**
 * What the Windows app (Electron) gives the page: window control. In a browser there is no shell
 * and the page uses the web APIs instead.
 */
export interface PlayerShell {
  /** Switches the window to or from fullscreen. */
  fullscreen(on: boolean): void;
  /** Closes the game. */
  quit(): void;
}

declare global {
  interface Window {
    blockwerkPlayerShell?: PlayerShell;
  }
}

/** The shell of the Windows app, or `null` in a browser. */
export function playerShell(): PlayerShell | null {
  return window.blockwerkPlayerShell ?? null;
}
