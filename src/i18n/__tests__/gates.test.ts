import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ENABLED_LOCALES,
  LOCALES,
  contentStrings,
  loadCatalog,
  loadGlossary,
  localeMeta,
} from '../index';
import { faceFile, glyphSet, missingGlyphs } from '../glyph-coverage';
import { scannedFiles, sourceFiles } from '../hardcoded-prose';
import { faceForKey } from '../voice';
import { budgetClass, copyBudget } from '../copy-budget';
import { advanceEm } from '../advance';
import {
  COLUMN_MIN_GUTTER,
  HEADER_MAX_FONT_MULTIPLIER,
  LEAGUE_COLUMN_WIDTH,
  LEAGUE_HEADER_FONT_SIZE,
} from '../../ui/league-table-columns';
import {
  HEADER_FONT_SIZE as REGISTER_HEADER_FONT_SIZE,
  HEADER_MIN_GUTTER as REGISTER_MIN_GUTTER,
  REGISTER_COLUMN_WIDTH,
  SORT_ARROW_GAP,
  SORT_ARROW_WIDTH,
} from '../../ui/squad-register-columns';

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
const englishAll = () => ({
  ...contentStrings(),
  ...loadCatalog('en').strings,
});
const translated = () => ENABLED_LOCALES.filter((locale) => locale !== 'en');

