import { ENABLED_LOCALES, type Locale } from './locales';

/**
 * Which language the game should open in, read from the device.
 *
 * **Not the App Store country.** A store account is a billing address, not a
 * language: a Vietnamese speaker in Texas has a US store and a Vietnamese
 * phone, and a British expat in Berlin has a German store and an English one.
 * iOS hands an app the user's ordered list of preferred languages directly, and
 * that list is the only honest signal.
 *
 * The matching is a pure function over BCP-47 tags so it can be tested — this
 * project's Jest runs in `node` with no react-native, so anything that reaches
 * for `expo-localization` at module scope is untestable. `deviceLocale()` is the
 * only part that touches the native module, and it is a thin wrapper.
 */

/**
 * Languages the game may switch to on its own — all seven.
 *
 * Vietnamese was held out of this list while its face was unproven: 102
 * hand-built glyphs that had only ever been seen through a rasteriser on a Mac,
 * never on glass. Auto-selecting a language nobody had read on a real screen
 * was a bet worth not taking.
 *
 * The owner, who reads Vietnamese, has since run the game on a device and
 * confirmed it renders correctly — the §6.5 sign-off in
 * `docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md`. So it
 * joins the rest.
 */
export const AUTO_LOCALES: readonly Locale[] = [
  'en',
  'es',
  'pt-BR',
  'fr',
  'de',
  'id',
  'vi',
];

/**
 * Device tag prefixes that resolve to one of ours.
 *
 * Keyed by the tag's language subtag, lower-cased, because a device reports
 * `es-MX`, `fr-CA` or `de-AT` and every one of those should land on the single
 * catalog this game ships for that language. Regional Portuguese is the one
 * real judgement: the game has only pt-BR, so `pt-PT` gets Brazilian rather
 * than English — closer to right than not translating at all.
 *
 * `in` is Indonesian's retired ISO code. iOS reports `id`, but Java and older
 * Android still emit `in`, and it costs one line to accept both.
 */
const LANGUAGE_SUBTAG: Readonly<Record<string, Locale>> = {
  en: 'en',
  es: 'es',
  pt: 'pt-BR',
  fr: 'fr',
  de: 'de',
  id: 'id',
  in: 'id',
  vi: 'vi',
};

/**
 * The first device language the game can actually draw, or `undefined`.
 *
 * Ordered, so a phone set to Catalan-then-Spanish gets Spanish rather than
 * English. `auto` is which locales may be chosen without asking — pass
 * `ENABLED_LOCALES` to resolve a language the player picked themselves, and
 * `AUTO_LOCALES` to decide what to open in.
 */
export function matchDeviceLocale(
  tags: readonly string[],
  auto: readonly Locale[] = AUTO_LOCALES,
): Locale | undefined {
  for (const tag of tags) {
    const subtag = tag.split(/[-_]/)[0]?.toLowerCase();
    if (subtag === undefined) continue;
    const locale = LANGUAGE_SUBTAG[subtag];
    if (
      locale !== undefined &&
      auto.includes(locale) &&
      ENABLED_LOCALES.includes(locale)
    ) {
      return locale;
    }
  }
  return undefined;
}

/**
 * The device's preferred languages, newest API first.
 *
 * Wrapped in a try/catch and imported lazily because this is the one place the
 * native module is touched: a web build, a test runner and a headless render
 * all reach this code, and none of them has `expo-localization`. Failing to
 * read the device language is not an error — it just means the game opens in
 * English, which is what it did before this file existed.
 */
export function deviceLanguageTags(): readonly string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const localization = require('expo-localization') as {
      getLocales?: () => readonly {
        languageTag?: string;
        languageCode?: string;
      }[];
    };
    const locales = localization.getLocales?.() ?? [];
    return locales
      .map((entry) => entry.languageTag ?? entry.languageCode ?? '')
      .filter((tag) => tag.length > 0);
  } catch {
    return [];
  }
}

/** The language to open in on a first launch, or `undefined` to stay English. */
export function deviceLocale(): Locale | undefined {
  return matchDeviceLocale(deviceLanguageTags());
}
