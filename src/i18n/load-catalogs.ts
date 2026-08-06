import deJson from '../../content/i18n/de.json';
import enJson from '../../content/i18n/en.json';
import esJson from '../../content/i18n/es.json';
import frJson from '../../content/i18n/fr.json';
import idJson from '../../content/i18n/id.json';
import ptBrJson from '../../content/i18n/pt-BR.json';
import viJson from '../../content/i18n/vi.json';
import { CatalogSchema, type Catalog } from './catalog-schema';
import type { Locale } from './locales';

const RAW: Readonly<Record<Locale, unknown>> = {
  en: enJson,
  es: esJson,
  'pt-BR': ptBrJson,
  fr: frJson,
  de: deJson,
  id: idJson,
  vi: viJson,
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

export function loadCatalog(locale: Locale): Catalog {
  const cached = cache.get(locale);
  if (cached !== undefined) return cached;
  const parsed = CatalogSchema.parse(RAW[locale]);
  cache.set(locale, parsed);
  return parsed;
}
