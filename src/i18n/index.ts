// NOTE: `glyph-coverage.ts` is deliberately NOT re-exported here. It reads TTF
// files with `fs`, which Metro cannot bundle — it is a CI/test tool and must be
// imported directly by the tests that use it.
//
// `copy-budget.ts` is left out for the neighbouring reason: nothing the player
// touches calls `copyBudget`, only the width gate in `gates.test.ts` does, and
// re-exporting it here put it — and the six glossary JSON files it now owns —
// into the web first-load bundle, because App.tsx imports this barrel. Import
// it from `./copy-budget` directly, as the gate does.
export { CatalogSchema, type Catalog } from './catalog-schema';
export {
  formatInteger,
  formatIntegerForCopy,
  formatMoney,
  formatMoneyForCopy,
  formatThousandsForCopy,
} from './format-number';
export {
  contentStrings,
  glossaryTermSlug,
  powerCopySlug,
  proseSlug,
} from './content-strings';
export { ensureCatalog, loadCatalog, registerCatalog } from './load-catalogs';
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
export { AUTO_LOCALES, deviceLocale, matchDeviceLocale } from './device-locale';
export { LocaleProvider, useCopy, useFaces, useLocale } from './locale-context';
export { pixelStylesFor, usePixelStyles } from './use-pixel-styles';
