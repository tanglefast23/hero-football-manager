import { ENABLED_LOCALES, localeMeta, type Locale } from '../i18n';

export interface LanguagePanelRow {
  locale: Locale;
  /** The language's name in its own language. Never "Spanish". */
  endonym: string;
  selected: boolean;
  /**
   * The face this row must be drawn in, which is not always the active
   * language's face.
   *
   * "Tiếng Việt" contains `ế` and `ệ`, and Silkscreen has neither. Drawn in the
   * active locale's face while the player is still in English, that row would
   * show the mid-word typeface substitution this whole feature exists to
   * prevent — in the picker itself. So every row carries its own face.
   */
  face: string;
}

/**
 * What the language picker shows.
 *
 * Rows come from `ENABLED_LOCALES`, not from the full `LOCALES` union: offering
 * a language whose catalog is still empty means offering a menu item that
 * visibly does nothing. English fallback makes that safe, not honest.
 */
export function languagePanelRows(
  active: Locale,
  available: readonly Locale[] = ENABLED_LOCALES,
): LanguagePanelRow[] {
  return available.map((locale) => ({
    locale,
    endonym: localeMeta(locale).endonym,
    selected: locale === active,
    face: localeMeta(locale).faces.display,
  }));
}
