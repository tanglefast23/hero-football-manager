import { readFileSync } from 'fs';
import { join } from 'path';
import { ENABLED_LOCALES, LOCALES, loadCatalog, localeMeta } from '../index';
import { faceFile, glyphSet, missingGlyphs } from '../glyph-coverage';
import { faceForKey } from '../voice';

const english = () => loadCatalog('en').strings;
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
    const source = english();
    for (const locale of translated()) {
      const ceiling = localeMeta(locale).expansion;
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        if (key.startsWith('col.')) continue; // layout tokens, sized by measurement
        const limit = Math.ceil((source[key]?.length ?? 0) * ceiling) + 2;
        expect({ locale, key, length: value.length, limit })
          .toMatchObject({ locale, key });
        expect(value.length).toBeLessThanOrEqual(limit);
      }
    }
  });

  test('gate 4 — placeholders match the English source exactly', () => {
    // A dropped {player} is a silent content bug: the string still renders, it
    // just stops naming anyone.
    const source = english();
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

  test('gate 3b — no key holds a sentence fragment', () => {
    // A label trailing off on a preposition or article is half a sentence, split
    // across JSX by an emphasised span. Keyed as-is it forces every language
    // into English word order. Compose it into one key with a placeholder.
    const trailing = /\b(the|a|an|to|for|of|and|or|in|on|with|from|by|at)$/i;
    const fragments = Object.entries(english())
      .filter(([, value]) => trailing.test(value.trim()))
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

    expect(fragments).toEqual([]);
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
      return [...text.matchAll(/labelKey: '([^']+)'/g)].map(match => match[1]!);
    });

    expect(keys.length).toBeGreaterThan(0);
    const known = new Set(Object.keys(english()));
    expect(keys.filter(key => !known.has(key))).toEqual([]);
  });
});
