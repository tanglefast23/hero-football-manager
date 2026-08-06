/**
 * The seven shipping languages, chosen for football-fan population and filtered
 * by whether the pixel font can render them — see
 * docs/superpowers/specs/2026-08-06-multilingual-copy-design.md §2.
 *
 * `ENABLED_LOCALES` is deliberately separate from `LOCALES`. Translation lands
 * one language at a time, and both the picker and every CI quality gate run
 * against enabled locales only. Without that split, a gate asserting "every
 * English key exists in all six catalogs" would fail from the first day of the
 * first translation phase until the last day of the last one.
 */
export const LOCALES = ['en', 'es', 'pt-BR', 'fr', 'de', 'id', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];

/** Widen as each language completes its translation phase. */
export const ENABLED_LOCALES: readonly Locale[] = ['en', 'es'];

/**
 * Which plural forms a language needs. Hermes' `Intl` coverage varies by
 * platform and the game must behave identically on both, so this is hand-rolled
 * rather than delegated to `Intl.PluralRules`.
 *
 * - `oneOther`  — n === 1 is singular; 0 is plural.
 * - `zeroIsOne` — 0 and 1 are both singular. French AND Brazilian Portuguese:
 *   CLDR gives `pt` the rule `i = 0 or 1 -> one`, so "0 jogador" is correct and
 *   "0 jogadores" is not. Grouping pt-BR with Spanish would ship that bug in
 *   every zero-count string.
 * - `none`      — no plural marking at all.
 */
export type PluralRule = 'oneOther' | 'zeroIsOne' | 'none';

export interface LocaleFaces {
  /** Buttons, labels, headings — the `display` voice in PixelText. */
  display: string;
  /** Money, stats, table cells — the `data` voice. */
  data: string;
}

export interface LocaleMeta {
  /** The language's name in itself. Never "Spanish". */
  endonym: string;
  pluralRule: PluralRule;
  /**
   * Thousands separator. The game's `$` is fictional and never localises.
   *
   * French uses U+00A0 NO-BREAK SPACE, deliberately not the typographically
   * correct U+202F NARROW NO-BREAK SPACE: Silkscreen has neither U+202F nor
   * U+2009 (verified against its cmap), so the typographic choice would put a
   * tofu box in every French money value on screen. U+00A0 is present.
   */
  groupSeparator: string;
  faces: LocaleFaces;
  /**
   * How much longer than English this language may run, before the `+2` slack.
   * The copy-budget gate reads it. It lives here so there is one table rather
   * than a constant inside the gate that drifts from this registry.
   */
  expansion: number;
}

const SILKSCREEN: LocaleFaces = {
  display: 'Silkscreen_700Bold',
  data: 'Silkscreen_400Regular',
};

/**
 * Silkscreen maps 226 glyphs — Latin-1 only. Vietnamese needs 134 letters it
 * does not have (`ế ộ ữ ạ ằ ọ đ ơ ư` and the rest), and the combining marks to
 * compose them are absent too, so `vi` alone renders in Handjet.
 *
 * Handjet rather than VT323 because it ships matching 400 and 700 cuts.
 * `PixelText` treats the display/data split as load-bearing and forbids
 * faux-bold on a bitmap face; VT323's single weight would collapse both voices
 * into one for Vietnamese only.
 */
const HANDJET: LocaleFaces = {
  display: 'Handjet_700Bold',
  data: 'Handjet_400Regular',
};

const META: Readonly<Record<Locale, LocaleMeta>> = {
  en: { endonym: 'English', pluralRule: 'oneOther', groupSeparator: ',', faces: SILKSCREEN, expansion: 1 },
  es: { endonym: 'Español', pluralRule: 'oneOther', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.25 },
  'pt-BR': { endonym: 'Português (Brasil)', pluralRule: 'zeroIsOne', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.25 },
  fr: { endonym: 'Français', pluralRule: 'zeroIsOne', groupSeparator: ' ', faces: SILKSCREEN, expansion: 1.25 },
  de: { endonym: 'Deutsch', pluralRule: 'oneOther', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.3 },
  id: { endonym: 'Bahasa Indonesia', pluralRule: 'none', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.2 },
  vi: { endonym: 'Tiếng Việt', pluralRule: 'none', groupSeparator: '.', faces: HANDJET, expansion: 1.15 },
};

export function localeMeta(locale: Locale): LocaleMeta {
  return META[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
