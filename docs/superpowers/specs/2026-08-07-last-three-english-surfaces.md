# The last three English surfaces — spec

Date: 2026-08-07
Status: draft, for review by Grok 4.5 and Claude Fable 5

Three items remain from the five-audit sweep on PR #109. This spec establishes
what is true, what is genuinely undecided, and what the shape of the fix should
be. **It is not the implementation plan** — the plan comes after this is agreed.

---

## 0. The one rule this sweep keeps re-learning

Every serious bug in this workstream was the same shape: **plumbing that exists
and is not connected**. Keys written and never read, a provider that never
reached its consumers, gates measuring the wrong thing. The 3,632-test suite
caught none of them.

So this spec's first job is to be sure about the facts, and its second is to say
what would *prove* each fix works. A claim like "needs a coordinated save-format
change" — which three separate agents made about sponsors — is exactly the kind
of assumption that has been wrong before.

## 1. Item A — Sponsors

### 1.1 What three audits believed, and why it was wrong

All three said the sponsor fix was blocked on a coordinated save-format change,
because brand names are persisted in two `z.strictObject` schemas *and* copied
into ledger `labelParams`. Every one of them stopped there.

**Measured, this session, in `src/persistence/game-state-codec.ts`:**

| Fact | Line | Consequence |
| --- | --- | --- |
| `sponsorObjectiveSnapshotSchema` **already has** `labelKey` and `labelParams` | :517-522 | The objective side needs **no schema change at all**. The producer simply never writes them. |
| `sponsorContractSnapshotSchema` carries `sponsorContentId` | :534 | The brand is recoverable from content at render time. The persisted `sponsorName` is a fallback, not the only source. |
| `sponsorOfferSnapshotSchema` carries `sponsorContentId` | :551 | Same for offers. |

**So no save-format change is required, and no migration.** The persisted English
stays exactly where it is and keeps doing its job as the fallback for content
that no longer ships — the same dual-write contract the ledger already uses. The
work is: emit the keys, resolve them at render, and add the catalog entries.

That is a materially smaller and safer change than "widen two strict schemas",
and the difference is worth stating loudly because the wrong belief nearly
deferred this indefinitely. **Grok's review confirmed this conclusion against
the code.**

Four caveats it raised, all verified, none of which reintroduce a migration:

1. **The TypeScript type lags the codec.** `SponsorObjectiveSnapshot`
   ([club-business-types.ts:35-40](src/game/club-business-types.ts:35)) has no
   `labelKey`/`labelParams` fields, though the zod schema does. Writing them
   needs a type update — not a save migration.
2. **Continuity contracts are not a brand.** They use
   `sponsorContentId: 'continuity'` ([sponsors.ts:142](src/game/sponsors.ts:142)),
   which matches no row in `content/sponsors.json`. The lookup must fall through
   to UI keys, not assume a brand exists.
3. **Ledger params carry `sponsorName` and no content id**
   ([career.ts:519](src/game/career.ts:519)). Under the decision in §1.3 this is
   permanently fine — the brand is English everywhere by design.
4. **A consumer citation here was wrong.** The third site is
   [view-models.ts:1402](src/application/view-models.ts:1402), not 1384. The
   other two (:712, :796) are right, and `offerLine` is also read raw at :707
   and :789.
5. **`sponsorRules` — the whole of `sponsors.json` — is persisted per career**
   ([game-state-codec.ts:1319](src/persistence/game-state-codec.ts:1319), written
   at `career.ts:209`, read back at `launch.ts:368`). Offer generation on an old
   save therefore uses the save's own brand list, not shipped content. This
   *strengthens* the no-migration conclusion: a content id cannot dangle
   mid-career, only across an app update that removes a brand — and the
   persisted-English fallback covers exactly that.
6. **The new `sponsor.*` keys need an explicit voice classification.** Brand
   names render in `PixelText` but offer lines render in the platform sans
   ([ClubFinancesScreen.tsx:1040-1041](src/ui/screens/ClubFinancesScreen.tsx:1040)).
   Since `voiceOf` is namespace-driven, a `sponsor.` namespace defaulting to
   display would glyph-gate `offerLine` against a face it never renders in. The
   plan must state the voice per leaf — which is the same lesson as §3.

