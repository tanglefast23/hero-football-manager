You are one of three independent council reviewers auditing a design spec for Hero Football Manager — an Expo/React Native pixel-art football management sim (Kairosoft-style). Everything you need is inlined below; do NOT use tools, just read and review.

Critique HARD, numbered findings ordered by severity, citing the file/line evidence given below:
1. Correctness — will this deliver seven languages without regressing the English game?
2. Save compatibility — S4.3 adds labelKey/labelParams siblings to persisted labels. Safe? Any persisted-English surface the spec MISSED?
3. Determinism / ENGINE_VERSION risk.
4. Vietnamese font swap (S4.1) — NativeWind v4 vars() for fontFamily on iOS native. Sound? What breaks?
5. Fixed-width layout clipping (S4.2) — sufficient, given the measured-advance tables THROW on unmeasured strings?
6. CI gates (S8) — implementable in this Jest setup (testEnvironment node, roots ['<rootDir>/src'], react-native cannot be required, no jsdom)?
7. Translation quality audit (S9) — genuinely enforceable, or theatre? Be blunt.
8. Missing or over-engineered scope. What should be CUT?

Plain prose. No JSON. Final line must be exactly APPROVED or REVISE.

===== THE SPEC =====
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

This needs a **spike before the plan is committed**: confirm `fontFamily`
resolves through a CSS variable on iOS native, not just on web. If it does not,
the fallback is registering VT323 under the family names `Silkscreen_700Bold` /
`Silkscreen_400Regular` at boot — same zero-call-site-churn result, but a
language change then requires an app relaunch.

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

Mitigations, in order of preference:

1. The §1 character budget, enforced in CI. This prevents most of it.
2. Short forms for the worst offenders — table headers stay 1–3 characters in
   every language (`PTS` → `PKT` in German, `PTS` in Spanish, `Đ` in
   Vietnamese), declared per locale rather than translated.
3. Re-measure the advance tables per face. VT323 is monospace, which makes the
   Vietnamese measurement a single number rather than a per-string table.
4. Where a cell genuinely cannot hold a language, the layout changes for every
   language, not just that one — one layout, seven fills.

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

===== REPO EVIDENCE =====
--- CLAUDE.md (project rules) ---
# Hero Football Manager — Project Context

Kairosoft-style soccer club management sim with superpowered players. iOS-first (paid ~$0.99), Expo/React Native. Currently in planning → early build phase.

## Read first

- `README.md` — decision log + doc index. All design decisions live in `docs/01`–`docs/10`.
- `research/` — background research reports (Kairosoft economics, match presentation, stack analysis). Reference, not canon; the docs are canon.

## Non-negotiable architecture rules

- `src/sim/` (match engine) and `src/game/` (season/economy/events) are **pure TypeScript**: no React Native, Skia, or Expo imports, no `Math.random`/`Date.now` — a seeded PRNG (mulberry32) is injected. Everything in these rings must be Jest-testable headless and deterministic (same seed = byte-identical results).
- Match rendering uses react-native-skia's **Atlas batched API** — never one component per sprite (known perf trap).
- Game content (powers, events, drills, sponsors, archetypes, names) is typed JSON in `content/`, zod-validated. New content ships as data, not code.
- Balance changes must keep the CI balance-harness assertions passing (see `docs/09-tech-stack.md`).
- Any replay-affecting sim change (behavior, tuning, or RNG consumption) must bump `ENGINE_VERSION` in `src/sim/match.ts`. The golden-replay snapshot update is the forcing reminder — never update that snapshot without a version decision.

## Preview & QA hygiene (no background game audio)

