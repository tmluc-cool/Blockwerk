import type { Locale } from '@blockwerk/blocks';
import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translate } from '../i18n';
import type { Translate } from '../i18n';

/** Color theme of the editor. */
export type Theme = 'dark' | 'light';

interface SettingsState {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
}

/** User preferences that survive restarts (stored in localStorage, not in the project). */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      locale: 'de',
      theme: 'dark',
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'blockwerk.settings', version: 1 },
  ),
);

/** Returns the translation function for the current language; re-renders on language change. */
export function useT(): Translate {
  const locale = useSettings((state) => state.locale);
  return useCallback<Translate>((key, params) => translate(locale, key, params), [locale]);
}

/** Translation function for code outside React components. */
export const t: Translate = (key, params) => translate(useSettings.getState().locale, key, params);
