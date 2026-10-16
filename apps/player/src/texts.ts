/** The few texts of the player itself (the game's own UI texts live in the runtime). */
export type PlayerLocale = 'de' | 'en';

const TEXTS = {
  de: {
    loading: '{name} wird geladen …',
    start: 'Zum Starten klicken',
    failed: 'Das Spiel konnte nicht gestartet werden.',
    noGraphics: 'Dieser Browser kann keine 3D-Grafik zeigen (WebGL 2 fehlt).',
  },
  en: {
    loading: 'Loading {name} …',
    start: 'Click to start',
    failed: 'The game could not be started.',
    noGraphics: 'This browser cannot show 3D graphics (WebGL 2 is missing).',
  },
} as const;

export type PlayerTextKey = keyof (typeof TEXTS)['en'];

/** The language of the player: the browser's, German or English. */
export function detectLocale(): PlayerLocale {
  return globalThis.navigator?.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** A text of the player in a language, with `{name}` filled in. */
export function playerText(
  locale: PlayerLocale,
  key: PlayerTextKey,
  params: Readonly<Record<string, string>> = {},
): string {
  return TEXTS[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}
