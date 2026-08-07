# The last three English surfaces — implementation plan

Date: 2026-08-07
Spec: `docs/superpowers/specs/2026-08-07-last-three-english-surfaces.md` (twice reviewed)
Status: draft, for review by Grok 4.5 and Claude Fable 5

Order is **C → B → A**, confirmed by both reviewers. Each phase lands and is
verified before the next begins, so a failure never spans two phases.

---

## Render-site audit (prerequisite, DONE)

Fable made this a condition of choosing leaf overrides over voice inference: the
leaf list must come from reading render sites, not from reasoning about key
names. Done, and it is recorded here so the plan is auditable.

**`StoryEventScreen.tsx`** — every text node classified:

| Draws | Face | Line | Voice |
| --- | --- | --- | --- |
| `event.<id>.title` | `font-pixel text-2xl` | :277 | **display** |
| `event.<id>.<choice>.label` | `PixelText` | :412 | **display** |
| outcome `headline` | `font-pixel text-2xl` | :192-195 | **display** |
| `viewModel.categoryLabel` | `font-pixel` | **:252 and :273** | **display**, unkeyed |
| `kicker` | `font-pixel` | :185-190 | already `storyEvent.*` chrome — fine |
| `event.<id>.body` | sans, `scaledBody` | :293 | body, correct |
| `outcomeText` | sans | :197 | body, correct |
| `choice.detail`, `consequenceHint`, `disabledReason` | sans | :413-414 | body, correct |

**`GlossaryPanel.tsx`**:

| Draws | Face | Line | Voice |
| --- | --- | --- | --- |
| `glossary.clubHandbook` | `PixelText` | :42 | **display** |
| `glossary.<cat>.title` | `font-pixel` | :71 | **display** |
| `glossary.noMatches` | sans | :67 | body, correct |
| `glossary.<cat>.<slug>.term` / `.definition` | sans | :80-81 | body, correct |

Two things the audit changed versus the spec: `categoryLabel` is drawn at **two**
sites, not one, and the `kicker` needed tracing before it could be ruled out.
Neither was knowable from key names.

**Measured:** 206 pixel-drawn leaves of 508 `event.*` + `glossary.*` keys.

---

## Phase C — the gate stops missing the loudest text

### C1. Leaf-aware voice overrides

`src/i18n/voice.ts`: add a `DISPLAY_LEAVES` list checked **before** the body
prefixes. Each entry carries its render site as a comment, per Fable's
condition — an override without a citation is an assertion.

```
/^event\.[^.]+\.title$/                      // StoryEventScreen.tsx:277
/^event\.[^.]+\.[^.]+\.label$/               // StoryEventScreen.tsx:412
/^event\.[^.]+\.[^.]+\.[^.]+\.headline$/     // StoryEventScreen.tsx:192
/^glossary\.clubHandbook$/                   // GlossaryPanel.tsx:42
/^glossary\.[^.]+\.title$/                   // GlossaryPanel.tsx:71
```

### C2. Three tests, one of which must be a negative control

1. Every key matching a display leaf resolves `voiceOf === 'display'`.
2. Known body leaves stay body — `event.*.body`, `event.*.*.*.text`,
   `glossary.*.*.term`, `glossary.*.*.definition`, `glossary.noMatches`. This is
   the guard against over-reach (spec risk 4).
3. **Negative control**: a string containing U+2026 in a display leaf must FAIL
   gate 5. Without this the gate can pass by checking nothing, which is the
   defect that started this workstream.

### C3. The drift test Fable suggested

**Keep it, timeboxed.** Both reviewers weighed in and split, and Fable's case
won: the one failure class every round of this workstream has hit is "another
pixel render site nobody listed", and C3 is the only guard against the next one.

Grok's objection is real and narrows the spec: the live call sites are template
literals — `` t(`event.${id}.title`) `` — not string literals, so a
literal-only scanner is a no-op. Spec it as: **the nearest enclosing JSX element
is `PixelText`, or its `className` source text contains `font-pixel`** — a
substring test, which also handles the ternary classNames at
StoryEventScreen:192-194.

Known limit, stated so it is never over-trusted: it cannot see view-model-composed
values, so a `categoryLabel`-class bug passes it. It complements the render-site
audit; it never replaces it.

Timebox: if this is not working within an hour, drop it — but only after C5 and
C4's renaming have landed, since those are the blocking items.

### C4. `categoryLabel` — the fifth finding

