import { pluralSuffix } from './plural';
import type { Locale } from './locales';

export type CopyParams = Readonly<Record<string, string | number>>;
type Strings = Readonly<Record<string, string>>;

/**
 * A key with an `n` param may be stored as `key.one` / `key.other` instead of
 * `key`. A plain key wins, so a string only pluralises if it was authored to.
 */
function lookup(
  strings: Strings,
  key: string,
  locale: Locale,
  params?: CopyParams,
): string | undefined {
  const direct = strings[key];
  if (direct !== undefined) return direct;
  const count = params?.n;
  if (typeof count !== 'number') return undefined;
  return strings[`${key}.${pluralSuffix(locale, count)}`];
}

/**
 * Single-pass interpolation.
 *
 * Replacing placeholders one at a time would let a param value that itself
 * contains `{name}` be substituted by a later pass. Player and club names are
 * user input, so that is reachable rather than theoretical.
 */
function interpolate(template: string, params?: CopyParams): string {
  if (params === undefined) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = params[name];
    // Leave the placeholder visible rather than printing "undefined": a stray
    // `{player}` on screen is an obvious bug, whereas "undefined" reads as copy
    // and survives review.
    return value === undefined ? match : String(value);
  });
}

/**
 * Resolution order: the active locale, then English, then the key itself.
 *
 * Returning the key rather than an empty string is deliberate — a blank label
 * looks like a layout bug and hides, whereas `market.bid.confirm` on screen
 * names its own missing entry.
 */
export function resolveCopy(
  locale: Locale,
  strings: Strings,
  fallback: Strings,
  key: string,
  params?: CopyParams,
): string {
  const template = lookup(strings, key, locale, params) ?? lookup(fallback, key, 'en', params);
  return template === undefined ? key : interpolate(template, params);
}
