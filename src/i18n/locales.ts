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

/**
 * Widen as each language completes its translation phase.
 *
 * All seven are live. `vi` was withdrawn for the duration of the copy sweep —
 * the key-parity gate demands every enabled locale carry every key, and
 * Vietnamese would have failed CI from the first extracted string until its
 * last translated one, while its face was unresolved on top of that. Both are
 * done: `HFMSilkscreen` draws all 134 Vietnamese letters, and the catalog is
 * complete.
 *
 * If a language is ever withdrawn again, `scripts/merge-i18n-staging.js` keeps
 * a `GATED_LOCALES` mirror of this list — a `.js` script cannot import this
 * module, so the two have to move together. The drift fails safe: the script
 * refuses to write a catalog no gate would check.
 */
export const ENABLED_LOCALES: readonly Locale[] = [
  'en',
  'es',
  'pt-BR',
  'fr',
  'id',
  'de',
  'vi',
];

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

/**
 * One pixel family, for every language.
 *
 * `HFMSilkscreen` is stock Silkscreen with 102 Vietnamese letters appended —
 * built by `npm run build:fonts` into `assets/fonts/` from the coordinate table
 * in `content/fonts/vi-marks.json`, per
 * `docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md`. Stock
 * Silkscreen maps 226 glyphs, Latin-1 only, and cannot draw `ế ộ ữ ạ ằ ọ đ ơ ư`;
 * the combining marks needed to compose them — breve, hook above, horn, dot
 * below — are absent from its cmap too, so runtime composition was never an
 * option either.
 *
 * Every locale points here, not only `vi`. Repointing Vietnamese alone would
 * ship two Silkscreen lineages in one binary and let them drift, and the face
 * swap is per-language: selecting Vietnamese would redraw the entire UI — most
 * of it still untranslated English — in whichever second face was chosen. The
 * derivative's original 227 glyphs are byte-identical to stock, which
 * `src/i18n/__tests__/vietnamese-face.test.ts` proves rather than assumes.
 */
const SILKSCREEN: LocaleFaces = {
  display: 'HFMSilkscreen_700Bold',
  data: 'HFMSilkscreen_400Regular',
};

const META: Readonly<Record<Locale, LocaleMeta>> = {
  en: {
    endonym: 'English',
    pluralRule: 'oneOther',
    groupSeparator: ',',
    faces: SILKSCREEN,
    expansion: 1,
  },
  es: {
    endonym: 'Español',
    pluralRule: 'oneOther',
    groupSeparator: '.',
    faces: SILKSCREEN,
    expansion: 1.25,
  },
  'pt-BR': {
    endonym: 'Português (Brasil)',
    pluralRule: 'zeroIsOne',
    groupSeparator: '.',
    faces: SILKSCREEN,
    expansion: 1.25,
  },
  fr: {
    endonym: 'Français',
    pluralRule: 'zeroIsOne',
    groupSeparator: ' ',
    faces: SILKSCREEN,
    expansion: 1.25,
  },
  de: {
    endonym: 'Deutsch',
    pluralRule: 'oneOther',
    groupSeparator: '.',
    faces: SILKSCREEN,
    expansion: 1.3,
  },
  id: {
    endonym: 'Bahasa Indonesia',
    pluralRule: 'none',
    groupSeparator: '.',
    faces: SILKSCREEN,
    expansion: 1.2,
  },
  vi: {
    endonym: 'Tiếng Việt',
    pluralRule: 'none',
    groupSeparator: '.',
    faces: SILKSCREEN,
    expansion: 1.15,
  },
};

export function localeMeta(locale: Locale): LocaleMeta {
  return META[locale];
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}
