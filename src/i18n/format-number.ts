import { localeMeta, type Locale } from './locales';

/**
 * Digit grouping, hand-rolled for the same reason as the plural selector: this
 * game's numbers must read identically on every device, and `Intl.NumberFormat`
 * is exactly as uneven across Hermes builds as `Intl.PluralRules`.
 *
 * It also replaces a genuine pre-existing bug. Several call sites use a bare
 * `toLocaleString()` — `view-models.ts:560`, `event-selection.ts:189` and five
 * in `store.ts` — which follows the *device* locale, so a German phone already
 * shows "1.240" where an American one shows "1,240", with no setting
 * controlling it.
 */
export function formatInteger(locale: Locale, value: number): string {
  const truncated = Math.trunc(value);
  const negative = truncated < 0;
  const digits = String(Math.abs(truncated));
  const separator = localeMeta(locale).groupSeparator;

  let grouped = '';
  for (let index = 0; index < digits.length; index += 1) {
    // Before every digit whose distance from the end is a multiple of three.
    if (index > 0 && (digits.length - index) % 3 === 0) grouped += separator;
    grouped += digits[index];
  }

  return negative ? `-${grouped}` : grouped;
}

/**
 * The currency is invented, so the symbol is part of the game's look rather
 * than a locale decision — only the grouping localises.
 */
export function formatMoney(locale: Locale, value: number): string {
  const truncated = Math.trunc(value);
  const body = formatInteger(locale, Math.abs(truncated));
  return truncated < 0 ? `-$${body}` : `$${body}`;
}
