Audit this localisation design spec for a React Native / Expo pixel-art football management sim (Hermes, NativeWind v4, zustand, expo-sqlite, Jest testEnvironment=node with roots=['src'] and no jsdom, ~3000 translatable strings across 247 files incl. a 2944-line App.tsx, 7 languages: en base + es/pt-BR/fr/de/id/vi).

DO NOT use tools. Everything is below.

Already known, do NOT raise:
(a) preferences schema bumps 9 -> 10.
(b) fontFamily-through-CSS-var is verified working in react-native-css-interop 0.2.6.
(c) the measured-width tables throw on unmeasured strings; per-locale short forms + re-measurement are now hard Phase-2 dependencies.

OUTPUT FORMAT, obey exactly: no preamble; at most SIX findings hardest-first; each is one bold title line then AT MOST 80 words; skip minor nits; final line alone is APPROVED or REVISE.

Focus: what will actually break, what is missing, what is over-engineered and should be CUT, and whether the section 9 translation-quality audit is enforceable or theatre.


## 3. Where translation happens

**At the UI edge, never in the pure rings.**

`src/sim/` and `src/game/` stay pure TypeScript and stay deterministic. Today
some of them emit English sentences — `src/game/career.ts` builds ledger labels
like `'Fan Shop merchandise'`, and `src/application/view-models.ts` builds
`` `Season ${state.season}` ``. Those become **keys plus parameters**:

```ts
// before
{ label: 'Fan Shop merchandise', amount }
// after
{ labelKey: 'ledger.merch', labelParams: {}, amount }
```

The UI resolves the key. This is required by the architecture rule (no
locale-dependent behaviour in a ring that has to produce byte-identical results
from a seed), and it is what makes a saved career render in whatever language
the player later switches to.

### 3.1 Catalog format

One file per locale, `content/i18n/<locale>.json`, zod-validated at load like
every other content file:

```json
{
  "schemaVersion": 1,
  "locale": "de",
  "strings": {
    "creation.stat.pac.label": "TEMPO",
    "creation.stat.pac.detail": "Antritt und Rücklauf",
    "ledger.merch": "Fanshop",
    "market.bid.confirm": "{club} kauft {player} für {fee}"
  }
}
```

- Keys are dot-namespaced by screen or system: `creation.*`, `match.*`,
  `ledger.*`, `settings.*`, `bert.*`, `event.<id>.*`.
- Interpolation is `{name}` placeholders only. No nested markup, no HTML.
- Plurals use explicit sibling keys (`.one` / `.other`) resolved by an
  `Intl.PluralRules`-free hand-rolled selector — Hermes' `Intl` coverage varies
  by platform and the game must behave the same on both. The six target
  languages need only three rules: Germanic/Romance one-vs-other, French
  (0 and 1 both singular), and Indonesian/Vietnamese (no plural marking at all).

### 3.2 Runtime

A `useCopy()` hook backed by a Zustand slice, seeded from the persisted
`language` preference:

```ts
const t = useCopy();
t('creation.stat.pac.label');           // "TEMPO"
t('market.bid.confirm', { club, player, fee });
```

Missing key in a non-English catalog falls back to English rather than showing
the raw key. In development it also warns, and CI treats a missing key as a
failure (§8).

### 3.3 Content JSON

`content/*.json` carries ~1,440 prose strings — events, tips, glossary,
ceremony lines, coach reactions. These already have stable ids, so the
translation lives beside them keyed off that id (`event.derby-night.body`)
rather than duplicating the whole file per locale. `content/clubs.json` is
club and player **names** and is not translated.

---

## 4. The three hard constraints

### 4.1 Vietnamese does not render in the game's font

Measured from the shipped TTF: Silkscreen maps **226 glyphs**, Latin-1 plus a
handful of punctuation. Every Vietnamese letter with a stacked or below-base
diacritic is absent — `ế ộ ữ ạ ằ ọ đ ơ ư` and ~125 more. The combining marks
Vietnamese needs (`U+0323` dot below, `U+0309` hook above, `U+031B` horn) are
absent too, so even composed rendering fails.

iOS would silently substitute the system face **per glyph**, producing words
that switch typeface mid-syllable. Unacceptable.

**Chosen approach: a second pixel face for Vietnamese only.** Two Google Fonts
were verified to cover the full Vietnamese subset:

| Font | Glyphs | Also covers | Look |
| --- | --- | --- | --- |
| **VT323** | 568 | Turkish | Solid-stroke bitmap terminal, monospace |
| **Handjet** | 1322 | Turkish, Cyrillic, Greek | Dot-matrix, variable axes |