- The web build auto-plays looping music, and browser-pane tabs + `serve`/dev-server processes outlive your turn — a forgotten preview plays game audio through the Mac speakers indefinitely.
- Immediately after loading any web preview of the game, mute it (via javascript_tool): `document.querySelectorAll('audio,video').forEach(el => { el.muted = true; })`. If sound persists (Web Audio can't be muted from outside), navigate the tab to `about:blank` between checks.
- When QA is done, ALWAYS close the preview tab and stop any `serve`/static/dev-server process you started. Same for simulators: shut down a simulator you booted once you're finished with it. Never leave a running game tab or booted sim behind at the end of a turn.

## Phone dev server (Joe's physical iPhone)

The phone runs a **Debug build with no embedded JS** — it fetches everything from Metro on the Mac, so anything merged to main reaches the phone with a reload, never a rebuild. The recurring traps:

- **Start Metro only via `scripts/phone-dev-server.sh`, in a user-owned Terminal**: `osascript -e 'tell application "Terminal" to do script "/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager/scripts/phone-dev-server.sh"'` (Joe can also run `npm run phone` in his own Terminal). Servers started from a Claude Bash call get reaped within minutes — even nohup'd/detached ones. The script hardcodes the MAIN folder + port 8081, so it serves main even when launched from a worktree. Verify: `curl -s localhost:8081/status` → `packager-status:running`.
- **Ship-to-phone loop**: merge to main → `git pull` in the MAIN folder → reload the app on the phone (reopen it, or shake → Reload). Rebuild ONLY for native changes (new native dependency, Expo SDK bump, native app.json settings) or the IP re-bake below.
- **Redbox "No script URL provided … (null)" = stale baked IP, not a Metro problem.** The Mac's LAN IP is baked into the .app (`ip.txt`) at build time, and DHCP flaps it between 192.168.1.23 and .24 (broke 2026-07-28 AND 2026-07-29). Diagnose in one step: `ipconfig getifaddr en0` vs `cat ~/Library/Developer/Xcode/DerivedData/HeroFootballManager-*/Build/Products/Debug-iphoneos/HeroFootballManager.app/ip.txt`. Fix: rebuild to the plugged-in phone (re-bakes ip.txt). Stopgap Joe can run himself (needs sudo): `sudo ifconfig en0 alias <baked-ip> 255.255.255.255`. Durable cure: a DHCP reservation for the Mac in the router.
- **Phone drops mid-session** → another session's iOS build likely seized port 8081 (`lsof -nP -iTCP:8081 -sTCP:LISTEN`). Restart via the script; after any server death the phone needs one app reopen — a reload broadcast can't reconnect it.
- **Never infer what's on the phone from build artifacts on disk** (`Release-iphoneos` leftovers lie). Shake the phone: a React Native Dev Menu proves a Debug build talking to Metro.

## Key design facts (don't re-litigate casually)

- Matches auto-play, 3–4 real minutes watched; heroes build Heat, bank it until an authored opportunity, then enter "the Zone" (a full-intensity glow that holds until the context arrives — m1.27 removed the countdown, so an unused Zone never fades or refunds Heat). **Powers always fire automatically** — in-context at 85%, the only firing grade in the shipped game. There is no manual hero tap and no M/A toggle (removed 2026-07-25; the sim keeps POWER_TAP and SAVE_FOR_TAP as test instrumentation only). Teammate powers advance independently and may overlap; the phone match HUD shows one takeover card plus a "+N more heroes live" count, while the desktop rail shows up to four persistent hero tiles as the Hero License cap grows. The player's live inputs are Formation, Playstyle, Swap, and Energy Use — all recorded, so a watched match stays deterministic (same seed + same inputs) without being predetermined. Quick Result runs the same engine and now resolves identically to an unattended watch.
- Powers: 17 ship at launch (Magnet Touch cut at M4 by measurement; catalog in content/powers.json is canon), Hero License field caps (2→4), GK Resolve prevents one-shot goals, wind-ups are interruptible, cut-ins skippable after first view. Timing-sensitivity principle: effects are visible possession/geometry spikes, never stat smears.
- Economy: Money + Training Points — exactly one job each; no new currencies.
- Salaries weekly; awakened players keep old wage until renewal, then ×3–5 hero rates.
- Art: B+ "heroic chibi" pixel sprites + comic FX + broadcast dressing; paper-doll customization layers.
- Fail-soft economy (warnings → one loan → forced sale), never game over.
--- jest.config.js ---
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // .tsx too, or a component test would be collected by nothing and silently
  // never run.
  testMatch: ['**/__tests__/**/*.test.@(ts|tsx)'],
  // Transpile-only (no type-checking during the test run) so the acceptance
  // gates parallelize across workers without each one re-typechecking every
  // file it imports. The type gate is npx tsc --noEmit, run separately in CI
  // and before every commit here — this is not a substitute for it.
  transform: {
    // tsconfig.json extends expo/tsconfig.base (module: "preserve", allowJs: true)
    // for Metro's bundler. Two overrides needed only for ts-jest's own transform,
    // the app's real tsconfig is untouched: (1) module: "preserve" isn't runnable
    // CommonJS, which Jest needs; (2) allowJs makes ts-jest default outDir to an
    // internal constant, and TS 6 hard-errors (TS5011) on outDir without an
    // explicit rootDir — set rootDir to the project root to satisfy that.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', rootDir: '.', isolatedModules: true } }],
  },
  // Binary media assets (require('*.wav'/'*.m4a')) can't load as JS modules under
  // Jest — Metro handles them in the app. Stub them so audio.ts (and its pure
  // event→sound mapping) is importable in tests.
  moduleNameMapper: {
    '\\.(wav|m4a)$': '<rootDir>/src/render/__tests__/__mocks__/assetStub.js',
  },
  // Long-running measurement probes are opt-in via `npm run test:probe -- <path>`.
  // Keep the acceptance-seed audit test in the normal suite.
  testPathIgnorePatterns: ['<rootDir>/src/audit/__tests__/.*-probe\\.test\\.ts$'],
};
--- tailwind.config.js fontFamily ---
        stamp: '#d94f52', // red — cancel / danger / negative
        sky: '#a3c8f0', // light blue — eyebrows / accents on dark
      },
      fontFamily: {
        // Silkscreen bitmap pixel font — the game's display/label voice.
        // Loaded at runtime in App.tsx via @expo-google-fonts/silkscreen.
        mono: ['Silkscreen_400Regular'],
        pixel: ['Silkscreen_700Bold'],
      },
    },
  },
  plugins: [],
};
--- src/ui/components/PixelText.tsx ---
import { Text, type TextProps } from 'react-native';

