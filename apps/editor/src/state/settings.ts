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
  /** Project opened last (reference of the storage backend). */
  lastProject: string | null;
  /** Save automatically a few seconds after every change. */
  autosave: boolean;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  setLastProject: (ref: string | null) => void;
  setAutosave: (autosave: boolean) => void;
}

/** User preferences that survive restarts (stored in localStorage, not in the project). */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      locale: 'de',
      theme: 'dark',
      lastProject: null,
      autosave: true,
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setLastProject: (lastProject) => set({ lastProject }),
      setAutosave: (autosave) => set({ autosave }),
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
