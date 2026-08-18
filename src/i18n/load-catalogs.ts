import enJson from '../../content/i18n/en.json';
import { CatalogSchema, type Catalog } from './catalog-schema';
import type { Locale } from './locales';

type CatalogModule = { default: unknown };

const RAW = new Map<Locale, unknown>([['en', enJson]]);
const pending = new Map<Locale, Promise<void>>();

/**
 * Keep non-English catalogs out of the startup graph. Metro turns these async
 * imports into one web chunk per locale, so a player downloads and parses only
 * the catalog that the saved or device language needs.
 */
const LOADERS: Readonly<Partial<Record<Locale, () => Promise<CatalogModule>>>> =
  {
    es: () => import('../../content/i18n/es.json'),
    'pt-BR': () => import('../../content/i18n/pt-BR.json'),
    fr: () => import('../../content/i18n/fr.json'),
    de: () => import('../../content/i18n/de.json'),
    id: () => import('../../content/i18n/id.json'),
    vi: () => import('../../content/i18n/vi.json'),
  };

/**
 * Parsed once per locale, mirroring `src/content/load.ts`.
 *
 * Unlike that loader this one does *not* hand out copies. A catalog is read-only
 * to every consumer, and cloning tens of thousands of strings on each screen
 * would be a real cost for no benefit — the mutation hazard that forced copies
 * in the content loader does not exist here.
 */
const cache = new Map<Locale, Catalog>();

export function registerCatalog(locale: Locale, raw: unknown): void {
  RAW.set(locale, raw);
  cache.delete(locale);
}

export function ensureCatalog(locale: Locale): Promise<void> {
  if (RAW.has(locale)) return Promise.resolve();
  const inFlight = pending.get(locale);
  if (inFlight !== undefined) return inFlight;
  const loader = LOADERS[locale];
  if (loader === undefined) {
    return Promise.reject(new Error(`No catalog loader for locale ${locale}.`));
  }
  const request = loader()
    .then((module) => registerCatalog(locale, module.default))
    .finally(() => pending.delete(locale));
  pending.set(locale, request);
  return request;
}

export function loadCatalog(locale: Locale): Catalog {
  const cached = cache.get(locale);
  if (cached !== undefined) return cached;
  const raw = RAW.get(locale);
  if (raw === undefined) {
    throw new Error(
      `Catalog ${locale} was read before ensureCatalog(${locale}) completed.`,
    );
  }
  const parsed = CatalogSchema.parse(raw);
  cache.set(locale, parsed);
  return parsed;
}