/**
 * The three type voices from docs/11-art-style.md, in one place.
 *
 * React Native does not inherit `fontFamily` through a `<View>`, so every text
 * node has to name its own face. A bare `<Text>` therefore renders in SF Pro /
 * Roboto — the OS font, inside a pixel-art game. This component exists so a
 * call site picks a *voice* instead of remembering a class name.
 *
 * - `display` (default) — Silkscreen **Bold**. Buttons, labels, headings,
 *   eyebrows, chips, table headers. Per the art bible this is the game's
 *   default voice, which is why it is the default variant here.
 * - `data` — Silkscreen Regular. Money, stats, scores, table cells: anything
 *   that has to line up in a column.
 * - `body` — no pixel face at all, i.e. the platform sans. Long prose is
 *   deliberately *not* pixel type ("pixel fonts are exhausting to read").
 *
 * Never add `font-bold` on top of these. Silkscreen ships one weight per file,
 * so a bold request on the regular cut produces synthetic faux-bold, which
 * smears a 1-bit bitmap font. `display` already *is* the bold cut.
 */
export type PixelTextVariant = 'display' | 'data' | 'body';

const VARIANT_CLASS: Record<PixelTextVariant, string> = {
  display: 'font-pixel',
  data: 'font-mono',
  body: '',
};

export type PixelTextProps = TextProps & {
  variant?: PixelTextVariant;
  className?: string;
};

