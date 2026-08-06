import { createContext, useContext } from 'react';
import { copyFor, facesFor, type CopyFn } from './use-copy';
import type { Locale, LocaleFaces } from './locales';

/**
 * The active language, and the only place the UI reads it from.
 *
 * It is deliberately NOT a Zustand slice. Preferences already live in App-level
 * React state (`App.tsx`, `useState<AppPreferences>`), are loaded from SQLite on
 * boot and persisted by the existing save path — a second copy in the store
 * would need bidirectional sync and the two would drift across that async load.
 * The provider is fed straight from `preferences.language`, so language
 * inherits boot-load and persistence for free.
 *
 * Boot behaviour worth knowing: preferences load asynchronously, so the locale
 * is `'en'` for the first frames and flips once the row arrives. That is fine —
 * the screens before the picker are English regardless — but it is a deliberate
 * choice rather than an accident.
 */
const LocaleContext = createContext<Locale>('en');

export const LocaleProvider = LocaleContext.Provider;

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** `t(key, params)` bound to the active language. */
export function useCopy(): CopyFn {
  return copyFor(useLocale());
}

/**
 * The two pixel faces for the active language.
 *
 * Needed by the files that set `fontFamily` directly rather than through a
 * NativeWind class — those cannot be reached by the CSS-variable swap because
 * their styles are built once at module scope.
 */
export function useFaces(): LocaleFaces {
  return facesFor(useLocale());
}
