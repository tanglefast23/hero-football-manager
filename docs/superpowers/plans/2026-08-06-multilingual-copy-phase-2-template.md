# Multilingual Copy — Per-Language Translation Plan (template)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan for one locale at a time. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Take one locale from empty catalog to shipped, with every string audited at least once.

**Architecture:** Translate against the English catalog (hand-authored chrome in `en.json` plus content prose read by id from `content/*.json`), enforce voice and terminology mechanically, audit every string with an independent reviewer whose accuracy is itself measured, then enable the locale.

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

**Order matters: author the glossary now, but the CI assertion lands with Task 3.**
Running the gate before any translation exists makes it iterate over an empty
`strings` map — a vacuous pass that looks like coverage and proves nothing. Write
the glossary here; enable the test once the first batch is translated.

- [ ] **Step 1: Author the glossary**

Each entry declares its **allowed surface forms including inflections**, plus the
English pattern that identifies which source strings the rule applies to. Both
fields are required — an earlier draft's test read `entry.englishPattern` while
the JSON only carried `english`, which would not have run at all:

```json
{
  "schemaVersion": 1,
  "locale": "es",
  "terms": [
    {
      "english": "Hero License",
      "englishPattern": "Hero Licen[cs]e",
      "allowedForms": ["Licencia de Héroe", "Licencias de Héroe"],
      "why": "Keeps 'Héroe' capitalised so it reads as the game's noun, not a description."
    },
    {
      "english": "the Zone",
      "englishPattern": "\\bthe Zone\\b",
      "allowedForms": ["la Zona"],
      "why": "Short, and 'entrar en la Zona' is how a commentator would say it."
    }
  ]
}
```

- [ ] **Step 2: Write the gate (enable after Task 3's first batch)**

```ts
test('<locale> renders every coined term in an approved form', () => {
  const glossary = loadGlossary('<locale>');
  const en = loadCatalog('en').strings;
  const strings = loadCatalog('<locale>').strings;

  // Guard against the vacuous pass: this test is meaningless on an empty catalog.
  expect(Object.keys(strings).length).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (const entry of glossary.terms) {
    const pattern = new RegExp(entry.englishPattern);
    for (const [key, value] of Object.entries(strings)) {
      if (!pattern.test(en[key] ?? '')) continue;
      if (!entry.allowedForms.some(form => value.includes(form))) {
        offenders.push(`${key}: "${value}" (expected one of ${entry.allowedForms.join(' / ')})`);
      }
    }
  }
  expect(offenders).toEqual([]);
});
```

`includes` on a declared surface form is deliberate and safe **because the scope
is coined terms only**. It would be wrong for ordinary football vocabulary,
where German compounding and Spanish inflection defeat substring matching —
which is exactly why those stay advisory (above) rather than asserted.

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

- [ ] **Step 3: Compute the SEVEN-locale maxima now, not per locale**

`LEAGUE_COLUMN_WIDTH` stops meaning "wide enough for English" and starts meaning
"wide enough for the widest locale."

**Compute it across all seven at once, on this first run**, even though only
Spanish is enabled. If each locale widens the shared constants as it lands,
enabling German in Phase 4 silently changes the *English* game's layout — a
regression that arrives months after the change that caused it, in a language
nobody was testing. Doing it once up front costs one measurement pass and makes
English layout stable for the rest of the project.

- [ ] **Step 4: Write the gate — columns AND the row**

Per-column fitting is necessary but not sufficient. Because the widths are
maxima, the fixed columns can collectively crowd out the flexible one:
`squad-register-columns.ts:96` explicitly relies on the club/player column paying
for every fixed-width increase, and the league table already has seven
non-shrinking columns (`LeagueTableScreen.tsx:40`).

```ts
test('gate 8a — every col.* string fits its column in every locale', () => {
  for (const locale of LOCALES) {
    for (const [key, width] of Object.entries(LEAGUE_COLUMN_WIDTH)) {
      const label = loadCatalog(locale).strings[`col.league.${key}`];
      expect({ locale, key }).toMatchObject({ locale });
      expect(leagueHeaderWidthDemand(label, locale)).toBeLessThanOrEqual(width);
    }
  }
});

test('gate 8b — the whole row still fits the narrowest supported screen', () => {
  for (const layout of ['phone', 'wide'] as const) {
    const fixed = Object.values(LEAGUE_COLUMN_WIDTH).reduce((a, b) => a + b, 0);
    const demand = fixed
      + LEAGUE_ROW_PADDING
      + COLUMN_MIN_GUTTER * (Object.keys(LEAGUE_COLUMN_WIDTH).length - 1)
      + MIN_CLUB_NAME_WIDTH;
    expect({ layout, demand }).toMatchObject({ layout });
    expect(demand).toBeLessThanOrEqual(CONTENT_WIDTH[layout]);
  }
});
```

Gate 8a alone goes green while the row overflows and the club name is crushed to
nothing — which is the failure a player actually sees.

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
indistinguishable from real work, at roughly **5% of batch size**.

**Full canary coverage is mandatory for Spanish and sampled thereafter.** The
first locale is where the reviewer's miss rate is unknown and worth measuring
properly. Once Spanish has produced a number, later locales run canaries on a
sample of batches — enough to detect a reviewer regression, not enough to double
the cost of every language. If Spanish's miss rate is bad, that is a finding
about the whole approach and it surfaces before five more languages pay for it.

Each canary breaks one thing a reviewer is supposed to catch:

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

Verdicts land in `content/i18n/review/<locale>.json` with a one-line reason and a
hash of **everything the verdict depended on** — the key, the English source, the
translated string itself, the glossary version, and the screen context.

Hashing only the English leaves a hole: a translation could be edited after
approval and keep its `ok`, because the English never moved. Including the target
string closes it; including the glossary version re-opens strings when
terminology changes rather than grandfathering them.

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
      return entry?.verdict !== 'ok' || entry.hash !== reviewHash(locale, key);
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
