import { loadCatalog } from './load-catalogs';
import { localeMeta, type Locale, type LocaleFaces } from './locales';
import { resolveCopy, type CopyParams } from './resolve';

export type CopyFn = (key: string, params?: CopyParams) => string;

/**
 * Pure, and exported for tests.
 *
 * The hooks in `locale-context` are thin wrappers around these two functions
 * because this project's Jest config cannot render a component at all —
 * `testEnvironment` is `node` and `require('react-native')` throws. Keeping the
 * logic outside the hook is what makes any of it testable.
 */
export function copyFor(locale: Locale): CopyFn {
  const strings = loadCatalog(locale).strings;
  const fallback = locale === 'en' ? strings : loadCatalog('en').strings;
  return (key, params) => resolveCopy(locale, strings, fallback, key, params);
}

export function facesFor(locale: Locale): LocaleFaces {
  return localeMeta(locale).faces;
}
