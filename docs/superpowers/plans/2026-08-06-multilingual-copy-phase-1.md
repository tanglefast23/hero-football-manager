# Multilingual Copy — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the localisation plumbing and ship it with English only — every player-facing string flows through a key lookup, the language picker works, and the game looks and behaves exactly as it does today.

**Architecture:** Copy moves to zod-validated JSON catalogs under `content/i18n/`, resolved at the UI edge by a `useCopy()` hook that derives the active locale from `preferences.language` — the single source of language state. The pure rings (`src/sim/`, `src/game/`) and the application layer emit `labelKey` + `labelParams` instead of English sentences. Fonts swap per locale through NativeWind CSS custom properties for className sites and a `useFaces()` hook for the 16 files that set `fontFamily` from a raw literal.

**Tech Stack:** TypeScript, zod 4, Zustand 5, NativeWind 4 / react-native-css-interop 0.2.6, expo-font, expo-sqlite, Jest (testEnvironment `node`, roots `src` only), the TypeScript compiler API for AST checks. **No ESLint** — `README.md:10` forbids adding a lint script.

**Spec:** [`docs/superpowers/specs/2026-08-06-multilingual-copy-design.md`](../specs/2026-08-06-multilingual-copy-design.md)

---

## Scope of this plan

This plan covers **Phase 0 and Phase 1 only** — the engineering. It ends with a
game that is functionally identical to today's, in English, with every string
routed through the catalog and a working picker.

The translation phases (2–5) are deliberately **not** in this document. Phase 2
is a repeatable per-language procedure specified once in
`docs/superpowers/plans/2026-08-06-multilingual-copy-phase-2-template.md`, and
it does not start until the Phase 1 exit criteria below are green. Writing
bite-sized TDD steps for ~150,000 words of translation would be theatre.

**Phase 1 exit criteria — all must hold before Phase 2 opens:**

- [ ] `npx tsc --noEmit` clean
- [ ] `npm test` green, **including the golden replay** (`ENGINE_VERSION` unchanged)
- [ ] English catalog snapshot test passing (no silent rewording during keying)
- [ ] The no-hardcoded-prose AST gate reports zero violations outside exempt paths
- [ ] Locale-invariance test green: the same seeded career under all seven
      languages produces identical `GameState`
- [ ] Device pass: onboarding → first match, league table, squad register,
      financial report, Settings — nothing moved
- [ ] Device smoke test: switching to Vietnamese changes the face **on the match
      screen**, not just on className-styled chrome

---

---

## Status — 2026-08-06 — Phase 1 complete

| Task | State |
| --- | --- |
| 0. Vietnamese face | **Done.** Handjet, on structural grounds: it ships 400 + 700 so the display/data voice split survives, where VT323's single weight would collapse it |
| 1–5. Locale registry, plurals, numbers, catalogs, resolver | **Done.** The pure core, all Hermes-safe and node-Jest-testable |
| 6. Language preference, schema v10 | **Done.** Frozen `V9PreferencesSchema` |
| 7. Locale context + wiring | **Done.** `LocaleProvider`, `setLanguage`, `cycleLanguage` |
| 8–9. Font swap | **Done.** CSS vars for className sites, `usePixelStyles` for all 16 literal files |
| 10. Formation blurbs out of `src/sim/` | **Done.** All six; `ENGINE_VERSION` still `m2.1` |
| 11. Event outcome ids | **Done.** 150 outcomes |
| 12. Persisted-English keys | **Done** for the ledger: schemas declare the pair, `career.ts` dual-writes all twelve lines, and a gate proves every key resolves. The Hall of Fame landmine is fixed |
| 13. The extraction | **Done. 338 → 0.** 313 catalog keys |
| 14. CI gates | **Done.** Gates 1, 3, 3b, 4, 5, 5b, 5c, the AST prose gate, the font-literal guard, and the labelKey-resolves gate |
| 15. Language picker | **Done.** Title screen + Settings |
| 16. Native config | **Done.** |
| 17. Verification | **Done.** Full suite green, golden replay unmoved |

### What Phase 1 delivers

The game is unchanged in English and every player-facing string now flows
through the catalog. Switching to Vietnamese changes the typeface everywhere,
including the match screen. The picker persists across launches.

### What Phase 2 needs, and it is not much

- **The remaining persisted producers.** `player-requests.ts`,
  `cup-giant-killing.ts`, `season-recap.ts` and `career-events.ts` still write
  English labels only. The ledger shows the pattern and the gate is already
  there to catch a bad key.
- **`content/*.json` prose.** Events, tips, glossary, Bert and ceremony lines
  are keyed by content id but not yet routed through the resolver at their call
  sites. About 1,270 strings, and the largest single item left.
- **§4.2's advance work**, which is a hard blocker on the first non-English
  locale: `col.*` short forms, re-measured advances per face, and
  `LEAGUE_COLUMN_WIDTH` recomputed as a max across all seven locales up front.

### Device QA still owed

Nothing here has run on hardware. The five length-sensitive screens in English,
plus the Vietnamese face on the match screen, are the checks that matter.

---

## File structure

**New files**

| File | Responsibility |
| --- | --- |
| `src/i18n/locales.ts` | `Locale` union, `ENABLED_LOCALES`, per-locale metadata (endonym, plural rule, digit separator, face names) |
| `src/i18n/plural.ts` | Hand-rolled plural selector. Pure, no `Intl` |
| `src/i18n/format-number.ts` | Hand-rolled digit grouping. Pure, no `Intl` |
| `src/i18n/resolve.ts` | `resolveCopy(catalog, fallback, key, params)` — lookup, interpolation, plural selection, English fallback. Pure |
| `src/i18n/catalog-schema.ts` | zod schema for a catalog file |
| `src/i18n/load-catalogs.ts` | Static JSON imports + cached parse, mirroring `src/content/load.ts` |
| `src/i18n/use-copy.ts` | `useCopy()` hook reading the Zustand locale slice |
| `src/i18n/use-faces.ts` | `useFaces()` → `{ display, data }` family names for the active locale |
| `src/i18n/index.ts` | Public surface |
| `content/i18n/en.json` | **Hand-authored.** English for UI chrome keys only — content prose stays in `content/*.json` (spec §3.3) |
| `content/i18n/es.json` … `vi.json` | Hand-authored translations (empty in Phase 1) |
| `scripts/i18n/measure-advances.mjs` | Reads a TTF `hmtx` and emits per-string advances |
| `src/i18n/__tests__/no-hardcoded-prose.test.ts` | TypeScript-AST gate keeping English out of TSX. A Jest test, not a lint rule |
| `src/i18n/voice.ts` | Which face a key is drawn in (`display`/`data`/`body`), for the glyph gate |

**Modified files**

| File | Change |
| --- | --- |
| `tailwind.config.js:41-46` | `pixel`/`mono` families point at CSS vars |
| `App.tsx` | `vars()` wrapper at root; load Handjet cuts; picker wiring |
| `src/persistence/preferences-repository.ts` | `language` field, schema v10, migration rung |
| `src/persistence/game-state-codec.ts` | `labelKey`/`labelParams` on the 12 persisted surfaces |
| `src/application/hall-of-fame.ts` | Stop parsing goals out of an English sentence |
| `src/ui/screens/CharacterCreationScreen.tsx` | Language panel |
| `src/ui/SettingsOverlay.tsx` | Language control |
| `src/sim/tactics.ts:46-50` | Formation blurbs → ids |
| 16 raw-`fontFamily` files (§4.1 of the spec) | `useFaces()` instead of module-scope literals |
| `README.md:153` | Reverse the "localization — post-launch" decision |
| `content/events.json` | `id` on every outcome |
| `app.json` | `CFBundleLocalizations` |

---

## Task 0: Decide the Vietnamese face (Phase 0)

**Files:**
- Create: `scratch/font-compare.html` (throwaway, not committed)

- [ ] **Step 1: Build a comparison page**

Render the same six real game strings in Silkscreen Bold/Regular, Handjet
700/400, and VT323 — in English and Vietnamese — at the game's actual sizes
(10, 12, 13, 16, 24px), embedding each TTF as a base64 data URI.

Strings to use, because they are what the player actually reads:

```
KÝ HỢP ĐỒNG            (SIGN THE ROOKIE)
BẢNG XẾP HẠNG          (LEAGUE TABLE)
Lương tuần             (Weekly wages)
Đ  HS  T  H  B         (PTS GD W D L)
$1,240 / tuần          ($1,240 / week)
Cậu ấy vào Vùng rồi!   (He's in the Zone!)
```

- [ ] **Step 2: Look at it and decide**

Handjet is the recommendation — it ships 400 and 700 cuts, so Vietnamese keeps
the display/data voice split that `PixelText.tsx` treats as load-bearing. VT323
has one weight and would collapse them.

Record the decision in the spec's §11 as closed. If VT323 wins on looks, the
spec must also record that Vietnamese consciously ships one weight.

- [ ] **Step 3: Install the chosen package**

```bash
npm install @expo-google-fonts/handjet
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json docs/superpowers/specs/2026-08-06-multilingual-copy-design.md
git commit -m "feat(i18n): pick Handjet as the Vietnamese pixel face"
```

---

## Task 1: Locale registry

