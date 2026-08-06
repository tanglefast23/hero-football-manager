# Multilingual copy — design

Date: 2026-08-06
Status: draft, awaiting review

Ship Hero Football Manager in seven languages. English stays the source of
truth; six translations are authored against it. A language picker appears on
the screen where the manager signs their first player, and again in Settings.

---

## 1. What "translated" has to mean here

Two rules from the owner, and they outrank fidelity to the English wording:

1. **Casual — how people talk, not how they write.**
2. **Simple and succinct, always.**

These are not decoration. They decide the grammar of every line:

| Language | Address form | Register notes |
| --- | --- | --- |
| Spanish (`es`) | `tú` | Neutral Latin-American, not Castilian. No `vosotros`. Avoid `usted`. |
| Portuguese (`pt-BR`) | `você` | Brazilian. Never `tu`. Contract freely (`tá`, `pra`) where a friend would. |
| French (`fr`) | `tu` | `on` for "we". No `nous sommes`-style prose. |
| German (`de`) | `du` | Never `Sie`. Break compounds rather than build 22-letter nouns. |
| Indonesian (`id`) | `kamu` | Colloquial Jakarta-neutral. Never `Anda`. |
| Vietnamese (`vi`) | neutral | Avoid the honorific ladder — no `quý khách`, no `xin vui lòng`. |

**The succinctness rule becomes a hard budget.** Every translated string gets a
character ceiling derived from its English source, and CI fails if a string
busts it:

```
ceiling(locale) = ceil(len(english) * expansion[locale]) + 2
expansion = { es: 1.25, pt-BR: 1.25, fr: 1.25, de: 1.30, id: 1.20, vi: 1.15 }
```

This does double duty. It enforces "succinct always", and it is the only thing
standing between the translation and a clipped league table (§4.2). Where a
faithful translation cannot fit, the answer is to **rewrite shorter in the
target language**, never to translate literally and let it overflow.

Additional voice rules, applied to every locale:

- Button labels name the action, matching the English discipline already in the
  codebase ("Erase and start over", not "Confirm").
- No exclamation marks unless the English has one.
- Football vocabulary uses what fans in that market actually say, not a
  dictionary gloss: `pt-BR` "zagueiro" not "defensor central"; `es` "portero"
  (neutral LatAm) over "guardameta"; `de` "Innenverteidiger" but "Keeper" where
  the terrace says Keeper.
- Bert's voice (the assistant) stays a chatty mate in every language. His lines
  are the highest-risk copy for sounding like a manual — they get authored, not
  converted.
- Never show the player a penalty (existing house rule): the translation must
  not reintroduce negative framing that the English deliberately avoids.

---

## 2. The seven languages, and why

Selected for football-fan population, then filtered by whether the game's pixel
font can render them.

**Shipping:** English (`en`, source), Spanish (`es`), Portuguese-Brazil
(`pt-BR`), French (`fr`), German (`de`), Indonesian (`id`), Vietnamese (`vi`).

**Swapped out, and why.** Nielsen's 2025 global sports report puts 51% of the
world's population in the football-fan bucket, with the Gulf (Saudi 75%) and
Mexico (64%) at the top; the 2022 World Cup final reached 242.79M in MENA
alone. By fan count the true top five is roughly English, Spanish, **Arabic**,
**Chinese**, Portuguese. Both of the bolded ones fail the pixel-font test:

- **Arabic** — Silkscreen has no Arabic block, and Arabic needs right-to-left
  layout plus contextual glyph shaping. That is a UI-mirroring project, not a
  translation. Deferred, not rejected; it is the highest-value future addition.
- **Chinese** — thousands of glyphs at a 5×7 bitmap size do not exist and could
  not be legible if they did. There is no path that keeps the art direction.

Their slots go to French (France plus francophone West Africa), German
(Bundesliga, and one of the strongest paid-App-Store markets), and Indonesian
(Indonesia is among Asia's largest football-fan populations and is pure ASCII,
so it costs nothing in font risk). Vietnamese is included by owner request.

Italian was the runner-up to Indonesian: higher fandom rate (56%) and a better
premium-game market, but roughly a third of Indonesia's fan count.

---

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

## 5. The language picker

**Primary placement: the sign-your-first-player screen**
(`CharacterCreationScreen`). It already hosts a difficulty radio group in a
`PaperPanel`, so a Language panel sits alongside it with the same furniture:

