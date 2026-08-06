// NOTE: `glyph-coverage.ts` is deliberately NOT re-exported here. It reads TTF
// files with `fs`, which Metro cannot bundle — it is a CI/test tool and must be
// imported directly by the tests that use it.
export { CatalogSchema, type Catalog } from './catalog-schema';
export { formatInteger, formatMoney } from './format-number';
export { contentStrings } from './content-strings';
export { loadCatalog } from './load-catalogs';
export {
  ENABLED_LOCALES,
  LOCALES,
  isLocale,
  localeMeta,
  type Locale,
  type LocaleFaces,
  type LocaleMeta,
  type PluralRule,
} from './locales';
export { pluralSuffix, type PluralSuffix } from './plural';
export { resolveCopy, type CopyParams } from './resolve';
export { copyFor, facesFor, type CopyFn } from './use-copy';
export { LocaleProvider, useCopy, useFaces, useLocale } from './locale-context';
export { pixelStylesFor, usePixelStyles } from './use-pixel-styles';
