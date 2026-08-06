import { localeMeta, type Locale } from './locales';

export type PluralSuffix = 'one' | 'other';

/**
 * Which sibling key a count selects: `squad.count.one` or `squad.count.other`.
 *
 * Hand-rolled rather than `Intl.PluralRules` for the same reason the number
 * formatter is: Hermes' `Intl` coverage varies by platform, and this game has
 * to read identically on every device.
 *
 * Magnitude, not sign: "-1 point" is as singular as "1 point", and the game
 * shows negative money often enough for that to matter.
 */
export function pluralSuffix(locale: Locale, count: number): PluralSuffix {
  const n = Math.abs(count);
  switch (localeMeta(locale).pluralRule) {
    case 'none':
      return 'other';
    case 'zeroIsOne':
      return n === 0 || n === 1 ? 'one' : 'other';
    case 'oneOther':
      return n === 1 ? 'one' : 'other';
  }
}
