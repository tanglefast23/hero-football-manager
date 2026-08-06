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
  languages need exactly three rules:

  | Rule | Locales | Behaviour |
  | --- | --- | --- |
  | `n === 1` singular | `es`, `de`, `en` | 0 takes `.other` |
  | `n === 0 \|\| n === 1` singular | `fr`, **`pt-BR`** | 0 takes `.one` |
  | no plural marking | `id`, `vi` | always `.other`, one form |

  Brazilian Portuguese belongs with French, not with Spanish — CLDR treats
  `pt` as `i = 0 or 1 → one`, so "0 jogadores" is wrong and "0 jogador" is
  right. An earlier draft grouped it as "Germanic/Romance one-vs-other" and
  would have shipped that bug in every zero-count string.

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

**There must be exactly one English source per string, and an earlier draft's
answer to that was incoherent.** It said `en.json` would be *generated from the
call sites* — but once a call site becomes `t('creation.stat.pac.label')`, the
English is gone and there is nothing left to generate from. The generator had no
input.

The fix is to give each kind of copy exactly one home, with **no overlap**, so
nothing needs generating and nothing can drift:

| Copy | English source | Translations |
| --- | --- | --- |
| **Content prose** — events, tips, glossary, Bert, ceremony and coach lines | stays authored in `content/*.json`, exactly as today | `content/i18n/<locale>.json` under `event.<id>.body` etc. |
| **UI chrome** — buttons, labels, headings, ledger lines, toasts | `content/i18n/en.json`, **hand-authored** | same file per locale |

So the resolver has two lookups for English: a chrome key reads `en.json`, a
content key reads the content file by id. For every other locale both read
`<locale>.json`. Editing an English tip still means editing `tips.json`; editing
an English button still means editing `en.json`. Neither file ever contains the
other's strings, so there is no sync step and no generator to go stale.

The English snapshot test (§8) covers `en.json` plus the content-derived key set,
which is what makes "the keying pass did not silently reword anything" checkable.

### 3.4 Number formatting

The same Hermes caution that rules out `Intl.PluralRules` (§3.1) rules out
`Intl.NumberFormat`. The formatting helper is **hand-rolled**: group digits in
threes and pick the separator from a seven-entry table.

| Locale | Separator | Codepoint |
| --- | --- | --- |
| `en` | `,` | U+002C |
| `es`, `pt-BR`, `de`, `id`, `vi` | `.` | U+002E |
| `fr` | non-breaking space | **U+00A0** |

**French must use U+00A0, not a thin or narrow space.** Typographic French
prefers U+202F (narrow no-break space), and an earlier draft of this spec said
"thin space" — but Silkscreen has neither U+202F nor U+2009. Verified against
the `cmap`: U+00A0 is present, the other two are not. Shipping the typographic
choice would have put a tofu box in every French money value on screen.

This replaces the mix of `toLocaleString('en-US')`, `toLocaleString('en-GB')`
(`player-request-view-model.ts:111`), and unpinned `toLocaleString()`
(`view-models.ts:560`, `event-selection.ts:189`, `store.ts` ×4) — the last of
which already varies by *device* locale today and is a live bug regardless of
this project. **Replacing those call sites is its own work item**, not a
side-effect of adding the helper; a helper nobody calls changes nothing.

Formatting happens at the UI edge only, on the raw values in `labelParams`
(§4.3). It must never run inside a match tick or anywhere its output could reach
a deterministic log.

**Formatter output is glyph-checked too.** Gate 5 (§8) checks catalog strings,
but a separator is not a catalog string — it lives in code. The gate therefore
also asserts that every locale's separator, currency symbol and sign characters
exist in that locale's face. That assertion is what would have caught the
U+202F mistake above without anyone looking at a French screenshot.

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
were verified to cover the full Vietnamese subset by parsing their `cmap`:

| Font | Glyphs | Weights shipped | Also covers | Look |
| --- | --- | --- | --- | --- |
| VT323 | 568 | **400 only** | Turkish | Solid-stroke bitmap terminal, monospace |
| **Handjet** | 1322 | **400 + 700** (100–900 available) | Turkish, Cyrillic, Greek | Dot-matrix, variable |