### 1.2 What is actually English

`content/sponsors.json` holds three kinds of string, and they are **not** in
`contentStrings()` today — a deliberate exclusion at
[content-strings.ts:36-41](src/i18n/content-strings.ts:36). (An earlier draft
said "25 sponsor-ish content keys"; the real number is 16, and they all belong
to `event.*` rather than to brands. Corrected because overstated counts have
already mis-scoped work twice in this sweep.)

1. **12 brand names** — `Northstar Tools`, and eleven like it.
2. **12 offer lines** — `Build something worth cheering for.`
3. **3 objective templates** — `Win {target} league matches`.

Plus, in code:

4. `Current Sponsor` / `Current Sponsor {n}` and `Your existing sponsor terms
   continue.` — [sponsors.ts:143-144](src/game/sponsors.ts:143). These are **not
   a brand**; they are the UI's placeholder for "the deal you already have".
5. The profile chips `Steady` / `Balanced` / `Bold` —
   [view-models.ts:792](src/application/view-models.ts:792).

### 1.3 DECIDED — brand names stay English

**Owner's call, 2026-08-07: brands are not translated.** Grok independently
reached the same answer.

The reasoning both landed on: the owner's rule from the start of this workstream
was that *"about the only thing that should stay in English is maybe the team
names and player names."* A fictional sponsor is the same class of invented
proper noun as `Bramble Rovers`. Translating twelve of them would create six
parallel brand systems to keep consistent, invite glossary drift, and buy no
clarity — `Northstar Tools` is as readable in Vietnamese as a club name is.

What DOES translate, and is not in question:

| String | Verdict |
| --- | --- |
| 12 brand names | **English.** Proper nouns. |
| 12 offer lines | Translated — advertising prose, not a name. |
| 3 objective templates | Translated. |
| `Current Sponsor` / `Current Sponsor {n}` | Translated — UI chrome, not a brand. |
| `Your existing sponsor terms continue.` | Translated — UI chrome. |
| `Steady` / `Balanced` / `Bold` | Translated — UI chrome. |

This decision removes work rather than adding it: the ledger `labelParams` carry
`sponsorName` with no content id, and under this rule they never need one.

### 1.4 Proposed shape (given any option)

- Add sponsor prose to `contentStrings()` under `sponsor.brand.<id>.offerLine`
  and `sponsor.objective.<id>.label`, following the existing content-flattening
  convention, so English is **not** duplicated into `en.json`. **No key for the
  brand name** — §1.3.
- Widen the `SponsorObjectiveSnapshot` TypeScript type, then have `sponsors.ts`
  write `labelKey`/`labelParams` onto the objective snapshot — the fields the
  zod schema already accepts.
- Consumers at [:712](src/application/view-models.ts:712),
  [:796](src/application/view-models.ts:796) and
  [:1402](src/application/view-models.ts:1402) resolve with `copyOrEnglish`,
  keeping the persisted English as the fallback. `offerLine` is read raw at :707
  and :789 and needs the same treatment.
- The offer line resolves from `sponsorContentId`, so a translated catalog
  reaches even an old save. `'continuity'` matches no brand row and must fall
  through to its own UI keys.

## 2. Item B — personalities, archetypes, awakening cut-scene

### 2.1 The straightforward half

- `readableId()` at [market-view-model.ts:744-752](src/application/market-view-model.ts:744)
  feeds raw English into translated sentences from **five** call sites, not the
  two first listed: personalities (:359, :647), coach specialties (:354-355),
  **scout regions (:735)**, **unlock names (:741, interpolated into
  `market.teachesUnlock`)** and the **scout-report power fallback (:313)**. One
  function, one defect, five feeds — fixing two of them would leave the screen
  half-translated in the familiar way.
- [AwakeningCutsceneScreen.tsx:392-395](src/ui/screens/AwakeningCutsceneScreen.tsx:392)
  hardcodes `TAP TO SKIP`, `TAP TO CONTINUE`, `HERO #1`, `NEW HERO` on a
  marquee scene that is otherwise fully keyed.