/**
 * The variant class is emitted *before* the caller's className so a call site
 * can still override the face for a one-off (NativeWind resolves conflicting
 * utilities last-wins). The font is applied via className and never via
 * `style`, because mixing the two for one visual property lets either win
 * unpredictably on native.
 */
export function PixelText({ variant = 'display', className, ...props }: PixelTextProps) {
  const face = VARIANT_CLASS[variant];
  const merged = className === undefined || className.length === 0
    ? face
    : face.length === 0
      ? className
      : `${face} ${className}`;

  return <Text {...props} className={merged.length === 0 ? undefined : merged} />;
}
--- src/ui/league-table-columns.ts (first 130 lines) ---
/**
 * How wide each fixed column of the league table has to be, in points.
 *
 * Same derivation, and the same two traps, as `squad-register-columns.ts`:
 *
 * 1. NativeWind resolves `1rem` to React Native's 14pt, so `w-9` is 31.5pt and
 *    `w-7` is 24.5 — not the 36 and 28 the class names imply. All four columns
 *    were sized by those names and all four were too narrow.
 * 2. Text grows with the reader's iOS text size, up to 1.6 by default.
 *
 * Measured on Joe's phone at ordinary text size, two were already wrapping:
 * "PTS" broke to "PT" over a lone "S" (needs 29.8pt of a 31.5pt column, and
 * loses the margin to any rounding), and a "+10" goal difference broke to "+1"
 * over "0" (needs exactly 31.5 of 31.5). The club name is the only flexible
 * column and pays for the fix; it has room to spare.
 *
 * `league-table-columns.test.ts` re-runs the arithmetic below, so a width
 * cannot quietly stop fitting again.
 */

/**
 * Silkscreen Regular advances in em, read out of the shipped TTF's `hmtx`
 * table. Digits are 0.75em, "+"/"-" 0.75em, and uppercase varies — so these
 * are per-string totals for exactly the strings the table draws.
 */
export const LEAGUE_HEADER_ADVANCE_EM: Readonly<Record<string, number>> = {
  '#': 0.875,
  P: 0.75,
  W: 1.0,
  D: 0.75,
  L: 0.75,
  GD: 1.5,
  PTS: 2.125,
};

/** The widest value each column can ever be asked to draw. */
export const LEAGUE_CELL_ADVANCE_EM: Readonly<Record<string, number>> = {
  // Ten clubs to a division, so a two-digit position is the ceiling.
  '10': 1.5,
  // Eighteen league matches in a season; "30" leaves room for a longer format.
  '30': 1.5,
  // Goal difference is the only signed column, and the one that was wrapping.
  '+10': 2.25,
  '+40': 2.25,
  // Eighteen wins is 54 points, so two digits with headroom for three.
  '54': 1.375,
};

/** `text-sm`, which NativeWind resolves to 0.875rem = 12.25pt. */
export const LEAGUE_HEADER_FONT_SIZE = 12.25;

/**
 * Cell sizes by column. Position and points are `text-base` (1rem = 14pt)
 * because they are the two numbers a manager scans for; played and goal
 * difference are `text-sm`.
 */
export const LEAGUE_CELL_FONT_SIZE = {
  position: 14,
  played: 12.25,
  won: 12.25,
  drawn: 12.25,
  lost: 12.25,
  goalDifference: 12.25,
  points: 14,
} as const;

/**
 * How far a header may grow with the reader's text size.
 *
 * Tighter than the cells for the reason the register gives: an abbreviation
 * labelling a fixed column cannot grow without pushing its neighbour off the
 * row, and what it stands for is on its InfoTip at any size. 1.25 clears the
 * xxLarge multiplier (1.235), so ordinary large text renders unchanged.
 */
export const HEADER_MAX_FONT_MULTIPLIER = 1.25;

/**
 * The values are allowed the app's full range. A number the manager is reading
 * is exactly what a larger text size is for, so the column carries the growth
 * rather than the reader losing the number.
 */