**Recommendation: Handjet**, and the reason is structural rather than aesthetic.
`PixelText.tsx` defines two type voices — `display` is Silkscreen **Bold**,
`data` is Silkscreen **Regular** — and states outright that a bold request on
the regular cut "produces synthetic faux-bold, which smears a 1-bit bitmap
font." VT323 ships a single weight, so choosing it would collapse both voices
into one face for Vietnamese alone and silently delete a distinction the art
bible treats as load-bearing. `@expo-google-fonts/handjet` ships
`Handjet_400Regular` and `Handjet_700Bold` as static cuts, mirroring Silkscreen
one-for-one, and static cuts sidestep React Native's poor variable-axis support.

Handjet's Cyrillic and Greek coverage is free headroom if a future language
wants them.

**Consequence for §4.2: Handjet is not monospace.** An earlier draft leaned on
VT323 being monospace to collapse Vietnamese to a single advance constant. That
shortcut dies with VT323 — `vi` needs a full per-string advance table, measured
from Handjet's `hmtx`, exactly like Silkscreen's.

What remains open is only the aesthetic call: Handjet renders as separated dots
where Silkscreen renders solid blocks. Phase 0 renders one real Vietnamese
screen and confirms it reads as the same game. If it does not, the fallback is
VT323 **and** an explicit decision to accept one weight for Vietnamese.

**Swap mechanism, part 1: the className sites.** NativeWind v4 exports `vars()`,
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

So the className half is one line of `tailwind.config.js`:

```js
fontFamily: { mono: ['var(--font-data)'], pixel: ['var(--font-display)'] },
```

plus one `vars()` wrapper at the app root. Every existing `font-pixel` and
`font-mono` class keeps working untouched, and the swap is live — no relaunch.

This does not violate `PixelText.tsx`'s rule against mixing `style` and
`className` for one visual property. `fontFamily` is still set only by the
className pipeline; `vars()` supplies the *value* the class resolves against and
never sets `fontFamily` itself.

**Swap mechanism, part 2: the 16 files `vars()` cannot reach.** An earlier draft
claimed the swap was "one line and no call-site churn." That was wrong, and it
was wrong in the worst place. Raw `Silkscreen_*` family literals bypass
NativeWind entirely — they are module-scope constants feeding `StyleSheet.create`,
evaluated once at import, so no runtime rebinding can touch them.

**Counting them needs care, and a first attempt got it wrong.** Grepping for
`fontFamily: 'Silkscreen` finds only the direct form and misses the indirect
one:

```ts
const PIXEL_BOLD = 'Silkscreen_700Bold';   // <- invisible to that grep
const styles = StyleSheet.create({ name: { fontFamily: PIXEL_BOLD } });
```

That pattern hides three of the most important files of all —
`src/render/SubstitutionBoard.tsx:911`, `src/render/MatchControlRail.tsx:399`
and `src/render/PowerTitleTakeover.tsx:194`. **The correct search is for the
family-name string literal anywhere in a file**, not for the property
assignment. Any gate written against the narrower pattern passes while the match
screen stays broken.

Ten of the matching files are `src/ui/dev-harness/` and are exempt (§8 gate 6).
**Sixteen are player-facing:**

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

Left alone, a Vietnamese player gets correct type everywhere except the
substitution board, the match control rail, power takeovers, cup cards, the
awakening cutscene and the first-match coaching modal — i.e. the game's biggest
moments.

These convert to a `useFaces()` hook returning `{ display, data }` from the
active locale, with style objects built in render instead of at module scope.
It is mechanical, it is bounded, and it is an explicit work item rather than
something extraction discovers halfway through. The two `*ArtQaScreen` files are
QA surfaces and may be exempted if that proves cheaper.

**Family-name aliasing is rejected, not held in reserve.** Registering Handjet
under the `Silkscreen_*` names would fix all 70 sites at once, but it forces an
app relaunch on every language change — contradicting the live switch §5
promises — and expo-font will not re-register a family mid-session. If the
Phase 1 device smoke test contradicts the source trace above, the thing that
changes is §5's promise, and that is a decision to bring back rather than a
silent downgrade.

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

