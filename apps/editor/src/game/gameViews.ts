import type { GameViewport } from './GameViewport';

let current: GameViewport | null = null;

/** Registers the open Game view (focused when play mode starts). */
export function setGameView(view: GameViewport): () => void {
  current = view;
  return () => {
    if (current === view) current = null;
  };
}

/** The open Game view, if any. */
export function gameView(): GameViewport | null {
  return current;
}