export const CELL_MAX_FONT_MULTIPLIER = 1.6;

/** Clear space between a column and the one beside it, at the size cap. */
export const COLUMN_MIN_GUTTER = 4;

/**
 * Fixed column widths, each the larger of its header demand and its widest
 * value demand, rounded up onto the four-point grid.
 */
export const LEAGUE_COLUMN_WIDTH = {
  // Won, drawn and lost appear only on the full table screen. Same demand as
  // played: a two-digit count at full text scale.
  won: 36,
  drawn: 36,
  lost: 36,
  // "10" at full text scale wants 37.6.
  position: 40,
  // "30" wants 33.4.
  played: 36,
  // "+40" wants 48.1 — the column that was visibly breaking.
  goalDifference: 52,
  // Header-bound, not value-bound: "PTS" at the 1.25 cap wants 36.5 against
  // "54"'s 34.8. The only column here whose label is wider than its numbers.
  points: 40,
} as const;

export type LeagueColumn = keyof typeof LEAGUE_COLUMN_WIDTH;

/** Width a header needs at its size cap, plus the gutter to its neighbour. */
export function leagueHeaderWidthDemand(label: string): number {
  const advanceEm = LEAGUE_HEADER_ADVANCE_EM[label];
  if (advanceEm === undefined) {
    throw new Error(`No measured Silkscreen advance for the header "${label}"`);
  }
  return advanceEm * LEAGUE_HEADER_FONT_SIZE * HEADER_MAX_FONT_MULTIPLIER + COLUMN_MIN_GUTTER;
}

/** Width a value needs at the reader's largest text size, plus the gutter. */
export function leagueCellWidthDemand(value: string, column: LeagueColumn): number {
  const advanceEm = LEAGUE_CELL_ADVANCE_EM[value];
  if (advanceEm === undefined) {
    throw new Error(`No measured Silkscreen advance for the value "${value}"`);
  }
  return advanceEm * LEAGUE_CELL_FONT_SIZE[column] * CELL_MAX_FONT_MULTIPLIER + COLUMN_MIN_GUTTER;
}
--- src/persistence/preferences-repository.ts lines 1-120 ---
import { z } from 'zod';
import {
  COACHING_FORMATION_IDS,
  DEFAULT_FORMATION_PRESETS,
  FORMATION_IDS,
  isFormationId,
  type FormationId,
} from '../sim/tactics';
import type { PersistenceDatabase } from './database';
import type { PowerId } from '../sim/types';
import { migrateDatabase } from './migrations';

const PREFERENCES_SCHEMA_VERSION = 9;
const LEGACY_PREFERENCES_SCHEMA_VERSION = 1;
const M2_PREFERENCES_SCHEMA_VERSION = 2;
const M4_PREFERENCES_SCHEMA_VERSION = 3;
const CUT_IN_HISTORY_PREFERENCES_SCHEMA_VERSION = 4;
const MANAGER_TIPS_PREFERENCES_SCHEMA_VERSION = 5;
const AUTO_SUBS_PREFERENCES_SCHEMA_VERSION = 6;
const SQUAD_SORT_PREFERENCES_SCHEMA_VERSION = 7;
const CLIMB_COMPLETED_PREFERENCES_SCHEMA_VERSION = 8;
const PRIMARY_SLOT = 1;

export type MasterVolume = 0 | 0.25 | 0.5 | 0.75 | 1;
export type HudSide = 'left' | 'right';
export type TextScale = 1 | 1.15 | 1.3;
export type CutInMode = 'full' | 'banner';
export const SQUAD_SORT_KEYS = ['role', 'player', 'overall', 'potential', 'condition'] as const;
export type SquadSortKey = (typeof SQUAD_SORT_KEYS)[number];
export type SquadSortDirection = 'descending' | 'ascending';

/** How the squad list is ordered. Null is the roster's own order. */
export interface SquadSort {
  key: SquadSortKey;
  direction: SquadSortDirection;
}

