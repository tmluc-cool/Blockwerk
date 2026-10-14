/** Languages of the user interface. */
export type Locale = 'de' | 'en';

/** A text in every supported language. */
export type LocalizedText = Readonly<Record<Locale, string>>;