Recommendation: **VT323**, because its solid-block strokes sit closer to
Silkscreen than Handjet's dot-matrix rendering. Final call is a visual QA gate
during implementation — build one Vietnamese screen in each and look at it.
Handjet's Cyrillic and Greek coverage is worth noting as future headroom if
Russian or Greek is ever added.

**Swap mechanism.** `font-pixel` and `font-mono` are used directly at hundreds
of call sites, so the swap must not touch them. NativeWind v4 exports `vars()`,
so the two Tailwind families are redefined against CSS custom properties and a
single root-level `vars()` call rebinds them per locale:

```ts
<View style={vars({ '--font-display': displayFace, '--font-data': dataFace })}>
```

**This is verified, not hoped for.** Traced through
`react-native-css-interop@0.2.6`, which NativeWind v4 wraps:

- `font-family: var(--font-display)` reaches the compiler as an **unparsed**
  declaration, and `isValid()` accepts it because `"font-family"` is in
  `validProperties` (`css-to-rn/parseDeclaration.ts:174`).
- It routes to `parseUnparsed` (`:344`), whose `case "var"` (`:1683`) emits a
  runtime var descriptor rather than a literal.
- At render time `runtime/native/resolve-value.ts:85` resolves that descriptor
  against the variables `vars()` injected (`runtime/native/api.ts:116`).

So the whole change is one line of `tailwind.config.js`:

```js
fontFamily: { mono: ['var(--font-data)'], pixel: ['var(--font-display)'] },
```

plus one `vars()` wrapper at the app root. Every existing `font-pixel` and
`font-mono` class keeps working untouched, and the swap is live — no relaunch.

Worth being precise about one thing, because `PixelText.tsx` warns that mixing
`style` and `className` for one visual property "lets either win unpredictably
on native": this does **not** do that. `fontFamily` is still set only by the
className pipeline. The `vars()` call supplies the *value* the class resolves
against; it never sets `fontFamily` itself. The house rule holds.

The spike is therefore demoted from a gate to a **smoke test** in Phase 1 —
render one Vietnamese string on a device and confirm the face changed — since
source-tracing can be wrong in ways only a device shows.

Family-name aliasing (registering VT323 as `Silkscreen_700Bold`) is retained
only as a documented fallback. It costs a relaunch on language change and is
not needed unless the smoke test fails.

**Rejected: patching Silkscreen.** Silkscreen is OFL 1.1 with no reserved font
name, so modification is permitted, and it already composes accented letters
from components (`é` is a composite of `e` + acute). But its pixel grid is 125
units and its marks occupy rows 750–1000 — two full rows for a circumflex. A
stacked `ế` needs four rows and would break the em box. Fitting Vietnamese
means redrawing single-row marks by hand: a font-design subproject, not a
mechanical composition. Revisit only if the second face proves visually wrong.

### 4.2 Fixed-width layout will clip

`league-table-columns.ts` and `squad-register-columns.ts` compute column widths
from measured Silkscreen advances per exact string, and throw if asked about a
string they have not measured. `CharacterCreationScreen` puts stat labels in a
`w-28` cell and stepper values in `w-16`. Text also scales up to 1.6× with the
reader's iOS text size, and NativeWind's `rem` is 14pt so every `w-` class is
87.5% of its browser value.

**The failure mode is a crash, not a clip.** `leagueHeaderWidthDemand` and
`leagueCellWidthDemand` **throw** on any string absent from their advance maps
(`league-table-columns.ts:114`, `:123`, and the same pattern at
`squad-register-columns.ts:115`). A German `PKT` header that nobody measured
does not overflow — it redboxes. `squadRegisterHeaderWidthDemand` behaves the
same way.

**And the character budget is not a width check.** Silkscreen is proportional:
`W` is 1.0em and `P` is 0.75em (`LEAGUE_HEADER_ADVANCE_EM`). A German string can
sit comfortably under `len × 1.30 + 2` and still overrun its column, or sit over
the ceiling and fit fine. §1's budget enforces *succinctness*, which is a copy
goal; it is not, and must not be sold as, a layout guarantee. The earlier claim
that it was "the only thing standing between the translation and a clipped
league table" was wrong and is withdrawn.

So the mitigations are not a preference order. Items 1 and 2 are **hard
dependencies of Phase 2** — no non-English table header or squad-register
header ships before both are done:

1. **Per-locale short forms for every advance-mapped string, declared not
   translated.** Table and register headers stay 1–3 characters in every
   language (`PTS` → `PKT` in German, `PTS` in Spanish, `Đ` in Vietnamese).
   These live in the catalog under a `col.*` namespace that the copy budget
   does not apply to, because they are layout tokens wearing words.
