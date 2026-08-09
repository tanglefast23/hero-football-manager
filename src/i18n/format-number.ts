import { localeMeta, type Locale } from './locales';
import type { CopyFn } from './use-copy';

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
export function formatInteger(
  locale: Locale,
  value: number,
  signed = false,
): string {
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

  return negative
    ? `-${grouped}`
    : signed && truncated > 0
      ? `+${grouped}`
      : grouped;
}

/**
 * The currency is invented, so the symbol is part of the game's look rather
 * than a locale decision — only the grouping localises.
 */
export function formatMoney(
  locale: Locale,
  value: number,
  signed = false,
): string {
  const truncated = Math.trunc(value);
  const body = formatInteger(locale, Math.abs(truncated));
  const sign = truncated < 0 ? '-' : signed && truncated > 0 ? '+' : '';
  return `${sign}$${body}`;
}

/** Formats a value for the locale already bound to t(). */
export function formatIntegerForCopy(
  t: CopyFn,
  value: number,
  signed = false,
): string {
  // Hand-authored test doubles predate the locale marker, so they retain the
  // English fallback until their caller provides a real copyFor() function.
  return formatInteger(t.locale ?? 'en', value, signed);
}

export function formatMoneyForCopy(
  t: CopyFn,
  value: number,
  signed = false,
): string {
  return formatMoney(t.locale ?? 'en', value, signed);
}