Both are ordinary keying work.

### 2.2 The trap, which must be fixed first

[archetype-development.ts](src/ui/archetype-development.ts) is a lookup table
**keyed by the English display name**:

```ts
const ARCHETYPE_DEVELOPMENT: Readonly<Record<string, ArchetypeDevelopmentSummary>> = {
  Speedster: { strengths: '+15% PAC', weaknesses: 'OTHER STATS +0%' },
  ...
};
export function archetypeDevelopmentSummary(archetype: string) {
  return ARCHETYPE_DEVELOPMENT[archetype] ?? { strengths: '+ BALANCED', weaknesses: '- UNKNOWN' };
}
```

Worse than "dangerous": the English archetype name is a **persisted zod enum**
([types.ts:67](src/game/types.ts:67), codec :286/:903) and a game-logic control
value in `archetype-caps.ts`. Translating it at source is not a risky option, it
is an impossible one — it would break saves. The only correct shape is a
display-layer key, which happens to be what the forced ordering below produces.

Translate archetype names at source and **every player silently falls through to
`+ BALANCED / - UNKNOWN`**. It is the same English-as-a-control-value defect this
sweep has already fixed in eight places, and it fails quietly rather than loudly.

So the order is forced: split the code from the copy first, then translate.

Note the summary values are themselves English prose (`OTHER STATS +0%`,
`NO WEAK SPOT`) and are invisible to the prose gate, because `looksLikeProse`
requires two lowercase letters and these are all-caps
([hardcoded-prose.ts:145](src/i18n/hardcoded-prose.ts:145)). That blind spot is
worth recording whether or not it is fixed here.

### 2.3 Adjacent, raised by review

- **Training modifier labels.** `training.ts` (~:493-511) emits `Youth`,
  `Veteran`, `Coach`, a raw archetype and an English facility name, and
  `TrainingDrillModal` renders them raw. Not in the original three bullets, but
  it sits on the same screen as the archetype work and would otherwise reappear
  as "English on the drill card" the moment personalities and archetypes are
  keyed. Fold it in.
- **Personality explainers are already keyed** (`squadTraining.personality.*`).
  Only the NAME tokens go through `readableId`. The plan must not re-key the
  explainers — that would be duplicate work and a second source of truth.

## 3. Item C — gate 5 does not check the loudest text in the game

### 3.1 Measured

`voiceOf()` classifies by **prefix only**
([voice.ts:22-31](src/i18n/voice.ts:22)). `event.` and `glossary.` are in
`BODY_PREFIXES`, so gate 5 skips them as "platform sans, any glyph".

But `StoryEventScreen` draws `event.<id>.title` and the choice labels in
`font-pixel` / `PixelText`, and `GlossaryPanel` draws `glossary.clubHandbook` in
`PixelText`. Verified this session: all four resolve to `body`.

**The first draft of this section had the leaf list wrong, and Grok caught it.**
It named `event.*.title` and `event.*.label` only. Verified since, two more
surfaces are drawn in the pixel face and classified `body`:

| Key shape | Drawn at | Face |
| --- | --- | --- |
| `event.<id>.title` | [StoryEventScreen.tsx:277](src/ui/screens/StoryEventScreen.tsx:277) | `font-pixel` |
| `event.<id>.<choice>.label` | [StoryEventScreen.tsx:412](src/ui/screens/StoryEventScreen.tsx:412) | `PixelText` |
| **`event.<id>.<choice>.<outcome>.headline`** | [StoryEventScreen.tsx:192-195](src/ui/screens/StoryEventScreen.tsx:192) | `font-pixel text-2xl` |
| `glossary.clubHandbook` | [GlossaryPanel.tsx:42](src/ui/GlossaryPanel.tsx:42) | `PixelText` |
| **`glossary.<category>.title`** | [GlossaryPanel.tsx:71](src/ui/GlossaryPanel.tsx:71) | `font-pixel` |