```
┌ Language ────────────────── English ┐
│  ● English                          │
│  ○ Español                          │
│  ○ Português (Brasil)               │
│  ○ Français                         │
│  ○ Deutsch                          │
│  ○ Bahasa Indonesia                 │
│  ○ Tiếng Việt                       │
└─────────────────────────────────────┘
```

- Each language is written **in itself**, never "Spanish".
- English is preselected. First launch may *suggest* the device language by
  scrolling it into view, but never auto-applies it — the owner asked for
  English as the default and a silently-Spanish first launch is worse than a
  tap.
- Selecting a language re-renders the screen immediately, so the choice is
  self-demonstrating.
- The panel collapses to a single tappable row showing the current language;
  tapping expands the list. On the phone layout this keeps the screen from
  growing a seventh scroll section.

**Secondary placement: Settings.** `SettingsOverlay` gets the same control, so
the choice is changeable mid-career and is not a one-time trap.

**Persistence.** A `language: Locale` field on `AppPreferences`, defaulting to
`'en'`. `PREFERENCES_SCHEMA_VERSION` in
[`preferences-repository.ts:13`](src/persistence/preferences-repository.ts) is
**already 9**, so this bumps it to **10** and adds
`LANGUAGE_PREFERENCES_SCHEMA_VERSION = 9` to the migration ladder alongside the
eight existing constants, defaulting `language` to `'en'` on every older row.
Note that `PreferencesSchema` is a `z.strictObject` — a new field without the
matching schema entry fails validation outright rather than being ignored.

It is a device preference, not a career preference — one player, one language,
across careers.

---

## 6. Measured copy surface

Counted from the tree, deduplicated per file, excluding tests, the dev harness,
and `src/audit/`. These are candidate strings — the extraction pass in Phase 1
will prune developer-only text — so treat them as an upper bound with roughly
25% noise.

| Area | Files | Strings | Words |
| --- | ---: | ---: | ---: |
| Weekly loop (shell, home, training, market, finances, table) | 20 | 905 | 5,616 |
| Match (render ring, HUD, substitutions, power cut-ins) | 59 | 358 | 1,954 |
| Season and ceremony (awards, celebrations, awakening, story) | 38 | 285 | 1,666 |
| Onboarding and creation | 6 | 101 | 1,803 |
| Settings and meta (glossary, privacy, hall of fame) | 5 | 47 | 187 |
| Unclassified — `App.tsx`, overlays, walk-ons, view-models | 119 | 1,966 | 11,082 |
| **TS/TSX total** | **247** | **3,662** | **22,308** |

| Content file | Strings | Words |
| --- | ---: | ---: |
| `events.json` | 400 | 3,825 |
| `assistant-guide.json` (Bert) | 223 | 1,610 |
| `fulltime-coach-lines.json` | 180 | 1,408 |
| `glossary.json` | 86 | 1,158 |
| `onboarding.json` | 110 | 919 |
| `tips.json` | 36 | 631 |
| `award-ceremony-lines.json` | 60 | 542 |
| `player-requests.json`, `powers.json`, `sponsors.json`, `training.json`, `fulltime-blame-lines.json` | 175 | 936 |
| `clubs.json` — **names, not translated** | 170 | 340 |
| **Content total (translatable)** | **1,270** | **11,029** |

**Roughly 2,500–3,000 translatable strings and ~25,000 English words**, which
is ~150,000 words across six target languages before the quality passes in §8.
That number is the reason for phasing, and it is the number to sanity-check
after Phase 2 — if Spanish costs materially more than a sixth of the budget,
the scope conversation happens then, not at the end.

The `unclassified` row is the one to watch: `App.tsx` alone is 2,944 lines and
holds a large share of it. Splitting player-facing copy out of `App.tsx` is a
natural part of Phase 1 rather than a separate refactor.

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

## 10. Out of scope

- Arabic, Chinese, and any other non-Latin script. Named in §2 with reasons.
- Right-to-left layout support.
- Translating club, player, or competition **names**.
- Localised audio, or Bert's voice cues.
- App Store listing metadata and screenshots. Worth doing, separate job.
- Locale-specific currency, date, or calendar systems. The game's week/season
  clock is fictional.

---

## 11. Open decisions

1. **VT323 vs Handjet** for Vietnamese — resolved by the Phase 0 visual gate.
2. **`vars()` vs family-name aliasing** for the font swap — resolved by the
   Phase 0 native spike.
3. **Whether the first-launch picker suggests the device language.** Spec says
   scroll-into-view but do not auto-apply; this is reversible and cheap either
   way.
