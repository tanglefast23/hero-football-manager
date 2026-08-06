import { readFileSync } from 'fs';
import { join } from 'path';
import { ENABLED_LOCALES, LOCALES, contentStrings, loadCatalog, localeMeta } from '../index';
import { faceFile, glyphSet, missingGlyphs } from '../glyph-coverage';
import { faceForKey } from '../voice';
import { advanceEm } from '../advance';
import {
  COLUMN_MIN_GUTTER,
  HEADER_MAX_FONT_MULTIPLIER,
  LEAGUE_COLUMN_WIDTH,
  LEAGUE_HEADER_FONT_SIZE,
} from '../../ui/league-table-columns';

/**
 * UI chrome only. This is the set a locale MUST translate in full, so it is what
 * key parity and the fragment check run against.
 */
const english = () => loadCatalog('en').strings;

/**
 * Every English string a locale could be translating — chrome plus content
 * prose, read from the files it is authored in.
 *
 * Gates that MEASURE a translation against its source (budget, placeholders,
 * terminology) must use this. A source that only knows about chrome silently
 * measures every content translation against an empty string, which is not a
 * soft failure: the budget collapses to 2 characters and the placeholder check
 * expects none. The first translated tip found exactly that.
 *
 * Parity deliberately does NOT use it: content prose falls back to English by
 * design, and gate 10 tracks how much of it is done instead.
 */
const englishAll = () => ({ ...contentStrings(), ...loadCatalog('en').strings });
const translated = () => ENABLED_LOCALES.filter(locale => locale !== 'en');

const placeholders = (value: string) =>
  (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();

describe('i18n gates', () => {
  test('gate 1 — every English key exists in every enabled locale', () => {
    const keys = Object.keys(english());
    for (const locale of translated()) {
      const have = new Set(Object.keys(loadCatalog(locale).strings));
      expect({ locale, missing: keys.filter(key => !have.has(key)) })
        .toEqual({ locale, missing: [] });
    }
  });

  test('gate 3 — every translation is inside its character budget', () => {
    // A copy rule, not a layout guarantee: Silkscreen is proportional, so
    // character count is a poor proxy for pixel width. Layout safety comes from
    // the measured advance tables. This keeps the translation honest about
    // "succinct always".
    const source = englishAll();
    for (const locale of translated()) {
      const ceiling = localeMeta(locale).expansion;
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        if (key.startsWith('col.')) continue; // layout tokens, sized by measurement
        // A percentage is the wrong instrument for a short label. "Fans" is four
        // characters; x1.25 + 2 allows seven, and there is no seven-character
        // Spanish word for it — "Aficionados" is simply what it is called. The
        // rule exists to stop sprawl in sentences, so short sources get a flat
        // allowance instead of a proportional one that rounds to nothing.
        const english = source[key]?.length ?? 0;
        const limit = Math.max(Math.ceil(english * ceiling) + 2, english + 8);
        expect({ locale, key, length: value.length, limit })
          .toMatchObject({ locale, key });
        expect(value.length).toBeLessThanOrEqual(limit);
      }
    }
  });

  test('gate 4 — placeholders match the English source exactly', () => {
    // A dropped {player} is a silent content bug: the string still renders, it
    // just stops naming anyone.
    const source = englishAll();
    for (const locale of translated()) {
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        expect({ locale, key, placeholders: placeholders(value) })
          .toEqual({ locale, key, placeholders: placeholders(source[key] ?? '') });
      }
    }
  });

  test('gate 5 — every string renders in a face that has its glyphs', () => {
    const covered = new Map<string, ReadonlySet<number>>();
    for (const locale of ENABLED_LOCALES) {
      const faces = localeMeta(locale).faces;
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        const family = faceForKey(key, faces);
        if (family === null) continue; // body voice: platform sans, any glyph
        if (!covered.has(family)) covered.set(family, glyphSet(faceFile(family)));
        expect({ locale, key, missing: missingGlyphs(value, covered.get(family)!) })
          .toEqual({ locale, key, missing: [] });
      }
    }
  });

  test('gate 5b — the formatter s own characters exist in the face', () => {
    // Separators live in code, not in the catalog, so gate 5 cannot see them.
    // This is what catches a narrow space like U+202F that Silkscreen lacks,
    // without anyone having to look at a French screenshot.
    for (const locale of LOCALES) {
      const covered = glyphSet(faceFile(localeMeta(locale).faces.data));
      const characters = `${localeMeta(locale).groupSeparator}$-0123456789`;
      expect({ locale, missing: missingGlyphs(characters, covered) })
        .toEqual({ locale, missing: [] });
    }
  });

  test('gate 3b — no key holds a sentence fragment, in any language', () => {
    // A label trailing off on a preposition is half a sentence. Keyed as-is it
    // forces every language into English word order, and reads as a typo
    // wherever it lands.
    //
    // Two things this got wrong first time round, both worth keeping written
    // down. The list has to be PER LANGUAGE — an English-only one let a French
    // "Sang-froid du" through, the same mistake invisible to an English regex.
    // And it must compare whole TOKENS, not use `\b`: JavaScript's word
    // boundary treats "ñ" and "í" as non-word characters, so /\bo$/ happily
    // matched "año" and /\ba$/ matched "energía".
    //
    // Only unambiguous prepositions and definite articles are listed.
    // Conjunctions and indefinite articles ("y", "or", "una") legitimately end
    // real phrases, and a gate that cries wolf gets switched off.
    const TRAILING: Readonly<Record<string, readonly string[]>> = {
      en: ['the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with', 'from', 'by', 'at'],
      es: ['el', 'la', 'los', 'las', 'de', 'del', 'al', 'para', 'por', 'con', 'en'],
      'pt-BR': ['o', 'os', 'as', 'de', 'do', 'da', 'para', 'por', 'com', 'em', 'no', 'na'],
      fr: ['le', 'les', 'de', 'du', 'des', 'à', 'au', 'aux', 'pour', 'par', 'avec', 'en'],
      // German separable verbs park their particle at the end, so "an", "mit",
      // "auf", "zu" and "in" all finish perfectly good sentences — "Ruf mich
      // nicht an" is complete. Only articles and prepositions that can never be
      // a separable prefix are listed.
      de: ['der', 'die', 'das', 'von', 'für'],
      id: ['di', 'ke', 'dari', 'untuk', 'dengan', 'yang', 'pada'],
      // Vietnamese is analytic and its function words double as content words,
      // so a trailing-token check would fire constantly. Its fragments are
      // caught by the in-context review instead.
    };

    const lastToken = (value: string) =>
      value.trim().replace(/[.!?:;,"“”«»]+$/u, '').split(/\s+/).at(-1)?.toLowerCase() ?? '';

    for (const locale of ENABLED_LOCALES) {
      const trailing = TRAILING[locale];
      if (trailing === undefined) continue;
      const strings = locale === 'en' ? english() : loadCatalog(locale).strings;
      const fragments = Object.entries(strings)
        .filter(([, value]) => trailing.includes(lastToken(value)))
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

      expect({ locale, fragments }).toEqual({ locale, fragments: [] });
    }
  });

  test('gate 5c — every endonym renders in its OWN face', () => {
    // The picker draws each language's name in that language's face. If one of
    // them cannot be drawn, the control offering the fix is itself broken.
    for (const locale of LOCALES) {
      const meta = localeMeta(locale);
      const covered = glyphSet(faceFile(meta.faces.display));
      expect({ locale, missing: missingGlyphs(meta.endonym, covered) })
        .toEqual({ locale, missing: [] });
    }
  });
});

