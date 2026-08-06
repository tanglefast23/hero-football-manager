Audit these two implementation plans for a React Native / Expo pixel-art football management sim.

Context you need (do NOT use tools, everything is below):
- Hermes runtime. NativeWind v4 / react-native-css-interop 0.2.6. Zustand 5. zod 4. expo-sqlite.
- Jest: testEnvironment 'node', roots ['<rootDir>/src'], NO jsdom, require('react-native') THROWS. Tests can fs.readFileSync anything.
- src/sim and src/game are pure TS, seeded PRNG, must stay byte-deterministic. A golden-replay snapshot guards this; any replay-affecting change must bump ENGINE_VERSION in src/sim/match.ts.
- Content is typed JSON in content/, zod-validated, loaded via static imports in src/content/load.ts.
- ~3000 translatable strings across 247 files including a 2944-line App.tsx.
- 7 locales: en (source) + es, pt-BR, fr, de, id, vi.
- Silkscreen (the pixel font) has 226 glyphs, Latin-1 only. Vietnamese needs a second face (Handjet, which ships 400+700 cuts).

OUTPUT FORMAT, obey exactly: no preamble; at most SEVEN findings hardest-first; each is one bold title line then AT MOST 90 words; skip minor nits; final line alone is APPROVED or REVISE.

Judge on: will an engineer following these plans literally succeed? What breaks? What is missing? What is over-engineered and should be CUT? Are the TDD steps real tests or decorative? Is anything in the plans actually impossible in this Jest/Hermes setup?

===== PLAN 1: PHASE 1 =====
# Multilingual Copy — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the localisation plumbing and ship it with English only — every player-facing string flows through a key lookup, the language picker works, and the game looks and behaves exactly as it does today.

**Architecture:** Copy moves to zod-validated JSON catalogs under `content/i18n/`, resolved at the UI edge by a `useCopy()` hook backed by a Zustand slice. The pure rings (`src/sim/`, `src/game/`) and the application layer emit `labelKey` + `labelParams` instead of English sentences. Fonts swap per locale through NativeWind CSS custom properties for className sites and a `useFaces()` hook for the 13 files that set `fontFamily` as a raw literal.

**Tech Stack:** TypeScript, zod 4, Zustand 5, NativeWind 4 / react-native-css-interop 0.2.6, expo-font, expo-sqlite, Jest (testEnvironment `node`, roots `src` only), ESLint.

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
- [ ] `content/i18n/en.json` regenerates with no diff
- [ ] English catalog snapshot test passing
- [ ] ESLint no-hardcoded-prose gate reports zero violations outside exempt paths
- [ ] Device pass: onboarding → first match, league table, squad register,
      financial report, Settings — nothing moved
- [ ] Device smoke test: switching to Vietnamese changes the face **on the match
      screen**, not just on className-styled chrome

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
| `content/i18n/en.json` | **Generated.** English catalog |
| `content/i18n/es.json` … `vi.json` | Hand-authored translations (empty in Phase 1) |
| `scripts/i18n/generate-en-catalog.mjs` | Builds `en.json` from content JSON + keyed call sites |
| `scripts/i18n/measure-advances.mjs` | Reads a TTF `hmtx` and emits per-string advances |
| `eslint-rules/no-hardcoded-prose.js` | The gate that keeps English out of TSX |

**Modified files**