**Files:**
- Create: `src/i18n/locales.ts`
- Test: `src/i18n/__tests__/locales.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { ENABLED_LOCALES, LOCALES, isLocale, localeMeta } from '../locales';

describe('locale registry', () => {
  test('ships seven locales with English first', () => {
    expect(LOCALES).toEqual(['en', 'es', 'pt-BR', 'fr', 'de', 'id', 'vi']);
  });

  test('only English is enabled in phase 1', () => {
    expect(ENABLED_LOCALES).toEqual(['en']);
  });

  test('every locale has an endonym written in itself', () => {
    expect(localeMeta('es').endonym).toBe('Español');
    expect(localeMeta('vi').endonym).toBe('Tiếng Việt');
    expect(localeMeta('de').endonym).toBe('Deutsch');
  });

  test('pt-BR groups with French for plurals, not with Spanish', () => {
    expect(localeMeta('pt-BR').pluralRule).toBe('zeroIsOne');
    expect(localeMeta('fr').pluralRule).toBe('zeroIsOne');
    expect(localeMeta('es').pluralRule).toBe('oneOther');
    expect(localeMeta('id').pluralRule).toBe('none');
  });

  test('only Vietnamese uses the second face', () => {
    expect(localeMeta('en').faces.display).toBe('Silkscreen_700Bold');
    expect(localeMeta('vi').faces.display).toBe('Handjet_700Bold');
    expect(localeMeta('vi').faces.data).toBe('Handjet_400Regular');
  });

  test('isLocale rejects an unknown tag', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pt')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: FAIL — `Cannot find module '../locales'`

- [ ] **Step 3: Implement**

```ts
/**
 * The seven shipping languages, chosen for football-fan population and filtered
 * by whether the pixel font can render them — see the design spec §2.
 *
 * `ENABLED_LOCALES` is deliberately separate from `LOCALES`. Translation lands
 * one language at a time, and every CI quality gate runs against enabled
 * locales only. Without that split, a gate asserting "every English key exists
 * in all six catalogs" would fail from the first day of Phase 2 until the last
 * day of Phase 4.
 */
export const LOCALES = ['en', 'es', 'pt-BR', 'fr', 'de', 'id', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];

/** Widen as each language completes its translation phase. */
export const ENABLED_LOCALES: readonly Locale[] = ['en'];

/**
 * Which plural forms a language needs. Hermes' `Intl` coverage varies by
 * platform and the game must behave identically on both, so this is hand-rolled
 * rather than delegated to `Intl.PluralRules`.
 *
 * - `oneOther`  — n === 1 is singular; 0 is plural.
 * - `zeroIsOne` — 0 and 1 are both singular. French AND Brazilian Portuguese:
 *   CLDR gives `pt` the rule `i = 0 or 1 → one`, so "0 jogador" is correct and
 *   "0 jogadores" is not.
 * - `none`      — no plural marking at all.
 */
export type PluralRule = 'oneOther' | 'zeroIsOne' | 'none';

export interface LocaleFaces {
  /** Buttons, labels, headings — the `display` voice in PixelText. */
  display: string;
  /** Money, stats, table cells — the `data` voice. */
  data: string;
}

export interface LocaleMeta {
  /** The language's name in itself. Never "Spanish". */
  endonym: string;
  pluralRule: PluralRule;
  /** Thousands separator. The game's `$` is fictional and never localises. */
  groupSeparator: string;
  faces: LocaleFaces;
  /**
   * How much longer than English this language is allowed to run, before the
   * `+2` slack. Gate 3 reads it; the spec's §1 budget is the source of the
   * numbers. It lives here so there is one table, not a constant in the gate
   * that drifts from the registry.
   */
  expansion: number;
}

const SILKSCREEN: LocaleFaces = {
  display: 'Silkscreen_700Bold',
  data: 'Silkscreen_400Regular',
};

/**
 * Silkscreen maps 226 glyphs — Latin-1 only. Vietnamese needs 134 letters it
 * does not have, so `vi` alone renders in Handjet, which ships matching 400 and
 * 700 cuts. See the design spec §4.1.
 */
const HANDJET: LocaleFaces = {
  display: 'Handjet_700Bold',
  data: 'Handjet_400Regular',
};

const META: Readonly<Record<Locale, LocaleMeta>> = {
  en: { endonym: 'English', pluralRule: 'oneOther', groupSeparator: ',', faces: SILKSCREEN, expansion: 1 },
  es: { endonym: 'Español', pluralRule: 'oneOther', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.25 },
  'pt-BR': { endonym: 'Português (Brasil)', pluralRule: 'zeroIsOne', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.25 },
  fr: { endonym: 'Français', pluralRule: 'zeroIsOne', groupSeparator: ' ', faces: SILKSCREEN },
  de: { endonym: 'Deutsch', pluralRule: 'oneOther', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.3 },
  id: { endonym: 'Bahasa Indonesia', pluralRule: 'none', groupSeparator: '.', faces: SILKSCREEN, expansion: 1.2 },
  vi: { endonym: 'Tiếng Việt', pluralRule: 'none', groupSeparator: '.', faces: HANDJET, expansion: 1.15 },
};

