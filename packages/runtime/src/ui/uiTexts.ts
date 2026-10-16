import type { UiStringKey, UiStrings } from './strings';

/** Languages of the built-in game UI (pause menu, hints, loading screen). */
export type UiLocale = 'de' | 'en';

const TEXTS: Readonly<Record<UiLocale, Readonly<Record<UiStringKey, string>>>> = {
  de: {
    'hint.pickup': '[E] {label} aufheben',
    'hint.open': '[E] {label} öffnen',
    'hint.close': '[E] {label} schließen',
    'hint.locked': 'Verschlossen – braucht {label}',
    'hint.talk': '[E] Mit {label} sprechen',
    'hint.use': '[E] {label} benutzen',
    'dialog.continue': 'Weiter [E]',
    'graphics.auto': 'Projekt-Standard',
    'graphics.low': 'Niedrig',
    'graphics.medium': 'Mittel',
    'graphics.high': 'Hoch',
    'graphics.ultra': 'Ultra',
    'action.up': 'Vorwärts',
    'action.down': 'Rückwärts',
    'action.left': 'Links',
    'action.right': 'Rechts',
    'action.jump': 'Springen',
    'action.sprint': 'Rennen',
    'action.crouch': 'Ducken',
    'action.interact': 'Benutzen',
    'action.attack': 'Angreifen',
    'action.roll': 'Rolle',
    'action.pause': 'Pause',
    'keys.press': 'Taste drücken …',
    'notice.saved': 'Spiel gespeichert',
    'notice.noSave': 'In diesem Platz liegt kein Spielstand',
    'notice.saveFailed': 'Das Spiel konnte nicht gespeichert werden',
    'loading.title': '{name} wird geladen …',
    'loading.tip.0': 'Tipp: Mit E sprichst du, öffnest Türen und hebst Dinge auf.',
    'loading.tip.1': 'Tipp: Gegenstände und Leben nimmst du in die nächste Szene mit.',
    'loading.tip.2':
      'Tipp: Zombies bemerken dich im Sichtkegel und am Geräusch. Bleib außer Sicht.',
    'inventory.empty': 'Noch nichts',
  },
  en: {
    'hint.pickup': '[E] Pick up {label}',
    'hint.open': '[E] Open {label}',
    'hint.close': '[E] Close {label}',
    'hint.locked': 'Locked – needs {label}',
    'hint.talk': '[E] Talk to {label}',
    'hint.use': '[E] Use {label}',
    'dialog.continue': 'Continue [E]',
    'graphics.auto': 'Project default',
    'graphics.low': 'Low',
    'graphics.medium': 'Medium',
    'graphics.high': 'High',
    'graphics.ultra': 'Ultra',
    'action.up': 'Forward',
    'action.down': 'Backward',
    'action.left': 'Left',
    'action.right': 'Right',
    'action.jump': 'Jump',
    'action.sprint': 'Sprint',
    'action.crouch': 'Crouch',
    'action.interact': 'Interact',
    'action.attack': 'Attack',
    'action.roll': 'Roll',
    'action.pause': 'Pause',
    'keys.press': 'Press a key …',
    'notice.saved': 'Game saved',
    'notice.noSave': 'No saved game in this slot',
    'notice.saveFailed': 'The game could not be saved',
    'loading.title': 'Loading {name} …',
    'loading.tip.0': 'Tip: Press E to talk, open doors and pick things up.',
    'loading.tip.1': 'Tip: Your items and health come with you to the next scene.',
    'loading.tip.2': 'Tip: Zombies notice you in their view cone and by sound. Stay out of sight.',
    'inventory.empty': 'Nothing yet',
  },
};

/** Translates the built-in UI texts into a language (`{name}` placeholders are filled in). */
export function uiStringsFor(locale: UiLocale): UiStrings {
  return (key, params) => {
    const text = TEXTS[locale][key];
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      params[name] === undefined ? match : String(params[name]),
    );
  };
}