| File | Change |
| --- | --- |
| `tailwind.config.js:41-46` | `pixel`/`mono` families point at CSS vars |
| `App.tsx` | `vars()` wrapper at root; load Handjet cuts; picker wiring |
| `src/persistence/preferences-repository.ts` | `language` field, schema v10, migration rung |
| `src/persistence/game-state-codec.ts` | `labelKey`/`labelParams` on the 11 persisted surfaces |
| `src/ui/screens/CharacterCreationScreen.tsx` | Language panel |
| `src/ui/SettingsOverlay.tsx` | Language control |
| `src/sim/tactics.ts:46-50` | Formation blurbs → ids |
| 13 raw-`fontFamily` files (§4.1 of the spec) | `useFaces()` instead of module-scope literals |
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
  en: { endonym: 'English', pluralRule: 'oneOther', groupSeparator: ',', faces: SILKSCREEN },
  es: { endonym: 'Español', pluralRule: 'oneOther', groupSeparator: '.', faces: SILKSCREEN },
  'pt-BR': { endonym: 'Português (Brasil)', pluralRule: 'zeroIsOne', groupSeparator: '.', faces: SILKSCREEN },
  fr: { endonym: 'Français', pluralRule: 'zeroIsOne', groupSeparator: ' ', faces: SILKSCREEN },
  de: { endonym: 'Deutsch', pluralRule: 'oneOther', groupSeparator: '.', faces: SILKSCREEN },
  id: { endonym: 'Bahasa Indonesia', pluralRule: 'none', groupSeparator: '.', faces: SILKSCREEN },
  vi: { endonym: 'Tiếng Việt', pluralRule: 'none', groupSeparator: '.', faces: HANDJET },
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
  const db = await openTestDatabase();
  await seedPreferencesRow(db, 9, { ...rowWithoutLanguage });

  const loaded = await createPreferencesRepository(db).load();

  expect(loaded.language).toBe('en');
  const row = await db.getFirstAsync<{ schema_version: number }>(
    'SELECT schema_version FROM preferences WHERE slot = 1',
  );
  expect(row?.schema_version).toBe(10);
});