The headline is the loudest line on the screen — the payoff after a choice — and
a leaf list of `title` + `label` would have left it unguarded, recreating the
same bug under a different leaf. That is worth dwelling on: **the first attempt
to fix a hand-maintained model of render reality was itself an incomplete
hand-maintained model.** It is the argument for option 2 in §3.2, in miniature.

The count also needs correcting, and the two reviewers disagreed on it, so it
was measured: **206 pixel-drawn leaves out of 508** `event.*` + `glossary.*`
keys — 50 titles, 100 choice labels, 50 outcome headlines, 6 glossary category
titles. Fable's figure was exact; Grok's 157 omitted the headlines it had itself
just identified. The other 302 are bodies, outcome texts, terms and definitions,
which are correctly drawn in the platform sans and must NOT be marked display —
doing so would trip risk 4. Nothing is broken today — the shipped cmaps were
parsed and there are zero missing glyphs — but a translator typing `…` (U+2026,
absent from the face) into a Vietnamese event headline ships tofu with CI green.

### 3.2 The design question

A prefix list cannot express "this namespace is body **except** its `.title` and
`.label` leaves". Two shapes:

| Option | Shape | Trade-off |
| --- | --- | --- |
| **1** | Leaf-aware overrides: `event.*.title` and `event.*.label` are display; the rest of `event.` stays body | Small, targeted, matches how `copy-budget.ts` already special-cases `playerRequest.<id>.line` |
| **2** | Derive the voice from what the component actually draws, by scanning source | Truthful by construction, cannot drift — but it is a new static-analysis gate, and this codebase has been bitten by scanners that measured the wrong thing |

Option 1 is the smaller change; option 2 is the one that cannot rot. The concern
with option 1 is that it is another hand-maintained model of render reality, and
**a hand-maintained model being wrong is precisely the bug being fixed here.**

Grok's answer: ship option 1 with the **corrected** leaf list, plus two cheap
guards that do not require a scanner —

- every key matching the display leaves must `voiceOf` as `display`;
- known body leaves (`event.*.body`, `event.*.*.*.text`) must stay `body`, so an
  over-broad override cannot quietly reject valid prose;
- a negative control: a string containing U+2026 in a display leaf must FAIL
  gate 5. Without this the gate can pass by checking nothing, which is the
  original sin of this whole workstream.

Fable adds two hard conditions, and they are the price of choosing option 1:

- **The leaf list must come from a fresh audit of every `PixelText` /
  `font-pixel` call site**, not from reasoning about key names. This review grew
  the list from two patterns to four inside a single session, which is the drift
  concern demonstrating itself.
- **Each entry must cite its render site `file:line`**, the way `voice.ts`
  already documents why `coach.` is body. An override with no citation is an
  assertion, and assertions are what this sweep keeps disproving.

It also suggests the cheap half of option 2 as a TEST rather than a gate: the
`hardcoded-prose.ts` scanner already walks JSX, so it can assert that no
`t('event.…')` / `t('glossary.…')` literal outside the override list is rendered
inside a `PixelText`/`font-pixel` element. Worth doing; not worth building voice
inference for.

### 3.3 The fifth finding — English content enums drawn as a headline

Found by Fable, missed by Grok, missed by all five earlier audits, and it is on
the very screen Item C is about.

[view-models.ts:1243](src/application/view-models.ts:1243):

```ts
categoryLabel: `${event.rarity} ${event.category}`,
```

Drawn `font-pixel ... uppercase` at
[StoryEventScreen.tsx:252](src/ui/screens/StoryEventScreen.tsx:252), so a story
interruption is headed **`RARE MYSTERY`** in all six locales. Measured: 3
rarities (`rare`, `legendary`, `common`) × 7 categories (`mystery`, `club`,
`media`, `sponsor`, `player`, `medical`, `fan`) — 10 words to key.

**Why every instrument missed it.** It has no catalog key, so gates 5 and 10
cannot see it. It is composed from data *values* rather than string literals, so
the hardcoded-prose scanner cannot see it either. It is the sweep's signature
defect — English content values used directly as display — hiding in the one
blind spot shared by both tools.

The enums themselves are content ids and must not change; this is a display-layer
key lookup, exactly like `DIVISION_NAME_KEYS`.