2. **Extend the advance maps to cover every one of those strings, per face.**
   The measurement script that produced the existing em values gets rerun
   against Silkscreen for the five Latin locales and against the Vietnamese face
   for `vi`. VT323 is monospace, so `vi` collapses to a single advance constant
   rather than a per-string table.
3. A Jest gate asserting that every `col.*` string in every locale has a
   measured advance **and** fits its column — this is gate 8 in §8, and it is
   what turns "we remembered to measure it" into something CI can prove.
4. Beyond the measured tables, the soft-clipping cells (`w-28` stat labels,
   `w-16` stepper values, `numberOfLines={1}` headers): where a cell genuinely
   cannot hold a language, the layout changes for every language, not just that
   one — one layout, seven fills.

### 4.3 English is baked into save files

Four persisted surfaces carry English prose through the zod codec into SQLite:

| Surface | Schema | Fix |
| --- | --- | --- |
| Ledger line `label` | `.passthrough()` | Add sibling `labelKey` + `labelParams`; keep `label` as the legacy fallback |
| Cash transaction `label` | `.passthrough()` | Same |
| Season recap award `label`/`detail` | `.passthrough()` | Same |
| Sponsor objective snapshot `label`, `offerLine` | `strictObject` | Needs a codec schema bump |

Because three of the four already pass through unknown keys, new fields land
without a version bump; only the sponsor snapshot forces one. Rendering prefers
`labelKey` when present and falls back to the stored `label`, so a career saved
before this change keeps working and shows its historical rows in English while
everything new is localised. That is honest and it never loses data.

Cup round labels are already a `z.enum(['Play-in', 'Round of 32', …])` — a key
list wearing English clothes. They render through a lookup with no schema
change.

**Related pre-existing bug worth fixing here:** several `toLocaleString()` calls
are unpinned (`view-models.ts:560`, `event-selection.ts:189`, `store.ts` ×4)
and already vary by device locale — a German device shows `1.234` where an
American one shows `1,234`. All number formatting gets routed through one
helper that takes the game language, not the device locale.

Money stays `$`. The currency is fictional and the symbol is part of the game's
look; only grouping separators localise.

---

## 7. Phasing

Every phase ships something that works. Nothing is left half-English at a
stopping point.

**Phase 0 — spikes.** Confirm the `vars()` font swap works on iOS native.
Confirm VT323 renders Vietnamese legibly at the game's sizes. Both are
throwaway branches; both gate the plan.

**Phase 1 — plumbing, English only.** Catalog format, zod schema, `useCopy()`,
the `language` preference, the picker on both screens, the CI gates. The
English catalog is populated by extraction. At the end of this phase the game
looks identical and behaves identically, but every string flows through the
lookup. This is the phase that must not regress anything.

**Phase 2 — first language end-to-end (Spanish).** Proves the pipeline, the
character budget, and the layout fixes against a real translation before five
more are committed. Spanish because it is the highest-value and a middling
expansion factor — if Spanish fits, French and Portuguese will.

**Phase 3 — Vietnamese.** Second, not last, because it is the one that can fail
on font grounds. Failing early is cheaper.

**Phase 4 — Portuguese, French, German, Indonesian.** German last within this
group; it is the longest and will surface any remaining layout ceilings.

**Phase 5 — long tail.** Events, tips, glossary, ceremony lines, coach and
blame lines, Bert's full script. Largest word count, lowest per-string risk.

Within each translation phase, work goes screen by screen so a partial phase is
still coherent.

**Every translation phase is: lock the glossary (§8.1) → translate → independent
per-string review (§8.2) → blind back-translation (§8.3) → in-context spot-check
(§8.4).** A phase is not done when the strings exist; it is done when every
string in it carries an `ok` verdict. Phase 2 runs this loop on Spanish first
precisely so the cost of the quality pass is measured on one language before six
are committed to it.

---

## 8. Testing and CI

The balance harness and golden-replay conventions already establish that this
project gates on assertions rather than eyeballs. Localisation gets the same:

1. **No missing keys.** Every key used by `t()` exists in the English catalog;
   every English key exists in all six others. Fails the build.
2. **No orphan keys.** A key in a catalog that nothing references is a failure,
   not a warning — it means copy moved and the translation did not.
3. **Character budget.** Every string in every locale is within its §1 ceiling.
4. **Placeholder parity.** A translated string uses exactly the placeholders its
   English source uses. A dropped `{player}` is a silent content bug.