`view-models.ts:1243` composes `${event.rarity} ${event.category}`, drawn at
**two** pixel sites (:252, :273).

**Key names are `storyEvent.rarity.<id>` and `storyEvent.category.<id>` — NOT
`event.*`.** Fable caught that `event.` is a `BODY_PREFIXES` entry, so keys under
it would classify `body` and be skipped by the very gate C1 adds, *and* would
break gate 10 (a content key with no source file — these come from enums, not
from any content file). Verified: `event.rarity.rare` → `body`,
`storyEvent.rarity.rare` → `display`. Chrome keys in `en.json`, which is also
what `DIVISION_NAME_KEYS` actually does.

**Rendered as two separated tags: `RARE · MYSTERY`.**

Both reviewers rejected a naive `"{rarity} {category}"` template, for the same
reason I found independently: word order is not the failure mode, **agreement**
is. Spanish inflects the adjective for the noun's gender (`misterio raro` vs
`afición rara`); German declines it (`seltenes Mysterium` vs `seltener Verein`).
One `rarity.rare` word cannot agree with seven category nouns in four of six
languages, and no template fixes that.

Grok proposed the separator; Fable independently confirmed it works and needs
only 10 words instead of 21 pairs (126 strings). The separator turns an
adjective-noun phrase into two independent tags, which need no agreement — and
` · ` is already this game's house separator (`D5 · District League`,
`S1 · W3`), so it is not a new visual idea.

- 3 `storyEvent.rarity.*` + 7 `storyEvent.category.*` = 10 keys × 7 locales
- compose in the view model as `` `${rarity} · ${category}` ``
- content enums unchanged — they are ids
- only 14 of the 21 pairs actually ship, which is further reason not to key pairs

### C5. Gate 5 must also check ENGLISH content (F2 — blocking)

Gate 5 iterates `loadCatalog(locale).strings`. For `en` that is `en.json` chrome
**only** — English content prose is never glyph-checked, before or after C1. So a
new English event title containing `…` ships tofu with CI green, which is this
workstream's signature shape. Fix: for `en`, iterate `englishAll()`.

Without this, success criterion 4 is simply false.

### C6. Record the budget coupling (F3)

`budgetClass` reads `voiceOf`, so flipping these 206 leaves display moves them
from the `prose` budget to the tighter `boxed` one. Fable measured all 1,236
existing translations against the boxed formula: **0 break**, so the flip is safe
to land. But it must be a recorded decision, not an accident — every *future*
event title lands under the tighter ceiling, on titles that visibly wrap
(`text-2xl leading-8`).

Decision: accept `boxed` for now, with a comment stating the measurement and the
date. Revisit only with a measured overflow, per the `copy-budget.ts` rule.

### C7. Verify

`npx jest src/i18n src/ui src/application`, plus the negative control from C2
proving the gate can fail.

## Phase B — personalities, archetypes, cut-scene, drill card

### B1. Split the archetype code from its copy (FIRST — nothing else in B before this)

`ARCHETYPE_DEVELOPMENT` is keyed by English display name and the name is a
**persisted zod enum**, so the enum stays and the display becomes a lookup:

- key the table by the enum value (unchanged strings, but explicitly the *id*)
- add `archetype.<id>.name` keys for display
- the `+ BALANCED / - UNKNOWN` fallback keeps working, but a test asserts every
  shipped archetype id resolves to a real row, so the fallback can never again
  swallow all of them silently

The summary values (`+15% PAC`, `OTHER STATS +0%`, `NO WEAK SPOT`) are English
prose invisible to the prose gate (all-caps, multi-token). Key them too.

### B2. Every raw name token — not just `readableId`

Both reviewers found this under-scoped by more than half. The full inventory,
all verified:

**`readableId`** (`market-view-model.ts:744-752`) — five feeds: personalities
(:359, :647), coach specialties (:354-355), scout regions (:735), unlock names
(:741), scout-report power fallback (:313).

**`readableLabel` — a SECOND prettifier** doing the same job elsewhere
(`view-models.ts:917, :932`): coach personality and specialty labels on the staff
desk. Fixing `readableId` alone leaves its twin shipping English.

**`market-source-adapter.ts:157, :338`** — more power tokens.

**`event-selection.ts:204, :212`** — a raw facility id and a raw
`requiredPersonality` interpolated into a translated sentence, drawn on the story
event screen at StoryEventScreen:414.