## 4. What must be true when this is done

1. No player-facing English on any of the three surfaces in any of six locales.
2. Old saves still load, and still render correctly. **No migration.**
3. `ARCHETYPE_DEVELOPMENT` no longer keyed by display text, with a test that
   fails if it regresses.
4. Gate 5 covers the pixel-drawn `event.*`/`glossary.*` leaves, with a negative
   control — a deliberately bad glyph must fail the gate.
5. Full suite green; no assertion weakened to make a change pass.

## 5. Risks

1. **The brand-name decision is not reversible cheaply** once translations exist
   in six locales, so it should be settled before any translating starts.
2. **The archetype split must land before archetype copy is touched**, or the
   fallback swallows every player silently.
3. **Sponsor consumers read from three places** (offer cards, contract rows,
   ledger params). Missing one reproduces the exact half-translated screen this
   sweep keeps finding — the finance screen that flipped to English mid-list.
4. **Gate 5's fix could over-reach**: marking all of `event.` as display would
   reject legitimate body copy (em dashes, curly quotes) that the platform sans
   renders fine, breaking the build for no user-visible gain.

## 6. Review record

### Round 1 — Grok 4.5, 2026-08-07: REVISE

Confirmed the load-bearing claim (§1.1, no save-format change) against the code,
and rejected the spec for three things, all now fixed above:

1. The gate-5 leaf list omitted the pixel-drawn **event outcome headline** and
   **glossary category titles** — it would have shipped the same bug under a
   different leaf. This was the "fourth thing", and it was found by asking for
   it explicitly.
2. A wrong consumer citation (1384 → 1402) and two overstated counts (25 → 16,
   ~460 → ~157). Minor individually; this workstream has already mis-scoped work
   twice on numbers that were not checked.
3. Under-specified consequences of the brand decision — now moot, since §1.3 is
   decided and the ledger `sponsorKey` work it implied is not needed.

It also raised the `SponsorObjectiveSnapshot` type lag, the `'continuity'`
sponsor id, the training modifier labels, and that personality explainers are
already keyed. All verified and folded in.

Answers to the original questions: brand names **A** (English); "no migration"
**confirmed**; gate 5 **option 1 with the corrected leaf list plus a negative
control**; sequencing **C → B → A confirmed**, with the archetype rekey strictly
before any archetype copy.

### Round 2 — Claude Fable 5, 2026-08-07: REVISE

Independently confirmed §1.1 and could not break it. Then found what Grok had
not, including the most valuable single item in either review:

1. **§3.3, the fifth finding** — `categoryLabel` composes two English content
   enums into a pixel headline. Invisible to BOTH instruments at once: no key,
   and built from data values rather than string literals. Found on the exact
   screen Item C targets.
2. **`readableId` has five feeds, not two** — regions, unlock names and the
   power fallback were unlisted. Fixing only the listed two would leave the
   market screen half-translated.
3. **The archetype name is a persisted zod enum**, so translating it at source
   is impossible rather than merely dangerous. Right ordering, wrong reason.
4. **`sponsorRules` is persisted per career**, which strengthens the
   no-migration argument rather than weakening it.
5. **New `sponsor.*` keys need a per-leaf voice**, because brands draw in
   `PixelText` and offer lines in the platform sans.
6. The pixel-leaf count: Fable said 206, Grok said 157. **Measured: 206 of 508.**
   Grok's figure omitted the headlines it had itself identified.

On the brand decision it picked **A** unprompted and argued against C
specifically: 72 catalog entries identical to their English would pollute the
coverage instrument this workstream leans on. It also notes risk 1 is
overstated — A→B later is cheap; it is B→A that is ugly. That matches the
owner's call.

### Status

Both reviews folded in. Every claim either reviewer made about the code was
re-verified here before being accepted, and the one numeric disagreement was
settled by measurement rather than by preferring a reviewer.

Scope grew by two items during review — the `.headline`/`glossary.*.title`
leaves and the `categoryLabel` enums — which is the argument for having done
this as a spec first. Ready for the implementation plan.