**Two reviewers disagreed about the failure mode here, so it was checked.** The
answer: `leagueHeaderWidthDemand` and `leagueCellWidthDemand` **throw** on any
string absent from their advance maps (`league-table-columns.ts:114`, `:123`,
same pattern at `squad-register-columns.ts:115`) — but they are imported *only*
by `src/ui/__tests__/league-table-columns.test.ts`. Nothing calls them at
runtime.

So there is **no production redbox**. What ships is:

- **In Jest:** adding a locale header without measuring it *throws*, which is a
  useful hard failure and the reason gate 8 works at all.
- **On device:** the UI lays out against the static `LEAGUE_COLUMN_WIDTH`
  constants (`league-table-columns.ts:91`), which are sized to the **English**
  headers. A longer German header does not crash — it wraps or clips, exactly
  the bug the file's own header comment records ("PTS" breaking to "PT" over a
  lone "S").

**The load-bearing consequence:** those constants must stop meaning "wide enough
for English" and start meaning **"wide enough for the widest enabled locale."**
Every column width becomes a max across all enabled locales' measured short
forms, recomputed whenever a locale is enabled. That is a change to shared
layout, so it affects the English game too — English columns may get wider — and
that is correct and intended (§4.2 item 4: one layout, seven fills).

**The character budget is not a width check.** Silkscreen is proportional: `W`
is 1.0em and `P` is 0.75em (`LEAGUE_HEADER_ADVANCE_EM`); the squad register
records the same trap (`squad-register-columns.ts:24-39`). A German string can
sit under `len × 1.30 + 2` and still overrun its column, or sit over the ceiling
and fit fine. §1's budget enforces *succinctness*, a copy goal. It is not, and
must not be sold as, a layout guarantee.

So the mitigations are not a preference order. Items 1–3 are **hard dependencies
of Phase 2** — no non-English table or register header ships before all three:

1. **Per-locale short forms for every advance-mapped string, declared not
   translated.** Table and register headers stay 1–3 characters in every
   language (`PTS` → `PKT` in German, `PTS` in Spanish, `Đ` in Vietnamese).
   These live in the catalog under a `col.*` namespace exempt from the §1 copy
   budget, because they are layout tokens wearing words.
2. **Extend the advance maps to cover every one of those strings, per face** —
   Silkscreen for the five Latin locales, Handjet for `vi`. Handjet is not
   monospace, so `vi` needs a full per-string table, not a single constant.
3. **Recompute `LEAGUE_COLUMN_WIDTH` and its squad-register equivalent as the
   max across enabled locales,** and assert in Jest that every enabled locale's
   headers fit. This is gate 8 in §8, and it is what turns "we remembered to
   measure it" into something CI can prove.
4. Beyond the measured tables, the soft-clipping cells — `w-28` stat labels and
   `w-16` stepper values (`CharacterCreationScreen.tsx:44`),
   `numberOfLines={1}` headers, HUD chips, buttons — have no advance tables at
   all and are covered only by the budget and device QA. Where a cell genuinely
   cannot hold a language, the layout changes for every language, not just that
   one. Strings that live in fixed cells are the candidates for
   advance-measured ceilings rather than character ceilings, if device QA shows
   the budget is not catching them.

### 4.3 English is baked into save files

**Eleven** persisted surfaces carry English prose through the zod codec into
SQLite. Early drafts of this spec claimed four, then seven; the council found
the rest. The number is stated precisely because an implementer who works from a
short list ships a game that still renders English from whatever the list
missed.