**Archetype name render sites** (B1 converts the table; these draw the name):
`SquadTrainingScreen.tsx:1002` (PixelText) and :1088 (sans),
`MarketScreen.tsx:347` (`font-pixel`, fed by `market-view-model.ts:446` which is
*not* a `readableId` feed), `ClubLegacyScreen.tsx:88` (StatusChip).

**Personality has two unions that must map to one key family**: `types.ts:76` is
title-case and persisted (`'Fiery'`); `market.ts:39` is uppercase (`'FIERY'`).

**Personality explainers are already keyed** (`squadTraining.personality.*`) —
do not touch them. Only name tokens are missing.

B5's test must assert a non-English render at **every** archetype site, not one —
otherwise it passes while three stay English, which is risk 3 exactly.

### B3. Awakening cut-scene

`AwakeningCutsceneScreen.tsx:391-395` — `TAP TO SKIP`, `TAP TO CONTINUE`,
`HERO #1`, `NEW HERO`. Ordinary keying.

### B4. Training modifier labels

**The first draft of this step was architecturally impossible** and Grok caught
it: it said the facility name "resolves through the existing `facilityName()`
helper", but that helper lives in `src/application/copy-fallback.ts` and
`training.ts` is in `src/game`, which may not import the application ring. The
architecture test would have rejected it.

Correct shape: `training.ts` emits a **stable modifier kind id** plus the English
as fallback — the same dual write every other ring producer uses — and
`TrainingDrillModal` resolves the kind at the UI boundary, where `facilityName()`
and the archetype keys are both reachable.

### B5. Verify

Full `src/game src/application src/ui src/i18n`, plus a test that a non-English
locale renders non-English for: an archetype name, a personality, a scout region
and a drill modifier.

---

## Phase A — sponsors

### A1. Widen the ring type

`SponsorObjectiveSnapshot` (`club-business-types.ts:35-40`) gains optional
`labelKey` / `labelParams`. **Compile-time only — the zod schema already accepts
them, so there is no migration and no `GAME_SCHEMA_VERSION` bump.**

### A2. Content keys

Add to `contentStrings()`:

- `sponsor.brand.<id>.offerLine` — 12
- `sponsor.objective.<id>.label` — 3

**No key for brand names** — owner's decision, §1.3 of the spec. They stay
English like club and player names.

**Voice**: offer lines render in the platform sans
(`ClubFinancesScreen.tsx:1041`), so they must classify as **body**, not display.
Since `voiceOf` is namespace-driven, `sponsor.` needs an explicit entry — a
default of display would glyph-gate a string against a face it never renders in.

### A3. Producer

`sponsors.ts` writes `labelKey`/`labelParams` onto the objective snapshot. The
continuity placeholder uses `sponsorContentId: 'continuity'`, which matches no
brand row, so its `Current Sponsor` / terms-continue strings get **UI chrome
keys** rather than content keys, and the lookup must special-case it — otherwise
the fix defeats itself and old saves show English forever.

### A4. Consumers

`view-models.ts` :712, :796, :1402 resolve the objective with `copyOrEnglish`;
:707 and :789 resolve `offerLine` from `sponsorContentId`, falling back to the
persisted English. Profile chips (`Steady`/`Balanced`/`Bold`, :791-793) become
keys.

Missing one of these reproduces the half-translated screen this sweep keeps
finding — the finance list that flipped to English mid-scroll.

### A4b. Gate wiring — both reviewers flagged this independently

Two steps whose absence would turn CI red on the first sponsor commit:

1. **Gate 10 source mapping.** `SOURCE_BY_PREFIX` and `COVERAGE_FLOOR` in
   `gates.test.ts` have no `sponsor.` entry, so "every content key belongs to a
   source file the floors know about" fails the moment A2 lands.
2. **The persisted-labels producer scan** (`gates.test.ts:194`) covers only
   `career.ts`, `player-requests.ts` and `management.ts`. Add `sponsors.ts`, or
   A3's new `labelKey` writes are unguarded — the exact "keys written but never
   read" class this whole sweep exists to close.

Also rewrite the two comments that A makes false: the exclusion note at
`content-strings.ts:36-41` and the `TODO(i18n)` block at `sponsors.ts:122-133`.
Left as-is, the next reviewer re-litigates the migration question from stale
evidence.

### A4c. The prose ratchet (F8)