5. **Glyph coverage.** Every character in a locale's catalog exists in that
   locale's font, checked against the TTF `cmap` — the same measurement
   technique already used for column advances. This is what catches a stray `ı`
   or a smart quote that Silkscreen does not have.
6. **No hardcoded prose.** A lint rule over `src/ui/` and `App.tsx` rejecting
   JSX text nodes and prose string literals outside the catalog. Scoped to
   player-facing files; developer-mode and QA-harness strings are exempt and
   stay English.
7. **Golden replay unaffected.** Localisation must not touch `ENGINE_VERSION`.
   If a sim change is needed to remove a sentence from `src/sim/`, that is a
   version decision and gets called out, not slipped in.
8. **Snapshot per locale** for the two measured-width tables, so a translation
   that would clip fails in Jest rather than on Joe's phone.

Device QA per language: onboarding through first match, the league table, the
squad register, the financial report, and Settings — the five screens where
length and glyph coverage bite.

---

## 9. Translation quality

The CI gates in §7 prove a translation is *present, sized, and renderable*.
None of them prove it is *good*. A string can pass every check and still read
like a manual, invert a meaning, or call a goalkeeper the wrong thing on
alternating screens. Quality needs its own pass, and every string gets one.

### 8.1 Terminology is locked before translation starts

The single largest quality lever across 2,000 strings is consistency, and
consistency cannot be recovered after the fact. Before any phase-2+ translation
begins, each language gets a **term glossary**: roughly 80 entries covering
football vocabulary (goalkeeper, centre-back, clean sheet, matchday, transfer
fee, wages, squad, fixture), the game's own coined nouns (Heat, the Zone, Hero
License, Awakening, Training Points, Fan Shop, Buzz), and the recurring UI verbs
(sign, release, license, swap, advance, build).

It lives at `content/i18n/glossary/<locale>.json`, is decided once with reasons
recorded, and is machine-checked: if the glossary says `es` renders "Hero
License" as "Licencia de Héroe", CI fails any Spanish string that renders it
another way. The game's coined terms are the ones players learn, so an
inconsistent one is worse than an awkward one.

### 8.2 Every string is audited at least once, by a different reviewer

No string ships on the word of whoever wrote it. Each translated string passes
a review by an independent reviewer — a different model, prompted as a native
speaker of that language who follows football and plays management games, and
given the target string, the English source, the glossary, and the screen it
appears on.

The reviewer returns a verdict per string:

| Verdict | Meaning | Action |
| --- | --- | --- |
| `ok` | Ships as written | none |
| `stiff` | Correct but reads written, not spoken | rewrite, re-review |
| `wrong` | Meaning changed, term off-glossary, or placeholder misused | rewrite, re-review |
| `long` | Correct but will not fit its cell | shorten in-language, re-review |

Anything not `ok` is rewritten and goes back through review. Verdicts are
recorded per string in `content/i18n/review/<locale>.json` alongside the
reviewer's one-line reason, so the audit is inspectable rather than a claim —
and so a later copy change to the English source can invalidate exactly the
strings it affects rather than the whole language.

Coverage is a CI gate of its own: **no locale ships with a string lacking an
`ok` verdict against the current English source hash.** That is what makes
"audited at least once" enforceable instead of aspirational.

### 8.3 Blind back-translation catches meaning drift

Review by a fluent reader is good at register and bad at inversions — a
confident, natural sentence that says the opposite of the source reads fine.
So a second, cheap check runs over the whole catalog: a reviewer that sees
**only the translated string**, with no access to the English, writes what it
means in English. That back-translation is diffed against the source.

This is where dropped negations, swapped subjects ("you sign him" → "he signs
you"), and mistranslated football idiom surface. Flagged strings go to the §8.2
loop. It is run per locale after translation and again before release.

### 8.4 Register spot-check, in context

Twenty strings per language, sampled across the screens where voice matters
most — Bert's lines, button labels, the post-match report, event prose — are
reviewed **on a screenshot of the actual screen**, not in a list. Out of
context, "Free" is a fine translation; on the transfer screen it should mean
"available", and only the screenshot shows that.

This is the pass that catches what the automated gates structurally cannot, and
it is deliberately small enough to actually happen for all six languages.

### 8.5 What this does not claim

None of the above is a native-speaker sign-off, and the spec should not pretend
otherwise. It is a layered machine audit: locked terminology, an independent
per-string review, a blind back-translation, and an in-context sample. That
catches the failure modes that make a translation embarrassing. It will not
catch every regionalism, and the honest plan is to ship, then fix on player
reports — which the catalog format makes a one-line change rather than a code
edit.

---
