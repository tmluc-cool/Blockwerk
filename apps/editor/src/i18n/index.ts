import de from './de.json';
import en from './en.json';
import type { Locale } from '@blockwerk/blocks';

/** Every translation key. The English file defines the set; tests ensure German matches. */
export type TranslationKey = keyof typeof en;

/** Placeholder values for `{name}` parameters in a translation. */
export type TranslationParams = Readonly<Record<string, string | number>>;

const dictionaries: Readonly<Record<Locale, Readonly<Record<TranslationKey, string>>>> = { de, en };

/** Raw dictionaries, exported for tests. */
export const DICTIONARIES = dictionaries;

/** Looks up a translation and fills in `{name}` parameters. Unknown parameters stay visible. */
export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const text = dictionaries[locale][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

/** Translation function bound to a language. */
export type Translate = (key: TranslationKey, params?: TranslationParams) => string;
