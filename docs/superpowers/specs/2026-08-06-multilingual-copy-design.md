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

This is a **copy rule, not a layout guarantee** — Silkscreen is proportional, so
character count is a poor proxy for pixel width, and layout safety comes from
the measured advance tables in §4.2 instead. What the budget does is keep the
translation honest about "succinct always": where a faithful translation will
not fit the budget, the answer is to **rewrite shorter in the target language**,
never to translate literally and let it sprawl.

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

**The three layers that emit English, and what each becomes:**

| Layer | Examples | Becomes |
| --- | --- | --- |
| Pure sim (`src/sim/`) | `tactics.ts:46–50` formation blurbs — `'Balanced lines'`, `'Wide attack'`, `'Midfield shield'`, `'Deep counter'`, `'Crowd midfield'` | Display-only maps; the ring keeps `FormationId` and the blurb map moves to the catalog. No behaviour changes, so no `ENGINE_VERSION` bump — but see §8 gate 7 |
| Pure game (`src/game/`) | `career.ts` ledger labels, `management.ts` shortfall sentences, `promotion-progression.ts` drill titles | `labelKey` + `labelParams` |
| Application (`src/application/`) | `store.ts:1482–1776` toasts, `view-models.ts:560` settlement lines, `event-selection.ts:189` requirement lines | `labelKey` + `labelParams` — these are the easiest to forget because they are not "UI" and not "pure ring" |

That application layer is the one an extraction pass skips by accident. It is
called out here so it gets its own inventory item in the plan rather than being
swept up under "the UI".

`src/sim/teams.ts` club names stay English — they are names (§10).

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

### 3.3 Content JSON, and the single source of English

`content/*.json` carries ~1,270 translatable prose strings — events, tips,
glossary, ceremony lines, coach reactions. These already have stable ids, so a
translation is keyed off that id (`event.derby-night.body`) rather than
duplicating the whole file per locale. `content/clubs.json` is club and player
**names** and is not translated.

**There must be exactly one English source, or the two will drift.** Content
prose keeps living in `content/*.json` where it is authored today; the English
catalog does **not** duplicate it by hand. Concretely:

- `content/i18n/en.json` is **generated, never hand-edited.** A build script
  extracts it from the two English sources — the content files (by id) and the
  keyed strings lifted out of TS/TSX — and writes the merged catalog. It carries
  a `DO NOT EDIT` header and CI fails if regenerating it produces a diff.
- The six translated catalogs **are** hand-authored, against the generated
  English.
- So editing English copy means editing `content/*.json` or the call site, never
  `en.json`. That keeps one place to change a sentence and makes "the English
  changed, these translations are now stale" a mechanical diff (§9.2).

Without this rule, a writer fixes a tip in `tips.json`, the catalog still holds
the old English, and every translation is silently reviewed against text the
game no longer shows.

### 3.4 Number formatting

The same Hermes caution that rules out `Intl.PluralRules` (§3.1) rules out
`Intl.NumberFormat`. The formatting helper is **hand-rolled**: group digits in
threes and pick the separator from a seven-entry table (`.` for `de`, `es`,
`pt-BR`, `id`, `vi`; `,` for `en`; thin space for `fr`). Seven locales do not
justify a polyfill, and a hand-rolled grouper is trivially unit-testable in the
node Jest environment.

This replaces the mix of `toLocaleString('en-US')`, `toLocaleString('en-GB')`
(`player-request-view-model.ts:111`), and unpinned `toLocaleString()`
(`view-models.ts:560`, `event-selection.ts:189`, `store.ts` ×4) — the last of
which already varies by *device* locale today and is a live bug regardless of
this project.

Formatting happens at the UI edge only, on the raw values in `labelParams`
(§4.3). It must never run inside a match tick or anywhere its output could
reach a deterministic log.

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

Seven persisted surfaces carry English prose through the zod codec into SQLite —
not the four an earlier draft of this spec claimed, and four of them are
`strictObject`, not one:

