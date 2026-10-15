import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';
import type { GameObject } from '../world/GameObject';

/** When a canvas is shown. */
export type UiVisibility = 'always' | 'paused' | 'manual';

/** The live state of a UI Canvas component (read by the UI layer). */
export interface UiCanvasState {
  readonly object: GameObject;
  ui: string | null;
  /** `all`: every player (one HUD, or one per split-screen view); `1` / `2`: only that player's view. */
  player: 'all' | '1' | '2';
  order: number;
  visibility: UiVisibility;
  /** For "manual": whether "show UI" has been used. */
  shown: boolean;
}

/** UI Canvas components by object. */
export const uiCanvasRegistry = new WeakMap<GameObject, UiCanvasState>();

const fields = {
  ui: {
    type: 'asset',
    assetType: 'ui',
    default: null,
    text: { de: 'UI-Leinwand', en: 'UI Canvas' },
  },
  player: {
    type: 'enum',
    default: 'all',
    options: [
      { value: 'all', text: { de: 'Alle Spieler', en: 'All players' } },
      { value: '1', text: { de: 'Spieler 1', en: 'Player 1' } },
      { value: '2', text: { de: 'Spieler 2', en: 'Player 2' } },
    ],
    text: { de: 'Für Spieler', en: 'For Player' },
  },
  visibility: {
    type: 'enum',
    default: 'always',
    options: [
      { value: 'always', text: { de: 'Immer', en: 'Always' } },
      {
        value: 'paused',
        text: { de: 'Solange das Spiel pausiert ist', en: 'While the game is paused' },
      },
      {
        value: 'manual',
        text: { de: 'Von Hand (Block oder Knopf)', en: 'By hand (block or button)' },
      },
    ],
    text: { de: 'Sichtbar', en: 'Visible' },
  },
  sortOrder: {
    type: 'number',
    default: 0,
    step: 1,
    text: { de: 'Reihenfolge (grösser = weiter vorne)', en: 'Sort Order (higher = in front)' },
  },
} as const satisfies FieldDefinitions;

/** UI Canvas (SPEC 8.12, Unity: Canvas): shows a UI asset over the game. */
export const uiCanvas = defineComponent({
  type: 'uiCanvas',
  category: 'ui',
  unique: false,
  unity: 'Canvas',
  text: { de: 'UI-Leinwand', en: 'UI Canvas' },
  docs: {
    de: 'Zeigt eine UI-Leinwand (aus dem UI-Editor) über dem Spiel: HUD, Menüs, Hinweise. Bei geteiltem Bildschirm kann jede Leinwand zu einem Spieler gehören. „Solange das Spiel pausiert ist“ ist für das Pausemenü, „von Hand“ für Menüs, die ein Knopf oder der Block „zeige UI“ öffnet.',
    en: 'Shows a UI canvas (from the UI Editor) over the game: HUD, menus, hints. With split screen a canvas can belong to one player. "While the game is paused" is for the pause menu, "by hand" for menus that a button or the block "show UI" opens.',
  },
  keywords: {
    de: ['ui', 'menü', 'hud', 'oberfläche', 'canvas', 'anzeige'],
    en: ['ui', 'menu', 'hud', 'interface', 'canvas', 'overlay'],
  },
  fields,
  create({ object }, initial) {
    const state: UiCanvasState = {
      object,
      ui: initial.ui,
      player: initial.player as UiCanvasState['player'],
      order: initial.sortOrder,
      visibility: initial.visibility as UiVisibility,
      shown: false,
    };
    uiCanvasRegistry.set(object, state);
    return {
      apply(next) {
        state.ui = next.ui;
        state.player = next.player as UiCanvasState['player'];
        state.order = next.sortOrder;
        state.visibility = next.visibility as UiVisibility;
      },
      destroy() {
        uiCanvasRegistry.delete(object);
      },
    };
  },
});