| # | Surface | Codec | Schema | Notes |
| --- | --- | --- | --- | --- |
| 1 | Ledger line `label` | `:190` | `.passthrough()` | Built in `game/career.ts:836-1004` |
| 2 | Cash transaction `label` | `:185` | `.passthrough()` | Also fed from `game/player-requests.ts:422` via `definition.title` |
| 3 | Season recap award `label`, `detail` | `:1132` | `.passthrough()` | |
| 4 | Sponsor objective snapshot `label` | `:495` | **`strictObject`** | |
| 5 | Sponsor contract snapshot `offerLine` | `:510` | **`strictObject`** | Carries `sponsorContentId` (`:508`) — id lookup works |
| 6 | Sponsor offer snapshot `offerLine` | `:527` | **`strictObject`** | Carries `sponsorContentId` (`:525`) |
| 7 | Sponsor **rules** `brands[].offerLine`, `objectives[].labelTemplate` | `:458`, `:483`; snapshotted whole at `:1283` | **`strictObject`** | Content copied into the save |
| 8 | `pendingEvent.outcomeText` | `:758` | optional | Resolved event prose. Sibling `resolvedOutcomeIndex` (`:759`) already persists — the key fix is nearly free |
| 9 | `pendingCupGiantKillingCelebrations[].title`, `.body` | `:1343-1348` | `.passthrough()` | Four authored Bert speeches from `game/cup-giant-killing.ts:17-46`, persisted whole |
| 10 | `seasonRecap.cupResult` | `:1176` | free string | Mixes `'Not entered'` / `'Winners'` / `'Entered'` with round labels (`game/season-recap.ts:247-257`); rendered as a panel **title** at `SeasonEndScreen.tsx:166` |
| 11 | `playerRequestRules.requests[].title`, `.line` | `:429-436` | `.passthrough()` | Content rules copied into the save |
| 12 | Season recap `topScorer.detail` — **also parsed as game data** | `:1132` | `.passthrough()` | See the landmine below |

**Surface 12 is a data-corruption landmine, not a display string.**
`hall-of-fame.ts:50` reads the Golden Boot goal count back out of the English
sentence with `^(\d+) goals$`, written by `season-recap.ts:87` as
`` `${topScorerGoals} goals` ``. The function's own comment admits the coupling
and says an unparseable detail "counts zero rather than throwing". So translating
that one string to `"22 goles"` does not throw, does not fail a gate, and does
not look wrong — it silently zeroes every career top-scorer total in the Hall of
Fame.

No gate elsewhere in this spec would catch it: the key resolves, the placeholder
count matches, the glyphs exist, the budget holds. **Fix it by persisting an
optional numeric `goals` alongside the sentence**, reading the number when
present and keeping the regex only as the legacy path for saves written before
the change. Do this in the same task as the rest of §4.3, not later.

This is also a general warning for the extraction: **before keying any string,
check whether anything parses it.** A grep for the English literal across
`src/` is the cheap version of that check, and it is the only thing that would
have surfaced this one.

`sponsorName` and club names on these schemas are names, not prose, and are not
translated (§10).

**One rendering rule covers all eleven:** a persisted snapshot renders through a
content-id or key lookup; the stored English is the legacy fallback for careers
saved before this change. Surfaces 5–7 and 11 already persist the content id
they came from, so their lookup needs no new field at all — only a renderer that
prefers the id over the frozen string.

`seasonRecap.cupResult` (10) is the awkward one: it is a *denormalised* string
that mixes an outcome word with a round label, and §3's claim that "cup round
labels are already an enum" covers `rounds[].label` but not this sibling.

**It does not become a `{ outcome, round }` object**, which an earlier draft
proposed. The codec requires a string today (`game-state-codec.ts:1163`), so
replacing the type would break every existing recap and would need a real
`GAME_SCHEMA_VERSION` bump with a migration — contradicting the
optional-fields-need-no-bump reasoning below, which only holds for genuinely
optional *additions*. Instead: **keep `cupResult` a required string** and add
optional `cupOutcome` / `cupRound` siblings beside it. New saves write all
three; the UI prefers the structured pair; old saves keep rendering their
English.

**Two rules the implementation must not get wrong:**

1. **Always dual-write.** `label` stays `nonemptyString` and stays **required**.
   New rows write the English `label` *and* `labelKey` + `labelParams`. A writer
   that emits only keys fails validation on its own schema. The UI prefers
   `labelKey` and falls back to `label`.
2. **`labelParams` carries raw values, never formatted text.** Store
   `{ fee: 240000 }`, not `{ fee: "$240,000" }`. Formatting is a display concern
   (§3.4) — preformatting freezes one locale's thousands separator and currency
   placement into SQLite, which is the exact bug this section exists to prevent.
   Note `career.ts:836-1004` shows `labelParams` must also carry *names* —
   sponsor, player, facility — and that `FACILITY_CATALOG[...].name` needs keys
   of its own.