const placeholders = (value: string) =>
  (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();

describe('i18n gates', () => {
  test('gate 1 — every English key exists in every enabled locale', () => {
    const keys = Object.keys(english());
    for (const locale of translated()) {
      const have = new Set(Object.keys(loadCatalog(locale).strings));
      expect({ locale, missing: keys.filter((key) => !have.has(key)) }).toEqual(
        { locale, missing: [] },
      );
    }
  });

  test('gate 1c — no locale carries a key English has dropped', () => {
    // Gate 1 is a SUBSET check, English -> locale, so it cannot see a key a
    // locale still has and English no longer does. That direction was blind for
    // long enough to ship 1,440 dead strings: 30 events were cut from
    // `content/events.json` and their eight keys apiece stayed behind in all six
    // catalogs, ~168 KB of translated prose for text no player can reach,
    // downloaded and parsed on every phone.
    //
    // Measured against `englishAll()`, not the chrome catalog: a locale
    // legitimately carries content keys, which live in `content/*.json` and
    // never appear in `en.json`.
    const known = new Set(Object.keys(englishAll()));
    for (const locale of translated()) {
      const stale = Object.keys(loadCatalog(locale).strings).filter(
        (key) => !known.has(key),
      );
      expect({ locale, stale }).toEqual({ locale, stale: [] });
    }
  });

  test('gate 3 — every translation is inside its character budget', () => {
    // A copy rule, not a layout guarantee: Silkscreen is proportional, so
    // character count is a poor proxy for pixel width. Layout safety comes from
    // the measured advance tables.
    //
    // The ceiling is per-KEY now, not per-locale — see `copy-budget.ts`. One
    // number for the whole catalog was squeezing screen-reader labels, which
    // have no width at all, by the same rule it applied to a chip in a border.
    const source = englishAll();
    for (const locale of translated()) {
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        if (key.startsWith('col.')) continue; // layout tokens, sized by measurement
        const english = source[key];
        if (english === undefined) continue;
        const limit = copyBudget(key, english, locale);
        expect({
          locale,
          key,
          class: budgetClass(key),
          length: value.length,
          limit,
          withinBudget: value.length <= limit,
        }).toMatchObject({ locale, key, withinBudget: true });
      }
    }
  });

  test('gate 4 — placeholders match the English source exactly', () => {
    // A dropped {player} is a silent content bug: the string still renders, it
    // just stops naming anyone.
    const source = englishAll();
    for (const locale of translated()) {
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        expect({ locale, key, placeholders: placeholders(value) }).toEqual({
          locale,
          key,
          placeholders: placeholders(source[key] ?? ''),
        });
      }
    }
  });

  test('gate 5 — every string renders in a face that has its glyphs', () => {
    const covered = new Map<string, ReadonlySet<number>>();
    for (const locale of ENABLED_LOCALES) {
      const faces = localeMeta(locale).faces;
      // English needs `englishAll()`, not the catalog. `loadCatalog('en')` is
      // chrome ONLY — English content prose lives in `content/*.json` and
      // reaches the app through `contentStrings()`. So for as long as this read
      // the catalog, no English content string was EVER glyph-checked: a new
      // event title carrying a `…` shipped tofu with CI green, which is this
      // gate's whole reason for existing. The translated locales are unaffected
      // — their catalogs already carry the content keys.
      const strings =
        locale === 'en' ? englishAll() : loadCatalog(locale).strings;
      for (const [key, value] of Object.entries(strings)) {
        const family = faceForKey(key, faces);
        if (family === null) continue; // body voice: platform sans, any glyph
        if (!covered.has(family))
          covered.set(family, glyphSet(faceFile(family)));
        expect({
          locale,
          key,
          missing: missingGlyphs(value, covered.get(family)!),
        }).toEqual({ locale, key, missing: [] });
        // ...and the UPPERCASED form, because the stylesheet uppercases most
        // display copy (`uppercase` on the class, `textTransform` in a few
        // StyleSheets) while this gate only ever saw the string as authored. A
        // character whose lower case is in the face and whose upper case is not
        // would have shipped as tofu with the gate green — the shape of every
        // bug in this workstream. Nothing fails this today; it is a hole being
        // closed, not a fire being put out.
        //
        // Deliberately BROADER than the stylesheet: this asks for upper-case
        // coverage on all 20,001 non-body keys, including screen-reader labels
        // nothing draws at all. Mapping each key to its render site is the
        // per-key knowledge this codebase does not have, and requiring both
        // cases of a pixel face is cheap — the faces are Latin-1 plus the
        // Vietnamese precomposed set, which carry both cases throughout. If
        // this ever fails on a key that is genuinely never uppercased, narrow
        // it to the leaves that are, rather than deleting the assertion.
        //
        // German ß is not a counterexample: `toUpperCase()` gives `SS`, which
        // is exactly what `text-transform: uppercase` renders, so the check
        // matches the browser rather than diverging from it.
        expect({
          locale,
          key,
          upper: missingGlyphs(value.toUpperCase(), covered.get(family)!),
        }).toEqual({ locale, key, upper: [] });
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
      expect({ locale, missing: missingGlyphs(characters, covered) }).toEqual({
        locale,
        missing: [],
      });
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
      // 'on' is deliberately absent, for the same reason German omits its
      // separable-verb particles: English phrasal verbs park theirs at the end,
      // so "turned on", "keep them on" and "KEEP ON" are complete. 'in' stays —
      // it caught a real ambiguity ("Bids in", now "Taking bids").
      en: [
        'the',
        'a',
        'an',
        'to',
        'for',
        'of',
        'in',
        'with',
        'from',
        'by',
        'at',
      ],
      es: [
        'el',
        'la',
        'los',
        'las',
        'de',
        'del',
        'al',
        'para',
        'por',
        'con',
        'en',
      ],
      'pt-BR': [
        'o',
        'os',
        'as',
        'de',
        'do',
        'da',
        'para',
        'por',
        'com',
        'em',
        'no',
        'na',
      ],
      fr: [
        'le',
        'les',
        'de',
        'du',
        'des',
        'à',
        'au',
        'aux',
        'pour',
        'par',
        'avec',
        'en',
      ],
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

    /**
     * A string that ends in terminal punctuation is a finished sentence, not a
     * fragment — whatever its last word is. English strands prepositions at the
     * end of relative clauses ("anything you've paid for."), and so do several
     * of the other languages here. Without this, the gate rejects correct prose
     * and the fix is always to mangle the sentence, which is the opposite of
     * what it is for.
     */
    const isSentence = (value: string) => /[.!?]$/u.test(value.trim());

    const lastToken = (value: string) =>
      value
        .trim()
        .replace(/[.!?:;,"“”«»]+$/u, '')
        .split(/\s+/)
        .at(-1)
        ?.toLowerCase() ?? '';

    for (const locale of ENABLED_LOCALES) {
      const trailing = TRAILING[locale];
      if (trailing === undefined) continue;
      const strings = locale === 'en' ? english() : loadCatalog(locale).strings;
      const fragments = Object.entries(strings)
        .filter(
          ([, value]) =>
            !isSentence(value) && trailing.includes(lastToken(value)),
        )
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
      expect({ locale, missing: missingGlyphs(meta.endonym, covered) }).toEqual(
        { locale, missing: [] },
      );
    }
  });
});

describe('gate 1b — every key the source asks for exists', () => {
  test('no t() call names a key the English catalog has never heard of', () => {
    // A missing key does not fail, it renders. `resolveCopy` falls back to the
    // key itself, so a typo or a key that was renamed in the catalog but not in
    // the source ships as `rosterRename.a11y.close` drawn on the button — a
    // real one, caught by reading a screen rather than by CI. Nothing else in
    // this file looks at the direction source → catalog.
    //
    // Literal keys only. Template keys (`glossary.${id}.term`) are built at
    // runtime and are covered by the content-prose floors instead.
    const known = new Set(Object.keys(englishAll()));
    const missing: string[] = [];
    for (const file of scannedFiles()) {
      const text = readFileSync(join(process.cwd(), file), 'utf8');
      for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        const key = match[1]!;
        if (
          known.has(key) ||
          known.has(`${key}.one`) ||
          known.has(`${key}.other`)
        )
          continue;
        missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('persisted labels resolve through the catalog', () => {
  test('every labelKey a producer writes exists in the English catalog', () => {
    // A producer that dual-writes a key nothing can resolve is worse than one
    // that writes English only: the fallback still renders, so nothing looks
    // broken, and the string silently never translates.
    // The whole of both pure rings, not a hand-kept list. The list held four
    // files and there are twenty producers: `retirement.ts`,
    // `promotion-progression.ts`, `facilities.ts`, `youth-intake.ts`,
    // `season-recap.ts` and eleven more dual-write keys this gate never read.
    // And it only ever matched `labelKey`, while the rings also emit `textKey`,
    // `titleKey`, `detailKey`, `nameKey` and `descriptionKey`. Nothing is
    // broken today — every producer resolves — so this is recurrence
    // prevention, and a walk cannot go stale the way a list does.
    const sources = [
      ...sourceFiles('src/game'),
      ...sourceFiles('src/sim'),
    ].filter((file) => !/__tests__|\.test\.tsx?$/.test(file));
    const KEY_PROPS =
      /(labelKey|textKey|titleKey|detailKey|nameKey|descriptionKey): ['`]([^'`]+)['`]/g;
    const keys = sources.flatMap((file) =>
      [...readFileSync(join(process.cwd(), file), 'utf8').matchAll(KEY_PROPS)]
        .map((match) => match[2]!)
        // A key built entirely at runtime — `` `${prefix}.title` `` — names no
        // literal prefix to check, and the content floors cover those.
        .filter((key) => !key.startsWith('$')),
    );

    expect(sources.length).toBeGreaterThan(20);
    expect(keys.length).toBeGreaterThan(0);
    // Both English sources: chrome keys from en.json, content keys derived from
    // the content files. A producer may legitimately reference either.
    const known = new Set(Object.keys(englishAll()));
    // Template keys are built from a content id at runtime, so check the prefix
    // resolves for every id rather than the literal `${...}` text.
    const dynamic = keys.filter((key) => key.includes('$'));
    const literal = keys.filter((key) => !key.includes('$'));
    // A key with an `n` param may be authored as `key.one` / `key.other` and
    // never as `key` — `retirement.shortContract` is. `resolveCopy` selects the
    // suffix at runtime, so the bare name resolving to nothing is correct, not
    // missing. Same allowance gate 1b already makes.
    expect(
      literal.filter(
        (key) =>
          !known.has(key) &&
          !known.has(`${key}.one`) &&
          !known.has(`${key}.other`),
      ),
    ).toEqual([]);
    for (const template of dynamic) {
      const prefix = template.slice(0, template.indexOf('$'));
      expect({
        template,
        matches: [...known].some((key) => key.startsWith(prefix)),
      }).toEqual({ template, matches: true });
    }
  });
});

describe('gate 8b — squad register headers fit, in every enabled locale', () => {
  /**
   * The register is the screen a manager spends the most time on, and its four
   * fixed columns are sized in points around measured English abbreviations.
   * A translated header is therefore a layout risk, not just a copy one — and
   * "Cond" has no four-letter equivalent in German.
   *
   * The labels are typed in title case and uppercased by the stylesheet, so
   * what is measured is the uppercased form. Measuring the typed one would
   * understate every label, because Silkscreen's lowercase is narrower.
   */
  const COLUMNS = {
    role: { phone: 'col.squad.role', wide: 'col.squad.role' },
    overall: { phone: 'col.squad.overall', wide: 'col.squad.score' },
    potential: {
      phone: 'col.squad.potential',
      wide: 'col.squad.potentialLong',
    },
    condition: {
      phone: 'col.squad.condition',
      wide: 'col.squad.conditionLong',
    },
  } as const;

  /** The arrow is part of every column, drawn or not: see the widths file. */
  const demandOf = (label: string, family: string, fontSize: number) =>
    advanceEm(label.toUpperCase(), family) *
      fontSize *
      HEADER_MAX_FONT_MULTIPLIER +
    SORT_ARROW_GAP +
    SORT_ARROW_WIDTH +
    REGISTER_MIN_GUTTER;

  test('every locale s register header fits its column', () => {
    for (const locale of ENABLED_LOCALES) {
      const strings = loadCatalog(locale).strings;
      // The register's headers are drawn bold, and Silkscreen Bold is wider
      // than its regular cut — measuring the data face understates every label
      // by about a sixth, which is exactly the margin these columns run on.
      const family = localeMeta(locale).faces.display;
      for (const [column, keys] of Object.entries(COLUMNS)) {
        for (const layout of ['phone', 'wide'] as const) {
          const label = strings[keys[layout]] ?? english()[keys[layout]]!;
          const width =
            REGISTER_COLUMN_WIDTH[layout][column as keyof typeof COLUMNS];
          const demand = demandOf(
            label,
            family,
            REGISTER_HEADER_FONT_SIZE[layout],
          );
          expect({
            locale,
            layout,
            column,
            label,
            demand: Math.ceil(demand * 10) / 10,
            width,
          }).toMatchObject({ locale, layout, column });
          expect(demand).toBeLessThanOrEqual(width);
        }
      }
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
    advanceEm(label, family) *
      LEAGUE_HEADER_FONT_SIZE *
      HEADER_MAX_FONT_MULTIPLIER +
    COLUMN_MIN_GUTTER;

  test('every locale s header fits its column', () => {
    // Measured against the real font, not counted in characters: Silkscreen is
    // proportional, so "PJ" and "SP" are not the same width even though both
    // are two letters.
    for (const locale of ENABLED_LOCALES) {
      const strings = loadCatalog(locale).strings;
      const family = localeMeta(locale).faces.data;
      for (const [column, key] of Object.entries(COLUMNS)) {
        const label = strings[key] ?? english()[key]!;
        const width =
          LEAGUE_COLUMN_WIDTH[column as keyof typeof LEAGUE_COLUMN_WIDTH];
        expect({
          locale,
          column,
          label,
          demand: Math.ceil(demandOf(label, family) * 10) / 10,
          width,
        }).toMatchObject({ locale, column });
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
    const fixed = Object.values(LEAGUE_COLUMN_WIDTH).reduce(
      (sum, width) => sum + width,
      0,
    );
    const gutters =
      COLUMN_MIN_GUTTER * (Object.keys(LEAGUE_COLUMN_WIDTH).length - 1);

    // The width English alone requires. Raising this is a deliberate layout
    // decision that belongs in review, not a side effect of adding a language.
    const ENGLISH_ROW_BUDGET = 300;

    expect({ fixed, gutters, total: fixed + gutters }).toMatchObject({
      fixed,
      gutters,
    });
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
    for (const locale of ENABLED_LOCALES.filter((l) => l !== 'en')) {
      const glossary = loadGlossary(locale);
      const strings = loadCatalog(locale).strings;
      const offenders: string[] = [];

      for (const term of glossary.terms) {
        const pattern = new RegExp(term.englishPattern);
        for (const [key, value] of Object.entries(strings)) {
          if (!pattern.test(source[key] ?? '')) continue;
          if (!term.allowedForms.some((form) => value.includes(form))) {
            offenders.push(
              `${key}: ${JSON.stringify(value)} lacks ${term.allowedForms.join(' / ')}`,
            );
          }
        }
      }
      expect({ locale, offenders }).toEqual({ locale, offenders: [] });
    }
  });

  test('the check is not vacuous — the glossary and the catalog both have content', () => {
    for (const locale of ENABLED_LOCALES.filter((l) => l !== 'en')) {
      expect(loadGlossary(locale).terms.length).toBeGreaterThan(0);
      expect(Object.keys(loadCatalog(locale).strings).length).toBeGreaterThan(
        0,
      );
    }
  });

  test('every term still matches English, so none can be silently disarmed', () => {
    // The gate above only ever inspects strings whose ENGLISH matches the term's
    // pattern. A term that matches nothing therefore passes in perfect silence,
    // in all six languages, forever.
    //
    // That is one English edit away at all times: rename "Fan Shop" to "Club
    // Shop", or typo a pattern, and the term stops being enforced without a
    // single test turning red. It is the same shape as the bug that started this
    // workstream — a gate reporting zero because it was measuring nothing.
    const source = Object.values(englishAll());
    for (const locale of ENABLED_LOCALES.filter((l) => l !== 'en')) {
      const dead = loadGlossary(locale)
        .terms.filter(
          (term) =>
            !source.some((value) =>
              new RegExp(term.englishPattern).test(value),
            ),
        )
        .map(
          (term) =>
            `${term.english} (/${term.englishPattern}/ matches no English string)`,
        );
      expect({ locale, dead }).toEqual({ locale, dead: [] });
    }
  });
});

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
   *
   * The floors are recorded PER SOURCE FILE rather than as one number over all
   * content prose, because a single number cannot say both things at once. The
   * four files below at 100 are finished, and 100 is what stops English leaking
   * back into them: a new event or tip fails this gate until every locale has
   * it. The files at 0 have only just been flattened into keys and have no
   * translations yet — folded into one total they would have dragged the
   * finished four off 100 and quietly retired the guard on all of them.
   */
  const COVERAGE_FLOOR: Readonly<
    Record<string, Readonly<Record<string, number>>>
  > = {
    'events.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'tips.json': { es: 100, 'pt-BR': 100, fr: 100, id: 100, de: 100, vi: 100 },
    'player-requests.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'glossary.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'assistant-guide.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'onboarding.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'fulltime-coach-lines.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'fulltime-blame-lines.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'agent-final-lines.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'award-ceremony-lines.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'powers.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'rival-hero-intros.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    'training.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
    // Offer lines and objective templates only. The twelve brand names are
    // deliberately not keyed — a fictional sponsor is an invented proper noun,
    // like a club name — so this denominator is 15, not 27.
    'sponsors.json': {
      es: 100,
      'pt-BR': 100,
      fr: 100,
      id: 100,
      de: 100,
      vi: 100,
    },
  };

  /**
   * Which content file a key came from.
   *
   * Longest prefix wins, so `story.awakening.` is read as onboarding rather than
   * being swallowed by a shorter neighbour. A key matching nothing is a bug in
   * this table, not an unowned key, so the test fails rather than dropping it.
   */
  const SOURCE_BY_PREFIX: Readonly<Record<string, string>> = {
    'event.': 'events.json',
    'tip.': 'tips.json',
    'playerRequest.': 'player-requests.json',
    'glossary.': 'glossary.json',
    'bert.': 'assistant-guide.json',
    'awakening.': 'onboarding.json',
    'story.awakening.': 'onboarding.json',
    'coach.fulltime.': 'fulltime-coach-lines.json',
    'coach.blame.': 'fulltime-blame-lines.json',
    'agent.final.': 'agent-final-lines.json',
    'ceremony.': 'award-ceremony-lines.json',
    'powerEffect.': 'powers.json',
    'rivalHeroIntro.': 'rival-hero-intros.json',
    'rivalHeroVictory.': 'rival-hero-intros.json',
    'drill.': 'training.json',
    'sponsor.': 'sponsors.json',
  };

  const sourceOf = (key: string): string | undefined =>
    Object.entries(SOURCE_BY_PREFIX)
      .filter(([prefix]) => key.startsWith(prefix))
      .sort(([a], [b]) => b.length - a.length)[0]?.[1];

  test('every content key belongs to a source file the floors know about', () => {
    expect(
      Object.keys(contentStrings()).filter(
        (key) => sourceOf(key) === undefined,
      ),
    ).toEqual([]);
    expect(Object.keys(COVERAGE_FLOOR).sort()).toEqual(
      [...new Set(Object.values(SOURCE_BY_PREFIX))].sort(),
    );
  });

  /**
   * Floors only ever go up — and this time it is actually a ratchet.
   *
   * The first attempt at this was not one, and an audit said so. It asserted
   * "every floor is 100 unless you write an exception", which reproduces the
   * original regression in two lines instead of one, never notices a floor that
   * is missing entirely, and had a staleness check whose comment described
   * something the code did not do. All three are fixed here; the exception
   * escape hatch is gone rather than tightened, because a hatch nobody can
   * audit is worse than no hatch.
   *
   * The high-water mark is the point. Lowering a floor now means editing THIS
   * table too — a second, obvious, arguable line in the diff that says out loud
   * "we are shipping less translated than we once did". It is still possible;
   * it is no longer possible by accident, which is how `events.json` went
   * 100 -> 38 and sat there.
   */
  const FLOOR_HIGH_WATER: Readonly<Record<string, number>> = {
    'events.json': 100,
    'tips.json': 100,
    'player-requests.json': 100,
    'glossary.json': 100,
    'assistant-guide.json': 100,
    'onboarding.json': 100,
    'fulltime-coach-lines.json': 100,
    'fulltime-blame-lines.json': 100,
    'agent-final-lines.json': 100,
    'award-ceremony-lines.json': 100,
    'powers.json': 100,
    'rival-hero-intros.json': 100,
    'training.json': 100,
    'sponsors.json': 100,
  };

  test('no floor is below its high-water mark, and none is missing', () => {
    const regressions: string[] = [];
    const locales = ENABLED_LOCALES.filter((locale) => locale !== 'en');

    for (const [source, mark] of Object.entries(FLOOR_HIGH_WATER)) {
      const floors = COVERAGE_FLOOR[source];
      if (floors === undefined) {
        regressions.push(`${source}: has a high-water mark but no floor entry`);
        continue;
      }
      // An EMPTY or partial map was the original defect: eight files sat at
      // `{}` and were therefore never checked at all. `Object.entries({})` is
      // zero iterations, so a floor loop alone reads that as "nothing wrong".
      for (const locale of locales) {
        const floor = floors[locale];
        if (floor === undefined)
          regressions.push(`${source} ${locale}: no floor at all`);
        else if (floor < mark)
          regressions.push(
            `${source} ${locale}: ${floor} < high-water ${mark}`,
          );
      }
    }

    // A high-water table that has stopped covering the floors is the same hole
    // wearing the other hat.
    for (const source of Object.keys(COVERAGE_FLOOR)) {
      if (FLOOR_HIGH_WATER[source] === undefined) {
        regressions.push(`${source}: has a floor but no high-water mark`);
      }
    }

    expect(regressions).toEqual([]);
  });

  test('every locale meets its recorded content-prose floor', () => {
    const contentKeys = Object.keys(contentStrings());
    expect(contentKeys.length).toBeGreaterThan(0);

    const keysBySource = new Map<string, string[]>();
    for (const key of contentKeys) {
      const source = sourceOf(key);
      if (source === undefined) continue; // named by the test above
      keysBySource.set(source, [...(keysBySource.get(source) ?? []), key]);
    }

    // A source that produces NO keys never enters the map, so the loop below
    // never reaches its floor and the gate passes having checked nothing about
    // it. `contentStrings()` builds these by hand, one loop per file — lose the
    // tips loop and `tips.json` simply disappears from the report, at 0%
    // translated, with CI green. Assert the map still covers every floor.
    expect([...keysBySource.keys()].sort()).toEqual(
      Object.keys(COVERAGE_FLOOR).sort(),
    );

    const report: Record<string, Record<string, string>> = {};
    for (const locale of ENABLED_LOCALES.filter((l) => l !== 'en')) {
      const translated = loadCatalog(locale).strings;
      report[locale] = {};
      for (const [source, keys] of keysBySource) {
        const done = keys.filter((key) => key in translated).length;
        const percent = Math.floor((done / keys.length) * 100);
        report[locale][source] = `${done}/${keys.length} (${percent}%)`;
        expect({ locale, source, percent }).toMatchObject({ locale, source });
        expect(percent).toBeGreaterThanOrEqual(
          COVERAGE_FLOOR[source]?.[locale] ?? 0,
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log('content prose coverage:', report);
  });
});