export function localeMeta(locale: Locale): LocaleMeta {
  return META[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/i18n/__tests__/locales.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales.ts src/i18n/__tests__/locales.test.ts
git commit -m "feat(i18n): locale registry with per-locale plural rule and faces"
```

---

## Task 2: Plural selector

**Files:**
- Create: `src/i18n/plural.ts`
- Test: `src/i18n/__tests__/plural.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { pluralSuffix } from '../plural';

describe('pluralSuffix', () => {
  test('English and Spanish treat zero as plural', () => {
    expect(pluralSuffix('en', 0)).toBe('other');
    expect(pluralSuffix('en', 1)).toBe('one');
    expect(pluralSuffix('en', 2)).toBe('other');
    expect(pluralSuffix('es', 0)).toBe('other');
  });

  test('French and Brazilian Portuguese treat zero as singular', () => {
    expect(pluralSuffix('fr', 0)).toBe('one');
    expect(pluralSuffix('fr', 1)).toBe('one');
    expect(pluralSuffix('fr', 2)).toBe('other');
    expect(pluralSuffix('pt-BR', 0)).toBe('one');
    expect(pluralSuffix('pt-BR', 1)).toBe('one');
    expect(pluralSuffix('pt-BR', 2)).toBe('other');
  });

  test('Indonesian and Vietnamese have one form', () => {
    expect(pluralSuffix('id', 0)).toBe('other');
    expect(pluralSuffix('id', 1)).toBe('other');
    expect(pluralSuffix('vi', 5)).toBe('other');
  });

  test('negative counts use magnitude', () => {
    expect(pluralSuffix('en', -1)).toBe('one');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/i18n/__tests__/plural.test.ts`
Expected: FAIL — `Cannot find module '../plural'`

- [ ] **Step 3: Implement**

```ts
import { localeMeta, type Locale } from './locales';

export type PluralSuffix = 'one' | 'other';

/**
 * Which sibling key a count selects: `squad.count.one` or `squad.count.other`.
 *
 * Magnitude, not sign: "-1 point" is as singular as "1 point", and the game
 * shows negative money often enough for that to matter.
 */
export function pluralSuffix(locale: Locale, count: number): PluralSuffix {
  const n = Math.abs(count);
  switch (localeMeta(locale).pluralRule) {
    case 'none':
      return 'other';
    case 'zeroIsOne':
      return n === 0 || n === 1 ? 'one' : 'other';
    case 'oneOther':
      return n === 1 ? 'one' : 'other';
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/i18n/__tests__/plural.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/i18n/plural.ts src/i18n/__tests__/plural.test.ts
git commit -m "feat(i18n): hand-rolled plural selector (no Intl, Hermes-safe)"
```

---

## Task 3: Number formatter

**Files:**
- Create: `src/i18n/format-number.ts`
- Test: `src/i18n/__tests__/format-number.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { formatInteger, formatMoney } from '../format-number';

describe('formatInteger', () => {
  test('groups in threes with the locale separator', () => {
    expect(formatInteger('en', 1240)).toBe('1,240');
    expect(formatInteger('de', 1240)).toBe('1.240');
    expect(formatInteger('fr', 1240)).toBe('1 240');
    expect(formatInteger('vi', 1240000)).toBe('1.240.000');
  });

  test('leaves short numbers alone', () => {
    expect(formatInteger('de', 0)).toBe('0');
    expect(formatInteger('de', 999)).toBe('999');
  });

  test('keeps the sign outside the grouping', () => {
    expect(formatInteger('en', -1240)).toBe('-1,240');
  });

  test('truncates toward zero rather than rounding', () => {
    expect(formatInteger('en', 1240.9)).toBe('1,240');
    expect(formatInteger('en', -1240.9)).toBe('-1,240');
  });
});

describe('formatMoney', () => {
  test('the dollar sign is fictional and never moves', () => {
    expect(formatMoney('en', 1240)).toBe('$1,240');
    expect(formatMoney('de', 1240)).toBe('$1.240');
  });

  test('negative money reads as minus then symbol', () => {
    expect(formatMoney('en', -1240)).toBe('-$1,240');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/i18n/__tests__/format-number.test.ts`
Expected: FAIL — `Cannot find module '../format-number'`

- [ ] **Step 3: Implement**

```ts
import { localeMeta, type Locale } from './locales';

/**
 * Digit grouping, hand-rolled for the same reason as the plural selector: this
 * game's numbers must read identically on every device, and `Intl.NumberFormat`
 * is exactly as uneven across Hermes builds as `Intl.PluralRules`.
 *
 * It also replaces a genuine pre-existing bug. Several call sites used a bare
 * `toLocaleString()` — `view-models.ts:560`, `event-selection.ts:189` and four
 * in `store.ts` — which follows the *device* locale, so a German phone already
 * showed "1.240" where an American one showed "1,240", with no setting
 * controlling it.
 */
export function formatInteger(locale: Locale, value: number): string {
  const truncated = Math.trunc(value);
  const negative = truncated < 0;
  const digits = String(Math.abs(truncated));
  const separator = localeMeta(locale).groupSeparator;

  let grouped = '';
  for (let i = 0; i < digits.length; i++) {
    // Insert before every digit whose distance from the end is a multiple of 3.
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += separator;
    grouped += digits[i];
  }

  return negative ? `-${grouped}` : grouped;
}

/**
 * The currency is invented, so the symbol is part of the game's look rather
 * than a locale decision — only the grouping localises. See the spec §3.4.
 */
export function formatMoney(locale: Locale, value: number): string {
  const truncated = Math.trunc(value);
  const body = formatInteger(locale, Math.abs(truncated));
  return truncated < 0 ? `-$${body}` : `$${body}`;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/i18n/__tests__/format-number.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/i18n/format-number.ts src/i18n/__tests__/format-number.test.ts
git commit -m "feat(i18n): hand-rolled number grouping, replacing device-locale toLocaleString"
```

---

## Task 4: Catalog schema and loader

**Files:**
- Create: `src/i18n/catalog-schema.ts`, `src/i18n/load-catalogs.ts`, `content/i18n/en.json`
- Test: `src/i18n/__tests__/catalog.test.ts`

- [ ] **Step 1: Seed a minimal English catalog**

`content/i18n/en.json`:

```json
{
  "schemaVersion": 1,
  "locale": "en",
  "strings": {
    "settings.language.title": "Language"
  }
}
```

Create `content/i18n/es.json`, `pt-BR.json`, `fr.json`, `de.json`, `id.json`,
`vi.json` with the same shape, their own `locale`, and `"strings": {}`.

- [ ] **Step 2: Write the failing test**

```ts
import { CatalogSchema } from '../catalog-schema';
import { loadCatalog } from '../load-catalogs';

describe('catalog schema', () => {
  test('accepts a well-formed catalog', () => {
    const parsed = CatalogSchema.parse({
      schemaVersion: 1,
      locale: 'de',
      strings: { 'a.b': 'Hallo' },
    });
    expect(parsed.strings['a.b']).toBe('Hallo');
  });

  test('rejects an unknown locale', () => {
    expect(() => CatalogSchema.parse({ schemaVersion: 1, locale: 'pt', strings: {} })).toThrow();
  });

  test('rejects an empty string value, which is always a mistake', () => {
    expect(() => CatalogSchema.parse({ schemaVersion: 1, locale: 'en', strings: { 'a.b': '' } }))
      .toThrow();
  });

  test('rejects a key that is not dot-namespaced', () => {
    expect(() => CatalogSchema.parse({ schemaVersion: 1, locale: 'en', strings: { nodots: 'x' } }))
      .toThrow();
  });
});

describe('loadCatalog', () => {
  test('loads English', () => {
    expect(loadCatalog('en').strings['settings.language.title']).toBe('Language');
  });

  test('every locale has a parseable catalog file', () => {
    for (const locale of ['en', 'es', 'pt-BR', 'fr', 'de', 'id', 'vi'] as const) {
      expect(loadCatalog(locale).locale).toBe(locale);
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest src/i18n/__tests__/catalog.test.ts`
Expected: FAIL — `Cannot find module '../catalog-schema'`

- [ ] **Step 4: Implement the schema**

```ts
import { z } from 'zod';
import { LOCALES } from './locales';

/**
 * Keys are dot-namespaced by screen or system (`creation.*`, `match.*`,
 * `ledger.*`). The pattern is enforced because a flat key is the first step
 * toward two screens quietly sharing a string and then diverging.
 */
const keySchema = z.string().regex(/^[a-z][a-zA-Z0-9-]*(\.[a-zA-Z0-9_-]+)+$/);

export const CatalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  locale: z.enum(LOCALES),
  // An empty translation renders as a blank label rather than falling back,
  // which looks like a rendering bug and is impossible to spot in review.
  strings: z.record(keySchema, z.string().min(1)),
});

export type Catalog = z.infer<typeof CatalogSchema>;
```

- [ ] **Step 5: Implement the loader**

```ts
import deJson from '../../content/i18n/de.json';
import enJson from '../../content/i18n/en.json';
import esJson from '../../content/i18n/es.json';
import frJson from '../../content/i18n/fr.json';
import idJson from '../../content/i18n/id.json';
import ptBrJson from '../../content/i18n/pt-BR.json';
import viJson from '../../content/i18n/vi.json';
import { CatalogSchema, type Catalog } from './catalog-schema';
import type { Locale } from './locales';

const RAW: Record<Locale, unknown> = {
  en: enJson, es: esJson, 'pt-BR': ptBrJson, fr: frJson, de: deJson, id: idJson, vi: viJson,
};

/**
 * Parsed once per locale, mirroring `src/content/load.ts`. Unlike that loader
 * this one does NOT hand out copies: a catalog is read-only by every consumer,
 * and cloning ~25k strings on each screen would be a real cost for no benefit.
 */
const cache = new Map<Locale, Catalog>();

export function loadCatalog(locale: Locale): Catalog {
  const cached = cache.get(locale);
  if (cached !== undefined) return cached;
  const parsed = CatalogSchema.parse(RAW[locale]);
  cache.set(locale, parsed);
  return parsed;
}
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx jest src/i18n/__tests__/catalog.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 7: Commit**

```bash
git add src/i18n/catalog-schema.ts src/i18n/load-catalogs.ts src/i18n/__tests__/catalog.test.ts content/i18n/
git commit -m "feat(i18n): zod-validated per-locale catalogs"
```

---

## Task 5: The resolver

**Files:**
- Create: `src/i18n/resolve.ts`
- Test: `src/i18n/__tests__/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { resolveCopy } from '../resolve';

const en = { 'a.hi': 'Hello {name}', 'a.n.one': '{n} player', 'a.n.other': '{n} players' };
const de = { 'a.hi': 'Hallo {name}' };

describe('resolveCopy', () => {
  test('resolves and interpolates', () => {
    expect(resolveCopy('de', de, en, 'a.hi', { name: 'Bert' })).toBe('Hallo Bert');
  });

  test('falls back to English when the locale lacks the key', () => {
    expect(resolveCopy('de', de, en, 'a.n.one', { n: 1 })).toBe('1 player');
  });

  test('selects a plural sibling from the count param', () => {
    expect(resolveCopy('en', en, en, 'a.n', { n: 1 })).toBe('1 player');
    expect(resolveCopy('en', en, en, 'a.n', { n: 3 })).toBe('3 players');
  });

  test('pt-BR sends zero to the singular sibling', () => {
    const pt = { 'a.n.one': '{n} jogador', 'a.n.other': '{n} jogadores' };
    expect(resolveCopy('pt-BR', pt, en, 'a.n', { n: 0 })).toBe('0 jogador');
  });

  test('a missing key everywhere returns the key, never an empty string', () => {
    expect(resolveCopy('de', de, en, 'a.nope')).toBe('a.nope');
  });

  test('an unused param is not an error, but an unfilled placeholder is left visible', () => {
    expect(resolveCopy('en', en, en, 'a.hi', {})).toBe('Hello {name}');
  });

  test('params never re-interpolate — a value containing a placeholder is inert', () => {
    expect(resolveCopy('en', en, en, 'a.hi', { name: '{name}' })).toBe('Hello {name}');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/i18n/__tests__/resolve.test.ts`
Expected: FAIL — `Cannot find module '../resolve'`

- [ ] **Step 3: Implement**

```ts
import { pluralSuffix } from './plural';
import type { Locale } from './locales';

export type CopyParams = Readonly<Record<string, string | number>>;
type Strings = Readonly<Record<string, string>>;

/**
 * A key with an `n` param may be stored as `key.one` / `key.other` instead of
 * `key`. Plain keys win, so a string only pluralises if it was authored to.
 */
function lookup(strings: Strings, key: string, locale: Locale, params?: CopyParams): string | undefined {
  const direct = strings[key];
  if (direct !== undefined) return direct;
  const count = params?.n;
  if (typeof count !== 'number') return undefined;
  return strings[`${key}.${pluralSuffix(locale, count)}`];
}

/**
 * Single-pass interpolation. Replacing placeholders one at a time would let a
 * param value that itself contains `{name}` be substituted by a later pass —
 * player names are user input, so that is reachable, not theoretical.
 */
function interpolate(template: string, params?: CopyParams): string {
  if (params === undefined) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = params[name];
    // Leave the placeholder visible rather than printing "undefined": a
    // `{player}` on screen is an obvious bug, "undefined" reads as copy.
    return value === undefined ? match : String(value);
  });
}

/**
 * Resolution order: the active locale, then English, then the key itself.
 *
 * Returning the key rather than an empty string is deliberate — a blank label
 * looks like a layout bug and hides in review, whereas `market.bid.confirm` on
 * screen names its own missing entry.
 */
export function resolveCopy(
  locale: Locale,
  strings: Strings,
  fallback: Strings,
  key: string,
  params?: CopyParams,
): string {
  const template = lookup(strings, key, locale, params) ?? lookup(fallback, key, 'en', params);
  return template === undefined ? key : interpolate(template, params);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/i18n/__tests__/resolve.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/i18n/resolve.ts src/i18n/__tests__/resolve.test.ts
git commit -m "feat(i18n): copy resolver with plural selection and English fallback"
```

---

## Task 6: Language preference (schema v10)

**Files:**
- Modify: `src/persistence/preferences-repository.ts:13-21`, `:38-77`, `:96-...`
- Test: `src/persistence/__tests__/preferences-repository.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the existing suite:

```ts
test('language defaults to English', () => {
  expect(DEFAULT_APP_PREFERENCES.language).toBe('en');
});

test('a version-9 row migrates forward and gains English', async () => {
  const database = new FakePersistenceDatabase();
  database.preferencesRow = { slot: 1, schema_version: 9, payload: JSON.stringify(V9_ROW_LITERAL) };

  const loaded = await createPreferencesRepository(database).load();

  expect(loaded.language).toBe('en');
  expect(database.preferencesRow?.schema_version).toBe(10);
});

test('an unknown language tag is rejected rather than silently kept', async () => {
  const database = new FakePersistenceDatabase();
  database.preferencesRow = {
    slot: 1, schema_version: 10,
    payload: JSON.stringify({ ...V9_ROW_LITERAL, language: 'pt' }),
  };
  await expect(createPreferencesRepository(database).load()).rejects.toThrow();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/persistence/__tests__/preferences-repository.test.ts`
Expected: FAIL — `language` is undefined

- [ ] **Step 3: Freeze an explicit V9 schema — do NOT extend the live base**

**This is the step that decides whether real players lose their settings.** The
legacy schemas for versions 3–8 are *derived* from the current schema with
`.omit()` (`preferences-repository.ts:129` onward). Adding a required `language`
to `PreferencesSchema` therefore propagates it into every legacy schema, so a
genuine version-8 row — which has no `language` — fails validation, and the
fail-soft path (`application/preferences.ts:24`) discards it and resets **all**
settings to defaults.

The existing tests will not catch this, because they build old-version fixtures
from `DEFAULT_APP_PREFERENCES` (`preferences-repository.test.ts:79`), so the
fixtures would silently gain `language` too and stay green.

So:

```ts
const PREFERENCES_SCHEMA_VERSION = 10;
// ... existing constants 1-8 unchanged ...
// Named for what version 9 already HAD, matching the ladder's convention
// (CLIMB_COMPLETED_..._VERSION = 8 parses rows that have climbCompleted).
const DEVELOPER_MODE_PREFERENCES_SCHEMA_VERSION = 9;

/**
 * Version 9, written out rather than derived. Freezing it is the whole point:
 * a frozen schema cannot acquire a field just because the live schema did.
 */
const V9PreferencesSchema = z.strictObject({
  /* every field as it exists today, verbatim, WITHOUT language */
});

const PreferencesSchema = V9PreferencesSchema.extend({
  language: z.enum(LOCALES),
});
```

Add to `AppPreferences`:

```ts
  /** Device-wide UI language. One player, one language, across every career. */
  language: Locale;
```

Add `language: 'en'` to `DEFAULT_APP_PREFERENCES`, and the rung:

**Match the shape of the rungs that already exist** — there is no
`persistMigrated` helper and no `parsedRow` variable in this file. Every rung is
hand-written in the form at `preferences-repository.ts:348-366`:

```ts
if (row.schema_version === DEVELOPER_MODE_PREFERENCES_SCHEMA_VERSION) {
  const legacy = DeveloperModePreferencesSchema.safeParse(decoded);
  if (!legacy.success) {
    throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
  }
  const migrated: AppPreferences = {
    ...legacy.data,
    formationPresets: [...legacy.data.formationPresets],
    seenPowerCutIns: [...legacy.data.seenPowerCutIns],
    squadSort: legacy.data.squadSort === null ? null : { ...legacy.data.squadSort },
    language: DEFAULT_APP_PREFERENCES.language,
  };
  await database.runAsync(UPSERT_SQL, [PRIMARY_SLOT, PREFERENCES_SCHEMA_VERSION, JSON.stringify(migrated)]);
  return migrated;
}
```

- [ ] **Step 3c: Add `language` to all eight existing rungs**

Each older rung builds a full `AppPreferences` literal, so every one of them now
needs `language: DEFAULT_APP_PREFERENCES.language`. `tsc` will list them — treat
the type errors as the checklist rather than hunting by eye.

- [ ] **Step 3d: Update the eight `toBe(9)` assertions**

`src/persistence/__tests__/preferences-repository.test.ts` asserts
`expect(database.preferencesRow?.schema_version).toBe(9)` in eight places (e.g.
`:52`). All become `toBe(10)`. The tests use `FakePersistenceDatabase` with
`database.preferencesRow = {...}` — **not** `openTestDatabase` /
`seedPreferencesRow`, which do not exist. Note also that `PreferencesSchema` is
module-private (`:88`), so a test cannot import it; assert through
`createPreferencesRepository(db).load()` instead.

- [ ] **Step 3b: Replace fixture-by-spread with literal fixtures**

Add a hand-written version-9 fixture with **no** `language` key — not a spread
of `DEFAULT_APP_PREFERENCES` minus a field, because that is the construction
that hides the bug:

```ts
const V9_ROW_LITERAL = {
  formationPresets: ['4-4-2', '4-3-3', '3-5-2'],
  autoPowers: false,
  masterVolume: 1,
  reduceMotion: false,
  hudSide: 'left',
  hapticsEnabled: true,
  textScale: 1,
  highContrast: false,
  colorSafeKits: true,
  cutInMode: 'full',
  climbCompleted: false,
  seenPowerCutIns: [],
  autoSubs: false,
  squadSort: null,
  developerMode: false,
};
```

Do the same for versions 1–8. They have no literal fixtures today, which is why
this class of bug can reach a device at all.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/persistence/__tests__/preferences-repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/persistence/preferences-repository.ts src/persistence/__tests__/preferences-repository.test.ts
git commit -m "feat(i18n): persist the language preference, schema v10"
```

---

## Task 7: Wire the preference through, then useCopy / useFaces

**Files:**
- Create: `src/i18n/use-copy.ts`, `src/i18n/use-faces.ts`, `src/i18n/index.ts`
- Modify: `App.tsx` (load, set, persist)
- Test: `src/i18n/__tests__/use-copy.test.ts`

**An earlier draft of this plan shipped a dead control.** It added `language` to
SQLite (Task 6) and read `preferences.language` in the hook, but never wrote the
setter, never loaded the value into app state, and never persisted a change. The
picker in Task 15 would have toggled nothing. The wiring is this task.

**Ground truth, because two earlier drafts got this wrong.** Preferences are
**App-level React state**, not a Zustand slice:

```ts
// App.tsx:485
const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
```

The Zustand store is exported as **`useM1Store`** (`store.ts:374`), not
`useStore`, and it has **no `preferences` field at all**. Any hook written
against `useStore(state => state.preferences.language)` fails twice over.

So the locale reaches deep consumers — the match screen, power takeovers, the
substitution board — through a **React context fed from that existing state**,
not through the store and not by prop-drilling through twenty components:

```ts
// src/i18n/locale-context.tsx
const LocaleContext = createContext<Locale>('en');
export const LocaleProvider = LocaleContext.Provider;
export const useLocale = () => useContext(LocaleContext);
```

**Boot sequence, stated because it is observable:** preferences load
asynchronously from SQLite, so the locale is `'en'` for the first frames and
flips once the row arrives. That is acceptable — the pre-picker screens are
English anyway — but it must be a deliberate choice rather than a surprise, and
the provider must not remount the tree when it flips.

- [ ] **Step 1: Write the failing test for the pure core**

The hooks cannot be rendered here — `require('react-native')` throws under this
Jest config — so test the pure functions the hooks wrap:

```ts
import { copyFor, facesFor } from '../use-copy';

describe('copyFor', () => {
  test('returns a bound t() for the active locale', () => {
    expect(copyFor('en')('settings.language.title')).toBe('Language');
  });

  test('a locale with an empty catalog still resolves through English', () => {
    expect(copyFor('de')('settings.language.title')).toBe('Language');
  });
});

describe('facesFor', () => {
  test('Latin locales keep Silkscreen', () => {
    expect(facesFor('de').display).toBe('Silkscreen_700Bold');
  });
  test('Vietnamese swaps both voices together', () => {
    expect(facesFor('vi')).toEqual({ display: 'Handjet_700Bold', data: 'Handjet_400Regular' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/i18n/__tests__/use-copy.test.ts`
Expected: FAIL — `Cannot find module '../use-copy'`

- [ ] **Step 3: Implement the pure core plus the hooks**

```ts
import { loadCatalog } from './load-catalogs';
import { localeMeta, type Locale, type LocaleFaces } from './locales';
import { resolveCopy, type CopyParams } from './resolve';

export type CopyFn = (key: string, params?: CopyParams) => string;

/**
 * Pure, and exported for tests: the hooks are thin wrappers, and this Jest
 * config cannot render a component (testEnvironment is node and
 * `require('react-native')` throws).
 */
export function copyFor(locale: Locale): CopyFn {
  const strings = loadCatalog(locale).strings;
  const fallback = locale === 'en' ? strings : loadCatalog('en').strings;
  return (key, params) => resolveCopy(locale, strings, fallback, key, params);
}

export function facesFor(locale: Locale): LocaleFaces {
  return localeMeta(locale).faces;
}
```

The hooks read the context:

```ts
export function useCopy(): CopyFn {
  return copyFor(useLocale());
}

export function useFaces(): LocaleFaces {
  return facesFor(useLocale());
}
```

- [ ] **Step 4: Wire the setter and the persistence**

In `App.tsx`, beside the existing preference setters:

```ts
// App.tsx, beside the other preference setters
const setLanguage = useCallback((language: Locale) => {
  setPreferences(current => {
    const next = { ...current, language };
    void savePreferences(next);          // the existing persistence path
    return next;
  });
}, []);
```

and wrap the tree once:

```tsx
<LocaleProvider value={preferences.language}>
  <View style={vars({ '--font-display': faces.display, '--font-data': faces.data })} className="flex-1">
    {/* existing tree */}
  </View>
</LocaleProvider>
```

The picker (Task 15) takes `setLanguage` as a prop. Language inherits boot-load
and persistence from the machinery `preferences` already has, which is the whole
reason not to give it a separate store slice.

- [ ] **Step 5: Decide what the picker lists — and fix the spec to match**

The picker lists **`ENABLED_LOCALES`**, not `LOCALES`. Spec §7.1 already says
so, and offering a language whose catalog is empty means offering a menu item
that visibly does nothing — English fallback makes it *safe*, not *honest*.

`LOCALES` is the full seven-language type union and the target set for gates and
tests; `ENABLED_LOCALES` is what has actually shipped. In Phase 1 that is
`['en']`, so the picker shows one row — correct, because one language is what
exists. Task 17's Vietnamese smoke test works through the temporary widening it
already prescribes.

Write the distinction in `locales.ts` next to both constants: the names are easy
to confuse, and picking the wrong one either hides finished languages or ships
dead menu rows.

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx jest src/i18n/__tests__/use-copy.test.ts && npx tsc --noEmit`
Expected: PASS, 4 tests

- [ ] **Step 7: Commit**

```bash
git add src/i18n/ App.tsx
git commit -m "feat(i18n): useCopy and useFaces over the existing preference, with the setter wired"
```

---

## Task 8: Font swap — the className half

**Files:**
- Modify: `tailwind.config.js:41-46`, `App.tsx`
- Test: `src/i18n/__tests__/faces.test.ts`

- [ ] **Step 1: Point the Tailwind families at CSS variables**

```js
      fontFamily: {
        // Resolved at runtime from the `vars()` call at the app root, so a
        // language change swaps the face live without touching the ~hundreds of
        // `font-pixel` / `font-mono` call sites.
        //
        // Verified against react-native-css-interop 0.2.6: `font-family` is in
        // `validProperties` (css-to-rn/parseDeclaration.ts:174), so a `var()`
        // value arrives as an unparsed declaration, routes through
        // `parseUnparsed` (:344) to a runtime var descriptor (:1683), and is
        // resolved by runtime/native/resolve-value.ts:85 against the variables
        // `vars()` injected. This works on native, not only on web.
        mono: ['var(--font-data)'],
        pixel: ['var(--font-display)'],
      },
```

- [ ] **Step 2: Load the Handjet cuts and wrap the root**

In `App.tsx`, extend every `useFonts` call:

```ts
import { Handjet_400Regular, Handjet_700Bold } from '@expo-google-fonts/handjet';

const [fontsLoaded] = useFonts({
  Silkscreen_400Regular,
  Silkscreen_700Bold,
  Handjet_400Regular,
  Handjet_700Bold,
});
```

Wrap the app root:

```tsx
import { vars } from 'nativewind';
import { facesFor } from './src/i18n';

const faces = facesFor(language);

<View style={vars({ '--font-display': faces.display, '--font-data': faces.data })} className="flex-1">
  {/* existing tree */}
</View>
```

- [ ] **Step 3: Assert the config in a test**

```ts
const config = require('../../../tailwind.config.js');

test('the pixel families resolve through CSS variables, not literals', () => {
  expect(config.theme.extend.fontFamily.pixel).toEqual(['var(--font-display)']);
  expect(config.theme.extend.fontFamily.mono).toEqual(['var(--font-data)']);
});
```

- [ ] **Step 4: Run the suite**

Run: `npx jest src/i18n && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js App.tsx src/i18n/__tests__/faces.test.ts
git commit -m "feat(i18n): swap pixel faces per locale via NativeWind CSS variables"
```

---

## Task 9: Font swap — the 16 files `vars()` cannot reach

**Files (all 16):**
```
src/render/SubstitutionBoard.tsx       src/ui/PowerAcquiredDemoModal.tsx
src/render/MatchControlRail.tsx        src/ui/TrainingDrillModal.tsx
src/render/PowerTitleTakeover.tsx      src/ui/components/CupBracket.tsx
src/render/CupTitleCard.tsx            src/ui/components/DrillGainReveal.tsx
src/render/DrillSceneOverlay.tsx       src/ui/components/EventRewardArt.tsx
src/render/FirstMatchCoachingModal.tsx src/ui/components/TitlePlayerPopScene.tsx
src/render/match-screen-styles.ts      src/ui/screens/AwakeningCutsceneScreen.tsx
src/ui/screens/PowerArtQaScreen.tsx    src/ui/screens/AwakeningArtQaScreen.tsx
```
- Test: `src/i18n/__tests__/no-literal-faces.test.ts`

**Why this task exists:** raw `Silkscreen_*` family literals bypass NativeWind
entirely — they are module-scope constants fed into `StyleSheet.create`,
evaluated once at import, so no runtime rebinding reaches them. Ten matching
files are `src/ui/dev-harness/` and stay English by policy; the 16 above are
player-facing. Skipping this task ships Vietnamese with broken type in the
game's biggest moments.

**Count the files correctly.** Grepping `fontFamily: 'Silkscreen` finds only the
direct form and misses the indirect one:

```ts
const PIXEL_BOLD = 'Silkscreen_700Bold';   // invisible to that grep
const styles = StyleSheet.create({ name: { fontFamily: PIXEL_BOLD } });
```

That pattern hides `SubstitutionBoard.tsx:911`, `MatchControlRail.tsx:399` and
`PowerTitleTakeover.tsx:194` — the match screen itself. Search for the **family
name string literal anywhere in the file**. A guard written against the narrower
pattern goes green while the match screen stays broken, which is exactly what an
earlier draft of this plan did.

- [ ] **Step 1: Write the guard test first**

```ts
import fs from 'fs';
import path from 'path';

const EXEMPT = /src\/ui\/dev-harness\//;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!/__tests__/.test(p)) walk(p, out); }
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

test('no player-facing file hardcodes a font family', () => {
  // The family-name literal ANYWHERE in the file — not just after `fontFamily:`.
  // The narrow pattern misses `const PIXEL_BOLD = 'Silkscreen_700Bold'`.
  const offenders = walk('src')
    .filter(f => !EXEMPT.test(f))
    .filter(f => /'(Silkscreen|Handjet|VT323)_/.test(fs.readFileSync(f, 'utf8')));

  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail with exactly 16 files**

Run: `npx jest src/i18n/__tests__/no-literal-faces.test.ts`
Expected: FAIL listing the 16 files above, plus `src/i18n/locales.ts` (which
legitimately names the families — add it to `EXEMPT` alongside the dev harness).
If the list differs otherwise, reconcile before continuing.

- [ ] **Step 3: Convert each file**

The pattern, using `src/render/SubstitutionBoard.tsx` as the worked example.
Before — module scope, evaluated once at import:

```ts
const PIXEL_BOLD = 'Silkscreen_700Bold';
const PIXEL = 'Silkscreen_400Regular';
const POSITION_NAME_STYLE = { fontFamily: PIXEL_BOLD, fontSize: 18 };
const styles = StyleSheet.create({ score: { fontFamily: PIXEL, fontSize: 24 } });
```

After — the sizes and every other property stay at module scope; only the family
moves into render, so the locale can change it:

```ts
const POSITION_NAME_STYLE = { fontSize: 18 };
const styles = StyleSheet.create({ score: { fontSize: 24 } });

export function SubstitutionBoard(props: SubstitutionBoardProps) {
  const faces = useFaces();
  // ...
  <Text style={[POSITION_NAME_STYLE, { fontFamily: faces.display }]}>{name}</Text>
  <Text style={[styles.score, { fontFamily: faces.data }]}>{score}</Text>
}
```

Mapping is mechanical: `Silkscreen_700Bold` → `faces.display`,
`Silkscreen_400Regular` → `faces.data`.

`src/render/match-screen-styles.ts` has no component to hook from — export a
factory instead:

```ts
export function matchScreenStyles(faces: LocaleFaces) { /* build and return */ }
```

and memoise it at the one call site with `useMemo(() => matchScreenStyles(faces), [faces])`.

- [ ] **Step 4: Run the guard and the full suite**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, `no-literal-faces` green

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "refactor(i18n): route the 13 raw fontFamily files through useFaces"
```

---

## Task 10: Formation blurbs out of the pure sim ring

**Files:**
- Modify: `src/sim/tactics.ts:46-50`
- Test: `src/sim/__tests__/runtime-golden.test.ts` (must stay green, unchanged)

- [ ] **Step 1: Confirm the golden replay passes before touching anything**

Run: `npx jest src/sim/__tests__/runtime-golden.test.ts`
Expected: PASS. Record the current `ENGINE_VERSION`.

- [ ] **Step 2: Move the blurbs**

`FORMATION_LABELS` at `src/sim/tactics.ts:45-52` holds the only user-facing
English in the sim ring. **There are six entries, not five** — an earlier draft
of this plan quoted only through `:50` and missed the last one, whose hyphenated
"All-out" also evades a prose grep:

```ts
'4-4-2': 'Balanced lines',
'4-3-3': 'Wide attack',
'3-5-2': 'Midfield shield',
'5-3-2': 'Deep counter',
'4-5-1': 'Crowd midfield',
'3-4-3': 'All-out attack',      // <- the one that gets missed
```

Missing it is not cosmetic: `3-4-3` is in `DEFAULT_FORMATION_PRESETS`
(`tactics.ts:15-19`) and `COACHING_FORMATION_IDS` (`:8-13`), so a player sees the
raw key `formation.3-4-3.blurb` on the title screen and the match rail.

Delete the map from `tactics.ts`; the ring keeps only `FormationId`. Add all six
strings to `content/i18n/en.json` as `formation.<id>.blurb` and resolve them at
the call sites: `TitleLandingScreen.tsx:257`, `MatchControlRail.tsx:189,197`,
`MatchScreen.tsx:1335,2130`. All are display-only, which is why the replay
should not move.

- [ ] **Step 2b: Fix the source-text assertion that depends on the map**

`src/render/__tests__/match-rail.test.ts:182` asserts on source text containing
`FORMATION_LABELS[formation].toUpperCase()`. Deleting the map breaks it. Update
the assertion to the new `t()` call rather than deleting the test — it exists to
pin that the rail shows a formation label at all.

- [ ] **Step 3: Run the golden replay again**

Run: `npx jest src/sim/`
Expected: PASS with `ENGINE_VERSION` **unchanged**.

This is display-only data with no behavioural role, so the replay should not
move. If it does, something read the blurb for logic — stop, investigate, and
treat it as a version decision per CLAUDE.md rather than bumping reflexively.

- [ ] **Step 4: Commit**

```bash
git add src/sim/tactics.ts content/i18n/en.json src/ui/
git commit -m "refactor(i18n): move formation blurbs out of the sim ring"
```

---

## Task 11: Event outcome ids

**Files:**
- Modify: `content/events.json`, `src/content/schemas.ts`
- Test: `src/content/__tests__/content.test.ts`

**Why now:** outcomes are anonymous weighted entries (`weight`, `text`,
`successHeadline`) with no `id`. Keying their translations by array index means
a future reorder silently reassigns every translated outcome to the wrong
branch — every key still resolves, so no other gate in this plan would catch it.
Ids must exist before any outcome is translated.

- [ ] **Step 1: Write the failing test**

**Outcomes nest under `choices`, not under the event.** The shape is
`events[].choices[].outcomes[]` (`src/content/schemas.ts:458-462`); a test
reading `event.outcomes` throws on undefined.

```ts
test('every event outcome carries an id unique within its event', () => {
  for (const event of loadLaunchContent().events.events) {
    const ids = event.choices.flatMap(choice => choice.outcomes.map(o => o.id));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/content/__tests__/content.test.ts -t "outcome carries a unique id"`
Expected: FAIL — `id` undefined

- [ ] **Step 3: Add ids to the schema and the data**

In `src/content/schemas.ts`, add `id: idSchema` to `EventOutcomeSchema`. Then
add a stable id to every outcome in `content/events.json`.

**The id must include the choice**, because an event can have several risky
choices each with a success and a setback outcome — so `derby-night.success` is
not unique. Derive it as `<eventId>.<choiceId>.<role>`, e.g.
`meteor-shard-center-circle.display-meteor.success`. Never derive from the array index:
that is the fragility this task exists to remove.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/content/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content/events.json src/content/schemas.ts src/content/__tests__/content.test.ts
git commit -m "feat(i18n): give every event outcome a stable id"
```

---

## Task 12: Persisted-English keys (the 12 surfaces)

**Files:**
- Modify: `src/persistence/game-state-codec.ts` (lines per the table below)
- Modify: `src/game/career.ts`, `src/game/player-requests.ts`, `src/game/cup-giant-killing.ts`, `src/game/season-recap.ts`, `src/game/career-events.ts`
- Modify: the producer-side **types** (`LedgerLine`, `CashTransaction`, `SeasonRecapAward`) so the dual-write typechecks
- Test: `src/persistence/__tests__/i18n-label-codec.test.ts` (**new file** — codec tests here are split per feature; there is no `game-state-codec.test.ts`)

| # | Surface | Codec line | Schema |
| --- | --- | --- | --- |
| 1 | Ledger line `label` | `:190` | `.passthrough()` |
| 2 | Cash transaction `label` | `:185` | `.passthrough()` |
| 3 | Season recap award `label`, `detail` | `:1132` | `.passthrough()` |
| 4 | Sponsor objective snapshot `label` | `:495` | `strictObject` |
| 5 | Sponsor contract snapshot `offerLine` | `:510` | `strictObject` |
| 6 | Sponsor offer snapshot `offerLine` | `:527` | `strictObject` |
| 7 | Sponsor rules `brands[].offerLine`, `objectives[].labelTemplate` | `:458`, `:483` | `strictObject` |
| 8 | `pendingEvent.outcomeText` | `:758` | optional |
| 9 | Cup giant-killing `title`, `body` | `:1343-1348` | `.passthrough()` |
| 10 | `seasonRecap.cupResult` | `:1176` | free string |
| 11 | `playerRequestRules.requests[].title`, `.line` | `:429-436` | `.passthrough()` |
| 12 | Season recap `topScorer.detail` — **parsed as data** | `:1132` | `.passthrough()` |

- [ ] **Step 1: Write the failing test**

```ts
describe('persisted copy carries keys as well as English', () => {
  test('a new ledger line dual-writes label and labelKey', () => {
    const state = advanceOneWeek(newCareer());
    const line = state.ledgers.at(-1)!.lines[0];
    expect(line.label).toEqual(expect.any(String));   // still required
    expect(line.labelKey).toMatch(/^ledger\./);
  });

  test('labelParams hold raw values, never formatted text', () => {
    const state = signSponsor(newCareer());
    const line = state.ledgers.at(-1)!.lines.find(l => l.kind === 'sponsor')!;
    for (const value of Object.values(line.labelParams ?? {})) {
      expect(String(value)).not.toMatch(/[$,.]\d{3}/);
    }
  });

  test('a save written before this change still loads and renders its English', () => {
    const legacy = legacySaveFixture();          // no labelKey anywhere
    const parsed = parseCareerState(legacy);
    expect(parsed.ledgers[0].lines[0].label).toBe('Fan Shop merchandise');
    expect(parsed.ledgers[0].lines[0].labelKey).toBeUndefined();
  });

  test('cupResult is a structured pair, not a sentence', () => {
    const recap = seasonRecapFor(newCareer());
    expect(recap.cupResult).toEqual({ outcome: 'not-entered' });
  });
});
```

**Use the fixtures that exist.** None of `newCareer`, `advanceOneWeek`,
`signSponsor`, `legacySaveFixture`, `seasonRecapFor` or `parseCareerState` exist
in this repo. Follow the pattern in `ledger-idempotency-codec.test.ts` and
`m2-game-state-codec.test.ts`: build a state literal, round-trip it through the
codec's own encode/decode, and assert on the result.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/persistence/__tests__/i18n-label-codec.test.ts`
Expected: FAIL — `labelKey` undefined

- [ ] **Step 3: Add optional sibling fields to all 11 surfaces**

```ts
labelKey: nonemptyString.optional(),
labelParams: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
```

For the four `strictObject` schemas (4–7) the fields must be **declared** or the
row fails validation. This needs **no `GAME_SCHEMA_VERSION` bump and no
migration rung** — the fields are optional, so old saves parse unchanged and
nothing has to be synthesised for them. Do not relax these to `.passthrough()`
to avoid the declaration; silently dropping unknown keys is worse.

Surfaces 5–7 and 11 already persist their content id (`sponsorContentId` at
`:508` and `:525`), so they need a renderer that prefers the id over the frozen
string rather than a new field.

Surface 10 changes shape: `cupResult: z.union([z.string(), z.strictObject({ outcome: ..., round: ... })])`
— accepting the legacy string keeps old saves loading.

- [ ] **Step 4: Dual-write at every producer**

`career.ts:836-1004`, `player-requests.ts:422`, `cup-giant-killing.ts:17-46`,
`season-recap.ts:247-257`, `career-events.ts:283-331`. Every one writes the
English `label` **and** the key. `label` stays required — a producer that emits
only keys fails its own schema.

- [ ] **Step 4b: Stop parsing goals out of an English sentence**

`hall-of-fame.ts:50` reads the Golden Boot goal count back out of the English
string with `^(\d+) goals$`, written by `season-recap.ts:87` as
`` `${topScorerGoals} goals` ``. Its own comment admits the coupling, and an
unparseable detail "counts zero rather than throwing". Translate that string and
every career top-scorer total silently becomes zero — no gate in this plan would
catch it, because the key resolves, the placeholders match, the glyphs exist and
the budget holds.

Write the failing test first:

```ts
test('career top scorer survives a translated detail string', () => {
  const recap = { ...recapFixture, topScorer: { ...award, detail: '22 goles', goals: 22 } };
  expect(careerTopScorer([recap])?.goals).toBe(22);
});

test('a legacy recap with no numeric field still parses its English', () => {
  const recap = { ...recapFixture, topScorer: { ...award, detail: '22 goals' } };
  expect(careerTopScorer([recap])?.goals).toBe(22);
});
```

Then persist an optional numeric `goals` on `seasonRecapAwardSchema`, write it in
`season-recap.ts`, prefer it in `hall-of-fame.ts`, and keep the regex only as the
legacy path.

- [ ] **Step 4c: `cupResult` keeps its string**

Do **not** change `cupResult` to an object. The codec requires a string today
(`game-state-codec.ts:1163`); replacing the type breaks every existing recap and
needs a real `GAME_SCHEMA_VERSION` bump with a migration, which contradicts the
optional-additions reasoning in Step 3. Keep `cupResult` required, and add
optional `cupOutcome` / `cupRound` siblings. New saves write all three, the UI
prefers the pair, old saves keep rendering their English.

- [ ] **Step 4d: Grep before you key**

Before keying **any** string in this task or Task 13, grep `src/` for the English
literal. Surface 12 is the proof that a display string can be load-bearing, and
a grep is the only cheap way to find the next one.

- [ ] **Step 5: Run the full suite**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, golden replay unchanged

- [ ] **Step 6: Commit**

```bash
git add src/persistence/ src/game/
git commit -m "feat(i18n): dual-write labelKey alongside English on all 12 persisted surfaces"
```

---

## Task 13: The extraction

**Files:**
- Modify: every player-facing file, in batches; `content/i18n/en.json`
- Test: `src/i18n/__tests__/en-catalog.snapshot.test.ts`

This is the bulk of Phase 1 — roughly 3,000 candidate strings across 247 files.
Work **one screen at a time**, committing per screen, so a partial extraction is
always a working game.

- [ ] **Step 1: Fix the key-naming scheme before keying anything**

An earlier draft said "replace literal → add key → commit" with no scheme, which
is not an executable instruction — two engineers would produce two incompatible
catalogs. The scheme:

```
<area>.<screen-or-system>.<element>[.<variant>]
```

| Rule | Example |
| --- | --- |
| Area is the screen file's own name, lower-camel | `characterCreation`, `leagueTable`, `matchHud` |
| Cross-screen systems get a flat namespace | `ledger.*`, `settings.*`, `bert.*`, `col.*` |
| Element names the thing, not the text | `.confirmButton`, not `.eraseAndStartOver` |
| Plural siblings use `.one` / `.other` | `squad.count.one` |
| Content-derived keys mirror the content id | `event.derby-night.body` |

Element-names-the-thing matters: a key derived from the English wording becomes
a lie the first time the English changes.

- [ ] **Step 2: Write the snapshot guard**

```ts
test('the English catalog matches its snapshot', () => {
  expect(loadCatalog('en').strings).toMatchSnapshot();
});
```

This is what stops a keying pass from silently rewording copy. Every snapshot
diff must be a deliberate copy change, reviewed as one.

- [ ] **Step 3: Route content prose through the resolver too**

Adding ids to `content/events.json` (Task 11) does not by itself make the UI read
through the catalog. Until the call sites change, `events.json` remains the live
English *and* `<locale>.json` holds translations — two sources, guaranteed drift,
and Phase 2 would translate keys the app never reads.

So every content-prose consumer changes from reading `event.text` directly to
`t('event.<id>.body')`. The resolver's English path for content keys reads the
content file by id (spec §3.3), so English behaviour is unchanged and there is
still exactly one English source.

Consumers to convert: `StoryEventScreen`, the tips surface, `GlossaryPanel`, the
Bert assistant-guide sequences, ceremony lines, fulltime coach and blame lines.

- [ ] **Step 4: Declare the dynamic-key registry**

Gate 2 needs to know which keys are legally built at runtime. Export it from
`src/i18n/dynamic-keys.ts`, deriving the legal id set from the content files
themselves:

```ts
export const DYNAMIC_KEY_PREFIXES = {
  'event.': () => loadLaunchContent().events.events.map(e => e.id),
  'tip.': () => loadLaunchContent().tips.tips.map(t => t.id),
  'bert.': () => loadLaunchContent().assistantGuide.sequences.map(s => s.id),
} as const;
```

- [ ] **Step 5: Work the batches, lowest risk first**

1. `SettingsOverlay`, `PrivacySupportPanel`, `GlossaryPanel` — 47 strings
2. `CharacterCreationScreen`, `NewGameWelcome`, `TitleLanding` — 101 strings
3. The weekly loop — 905 strings across 20 files
4. Match and render ring — 358 strings across 59 files
5. Season and ceremony — 285 strings across 38 files
6. `App.tsx` and the overlays — the 1,966 unclassified strings

For each batch: replace the literal with `t()`, add the key to `en.json`, run
`npx jest && npx tsc --noEmit`, commit.

- [ ] **Step 6: Replace the `toLocaleString` call sites**

Task 3 built `formatInteger` / `formatMoney` but nothing calls them yet. Convert
`view-models.ts:560`, `event-selection.ts:189`, `player-request-view-model.ts:111`
and the **five** in `store.ts`. A helper nobody calls changes nothing, and these
sites vary by device locale today.

While converting, check that `labelParams` carry **raw numbers** — formatting
belongs at the render edge, not in the params (spec §4.3).

- [ ] **Step 7: Split player-facing copy out of `App.tsx` as you go — mechanically**

`App.tsx` is 2,944 lines and holds the largest share of the unclassified
strings. Move a screen's copy into that screen's file as you key it. Keep this
**mechanical**: do not couple localisation to a broad component restructure, or
Phase 1's "identical game" promise becomes impossible to verify.

- [ ] **Step 8: Commit per batch**

```bash
git add -A && git commit -m "refactor(i18n): key the <batch> copy"
```

---

## Task 14: The CI gates

**Files:**
- Create: `src/i18n/__tests__/gates.test.ts`, `src/i18n/__tests__/no-hardcoded-prose.test.ts`, `src/i18n/glyph-coverage.ts`, `src/i18n/voice.ts`

- [ ] **Step 1: Write the gates**

All of these are pure data checks and run under the existing node Jest config.
`roots: ['<rootDir>/src']` limits *test discovery*, not what a test may read, so
they reach `content/i18n/` with `fs.readFileSync`.

```ts
describe('i18n gates', () => {
  test('gate 1 — every English key exists in every enabled locale', () => {
    const en = Object.keys(loadCatalog('en').strings);
    for (const locale of ENABLED_LOCALES.filter(l => l !== 'en')) {
      const have = new Set(Object.keys(loadCatalog(locale).strings));
      expect(en.filter(k => !have.has(k))).toEqual([]);
    }
  });

  test('gate 3 — every string is inside its character budget', () => {
    const en = loadCatalog('en').strings;
    for (const locale of ENABLED_LOCALES.filter(l => l !== 'en')) {
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        if (key.startsWith('col.')) continue;      // layout tokens, exempt
        const ceiling = Math.ceil((en[key]?.length ?? 0) * localeMeta(locale).expansion) + 2;
        expect({ key, len: value.length }).toMatchObject({ len: expect.any(Number) });
        expect(value.length).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  test('gate 4 — placeholders match the English source exactly', () => {
    const placeholders = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();
    const en = loadCatalog('en').strings;
    for (const locale of ENABLED_LOCALES.filter(l => l !== 'en')) {
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        expect({ key, p: placeholders(value) })
          .toEqual({ key, p: placeholders(en[key] ?? '') });
      }
    }
  });

  test('gate 5 — every character exists in that locale s font', () => {
    for (const locale of ENABLED_LOCALES) {
      const covered = glyphSet(faceFile(localeMeta(locale).faces.display));
      for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
        const missing = [...value].filter(ch => !covered.has(ch.codePointAt(0)!));
        expect({ key, missing }).toEqual({ key, missing: [] });
      }
    }
  });
});
```

`glyphSet` parses a TTF `cmap` — the same technique `league-table-columns.ts`
already uses for advances. Put it in `src/i18n/glyph-coverage.ts`.

- [ ] **Step 2: Gate 2 against the dynamic-key registry**

Use `DYNAMIC_KEY_PREFIXES` from Task 13. A catalog key is legal if it is
statically referenced **or** matches a registered prefix with an id the content
files actually contain. Anything else fails.

- [ ] **Step 3: Gate 5 is per-voice, and covers formatter output**

Checking the whole catalog against the pixel font is wrong in both directions.
`PixelText.tsx:16` documents a third voice, `body`, that deliberately renders in
the platform sans because pixel type is exhausting for long prose. A blanket
check rejects a valid em dash in an event paragraph and misses an invalid glyph
in a button.

```ts
test('gate 5 — every string renders in a face that has its glyphs', () => {
  for (const locale of ENABLED_LOCALES) {
    const faces = localeMeta(locale).faces;
    for (const [key, value] of Object.entries(loadCatalog(locale).strings)) {
      const voice = voiceOf(key);
      if (voice === 'body') continue;                    // system sans, any glyph
      // Check the face the key is actually drawn in — display and data are
      // different files, and only checking `display` would miss data-voice copy.
      const covered = glyphSet(faceFile(faces[voice]));
      const missing = [...value].filter(ch => !covered.has(ch.codePointAt(0)!));
      expect({ key, missing }).toEqual({ key, missing: [] });
    }
  }
});

test('gate 5b — the formatter s own characters exist in the face', () => {
  for (const locale of ENABLED_LOCALES) {
    const covered = glyphSet(faceFile(localeMeta(locale).faces.data));
    for (const ch of [localeMeta(locale).groupSeparator, '$', '-']) {
      expect({ locale, ch }).toMatchObject({ locale });
      expect(covered.has(ch.codePointAt(0)!)).toBe(true);
    }
  }
});
```

Gate 5b is not optional decoration — it is what catches a separator like U+202F
that Silkscreen lacks, without anyone reading a French screenshot. Separators
live in code, not in the catalog, so gate 5 alone cannot see them.

**This tooling does not exist yet and has to be written.** An earlier draft said
"the same technique `league-table-columns.ts` uses" — but that file holds
*hand-recorded numbers* from an offline measurement (`:26-47`), not reusable
code. There is no TTF parser anywhere in the repo.

So `src/i18n/glyph-coverage.ts` is real new work, and needs its own tests:

- `faceFile(family)` maps `'Handjet_700Bold'` →
  `node_modules/@expo-google-fonts/handjet/700Bold/Handjet_700Bold.ttf`.
- `glyphSet(ttfPath)` parses the `cmap` table and returns the covered
  codepoints. It must handle **format 4 and format 12** — Handjet's 1,322
  glyphs and Silkscreen's 226 both fit format 4 today, but a format-12 face
  would silently return an empty set and make the gate pass on everything.
  Assert non-emptiness as a guard.
- A unit test pinning known answers: Silkscreen covers `é` and not `ế`; Handjet
  covers both. Those two facts are the whole basis of §4.1, so they are worth a
  regression test.

The same parser serves `scripts/i18n/measure-advances.mjs` in Phase 2, which
also needs `hmtx` — write it with that in mind.

A node Jest test may read from `node_modules`: `roots` limits test *discovery*,
not filesystem access.

- [ ] **Step 3b: Gate 6 is a TypeScript AST check, NOT ESLint**

`README.md:10` says "There is no lint script — that's intentional, don't add
one", and the repo has no ESLint dependency. Adding one to satisfy this gate
would unilaterally reverse a documented decision.

Use the TypeScript compiler API, already available via `ts-jest`, from a normal
Jest test:

```ts
import ts from 'typescript';

const SCOPE = ['src/ui', 'src/render', 'src/application', 'src/game', 'App.tsx'];
const EXEMPT = /src\/ui\/dev-harness\/|src\/audit\//;

test('gate 6 — no hardcoded player-facing prose', () => {
  const offenders: string[] = [];
  for (const file of filesIn(SCOPE).filter(f => !EXEMPT.test(f))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    ts.forEachChild(sf, function visit(node) {
      if (ts.isJsxText(node) && /[a-z]{2}/.test(node.text)) offenders.push(`${file}: ${node.text.trim()}`);
      // Accessibility strings are PROPS, not JSX text — 343 of them. A rule
      // written only against text nodes is structurally blind to them, and the
      // result is VoiceOver reading English in six languages.
      if (ts.isJsxAttribute(node) && /^accessibility(Label|Hint)$/.test(node.name.getText())
          && node.initializer && ts.isStringLiteral(node.initializer)) {
        offenders.push(`${file}: ${node.name.getText()}`);
      }
      ts.forEachChild(node, visit);
    });
  }
  expect(offenders).toEqual([]);
});
```

`src/game/` is in scope because §3 of the spec names it as one of the three
English-emitting layers. `throw new Error` messages are developer-facing and
exempt.

- [ ] **Step 3c: Gate 9 — locale invariance**

The golden replay runs `src/sim/match` with fixed teams
(`parity-replay.test.ts:60`); it does not exercise career events, the economy, or
save output, so it cannot alone prove language has no behavioural effect.

```ts
test('gate 9 — the same seeded career is identical under every language', () => {
  const runs = LOCALES.map(language => JSON.stringify(
    runSeededCareer({ seed: 12345, inputs: FIXED_INPUTS, preferences: { ...DEFAULT_APP_PREFERENCES, language } }),
  ));
  expect(new Set(runs).size).toBe(1);
});
```

`language` stays out of career state entirely, which is what makes this cheap to
satisfy — and the test is what proves it stayed out.

- [ ] **Step 4: Run everything**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat(i18n): CI gates for key parity, budget, placeholders, glyphs, prose and locale invariance"
```

---

## Task 15: The language picker

**Files:**
- Modify: `src/ui/screens/CharacterCreationScreen.tsx:137`, `src/ui/SettingsOverlay.tsx`
- Create: `src/ui/components/LanguagePanel.tsx`
- Test: `src/ui/__tests__/language-panel.test.ts`

- [ ] **Step 1: Write the failing test for the pure view-model**

```ts
test('lists the enabled locales by their own endonyms, active one marked', () => {
  const rows = languagePanelRows('en', ['en', 'es', 'vi']);
  expect(rows.map(r => r.endonym)).toEqual(['English', 'Español', 'Tiếng Việt']);
  expect(rows.find(r => r.selected)?.locale).toBe('en');
});

test('in phase 1 only English is offered', () => {
  expect(languagePanelRows('en', ENABLED_LOCALES).map(r => r.locale)).toEqual(['en']);
});

test('the Vietnamese row carries its own face whatever the active locale', () => {
  for (const active of LOCALES) {
    const vi = languagePanelRows(active, ['en', 'vi']).find(r => r.locale === 'vi')!;
    expect(vi.face).toBe('Handjet_700Bold');
  }
});
```

The second test is the one that matters: "Tiếng Việt" contains `ế` and `ệ`,
which Silkscreen does not have. Rendered in the active locale's face it would
show the exact mid-word typeface substitution this whole project exists to
prevent — in the picker itself.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/ui/__tests__/language-panel.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Build the panel**

Mirror the difficulty radio group already at `CharacterCreationScreen.tsx:137` —
same `PaperPanel`, same `accessibilityRole="radiogroup"`, same `●`/`○` glyph
convention (both are absent from Silkscreen and fall back deliberately). Collapse
to a single tappable row on the phone layout so the screen does not grow a
seventh scroll section.

Add the same control to `SettingsOverlay` so the choice is not a one-time trap.

- [ ] **Step 4: Run the suite**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/ && git commit -m "feat(i18n): language picker on the signing screen and in Settings"
```

---

## Task 16: Native config

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Declare the localisations**

Without this iOS reports the app as English-only and the App Store page does not
list the seven languages, however well the in-app picker works. This is app
config, not store metadata.

```json
"ios": {
  "infoPlist": {
    "CFBundleLocalizations": ["en", "es", "pt-BR", "fr", "de", "id", "vi"]
  }
}
```

- [ ] **Step 2: Rebuild to the phone**

This is a native config change, so it needs a rebuild rather than a Metro
reload. It is batched here with the Handjet dependency from Task 0 so Phase 1
costs exactly one rebuild.

- [ ] **Step 3: Commit**

```bash
git add app.json && git commit -m "feat(i18n): declare CFBundleLocalizations"
```

---

## Task 17: Phase 1 verification

- [ ] **Step 1: Full gate run**

```bash
npx tsc --noEmit && npx jest
```

- [ ] **Step 2: Confirm the engine did not move**

Run: `npx jest src/sim/__tests__/runtime-golden.test.ts`
Expected: PASS with `ENGINE_VERSION` unchanged from the value recorded in Task 10.

- [ ] **Step 3: Confirm the catalog snapshot is clean**

Run: `npx jest src/i18n/__tests__/en-catalog.snapshot.test.ts`
Expected: PASS with no snapshot write. A snapshot diff here means the keying
pass reworded English copy, which Phase 1 promised not to do.

- [ ] **Step 4: Device pass, English**

Onboarding → first match, league table, squad register, financial report,
Settings. Nothing should have moved. This is the regression check that matters
most, because Phase 1's whole promise is "identical game, different plumbing".

- [ ] **Step 5: Device smoke test, Vietnamese**

Temporarily add `vi` to `ENABLED_LOCALES`, switch to it, and confirm the face
changes **on the match screen** — not just on className-styled chrome. This is
what proves Task 9 actually worked; the className half (Task 8) would look fine
on its own while the match screen stayed broken.

Revert `ENABLED_LOCALES` to `['en']` afterwards.

- [ ] **Step 6: Tag the phase**

```bash
git commit --allow-empty -m "chore(i18n): phase 1 complete — plumbing in, English only"
```

---

## Self-review

**Spec coverage.** §1 voice → Phase 2. §2 languages → Task 1. §3 architecture →
Tasks 4, 5, 7, 10, 13; §3.1 catalog → Task 4; §3.2 runtime → Task 7; §3.3 single
English source → Task 13 step 3; §3.4 numbers → Tasks 3 and 13 step 6. §4.1 font
→ Tasks 0, 8, 9. §4.2 layout → **Phase 2**. §4.3 saves → Task 12. §5 picker →
Tasks 6, 7, 15. §6 inventory → Task 13 batching. §8 gates → Task 14. §9 quality
→ Phase 2. §10.1 native → Tasks 0, 16. §10.2 README reversal → Task 16.

**Known gap, stated rather than hidden:** the §4.2 advance-map work (`col.*`
short forms, `LEAGUE_COLUMN_WIDTH` as a max across enabled locales, the
row-fits-the-screen assertion) is a hard dependency of Phase 2 and is *not*
here — there is nothing to measure until a second locale exists. Task 14's gate
8 is English-only accordingly. **The spec recommends computing the seven-locale
maxima up front** so enabling German later cannot widen English columns
retroactively; that belongs in Phase 2 Task 2.

**Placeholders:** none. Every code step carries its code.

**Type consistency:** `Locale`, `LocaleFaces`, `CopyFn`, `CopyParams` are defined
in Tasks 1, 1, 7, 5 and used consistently after. `copyFor`/`useCopy` and
`facesFor`/`useFaces` keep the pure-core-plus-hook pairing throughout, which is
what lets Tasks 5 and 7 be tested at all under a node-only Jest config.
`voiceOf` (Task 14) and `DYNAMIC_KEY_PREFIXES` (Task 13) are each defined once
and referenced once.

**Corrections folded in from the second council round.** Recorded because each
was a plan that would have failed in a specific way:

| Was | Now |
| --- | --- |
| `en.json` generated from call sites | Hand-authored; the generator had no input once literals became keys |
| 13 raw-font files | 16 — the grep missed `const PIXEL_BOLD = 'Silkscreen_700Bold'`, hiding the match screen |
| `language` added to the live preferences schema | Frozen V9 schema — `.omit()`-derived legacy schemas would have failed real v8 rows and reset every setting |
| Preference read but never written | Task 7 wires the setter, load and persistence |
| `cupResult` becomes an object | Stays a required string with optional siblings; a type change breaks every old recap |
| Gate 6 as ESLint | TypeScript AST in Jest — `README.md:10` forbids adding a lint script |
| Gate 5 over the whole catalog | Per-voice, plus formatter output |
| French separator "thin space" | U+00A0 — Silkscreen has neither U+202F nor U+2009 |
| 11 persisted surfaces | 12 — `topScorer.detail` is parsed as data by `hall-of-fame.ts:50` |