**On schema versions, precisely.** Adding *optional* `labelKey` / `labelParams`
fields to the four `strictObject` schemas requires new schema declarations but
**no `GAME_SCHEMA_VERSION` bump and no migration rung** — old saves parse
unchanged, because nothing has to be synthesised for them (the ladder at
`game-state-codec.ts:2764-2786` exists for that case, and this is not that
case). An earlier draft said "needs a codec schema bump", which was ambiguous
and is corrected here.

Do **not** relax those `strictObject` schemas to `.passthrough()` to avoid
thinking about it. Silently dropping unknown keys is worse than a declaration.

**Event outcomes have no ids, and that is a trap.** Outcomes in
`content/events.json` are anonymous weighted entries (`weight`, `text`,
`successHeadline`) with no `id`. Keying their translations by array index means
a future reordering silently reassigns every translated outcome to the wrong
event branch — a corruption that no CI gate above would catch, because every
key would still resolve. **Add explicit `id` fields to event outcomes in
Phase 1**, before any outcome is translated. A frozen-order CI assertion is the
weaker alternative and should only be taken if adding ids proves to break
something.

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

- **The picker lists `ENABLED_LOCALES`, not all seven.** During Phase 1 that is
  one row; each translation phase adds one. Offering a language whose catalog is
  empty means offering a menu item that visibly does nothing — English fallback
  makes that *safe*, not *honest*. The mock above is the finished state.
- Each language is written **in itself**, never "Spanish".
- **"Tiếng Việt" cannot render in Silkscreen** — it contains `ế` and `ệ`, two of
  the glyphs §4.1 proves are missing. That one row must draw in the Vietnamese
  face (or the `body` face) **in every locale**, or the picker itself exhibits
  the mid-word typeface substitution this whole section exists to prevent. The
  row is a per-language literal, so it carries its own face rather than
  inheriting the active one.
- English is preselected. First launch may *suggest* the device language by
  scrolling it into view, but never auto-applies it — the owner asked for
  English as the default and a silently-Spanish first launch is worse than a
  tap.
- Selecting a language re-renders the screen immediately, so the choice is
  self-demonstrating.
- The panel collapses to a single tappable row showing the current language;
  tapping expands the list. On the phone layout this keeps the screen from
  growing a seventh scroll section.

**A non-English player reads several English screens first, and that is
accepted.** Title → story → assistant-mode choice → welcome all render before
`CharacterCreationScreen` (`App.tsx:1640-1687`). The owner asked for the picker
on the signing screen, so that is where it goes; the consequence is recorded
here rather than discovered later. If it grates in device QA, the cheap fix is a
globe icon on the title screen writing the same preference — noted as a
follow-up, not built speculatively.

**Secondary placement: Settings.** `SettingsOverlay` gets the same control, so
the choice is changeable mid-career and is not a one-time trap.

**Persistence.** A `language: Locale` field on `AppPreferences`, defaulting to
`'en'`. `PREFERENCES_SCHEMA_VERSION` (`preferences-repository.ts:13`) is
**already 9**, so this bumps it to **10**.

**There is a trap here that would reset every player's settings.** The legacy
schemas for versions 3–8 are not written out — they are *derived* from the
current schema with `.omit()` (`preferences-repository.ts:129` onward, e.g.
`PreferencesSchema.omit({ seenPowerCutIns: true, autoSubs: true, ... })`).
Adding a **required** `language` to the base therefore silently adds it to every
legacy schema, so a real version-8 row — which has no `language` — fails
validation, and the fail-soft path (`application/preferences.ts:24`) responds by
discarding the row and resetting *all* settings to defaults.

Worse, the existing migration tests build their old-version fixtures **from
`DEFAULT_APP_PREFERENCES`** (`preferences-repository.test.ts:79`), so those
fixtures would quietly acquire `language` too and the suite would stay green
while shipping the reset.

The fix is to stop deriving and start freezing:

1. **Freeze an explicit `V9PreferencesSchema`** — the current shape, written out,
   with no `language` — instead of letting version 9 inherit from the live base.
