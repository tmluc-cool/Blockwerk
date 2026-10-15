/** Texts the built-in UI needs; the host (editor, export) translates them. */
export const UI_STRING_KEYS = [
  'hint.pickup',
  'hint.open',
  'hint.close',
  'hint.locked',
  'hint.talk',
  'hint.use',
  'dialog.continue',
  'graphics.auto',
  'graphics.low',
  'graphics.medium',
  'graphics.high',
  'graphics.ultra',
  'action.up',
  'action.down',
  'action.left',
  'action.right',
  'action.jump',
  'action.sprint',
  'action.crouch',
  'action.interact',
  'action.attack',
  'action.roll',
  'action.pause',
  'keys.press',
  'notice.saved',
  'notice.noSave',
  'notice.saveFailed',
  'loading.title',
  'loading.tip.0',
  'loading.tip.1',
  'loading.tip.2',
  'inventory.empty',
] as const;

/** A text key of the built-in UI. */
export type UiStringKey = (typeof UI_STRING_KEYS)[number];

/** Translates a key (with `{name}` placeholders filled from `params`). */
export type UiStrings = (
  key: UiStringKey,
  params?: Readonly<Record<string, string | number>>,
) => string;