| Surface | Codec | Schema kind | Fix |
| --- | --- | --- | --- |
| Ledger line `label` | `:190` | `.passthrough()` | Sibling `labelKey` + `labelParams` |
| Cash transaction `label` | `:185` | `.passthrough()` | Same |
| Season recap award `label`, `detail` | `:1132` | `.passthrough()` | Same |
| Sponsor objective snapshot `label` | `:495` | **`strictObject`** | Sibling fields + version bump |
| Sponsor contract snapshot `offerLine` | `:510` | **`strictObject`** | Same |
| Sponsor offer snapshot `offerLine` | `:527` | **`strictObject`** | Same |
| Sponsor rules `brands[].offerLine`, `objectives[].labelTemplate` | `:458`, `:483` | **`strictObject`** | Same — note this is *content* copied into the save |

`sponsorName` and club names on these schemas are names, not prose, and are not
translated (§10).

**The sponsor rules row is the nasty one.** `sponsorRulesSchema` persists a copy
of `content/sponsors.json` into the career, so English sponsor patter and
objective templates are frozen at the moment the career was created. Those
records need keys at snapshot time, and `labelTemplate` — English prose with
placeholders — has to become a key before it is ever snapshotted, or the
snapshot preserves English forever.

**Two rules the implementation must not get wrong:**

1. **Always dual-write.** `label` stays `nonemptyString` and stays **required**
   in the codec. New rows write the English `label` *and* `labelKey` +
   `labelParams`. A writer that emits only keys fails validation on its own
   schema. The UI prefers `labelKey` and falls back to `label`; the stored
   English is the fallback for pre-change careers and the safety net if a key is
   ever dropped from the catalog.
2. **`labelParams` carries raw values, never formatted text.** Store
   `{ fee: 240000 }`, not `{ fee: "$240,000" }`. Formatting is a display
   concern and belongs at the UI edge — preformatting freezes one locale's
   thousands separator and currency placement into SQLite, which is the exact
   bug this section exists to prevent.

Do **not** relax the four `strictObject` schemas to `.passthrough()` to dodge the
version bump. Silently dropping unknown keys is worse than a deliberate ladder
entry; take the bump.

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

### 7.1 Enabled locales, not "all locales"

A language is either **enabled** or it is not shipped. `ENABLED_LOCALES` is a
single constant; the picker (§5) lists exactly what is in it, and every CI
quality gate runs against exactly what is in it. An unenabled locale may hold a
partial catalog with no consequence.