export interface AppPreferences {
  formationPresets: [FormationId, FormationId, FormationId];
  autoPowers: boolean;
  masterVolume: MasterVolume;
  reduceMotion: boolean;
  hudSide: HudSide;
  hapticsEnabled: boolean;
  textScale: TextScale;
  highContrast: boolean;
  colorSafeKits: boolean;
  cutInMode: CutInMode;
  /** Device-level proof used to offer the veteran-only new-career choice. */
  climbCompleted: boolean;
  seenPowerCutIns: PowerId[];
  /** Bench cover during a watched match, remembered between matches. */
  autoSubs: boolean;
  /** Squad list ordering, remembered between visits and between sessions. */
  squadSort: SquadSort | null;
  /** Debug-build-only switch for developer save controls. */
  developerMode: boolean;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  formationPresets: [...DEFAULT_FORMATION_PRESETS],
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

const FormationSchema = z.enum(FORMATION_IDS);
// Retired ids stay parseable so an older install's settings row still loads;
// they are dropped on the way through rather than rejected.
const RETIRED_POWER_IDS = ['MAGNET_TOUCH'] as const;
const PowerIdSchema = z.enum([
  'SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN', 'PORTAL_PASS',
  'DECOY_DOUBLE', 'FUTURE_SIGHT', 'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
  'RALLY_CRY', 'ICE_RINK', 'SHADOW_MARK', 'GRAVITY_WELL', 'GIANT_GK', 'GUST',
]);
const StoredPowerIdSchema = z.enum([...PowerIdSchema.options, ...RETIRED_POWER_IDS]);
const PreferencesSchema = z.strictObject({
  formationPresets: z.tuple([FormationSchema, FormationSchema, FormationSchema])
    .refine(values => new Set(values).size === 3, 'formation presets must be unique'),
  autoPowers: z.boolean(),
  masterVolume: z.union([z.literal(0), z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)]),
  reduceMotion: z.boolean(),
  hudSide: z.enum(['left', 'right']),
  hapticsEnabled: z.boolean(),
  textScale: z.union([z.literal(1), z.literal(1.15), z.literal(1.3)]),
  highContrast: z.boolean(),
  colorSafeKits: z.boolean(),
  cutInMode: z.enum(['full', 'banner']),
  climbCompleted: z.boolean(),
  seenPowerCutIns: z.array(StoredPowerIdSchema).max(20)
    .transform(ids => ids.filter((id): id is z.infer<typeof PowerIdSchema> => (
      !(RETIRED_POWER_IDS as readonly string[]).includes(id)
    )))
    .refine(values => new Set(values).size === values.length, 'seen power cut-ins must be unique'),
  autoSubs: z.boolean(),
  squadSort: z.union([
    z.null(),
    z.strictObject({
      key: z.enum(SQUAD_SORT_KEYS),
      direction: z.enum(['descending', 'ascending']),
    }),
  ]),
  developerMode: z.boolean(),
});
const LegacyPreferencesSchema = PreferencesSchema.pick({
  formationPresets: true,
  autoPowers: true,
  masterVolume: true,
});
--- game-state-codec.ts: persisted label schemas ---
const ledgerLineRevealSchema = z.discriminatedUnion('source', [
  gateRevealSchema,
  merchRevealSchema,
]);

const ledgerLineSchema = z
  .object({
    kind: z.enum([
      'tickets',
      'sponsor',
      'buzz',
      'prize',
      'merch',
      'training',
      'facilities',
      'wages',
      'subsidy',
      'emergency-loan',
      'board-sale',
      'loan-repayment',
      'board-rescue',
    ]),
    label: nonemptyString,
    amount: safeInteger,
    idempotencyKey: nonemptyString.optional(),
  })
  .passthrough();

const ledgerSchema = z
  .object({
    season: positiveInteger,
    week: positiveInteger,
    lines: z.array(ledgerLineSchema),
    balanceAfter: safeInteger,
  })
  .passthrough();