test('an unknown language tag is rejected rather than silently kept', () => {
  expect(() => PreferencesSchema.parse({ ...validPreferences, language: 'pt' })).toThrow();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/persistence/__tests__/preferences-repository.test.ts`
Expected: FAIL — `language` is undefined

- [ ] **Step 3: Implement**

At `preferences-repository.ts:13`, bump the head and add the new rung. **Name
the rung after the feature that version already had, not the one being added** —
that is the existing convention (`CLIMB_COMPLETED_..._VERSION = 8` parses rows
that *have* `climbCompleted`):

```ts
const PREFERENCES_SCHEMA_VERSION = 10;
// ... existing constants 1-8 unchanged ...
const DEVELOPER_MODE_PREFERENCES_SCHEMA_VERSION = 9;
```

Add to `AppPreferences`:

```ts
  /** Device-wide UI language. One player, one language, across every career. */
  language: Locale;
```

Add to `DEFAULT_APP_PREFERENCES`:

```ts
  language: 'en',
```

Add to `PreferencesSchema` — required, because the schema is a `strictObject`
and a missing declaration fails the whole row:

```ts
  language: z.enum(LOCALES),
```

Add the migration rung beside the existing eight:

```ts
if (row.schema_version === DEVELOPER_MODE_PREFERENCES_SCHEMA_VERSION) {
  return persistMigrated(
    { ...parsedRow, language: DEFAULT_APP_PREFERENCES.language },
    PREFERENCES_SCHEMA_VERSION,
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/persistence/__tests__/preferences-repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/persistence/preferences-repository.ts src/persistence/__tests__/preferences-repository.test.ts
git commit -m "feat(i18n): persist the language preference, schema v10"
```

---

## Task 7: Zustand slice, useCopy, useFaces

**Files:**
- Create: `src/i18n/use-copy.ts`, `src/i18n/use-faces.ts`, `src/i18n/index.ts`
- Modify: `src/application/store.ts`
- Test: `src/i18n/__tests__/use-copy.test.ts`

- [ ] **Step 1: Write the failing test**

The hooks cannot be rendered here — `require('react-native')` throws under this
Jest config — so test the pure selector the hooks wrap:

```ts
import { copyFor, facesFor } from '../use-copy';

describe('copyFor', () => {
  test('returns a bound t() for the active locale', () => {
    const t = copyFor('en');
    expect(t('settings.language.title')).toBe('Language');
  });

  test('an unenabled locale still resolves through English', () => {
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
import { useStore } from '../application/store';
import { loadCatalog } from './load-catalogs';
import { localeMeta, type Locale, type LocaleFaces } from './locales';
import { resolveCopy, type CopyParams } from './resolve';

export type CopyFn = (key: string, params?: CopyParams) => string;

/**
 * Pure, and exported for tests: the hooks below are thin wrappers, and this
 * Jest config cannot render a component (testEnvironment is node and
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

export function useCopy(): CopyFn {
  return copyFor(useStore(state => state.preferences.language));
}

export function useFaces(): LocaleFaces {
  return facesFor(useStore(state => state.preferences.language));
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/i18n/__tests__/use-copy.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/i18n/ && git commit -m "feat(i18n): useCopy and useFaces hooks over a pure core"
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

## Task 9: Font swap — the 13 files `vars()` cannot reach

**Files (all 13, one commit each is fine):**
```
src/render/CupTitleCard.tsx            src/ui/components/CupBracket.tsx
src/render/DrillSceneOverlay.tsx       src/ui/components/DrillGainReveal.tsx
src/render/FirstMatchCoachingModal.tsx src/ui/components/EventRewardArt.tsx
src/render/match-screen-styles.ts      src/ui/components/TitlePlayerPopScene.tsx
src/ui/PowerAcquiredDemoModal.tsx      src/ui/screens/AwakeningCutsceneScreen.tsx
src/ui/TrainingDrillModal.tsx          src/ui/screens/AwakeningArtQaScreen.tsx
                                       src/ui/screens/PowerArtQaScreen.tsx
```
- Test: `src/i18n/__tests__/no-literal-faces.test.ts`

**Why this task exists:** 70 raw `fontFamily: 'Silkscreen_*'` literals across 23
files bypass NativeWind entirely — they are module-scope constants fed into
`StyleSheet.create`, evaluated once at import, so no runtime rebinding reaches
them. Ten of the 23 are `src/ui/dev-harness/` and stay English by policy. The 13
above are player-facing and include the match screen, the power takeovers and
the awakening cutscene. Skipping this task ships Vietnamese with broken type in
the game's biggest moments.

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
  const offenders = walk('src')
    .filter(f => !EXEMPT.test(f))
    .filter(f => /fontFamily:\s*'(Silkscreen|Handjet|VT323)/.test(fs.readFileSync(f, 'utf8')));

  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail with exactly 13 files**

Run: `npx jest src/i18n/__tests__/no-literal-faces.test.ts`
Expected: FAIL listing the 13 files above. If the list differs, reconcile before
continuing — the set has drifted since the spec was written.

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

`src/sim/tactics.ts:46-50` holds the only user-facing English in the sim ring:

```ts
'4-4-2': 'Balanced lines',
'4-3-3': 'Wide attack',
'3-5-2': 'Midfield shield',
'5-3-2': 'Deep counter',
'4-5-1': 'Crowd midfield',
```

Delete that map from `tactics.ts`. The ring keeps only `FormationId`. Add the
five strings to `content/i18n/en.json` as `formation.4-4-2.blurb` and siblings,
and resolve them at the UI call sites with `t()`.

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

```ts
test('every event outcome carries a unique id', () => {
  const events = loadLaunchContent().events.events;
  for (const event of events) {
    const ids = event.outcomes.map(o => o.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/content/__tests__/content.test.ts -t "outcome carries a unique id"`
Expected: FAIL — `id` undefined

- [ ] **Step 3: Add ids to the schema and the data**

In `src/content/schemas.ts`, add `id: idSchema` to the outcome object. Then add
a stable id to every outcome in `content/events.json`, derived from the event id
and the outcome's role — `derby-night.success`, `derby-night.setback` — not from
its index, because an index-derived id would reintroduce the exact fragility
this task removes.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest src/content/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content/events.json src/content/schemas.ts src/content/__tests__/content.test.ts
git commit -m "feat(i18n): give every event outcome a stable id"
```

---

## Task 12: Persisted-English keys (the 11 surfaces)

**Files:**
- Modify: `src/persistence/game-state-codec.ts` (lines per the table below)
- Modify: `src/game/career.ts`, `src/game/player-requests.ts`, `src/game/cup-giant-killing.ts`, `src/game/season-recap.ts`, `src/game/career-events.ts`
- Test: `src/persistence/__tests__/game-state-codec.test.ts`

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

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/persistence/__tests__/game-state-codec.test.ts`
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

- [ ] **Step 5: Run the full suite**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, golden replay unchanged

- [ ] **Step 6: Commit**

```bash
git add src/persistence/ src/game/
git commit -m "feat(i18n): dual-write labelKey alongside English on all 11 persisted surfaces"
```

---

## Task 13: The extraction

**Files:**
- Create: `scripts/i18n/generate-en-catalog.mjs`
- Modify: every player-facing file, in batches
- Test: `src/i18n/__tests__/en-catalog.snapshot.test.ts`

This is the bulk of Phase 1 — roughly 3,000 candidate strings across 247 files.
Work **one screen at a time**, committing per screen, so a partial extraction is
always a working game.

- [ ] **Step 1: Write the snapshot guard first**

```ts
test('the English catalog matches its snapshot', () => {
  expect(loadCatalog('en').strings).toMatchSnapshot();
});
```

This is what stops a keying pass from silently rewording copy. Every diff to the
snapshot must be a deliberate copy change, reviewed as one.

- [ ] **Step 2: Order the batches by risk, lowest first**

1. `src/ui/SettingsOverlay.tsx`, `PrivacySupportPanel`, `GlossaryPanel` — 47 strings
2. `CharacterCreationScreen`, `NewGameWelcome`, `TitleLanding` — 101 strings
3. The weekly loop — 905 strings across 20 files
4. Match and render ring — 358 strings across 59 files
5. Season and ceremony — 285 strings across 38 files
6. `App.tsx` and the overlays — the 1,966 "unclassified" strings

- [ ] **Step 3: For each batch, the same four moves**

Replace the literal with a `t()` call; add the key to `content/i18n/en.json`;
run `npx jest && npx tsc --noEmit`; commit.

- [ ] **Step 4: Split player-facing copy out of `App.tsx` as you go**

`App.tsx` is 2,944 lines and holds the largest share of the unclassified
strings. Extracting its copy is the natural moment to move screen-specific
markup into the screen files it belongs to. Do not treat this as a separate
refactor — but do not let it balloon either.

- [ ] **Step 5: Commit per batch**

```bash
git add -A && git commit -m "refactor(i18n): key the <batch> copy"
```

---

## Task 14: The CI gates

**Files:**
- Create: `src/i18n/__tests__/gates.test.ts`, `eslint-rules/no-hardcoded-prose.js`

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
        const ceiling = Math.ceil((en[key]?.length ?? 0) * EXPANSION[locale]) + 2;
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

- [ ] **Step 2: Gate 2 as a warning until the dynamic-key registry exists**

Keys like `event.<id>.body` are built at the call site, so a static reference
graph cannot see them. The gate is legal-if-statically-referenced **or**
matching a declared dynamic prefix whose ids come from `content/*.json`. Until
that registry exists, log and do not fail.

- [ ] **Step 3: Gate 6 as ESLint, not Jest**

It needs TSX AST access the node Jest suite cannot provide. Scope:
`src/ui/`, **`src/render/`**, `src/application/`, `App.tsx`. Exempt
`src/ui/dev-harness/`, `src/audit/`, developer-mode strings.

It must cover **`accessibilityLabel` and `accessibilityHint` props** — there are
343 of them outside tests and the harness, they are props rather than JSX text
nodes, and a naive rule is structurally blind to them. Left out, VoiceOver reads
English to players in six languages.

- [ ] **Step 4: Run everything**

Run: `npx jest && npx eslint . && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/ eslint-rules/ .eslintrc*
git commit -m "feat(i18n): CI gates for key parity, budget, placeholders, glyphs and hardcoded prose"
```

---

## Task 15: The language picker

**Files:**
- Modify: `src/ui/screens/CharacterCreationScreen.tsx:137`, `src/ui/SettingsOverlay.tsx`
- Create: `src/ui/components/LanguagePanel.tsx`
- Test: `src/ui/__tests__/language-panel.test.ts`

- [ ] **Step 1: Write the failing test for the pure view-model**

```ts
test('lists every locale by its own endonym, active one first-marked', () => {
  const rows = languagePanelRows('en');
  expect(rows.map(r => r.endonym)).toEqual([
    'English', 'Español', 'Português (Brasil)', 'Français', 'Deutsch',
    'Bahasa Indonesia', 'Tiếng Việt',
  ]);
  expect(rows.find(r => r.selected)?.locale).toBe('en');
});

test('the Vietnamese row carries its own face in every locale', () => {
  for (const active of LOCALES) {
    const vi = languagePanelRows(active).find(r => r.locale === 'vi')!;
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
npx tsc --noEmit && npx jest && npx eslint .
```

- [ ] **Step 2: Confirm the engine did not move**

Run: `npx jest src/sim/__tests__/runtime-golden.test.ts`
Expected: PASS with `ENGINE_VERSION` unchanged from the value recorded in Task 10.

- [ ] **Step 3: Confirm the English catalog regenerates clean**

```bash
node scripts/i18n/generate-en-catalog.mjs && git diff --exit-code content/i18n/en.json
```

Expected: no diff.

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

**Spec coverage.** §1 voice rules → Phase 2 template, not this plan. §2 language
set → Task 1. §3 architecture → Tasks 4, 5, 7, 10, 13; §3.1 catalog → Task 4;
§3.2 runtime → Task 7; §3.3 single English source → Task 13; §3.4 numbers →
Task 3. §4.1 font → Tasks 0, 8, 9. §4.2 layout → **Phase 2**, correctly, since
short forms only matter once a second locale exists. §4.3 saves → Task 12. §5
picker → Tasks 6, 15. §6 inventory → informs Task 13's batching. §7 phasing →
scope note. §8 gates → Task 14. §9 quality → Phase 2 template. §10.1 native →
Tasks 0, 16.

**Known gap, stated rather than hidden:** the §4.2 advance-map work
(`col.*` short forms, re-measuring `LEAGUE_COLUMN_WIDTH` as a max across enabled
locales) is a hard dependency of Phase 2 and is *not* in this plan. It belongs
with the first real translation, because there is nothing to measure until a
second locale exists. Task 14's gate 8 is stubbed to English-only accordingly.

**Placeholders:** none. Every code step carries its code.

**Type consistency:** `Locale`, `LocaleFaces`, `CopyFn`, `CopyParams` are
defined in Tasks 1, 1, 7, 5 and used consistently after. `facesFor`/`useFaces`
and `copyFor`/`useCopy` keep the pure-core-plus-hook pairing throughout, which
is what lets Tasks 5 and 7 be tested at all under a node-only Jest config.


===== PLAN 2: PHASE 2 TEMPLATE =====
# Multilingual Copy — Per-Language Translation Plan (template)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan for one locale at a time. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Take one locale from empty catalog to shipped, with every string audited at least once.

**Architecture:** Translate against the generated English catalog, enforce voice and terminology mechanically, audit every string with an independent reviewer whose accuracy is itself measured, then enable the locale.

**Tech Stack:** As Phase 1, plus the review tooling in `scripts/i18n/`.

**Prerequisite:** Phase 1 exit criteria all green. Do not start otherwise.

**Spec:** [`docs/superpowers/specs/2026-08-06-multilingual-copy-design.md`](../specs/2026-08-06-multilingual-copy-design.md) §1, §4.2, §9

---

## How to use this document

This is a **template**, run once per locale in the order Spanish → Vietnamese →
Portuguese → French → German → Indonesian. Substitute `<locale>` throughout.

The **first run is Spanish and it is the cost probe.** After it completes, stop
and compare actual words, actual review cost and actual layout breakage against
the spec's §6 estimate. If Spanish costs materially more than a sixth of the
budget, the scope conversation happens there — not after five more languages are
half done.

**Vietnamese runs second, not last,** because it is the one that can fail on
font grounds and failing early is cheaper.

---

## Task 1: Lock the terminology (before translating anything)

**Files:**
- Create: `content/i18n/glossary/<locale>.json`
- Test: `src/i18n/__tests__/glossary.test.ts`

**Scope: coined terms only, roughly 20 entries.** Heat, the Zone, Hero License,
Awakening, Training Points, Fan Shop, Buzz, Superpower, Hero, Licence cap.

Ordinary football vocabulary (goalkeeper, clean sheet, matchday) is recorded as
**advisory** guidance for the translator and is *not* asserted in CI. A
substring check on those fails constantly on German compounding
(`Innenverteidiger` inside `Innenverteidigerposition`) and Spanish inflection
(`portero`/`porteros`), and a gate that cries wolf gets switched off.

- [ ] **Step 1: Write the failing test**

```ts
test('<locale> renders every coined term in an approved form', () => {
  const glossary = loadGlossary('<locale>');
  const strings = loadCatalog('<locale>').strings;

  for (const entry of glossary.terms) {
    for (const [key, value] of Object.entries(strings)) {
      if (!entry.englishPattern.test(loadCatalog('en').strings[key] ?? '')) continue;
      const usesApproved = entry.allowedForms.some(form => value.includes(form));
      expect({ key, term: entry.english, value }).toMatchObject({ key });
      expect(usesApproved).toBe(true);
    }
  }
});
```

- [ ] **Step 2: Author the glossary**

Each entry declares its **allowed surface forms including inflections**, which
is what makes the check unambiguous:

```json
{
  "schemaVersion": 1,
  "locale": "es",
  "terms": [
    {
      "english": "Hero License",
      "allowedForms": ["Licencia de Héroe", "Licencias de Héroe"],
      "why": "Keeps 'Héroe' capitalised so it reads as the game's noun, not a description."
    },
    {
      "english": "the Zone",
      "allowedForms": ["la Zona"],
      "why": "Short, and 'entrar en la Zona' is how a commentator would say it."
    }
  ]
}
```

- [ ] **Step 3: Run and commit**

Run: `npx jest src/i18n/__tests__/glossary.test.ts`

```bash
git add content/i18n/glossary/<locale>.json src/i18n/__tests__/glossary.test.ts
git commit -m "feat(i18n): lock <locale> coined terminology"
```

---

## Task 2: Layout tokens and advance measurement

**Files:**
- Modify: `content/i18n/<locale>.json` (`col.*` namespace), `src/ui/league-table-columns.ts`, `src/ui/squad-register-columns.ts`
- Create: `scripts/i18n/measure-advances.mjs`

**This is a hard blocker.** No non-English table or register header ships before
it is done. The measured-advance functions throw on unmeasured strings in Jest,
and at runtime the UI lays out against static widths sized to English.

- [ ] **Step 1: Declare the short forms**

Table and register headers are 1–3 characters in every language and live under
`col.*`, exempt from the §1 character budget because they are layout tokens
wearing words:

```json
"col.league.points": "PKT",
"col.league.goalDifference": "TD",
"col.league.played": "SP"
```

- [ ] **Step 2: Measure them**

`scripts/i18n/measure-advances.mjs` reads the locale's face TTF (`hmtx` +
`cmap`) and emits em advances per string, the same technique that produced the
existing values. Silkscreen for the five Latin locales, **Handjet for `vi`** —
Handjet is not monospace, so `vi` needs a full per-string table, not one
constant.

- [ ] **Step 3: Widen the shared column constants**

`LEAGUE_COLUMN_WIDTH` stops meaning "wide enough for English" and starts meaning
**"wide enough for the widest enabled locale."** This changes shared layout, so
English columns may get wider too. That is correct and intended — one layout,
seven fills.

- [ ] **Step 4: Write the gate**

```ts
test('gate 8 — every col.* string fits its column in every enabled locale', () => {
  for (const locale of ENABLED_LOCALES) {
    for (const [key, width] of Object.entries(LEAGUE_COLUMN_WIDTH)) {
      const label = loadCatalog(locale).strings[`col.league.${key}`];
      expect(leagueHeaderWidthDemand(label, locale)).toBeLessThanOrEqual(width);
    }
  }
});
```

- [ ] **Step 5: Run and commit**

Run: `npx jest src/ui/__tests__/league-table-columns.test.ts src/ui/__tests__/squad-register-columns.test.ts`

```bash
git add -A && git commit -m "feat(i18n): <locale> column short forms and measured advances"
```

---

## Task 3: Translate, screen by screen

**Files:**
- Modify: `content/i18n/<locale>.json`

Work in the same batch order Phase 1 used, committing per batch, so a partial
translation is always coherent.

**The first-session narrative is in this phase, not the long tail.** A stopping
point has to be playable in the order a player meets the game, so
`onboarding.json`, the early-season entries in `events.json` and Bert's
critical-path lines in `assistant-guide.json` translate here — not in Phase 5.
Chrome and narrative move together.

- [ ] **Step 1: Apply the voice rules from spec §1**

| Locale | Address | Notes |
| --- | --- | --- |
| `es` | `tú` | Neutral Latin-American. No `vosotros`, no `usted` |
| `pt-BR` | `você` | Brazilian. Never `tu`. Contract freely (`tá`, `pra`) |
| `fr` | `tu` | `on` for "we" |
| `de` | `du` | Never `Sie`. Break compounds |
| `id` | `kamu` | Colloquial. Never `Anda` |
| `vi` | neutral | No `quý khách`, no `xin vui lòng` |

Casual, not written. Short over clever. Where a faithful translation busts the
character budget, **rewrite shorter in the target language** — never translate
literally and let it sprawl.

- [ ] **Step 2: Run the structural gates after every batch**

```bash
npx jest src/i18n/__tests__/gates.test.ts
```

Gates 1, 3, 4 and 5 catch missing keys, budget overruns, dropped placeholders
and glyphs the face does not have — before any human looks at the copy.

- [ ] **Step 3: Commit per batch**

```bash
git add content/i18n/<locale>.json && git commit -m "feat(i18n): translate <batch> to <locale>"
```

---

## Task 4: Audit every string, with the reviewer's accuracy measured

**Files:**
- Create: `content/i18n/review/<locale>.json`
- Create: `scripts/i18n/seed-canaries.mjs`, `scripts/i18n/check-review-coverage.mjs`

This is the answer to the obvious objection — that one model reviewing another
model's translation just produces a green tick. Coverage alone proves the review
*happened*, not that it *worked*. Canaries measure whether it worked.

- [ ] **Step 1: Seed canaries into each review batch**

`seed-canaries.mjs` injects deliberately broken strings, shuffled in and
indistinguishable from real work, at roughly **5% of batch size**. Each canary
breaks one thing a reviewer is supposed to catch:

| Canary kind | Example (es) |
| --- | --- |
| dropped negation | "El club puede permitirse este fichaje" for "The club cannot afford this signing" |
| off-glossary coined term | "Permiso de Héroe" instead of the locked "Licencia de Héroe" |
| register flip | `usted` where the voice rule says `tú` |
| dropped placeholder | "Fichado por" for "{club} signed {player} for {fee}" |
| literal calque | word-for-word English idiom no native speaker would say |

- [ ] **Step 2: Review**

An independent reviewer — **a different model from the one that authored the
translation** — sees the target string, the English source, the glossary, and
the screen the string appears on. It returns one verdict per string:

| Verdict | Meaning | Action |
| --- | --- | --- |
| `ok` | Ships as written | none |
| `stiff` | Correct but reads written, not spoken | rewrite, re-review |
| `wrong` | Meaning changed, off-glossary, placeholder misused | rewrite, re-review |
| `long` | Correct but will not fit its cell | shorten in-language, re-review |

Verdicts land in `content/i18n/review/<locale>.json` with a one-line reason and
the **hash of the English source reviewed**, so a later English copy change
staleness-marks exactly the affected strings rather than the whole language.

- [ ] **Step 3: Score the canaries and void bad batches**

```ts
test('a review batch caught enough of its canaries to be trusted', () => {
  for (const batch of loadReviewBatches('<locale>')) {
    const missed = batch.canaries.filter(c => batch.verdicts[c.key] === 'ok');
    expect(missed.length / batch.canaries.length).toBeLessThanOrEqual(0.2);
  }
});
```

**A batch missing more than 20% of its canaries is void:** its `ok` verdicts are
discarded and it is re-reviewed with a different reviewer or a sharper prompt.
The miss rate is recorded next to the verdicts and **reported** — if the number
is bad, the audit's own claim collapses honestly instead of quietly.

- [ ] **Step 4: Enforce coverage**

```ts
test('no enabled locale ships a string without an ok verdict', () => {
  for (const locale of ENABLED_LOCALES.filter(l => l !== 'en')) {
    const review = loadReview(locale);
    const stale = Object.entries(loadCatalog(locale).strings).filter(([key]) => {
      const entry = review[key];
      return entry?.verdict !== 'ok' || entry.englishHash !== hashEnglish(key);
    });
    expect(stale).toEqual([]);
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add content/i18n/review/<locale>.json scripts/i18n/
git commit -m "feat(i18n): <locale> per-string audit with canary-measured reviewer accuracy"
```

---

## Task 5: Back-translation on prose only

**Files:**
- Create: `scripts/i18n/back-translate.mjs`

A reviewer that sees **only** the translated string writes what it means in
English; the result is diffed against the source. This catches inversions and
swapped subjects that a fluent read misses — a confident sentence saying the
opposite of the source reads fine.

**Scope: `event.*`, `bert.*`, tips and ceremony lines.** Not the whole catalog.
Over ~15,000 strings it is expensive, it thrashes on short chrome where "Save"
back-translates a dozen defensible ways, and a model that mistranslated a string
will often back-translate its own error into something that diffs clean.

- [ ] **Step 1: Run it, produce a triage list**

Output is a list for the §9.2 loop, **not a build failure**. Short chrome is
covered by the per-string audit plus placeholder parity.

- [ ] **Step 2: Feed flagged strings back through Task 4**

---

## Task 6: In-context spot-check

Twenty strings per language, on **screenshots of the actual screens** — Bert's
lines, button labels, the post-match report, event prose.

Out of context, "Free" is a fine translation of "Free"; on the transfer screen
it means "available", and only the screenshot shows that. This catches what the
automated gates structurally cannot, and it is deliberately small enough to
actually happen for all six languages.

- [ ] **Step 1: Build the game with `<locale>` enabled locally**
- [ ] **Step 2: Capture the five length-sensitive screens plus a match**
- [ ] **Step 3: Review the copy on the screenshots, not in a list**
- [ ] **Step 4: Feed anything wrong back through Task 4**

---

## Task 7: Enable the locale

- [ ] **Step 1: Add `<locale>` to `ENABLED_LOCALES`**

Every quality gate now runs against it for real.

- [ ] **Step 2: Full gate run**

```bash
npx tsc --noEmit && npx jest && npx eslint .
```

- [ ] **Step 3: Device QA in `<locale>`**

Onboarding → first match, league table, squad register, financial report,
Settings — the five screens where length and glyph coverage bite.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales.ts
git commit -m "feat(i18n): enable <locale>"
```

- [ ] **Step 5: If this was Spanish, stop here and report**

Actual words translated, actual review cost, canary miss rate, layout breakages
found, wall-clock. Compare against the spec's §6 estimate and take the go/no-go
decision before starting Vietnamese.