2. Version 10 is `V9PreferencesSchema.extend({ language: z.enum(LOCALES) })`.
3. Add a **literal** version-9 fixture with no `language` field, hand-written
   rather than spread from defaults.
4. Add literal fixtures for versions 1–8 too. They are missing today, which is
   why this class of bug can reach a device at all.

Name the new rung after the feature version 9 *already had*, following the
existing convention (`CLIMB_COMPLETED_..._VERSION = 8` parses rows that have
`climbCompleted`): the version-9 rung parses rows that have `developerMode` but
not `language`, so it is `DEVELOPER_MODE_PREFERENCES_SCHEMA_VERSION = 9`.

**One source of language state.** `GameApp` already owns preferences, loads them
asynchronously and queues saves (`App.tsx:481`, `:576`, `:1110`). A separate
Zustand locale slice would be a second copy needing bidirectional sync, and the
two would drift on the async load. The active locale is therefore **derived from
`preferences.language`** and nowhere else; `useCopy()` and `useFaces()` read
that one value. Changing language writes the preference, and everything else
follows from the re-render.

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

**Phase 0 — decide the Vietnamese face.** Render Vietnamese in Handjet (400 and
700) and VT323 at the game's real sizes and pick one (§11 decision 1). Handjet
is the recommendation; the check is aesthetic, not structural. The `vars()`
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
- **The 13 raw-`fontFamily` files (§4.1) converted to `useFaces()`**, and the
  device smoke test confirming a locale switch changes the face on the match
  screen — not just on className-styled chrome.
- **Explicit `id` fields added to event outcomes** in `content/events.json`
  (§4.3), before any outcome is translated.
- `CFBundleLocalizations` set in `app.json` (§10.1), so the one native rebuild
  this project needs happens here.

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
on font grounds, and failing early is cheaper. Handjet has different advances
from Silkscreen, so **every advance-mapped width shifts for `vi` alone** and
`LEAGUE_COLUMN_WIDTH` widens to the max across enabled locales (§4.2);
re-measurement is critical path here, not a follow-up.

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
5. **Glyph coverage — per voice, not per catalog.** Every character in a string
   must exist in the face that string will actually be drawn in. Checking the
   whole catalog against the pixel font is wrong in both directions:
   `PixelText.tsx:16` documents a third voice, `body`, that deliberately renders
   in the platform sans because "pixel fonts are exhausting to read" for long
   prose. Blanket-checking would reject valid body copy (an em dash in an event
   paragraph is fine) and would miss invalid pixel copy.

   So each key carries its **voice** (`display` / `data` / `body`), and the gate
   checks display and data keys against the locale's pixel face while exempting
   body keys. The voice is declarable per key-prefix — `event.*` and `bert.*`
   are body, `col.*` and `settings.*` are display — with per-key overrides.

   The gate also covers **formatter output**, which is not in the catalog at
   all: every locale's group separator, currency symbol and sign characters must
   exist in its face. That assertion is what catches a separator like U+202F
   that Silkscreen lacks (§3.4), without anyone reading a French screenshot.

6. **No hardcoded prose — a TypeScript AST check, not ESLint.** An earlier draft
   said ESLint. That violates a documented project rule: `README.md:10` states
   "There is no lint script — that's intentional, don't add one", and the repo
   carries no ESLint dependency. Adding one to satisfy a gate in this spec would
   be a unilateral reversal of an existing decision.

   Instead the check uses the **TypeScript compiler API**, which is already a
   dependency via `ts-jest`, and runs as a normal Jest test under `src/`. It
   parses each file to an AST and rejects JSX text nodes and prose string
   literals outside the catalog.

   Scope: `src/ui/`, `src/render/`, `src/application/`, **`src/game/`** and
   `App.tsx`. `src/game/` is included because §3 identifies game-layer prose as
   one of the three English-emitting layers; omitting it would let ledger labels
   quietly stay English. Exempt: `src/ui/dev-harness/`, `src/audit/`,
   developer-mode strings, and `throw new Error` messages (developer-facing).

   **It must also cover accessibility props.** There are 343
   `accessibilityLabel` / `accessibilityHint` strings outside tests and the dev
   harness. They are props, not JSX text nodes, so a rule written only against
   text nodes is structurally blind to them — and the result is VoiceOver
   reading English to players in six languages.