const cashTransactionSchema = z.object({
  id: nonemptyString,
  season: positiveInteger,
  week: positiveInteger,
  kind: z.enum([
    'facility-build',
    'facility-upgrade',
    'facility-relocation',
    'facility-closure',
    'training-upgrade',
    'scouting',
    'transfer-buy',
    'transfer-sell',
    'youth-signing',
    'coach-hiring',
    'coach-dismissal',
    'player-request',
    'event',
    'balance-adjustment',
  ]),
  label: nonemptyString,
  amount: safeInteger.refine(value => value !== 0, 'must be non-zero'),
  // Signed, like `ledgerSchema` above. Every kind here used to be a purchase,
  // which a club can only make with money, so the balance left after one was
  // always positive. Closing a facility is a credit and is deliberately
  // reachable while the club is under water — the difficulty cash floor parks
  // it at -15,000 or -30,000 — so the balance after one can be negative.
  balanceAfter: safeInteger,
  referenceId: nonemptyString.optional(),
}).passthrough();

...
    }),
  }),
  objectives: z.array(z.strictObject({
    id: nonemptyString,
    kind: sponsorObjectiveKindSchema,
    labelTemplate: nonemptyString,
    targets: z.strictObject({
      EASY: positiveInteger,
      NORMAL: positiveInteger,
      HARD: positiveInteger,
    }),
    chairmanDelta: safeInteger,
  })),
});

const sponsorObjectiveSnapshotSchema = z.strictObject({
  kind: sponsorObjectiveKindSchema,
  label: nonemptyString,
  target: positiveInteger,
  nominalBonus: nonnegativeInteger,
});

const sponsorObjectiveOutcomeSchema = z.strictObject({
...
    fansLost: nonnegativeInteger,
  }).passthrough(),
]);

const seasonRecapAwardSchema = z.object({
  playerId: nonemptyString,
  playerName: nonemptyString,
  label: nonemptyString,
  detail: nonemptyString,
}).passthrough();

const divisionAwardPlacementSchema = z.object({
  playerId: nonemptyString,
  playerName: nonemptyString,
  clubId: nonemptyString,
  value: nonnegativeInteger,
--- grep: user-facing strings originating in src/sim/ ---
src/sim/tactics.ts:46:  '4-4-2': 'Balanced lines',
src/sim/tactics.ts:47:  '4-3-3': 'Wide attack',
src/sim/tactics.ts:48:  '3-5-2': 'Midfield shield',
src/sim/tactics.ts:49:  '5-3-2': 'Deep counter',
src/sim/tactics.ts:50:  '4-5-1': 'Crowd midfield',
--- grep: unpinned toLocaleString ---
src/application/view-models.ts:560:          lastSettlementLabel: `Reached ${state.clubBusiness.buzz.lastSettlementSummary.prePayoutValue} · Paid $${state.clubBusiness.buzz.lastSettlementSummary.payout.toLocaleString()} · Reset to 0`,
src/application/event-selection.ts:189:    return `Requires $${requirements.minMoney.toLocaleString()} cash`;
src/application/store.ts:1482:                ? `${signed.sponsorName} signed for $${signed.nominalMonthlyFee.toLocaleString()} per month.`
src/application/store.ts:1483:                : `${signed.sponsorName} signed. Contract $${signed.nominalMonthlyFee.toLocaleString()} per month; the club receives $${actualSigned.toLocaleString()} on Chairman.`,
src/application/store.ts:1665:            }$${Math.abs(net).toLocaleString()} net cash.`,
src/application/store.ts:1680:            : `${FACILITY_CATALOG[building.type].name} closed. $${refund.toLocaleString()} recovered.`,
src/application/store.ts:1776:          message: `${buyer?.name ?? 'The buying club'} signed the player for $${bid.quote.fee.toLocaleString()}.`,