Criterion 6 (ratchet strictly below 74) is **unreachable** unless
`createProvisionalSponsorPortfolio` gets an `@i18n-fallback` tag: its
`Current Sponsor` strings stay as the persisted fallback with no `*Key` sibling
the scanner can see, so it keeps counting them. Nothing else in scope moves the
number — cutscene caps, archetype summaries and `readableId` output are all
invisible to that scanner.

### A5. Translations

12 offer lines + 3 objective templates + continuity chrome + 3 profile chips,
× 6 locales. Match each catalog's register; Vietnamese restricted to characters
already in `vi.json`.

### A6. Verify

- Full suite.
- **An old-save test, with a NON-ENGLISH translator.** Decode a save whose
  objective snapshot has no `labelKey`, render through the real view model with
  `t` bound to a translated locale, and confirm the persisted English appears.
  With an English `t` the assertion passes vacuously — fallback and successful
  resolution are indistinguishable, which would make the test theatre.
- A test that a `sponsorContentId` with no matching brand row falls back to the
  persisted English rather than throwing.

---

## What must be true at the end

1. No player-facing English on the three surfaces in any of six locales.
2. Old saves load and render. No migration, no schema version bump.
3. `ARCHETYPE_DEVELOPMENT` no longer keyed by display text, with a test that
   fails if it regresses.
4. Gate 5 covers all 206 pixel leaves, with a negative control proving the gate
   can fail.
5. Full suite green. No assertion weakened to make a change pass.
6. Prose ratchet strictly lower than 74.

## Risks this plan is carrying

1. **C4's word order.** `"{rarity} {category}"` as a template assumes those two
   words compose in every language. They may not — some languages would want a
   single phrase per pair. The template at least makes that fixable without
   re-keying; 21 hand-written pairs would be the alternative and is worse.
2. **B1 must land before any archetype display work.** Out of order, the
   fallback swallows every player and no test currently catches it.
3. **A4 is the one to get wrong.** Five call sites, and the failure mode is a
   partially translated screen rather than an error.
4. **C3 may not be worth its complexity** — flagged above for a reviewer call.

## Review record — both reviewers, 2026-08-07: REVISE

Both verdicts were REVISE and both were earned. Everything below is folded in
above, and every claim was re-verified here before being accepted.

**The single best finding, from Fable (F1): the plan's own new keys would have
dodged the plan's own new gate.** `event.rarity.*` starts with `event.`, a body
prefix, so those ten words would have classified `body` and been skipped by the
gate C1 exists to add — and broken gate 10 as content keys with no source file.
Verified: `event.rarity.rare` → `body`, `storyEvent.rarity.rare` → `display`.

**Blocking, both reviewers independently:**

- Gate 5 never checks English content at all (Fable F2) — it reads
  `loadCatalog('en')`, which is chrome only. Criterion 4 was false as written.
- Phase B was under-scoped by more than half: a **second prettifier**
  (`readableLabel`), four more archetype render sites, two raw interpolations on
  the story-event screen, and personality existing as **two different unions**.
- Phase B4 was **architecturally impossible** — it told an implementer to call an
  application-ring helper from the pure game ring (Grok).
- Phase A would have turned CI red immediately: no `sponsor.` entry in gate 10's
  source map, and the producer scan doesn't cover `sponsors.ts` (both).
- Criterion 6 was unreachable without tagging the continuity producer (Fable F8).
- The A6 old-save test would have passed vacuously with an English `t` (Fable F9).

**Also found:** the `' and '` joiner at `view-models.ts:3546`, live in 38 risky
outcomes across six locales, invisible to both instruments for the same reason
`categoryLabel` was — composed from resolved values, no literal, no key. Added
to Phase C's scope.

**Where the reviewers disagreed — C4.** Grok said template-with-separator, Fable
said 21 keyed pairs while acknowledging the separator works. My own independent
analysis had reached "21 pairs" for the agreement reason, then found the
separator dissolves the agreement problem entirely. Shipping the separator: 10
keys instead of 126 strings, grammatically correct in all six, and ` · ` is
already the house separator. Recorded because two reviewers and I initially
disagreed and the evidence settled it, not seniority.

**Where a reviewer was wrong.** Grok argued uppercase "flattens morphology" so
agreement does not matter. It does not: uppercasing `seltenes` yields `SELTENES`,
not `seltener`. The inflection survives. This is why the separator, not the
template, is the fix.

## Status

Ready to execute, C → B → A.