7. **Golden replay still matches, or the bump is deliberate.** The earlier
   wording — "localisation must not touch `ENGINE_VERSION`" — was a prohibition
   dressed as a test, and prohibitions do not catch anything. The real gate is
   the existing golden-replay snapshot: it either matches or it does not. If
   extraction changes control flow or RNG consumption (building a label that
   sized an array, branching on English text), the snapshot fails and that
   forces the version decision CLAUDE.md already requires. Expected outcome is
   no bump; the gate is what proves it rather than assuming it.
8. **Width tables per locale — and the row must still fit the phone.** Every
   `col.*` string in every enabled locale has a measured advance and fits its
   column, for that locale's face.

   Per-column fitting is necessary but **not sufficient**. Because the shared
   widths become a max across enabled locales (§4.2), the fixed columns can
   collectively grow until they crowd out the one flexible column —
   `squad-register-columns.ts:96` explicitly relies on the club/player column
   paying for every fixed-width increase, and the full league table already has
   seven non-shrinking columns (`LeagueTableScreen.tsx:40`). So the gate also
   asserts:

   ```
   sum(fixed widths) + padding + gutters + min(flexible column)
     <= smallest supported content width
   ```

   for both the phone and wide layouts.

   **Consequence worth stating plainly:** because widths are global maxima,
   enabling German or Vietnamese later can widen columns in the *English* game.
   Either compute the seven-locale maxima up front, before Phase 2, or re-run
   English layout acceptance after each locale is enabled. Computing up front is
   cheaper and is the recommendation.

9. **Locale invariance of the simulation.** The golden replay
   (`parity-replay.test.ts:60`) runs `src/sim/match` with fixed teams — it does
   not exercise career events, the economy, application formatting or save
   output, so it cannot by itself prove that language has no behavioural effect.
   Add a test that runs the same seeded career and the same input sequence under
   **every** language preference and compares the resulting `GameState` and match
   envelopes semantically. `language` stays out of career state entirely, which
   is what makes this test cheap to satisfy.

   Note also that a save-schema change is a separate concern from
   `ENGINE_VERSION` — `save-file.ts:34` already documents that split.

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
one-line reason and a **hash of everything the verdict depended on**: the key,
the English source, **the translated string itself**, the glossary version, and
the context (screen) description.

Hashing only the English — as an earlier draft did — leaves an obvious hole: a
translation could be edited after approval and keep its `ok`, because the
English it was judged against never moved. Including the target string closes
that. Including the glossary version means a terminology change re-opens the
strings it affects rather than silently grandfathering them.

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

### 10.1 Two native changes that are IN scope, and cost a rebuild

Both are easy to mistake for store metadata. Neither is.

- **`CFBundleLocalizations` in `app.json`.** Without it iOS reports the app as
  English-only and the App Store page does not list the seven languages, however
  well the in-app picker works. This is app config, not listing copy.
- **`expo-localization`, if the picker suggests the device language.** It is not
  in `package.json` today, so adding it is a new native dependency — which per
  this project's own phone-dev rules means a rebuild, not a Metro reload. If
  Open Decision 3 lands on "do not suggest", this dependency is not needed at
  all; that is a point in favour of not suggesting.

Both land in Phase 1 so the single rebuild covers them together.

---

### 10.2 This supersedes a prior decision

`README.md:153` records "localization beyond English — post-launch" as a
canonical decision. This spec reverses it at the owner's request. The README
entry must be updated in Phase 1 rather than left contradicting the plan of
record — a decision log that disagrees with the code is worse than no log.

---

## 11. Open decisions

1. **VT323 vs Handjet** for Vietnamese — **Handjet recommended**, on structural
   grounds: it ships 400 and 700 cuts and so preserves the game's two type
   voices, where VT323's single weight would collapse them (§4.1). What remains
   open is purely aesthetic — Handjet's dots versus Silkscreen's solid blocks —
   and Phase 0 settles it by rendering one real Vietnamese screen. Choosing
   VT323 anyway means consciously accepting one weight for Vietnamese.
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