describe('persisted labels resolve through the catalog', () => {
  test('every labelKey a producer writes exists in the English catalog', () => {
    // A producer that dual-writes a key nothing can resolve is worse than one
    // that writes English only: the fallback still renders, so nothing looks
    // broken, and the string silently never translates.
    const sources = ['src/game/career.ts', 'src/game/player-requests.ts'];
    const keys = sources.flatMap(file => {
      const text = readFileSync(join(process.cwd(), file), 'utf8');
      return [
        ...[...text.matchAll(/labelKey: '([^']+)'/g)].map(match => match[1]!),
        ...[...text.matchAll(/labelKey: `([^`]+)`/g)].map(match => match[1]!),
      ];
    });

    expect(keys.length).toBeGreaterThan(0);
    // Both English sources: chrome keys from en.json, content keys derived from
    // the content files. A producer may legitimately reference either.
    const known = new Set(Object.keys(englishAll()));
    // Template keys are built from a content id at runtime, so check the prefix
    // resolves for every id rather than the literal `${...}` text.
    const dynamic = keys.filter(key => key.includes('$'));
    const literal = keys.filter(key => !key.includes('$'));
    expect(literal.filter(key => !known.has(key))).toEqual([]);
    for (const template of dynamic) {
      const prefix = template.slice(0, template.indexOf('$'));
      expect({ template, matches: [...known].some(key => key.startsWith(prefix)) })
        .toEqual({ template, matches: true });
    }
  });
});

describe('gate 8 — column headers fit, in every enabled locale', () => {
  const COLUMNS = {
    position: 'col.league.position',
    played: 'col.league.played',
    won: 'col.league.won',
    drawn: 'col.league.drawn',
    lost: 'col.league.lost',
    goalDifference: 'col.league.goalDifference',
    points: 'col.league.points',
  } as const;

  /** The header's own size cap and gutter, from league-table-columns.ts. */
  const demandOf = (label: string, family: string) =>
    advanceEm(label, family) * LEAGUE_HEADER_FONT_SIZE * HEADER_MAX_FONT_MULTIPLIER
      + COLUMN_MIN_GUTTER;

  test('every locale s header fits its column', () => {
    // Measured against the real font, not counted in characters: Silkscreen is
    // proportional, so "PJ" and "SP" are not the same width even though both
    // are two letters.
    for (const locale of ENABLED_LOCALES) {
      const strings = loadCatalog(locale).strings;
      const family = localeMeta(locale).faces.data;
      for (const [column, key] of Object.entries(COLUMNS)) {
        const label = strings[key] ?? english()[key]!;
        const width = LEAGUE_COLUMN_WIDTH[column as keyof typeof LEAGUE_COLUMN_WIDTH];
        expect({ locale, column, label, demand: Math.ceil(demandOf(label, family) * 10) / 10, width })
          .toMatchObject({ locale, column });
        expect(demandOf(label, family)).toBeLessThanOrEqual(width);
      }
    }
  });

  test('no locale widens the row beyond what English already needs', () => {
    // Per-column fitting is necessary but not sufficient: the fixed columns
    // collectively crowd out the flexible club-name column, which is the one
    // that pays for every fixed-width increase.
    //
    // This is a REGRESSION guard, not an absolute fit claim. The seven-column
    // row is already 300pt of fixed width and gutters before a club name, which
    // is tight on a 320pt phone — but that is English's own pre-existing
    // squeeze, shipped today, and not something localisation introduced. What
    // localisation must not do is make it worse: `LEAGUE_COLUMN_WIDTH` is a max
    // across locales, so a long header in one language silently widens the
    // table in all of them, English included.
    const fixed = Object.values(LEAGUE_COLUMN_WIDTH).reduce((sum, width) => sum + width, 0);
    const gutters = COLUMN_MIN_GUTTER * (Object.keys(LEAGUE_COLUMN_WIDTH).length - 1);

    // The width English alone requires. Raising this is a deliberate layout
    // decision that belongs in review, not a side effect of adding a language.
    const ENGLISH_ROW_BUDGET = 300;

    expect({ fixed, gutters, total: fixed + gutters })
      .toMatchObject({ fixed, gutters });
    expect(fixed + gutters).toBeLessThanOrEqual(ENGLISH_ROW_BUDGET);
  });
});

describe('gate 9 — locked terminology', () => {
  test('every coined term uses an approved form in every enabled locale', () => {
    // Scope is coined terms ONLY. Ordinary football vocabulary stays advisory,
    // because a substring check on it false-positives constantly on Spanish
    // inflection and German compounding — and a gate that cries wolf gets
    // switched off.
    const source = englishAll();
    for (const locale of ENABLED_LOCALES.filter(l => l !== 'en')) {
      const glossary = loadGlossary(locale);
      const strings = loadCatalog(locale).strings;
      const offenders: string[] = [];

      for (const term of glossary.terms) {
        const pattern = new RegExp(term.englishPattern);
        for (const [key, value] of Object.entries(strings)) {
          if (!pattern.test(source[key] ?? '')) continue;
          if (!term.allowedForms.some(form => value.includes(form))) {
            offenders.push(`${key}: ${JSON.stringify(value)} lacks ${term.allowedForms.join(' / ')}`);
          }
        }
      }
      expect({ locale, offenders }).toEqual({ locale, offenders: [] });
    }
  });

  test('the check is not vacuous — the glossary and the catalog both have content', () => {
    for (const locale of ENABLED_LOCALES.filter(l => l !== 'en')) {
      expect(loadGlossary(locale).terms.length).toBeGreaterThan(0);
      expect(Object.keys(loadCatalog(locale).strings).length).toBeGreaterThan(0);
    }
  });
});

interface Glossary {
  terms: { english: string; englishPattern: string; allowedForms: string[] }[];
}

function loadGlossary(locale: string): Glossary {
  return JSON.parse(
    readFileSync(join(process.cwd(), `content/i18n/glossary/${locale}.json`), 'utf8'),
  ) as Glossary;
}

describe('gate 10 — content-prose coverage is measured, not assumed', () => {
  /**
   * How much of each locale's content prose is translated.
   *
   * Content keys resolve through English when a locale has not translated them,
   * which is correct behaviour and completely silent — a French player sees a
   * French menu and an English event, and nothing fails. That silence is the
   * problem: without a number, "the long tail" stays a vibe rather than a
   * quantity, and nobody can tell 5% done from 95% done.
   *
   * These floors may only ever RISE. Raising one is how a batch of long-tail
   * translation gets recorded as landed.
   */
  const COVERAGE_FLOOR: Readonly<Record<string, number>> = {
    es: 25, 'pt-BR': 19, fr: 19, id: 19, de: 19, vi: 19,
  };

  test('every locale meets its recorded content-prose floor', () => {
    const contentKeys = Object.keys(contentStrings());
    expect(contentKeys.length).toBeGreaterThan(0);

    const report: Record<string, string> = {};
    for (const locale of ENABLED_LOCALES.filter(l => l !== 'en')) {
      const translated = loadCatalog(locale).strings;
      const done = contentKeys.filter(key => key in translated).length;
      const percent = Math.floor((done / contentKeys.length) * 100);
      report[locale] = `${done}/${contentKeys.length} (${percent}%)`;
      expect({ locale, percent }).toMatchObject({ locale });
      expect(percent).toBeGreaterThanOrEqual(COVERAGE_FLOOR[locale] ?? 0);
    }
    // eslint-disable-next-line no-console
    console.log('content prose coverage:', report);
  });
});
