import { contentStrings } from './content-strings';
import { loadCatalog } from './load-catalogs';
import { localeMeta, type Locale, type LocaleFaces } from './locales';
import { resolveCopy, type CopyParams } from './resolve';

export type CopyFn = ((key: string, params?: CopyParams) => string) & {
  /** Locale marker used by number and money formatters at the UI boundary. */
  readonly locale?: Locale;
};

/**
 * Pure, and exported for tests.
 *
 * The hooks in `locale-context` are thin wrappers around these two functions
 * because this project's Jest config cannot render a component at all —
 * `testEnvironment` is `node` and `require('react-native')` throws. Keeping the
 * logic outside the hook is what makes any of it testable.
 */
/**
 * English comes from two places, and deliberately so: UI chrome from `en.json`,
 * content prose from the content files it is authored in. Neither duplicates
 * the other, so there is nothing to keep in sync. Chrome wins a collision,
 * because a chrome key is the one someone wrote on purpose.
 */
function englishStrings(): Readonly<Record<string, string>> {
  return { ...contentStrings(), ...loadCatalog('en').strings };
}

export function copyFor(locale: Locale): CopyFn {
  const english = englishStrings();
  const strings = locale === 'en' ? english : loadCatalog(locale).strings;
  return Object.assign(
    (key: string, params?: CopyParams) =>
      resolveCopy(locale, strings, english, key, params),
    { locale },
  );
}

export function facesFor(locale: Locale): LocaleFaces {
  return localeMeta(locale).faces;
}
