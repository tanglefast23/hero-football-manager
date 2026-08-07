import deGlossary from '../../content/i18n/glossary/de.json';
import esGlossary from '../../content/i18n/glossary/es.json';
import frGlossary from '../../content/i18n/glossary/fr.json';
import idGlossary from '../../content/i18n/glossary/id.json';
import ptBrGlossary from '../../content/i18n/glossary/pt-BR.json';
import viGlossary from '../../content/i18n/glossary/vi.json';
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


/**
 * The coined terms a locale must use, and the forms it may use them in.
 *
 * Bundled rather than read from disk, so it works in the app as well as in a
 * test — `copy-budget.ts` needs it at runtime to stop the width rule demanding
 * a term shorter than the glossary allows, and the gate needs it to check the
 * translations. One loader, so the two can never disagree about what the
 * approved forms are.
 *
 * English has no glossary: it is the source the patterns are written against.
 */
export interface GlossaryTerm {
  readonly english: string;
  readonly englishPattern: string;
  readonly allowedForms: readonly string[];
}

export interface Glossary {
  readonly terms: readonly GlossaryTerm[];
}

const GLOSSARIES: Partial<Record<Locale, Glossary>> = {
  es: esGlossary as Glossary,
  'pt-BR': ptBrGlossary as Glossary,
  fr: frGlossary as Glossary,
  de: deGlossary as Glossary,
  id: idGlossary as Glossary,
  vi: viGlossary as Glossary,
};

export function loadGlossary(locale: Locale): Glossary {
  return GLOSSARIES[locale] ?? { terms: [] };
}