This exists because the alternative is broken. Gate 1 ("every English key exists
in all six catalogs") plus a phase plan where Spanish lands before German means
either CI blocks every partial ship, or five catalogs get stuffed with English
stubs that pass the presence check and then fail the budget and glyph checks as
noise. Enabled-locale gating is what makes phasing and CI able to coexist.

### 7.2 A phase is a playable stop, not a coat of paint

An earlier draft claimed "nothing is left half-English at a stopping point."
That was false: translating the chrome while ~1,270 content strings stayed
English would leave a Spanish player reading English event prose in their first
session. The honest version of the promise:

> **A stopping point is coherent for a full play session, in the order a player
> meets the game.** Chrome and narrative move together, not chrome first.

Concretely, that pulls the *first-session* narrative forward out of the long
tail: `onboarding.json`, the first-match and early-season entries in
`events.json`, and Bert's critical-path lines in `assistant-guide.json` ship
with Phase 2, not Phase 5. What stays in the long tail is genuinely long-tail —
late-career events, the full coach-reaction pool, the glossary, blame lines.

### 7.3 The phases

**Phase 0 — decide the Vietnamese face.** Render Vietnamese in VT323 and
Handjet at the game's real sizes and pick one (§11 decision 1). The `vars()`
mechanism no longer needs a spike (§4.1); it needs a device smoke test, which
rides along in Phase 1.

**Phase 1 — plumbing, English only.** Catalog schema, the `en.json` generator,
`useCopy()`, the hand-rolled formatter (§3.4), the `language` preference, the
picker on both screens, the CI gates, and the extraction itself. At the end the
game looks and behaves identically but every string flows through the lookup.
This is the phase that must not regress anything, so its exit criteria are hard:

- `npx tsc --noEmit` and the full Jest suite pass, including the golden replay.
- **An English catalog snapshot test.** Every key→English pair is committed as a
  snapshot, so a later keying pass cannot silently reword copy. Regenerating
  `en.json` must produce no diff.
- Gate 6 (no hardcoded prose) reports zero violations outside the exempt paths.
- Device pass over the five length-sensitive screens (§8) in English, confirming
  nothing moved.

**Phase 2 — Spanish end-to-end, plus the layout work.** The cost probe. Includes
the §4.2 hard dependencies — per-locale `col.*` short forms and extended advance
maps — because they block any non-English header. Includes the first-session
narrative per §7.2. Spanish because it is the highest-value target with a
middling expansion factor: if Spanish fits, French and Portuguese will.

**Go/no-go after Phase 2.** Measure actual words, actual review cost, and actual
layout breakage against the §6 estimate. If Spanish costs materially more than a
sixth of the budget, the scope conversation happens here — reduce the language
set, or reduce the quality machinery — not after five more languages are half
done.

**Phase 3 — Vietnamese.** Third, not last, because it is the one that can fail
on font grounds, and failing early is cheaper. VT323 is monospace and Silkscreen
is not, so **every advance-mapped width shifts for `vi` alone**; re-measurement
is critical path here, not a follow-up.

**Phase 4 — Portuguese, French, German, Indonesian.** German last within the
group; it is the longest and will surface any remaining layout ceilings.

**Phase 5 — long tail.** Late-career events, the full coach and blame pools,
glossary, remaining ceremony lines. Largest word count, lowest per-string risk.

Within each translation phase, work goes screen by screen so a partial phase is
still coherent.

**Every translation phase is: lock the glossary (§9.1) → translate → audit
(§9.2) → in-context spot-check (§9.4).** A phase is not done when the strings
exist; it is done when every string in it carries an `ok` verdict.

---

## 8. Testing and CI

The balance harness and golden-replay conventions already establish that this
project gates on assertions rather than eyeballs. Localisation gets the same —
but only where a gate can actually be enforced. Three of the eight below were
over-specified in an earlier draft and are corrected here.

**Where they run.** Jest is `testEnvironment: node` with `roots: ['<rootDir>/src']`
and no jsdom, and `require('react-native')` throws. Gates 1–5, 7 and 8 are pure
data checks — catalog JSON, TTF `cmap` parsing, arithmetic — so they live in
`src/i18n/__tests__/` and reach the catalogs with `fs.readFileSync` on
`content/i18n/`. The `roots` setting limits *test discovery*, not what a test may
read. Gate 6 is not a Jest concern at all.

All locale-scoped gates run against `ENABLED_LOCALES` only (§7.1).

1. **No missing keys.** Every key a call site can request exists in the English
   catalog, and every English key exists in every *enabled* locale.
2. **No orphan keys — softened, and here is why.** A pure static reference graph
   cannot see `` t(`event.${id}.body`) ``, so hard-failing on "nothing
   references this key" would either flag every live content key as dead or push
   the API toward literal-only calls. Instead: a catalog key is legal if it is
   either statically referenced **or** matches a prefix in a declared
   **dynamic-key registry** — `event.<id>.*`, `bert.<id>.*`, `tip.<id>.*`, and
   so on, whose legal ids are generated from `content/*.json` itself. A key
   matching neither is the failure. Until that registry exists (Phase 1), this
   gate is a **warning**, not a build break.
3. **Character budget.** Every string within its §1 ceiling. This is a
   *succinctness* gate. It is explicitly **not** a layout proof — see §4.2.
4. **Placeholder parity.** A translated string uses exactly the placeholders its
   English source uses. A dropped `{player}` is a silent content bug.
5. **Glyph coverage.** Every character in a locale's catalog exists in that
   locale's font, checked against the TTF `cmap` — the technique already used
   for column advances. Catches a stray `ı`, a smart quote, or an em dash that
   Silkscreen does not have.
6. **No hardcoded prose — an ESLint job, not a Jest test.** A rule over
   `src/ui/`, `src/application/` and `App.tsx` rejecting JSX text nodes and
   prose literals outside the catalog. It needs TSX AST access that the node
   Jest suite cannot provide, so it runs as its own CI step. Developer-mode,
   `src/ui/dev-harness/` and `src/audit/` strings are exempt and stay English.
7. **Golden replay still matches, or the bump is deliberate.** The earlier
   wording — "localisation must not touch `ENGINE_VERSION`" — was a prohibition
   dressed as a test, and prohibitions do not catch anything. The real gate is
   the existing golden-replay snapshot: it either matches or it does not. If
   extraction changes control flow or RNG consumption (building a label that
   sized an array, branching on English text), the snapshot fails and that
   forces the version decision CLAUDE.md already requires. Expected outcome is
   no bump; the gate is what proves it rather than assuming it.
8. **Width tables per locale.** Every `col.*` string in every enabled locale has
   a measured advance **and** fits its column, for that locale's face. This is
   the gate that makes §4.2 real rather than remembered.

Device QA per language: onboarding through first match, the league table, the
squad register, the financial report, and Settings — the five screens where
length and glyph coverage bite.

---

## 9. Translation quality

The gates in §8 prove a translation is *present, sized, and renderable*. None of
them prove it is *good*. A string can pass every check and still read like a
manual, invert a meaning, or call a goalkeeper two different things on two
screens.

**The council pushed back hard on this section, and the pushback was fair.** The
objection: an LLM asked to review another LLM's translation will rubber-stamp
fluent-but-wrong copy, and recording an `ok` verdict against a source hash
proves *coverage*, not *correctness* — paperwork with a green tick. That is a
real failure mode and the previous draft did not answer it.

The answer is not to delete the audit — auditing every string once is a stated
requirement — but to (a) measure whether the reviewer is actually catching
anything, (b) stop treating the weakest checks as merge blockers, and (c) be
plain about what the whole thing is worth.

### 9.1 Locked terminology — the strongest lever, and the one that really works

Consistency across ~2,500 strings cannot be recovered after the fact. Before any
phase-2+ translation, each enabled locale gets a glossary at
`content/i18n/glossary/<locale>.json`.

**Scoped to coined terms, not to football vocabulary at large.** The game's own
nouns — Heat, the Zone, Hero License, Awakening, Training Points, Fan Shop,
Buzz, Superpower — are what players learn and what must never wobble. Roughly
20 entries, not 80.

Ordinary football words (goalkeeper, clean sheet, matchday) stay *advisory*: a
recommended rendering recorded for the translator, not a CI assertion. A
substring check on those would fail constantly on Spanish and German inflection
and compounding — `Innenverteidiger` inside `Innenverteidigerposition`,
`portero` versus `porteros` — and a gate that cries wolf gets switched off.

Each coined term declares its **allowed surface forms** (including inflections)
per locale, and CI fails a string that renders a coined term any other way. That
is a narrow, unambiguous, genuinely enforceable check.

### 9.2 Every string is audited once, by a different reviewer

Each translated string is reviewed by an independent reviewer — a different
model from the one that authored it, prompted as a native speaker of that
language who follows football and plays management games, given the target
string, the English source, the glossary, and the screen the string appears on.

| Verdict | Meaning | Action |
| --- | --- | --- |
| `ok` | Ships as written | none |
| `stiff` | Correct but reads written, not spoken | rewrite, re-review |
| `wrong` | Meaning changed, term off-glossary, placeholder misused | rewrite, re-review |
| `long` | Correct but will not fit its cell | shorten in-language, re-review |

Verdicts land in `content/i18n/review/<locale>.json` with the reviewer's
one-line reason and the **hash of the English source** they judged. When English
copy changes, exactly the affected strings go stale rather than the whole
language.

**Coverage is a gate: no enabled locale ships with a string lacking an `ok`
verdict against the current English hash.** That is what makes "audited at least
once" enforceable. It is a coverage gate and it is labelled as one — it asserts
the review happened, not that the copy is good.

### 9.3 Canaries — the check that makes 9.2 more than paperwork

This is the answer to "the reviewer will just rubber-stamp it."

Each review batch is seeded with **canaries**: strings deliberately broken in
ways the reviewer is supposed to catch — a negation dropped, a coined term
swapped for an off-glossary synonym, register flipped to formal (`usted`, `Sie`,
`Anda`), a placeholder removed, a literal calque no native speaker would say.
They are shuffled in and indistinguishable from real work.

The reviewer never learns which are canaries. Afterwards:

- **A canary marked `ok` is a miss.** Miss rate is computed per batch and
  recorded next to the verdicts.
- **A batch missing more than 20% of its canaries is void.** Its `ok` verdicts
  are discarded and the batch is re-reviewed with a different reviewer or a
  sharper prompt.

This converts an unmeasurable worry into a measured false-negative rate. If the
rate is bad, the number says so and the spec's own claim about the audit
collapses honestly instead of quietly. Roughly 5% canaries per batch is enough
to be statistically useful without much cost.

### 9.4 Register spot-check, in context

Twenty strings per language, sampled across the screens where voice matters most
— Bert's lines, button labels, the post-match report, event prose — reviewed
**on a screenshot of the actual screen**, not in a list. Out of context, "Free"
is a fine translation of "Free"; on the transfer screen it means "available",
and only the screenshot shows that.

This catches what the automated gates structurally cannot, and it is small
enough to actually happen for all six languages.

### 9.5 Back-translation — tooling, demoted from a gate

A blind back-translation (reviewer sees only the translated string, writes what
it means in English, diff against the source) does catch inversions and dropped
negations. But as a whole-catalog merge blocker over ~15,000 strings it is
expensive, it thrashes on short UI chrome where "Save" back-translates a dozen
defensible ways, and a model that mistranslated a string will often
back-translate its own error into something that diffs clean.

So it runs **on long prose only** — `event.*`, `bert.*`, tips, ceremony lines —
where the signal is real and the string is long enough for a diff to mean
something. It produces a triage list, not a build failure. Short chrome is
covered by §9.2 plus placeholder parity.

### 9.6 What this is worth

Being plain, because the previous draft was not: this is a layered machine
audit, not a native-speaker sign-off. Ranked by how much they actually buy:

1. **Locked coined terms** (§9.1) — genuinely enforceable, catches the most
   player-visible class of error.
2. **Placeholder parity, glyph coverage, width tables** (§8) — structural, and
   they either pass or they do not.
3. **Canary-validated per-string review** (§9.2–9.3) — worth what the measured
   miss rate says it is worth, and no more. That number gets reported.
4. **In-context spot-check** (§9.4) — small, high-yield, honest about its scale.
5. **Back-translation on prose** (§9.5) — useful triage, weakest evidence.

It will not catch every regionalism, and it should not be described to anyone as
equivalent to the balance harness — that gate measures a closed system, this one
estimates a human judgement. The plan is to ship, then fix on player reports,
which the catalog format makes a one-line data change rather than a code edit.

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

1. **VT323 vs Handjet** for Vietnamese — open. Resolved by the Phase 0 visual
   gate: render Vietnamese at real game sizes in both and pick. VT323 is the
   recommendation (solid strokes, closer to Silkscreen); Handjet's Cyrillic and
   Greek coverage is the argument for it if a future language wants them.
2. ~~`vars()` vs family-name aliasing~~ — **closed.** `vars()` is verified
   working on native by source-tracing `react-native-css-interop@0.2.6` (§4.1).
   Family-name aliasing is rejected as a product path, not held as a fallback:
   it forces a relaunch on language change, which contradicts the live switch
   §5 promises. If the Phase 1 device smoke test somehow fails, the thing that
   changes is §5's promise — and that is a decision to bring back to Joe, not a
   silent downgrade.
3. **Whether the first-launch picker suggests the device language.** Spec says
   scroll-into-view but do not auto-apply; reversible and cheap either way.
4. **Whether Phase 5's long tail gets the full §9 quality machine** or a lighter
   pass. Deliberately deferred to the post-Phase-2 go/no-go (§7.3), when the
   measured cost of one language exists and the decision can be made on a
   number instead of a guess.
