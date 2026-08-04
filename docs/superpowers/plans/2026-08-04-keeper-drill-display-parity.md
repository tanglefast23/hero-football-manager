# Keeper Drill Display Parity

**Status:** built 2026-08-04, all four steps.

Three deviations from the spec below, all forced by the code:

- **The rail could not live where §6 put it.**
  `long-career-development-probe.test.ts` is `describe.skip` unless its env var
  is set, so a rail there would never run — the same "cannot fire" failure §6
  rejects the 1.95 ratio for. It lives in a new always-on
  `src/audit/__tests__/keeper-display-drift-rail.test.ts`, which simulates no
  matches and costs milliseconds. **Measured: 412 points of drift over 150 REF
  taps; bound set at 460.**

- `keeperDisplayLadderMultiplier` is keyed on a **drill id**, not a path id. The
  upgrade shop quotes tiers the club has not bought, and a path's *owned* tier
  is the wrong answer for those rows.
- The displayed-value rule lives in `src/game/training.ts` as `displayedValue`,
  with `src/application/displayed-attributes.ts` delegating to it. §4.3 put it
  in the application layer, but the confirm-card preview needs the same rule and
  `src/game/` cannot import upwards. One rule, two doors.
**Date:** 2026-08-04
**Scope:** presentation only. No `src/sim/` change, no `ENGINE_VERSION` decision, no balance change.

**Review round 1 applied 2026-08-04.** Six findings accepted, one alternative
rejected with reasoning (§6), three further defects found on a second pass
(§4.4 #9 ceiling, §4.5 stale wording, §2e). Every file:line below has been
re-checked against live code; the ones the review cited that did not exist —
`src/game/__tests__/training.test.ts` — are gone.

---

## 1. The problem

Every training drill in the game costs the same TP at the same tier and awards the
same attribute points — **except the keeper's.**

`content/training.json`, tier 1 through 5:

| path | tier 1 | 2 | 3 | 4 | 5 | TP cost |
|---|---:|---:|---:|---:|---:|---|
| Sprints (PAC), Rondo (PAS), Circuit (STA), Finishing (SHO), Duels (DEF), First Touch (TEC) | 4 | 6 | 10 | 14 | 18 | 10/15/21/28/36 |
| **Keeper Drills (REF)** | **2** | **3** | **5** | **7** | **9** | 10/15/21/28/36 |

Exactly half, at every tier, for the same price.

This is not an oversight and **must not be repaired by changing the numbers.**
REF is contested on every opposing shot — about 14 a match at the opening fixture —
while SHO is read only on the trained striker's own ~2.6 and DEF is spread across
eleven defenders. `src/audit/__tests__/training-leverage-rails.test.ts` prices both
paths in goals moved per 100 TP, normalised per contest the attribute participates
in, and measures keeper training at **6.61x** the striker's at 600 paired seeds.
The file's own header notes the *unnormalised* ratio "starts around 5x before any
imbalance exists." The halved ladder is what keeps that number from being worse.

### Why it is a presentation defect anyway

`attributeAffectsPlay` (`src/game/archetype-caps.ts:91`) marks SHO, DEF and TEC
inert for goalkeepers. So a keeper's drill list is exactly four rows:

```
Sprints 1        +4 PAC   (10 TP)
Rondo 1          +4 PAS   (10 TP)
Circuit 1        +4 STA   (10 TP)
Keeper Drills 1  +2 REF   (10 TP)     <- same price, half the number
```

The 4-versus-2 comparison sits inside a single player's card, in a single column,
at the same price. It reads as the keeper being short-changed. The truth is the
opposite — that row is the strongest per-TP purchase in the game — but nothing on
screen says so, and the number that *is* on screen says the reverse.

The owner's goal, stated directly: the player should believe they are spending the
same and getting the same, without the underlying balance moving at all.

---

## 2. Options considered and rejected

Recorded so the reviewer does not re-derive them. Each was analysed against this
codebase, not in the abstract.

### 2a. Raise `gains.ref` and dampen REF inside the sim

Rejected: already tried three times and reverted, with measurements, in
`docs/superpowers/reports/2026-07-30-real-player-balance-findings.md`:

- REF removed from the aim channel — moved goals-prevented-per-100-TP 3.536 → 3.476 (1.7%).
- Split seam (full REF for the resolved save, dampened REF for the shooter's estimate) —
  fixed shot suppression but doubled league-wide shot volume.
- Fixed aim constant — leverage 14.14 → 16.25, keeper-only opener loss rate 31.7% → 21.7%.

The `m1.28` compression (`KEEPER_SAVE_BASELINE + (ref - baseline) / 4`) was shipped
and then deleted by `m2.0`'s scale-invariant campaign; `keeperSaveProbability`
carries the reason in comment: "roster values, not a hidden divisor, now control
keeper dominance."

### 2b. Rescale the REF axis game-wide

Double every authored REF and subtract `ratingD64(2) = 1286` wherever REF enters a
contest. Mathematically exact — the engine is scale-invariant, so this is a pure
unit change and, unlike `m1.28`, a constant D64 offset preserves the whole range.

Rejected on cost and on visible result:

- Touches REF generation at `pyramid.ts:830/843/936`, `youth-intake.ts:433/447`,
  `full-career.ts:646`, `clubs.json` rosters, and the opening opponent buff.
- `market.ts:313` averages REF with five outfield stats for GK rating, value and
  wage; without a compensating halve every keeper in the game gets ~10% dearer.
- Requires an `ENGINE_VERSION` bump and a golden-replay decision.
- Not bit-identical: measured, `ratingD64(2r) - 1286` differs from `ratingD64(r)`
  by up to 1 D64 on 236 of the first 499 ratings. 1/64 of a contest point has no
  gameplay effect, but every seeded fixture, acceptance seed and rail re-baselines.
- The keeper would read `REF 122` beside `DEF 50` in the same seven-stat row
  (`SquadTrainingScreen.tsx:1074`). It relocates "wildly different" rather than
  removing it.

### 2c. Project the displayed stat from the stored stat

`shown = anchor + k x (stored - anchor)`, computed on read. Rejected: the applied
gain is rounded to an integer before it reaches the stat
(`training.ts:237`, `max(1, round(base x ageMultiplier x facilityMultiplier x requestScale / 100))`),
and `trainingMultiplierForAge` is 1.3 / 1 / 0.6 (`pyramid.ts:546`):

| age band | STA tier-1 | REF tier-1 | real ratio |
|---|---:|---:|---:|
| <=23 (x1.3) | round(5.2) = 5 | round(2.6) = 3 | 5:3 |
| 24-29 (x1.0) | 4 | 2 | 2:1 |
| 30+ (x0.6) | round(2.4) = 2 | round(1.2) = 1 | 2:1 |

A fixed multiplier prints +6 STA against +8 REF for anyone 23 or under. The
information needed to invert the rounding is gone by the time the value is stored.
It also inflates opponents (a D1 keeper authored at REF 180, `pyramid.ts:315`,
would read 375) and diverges from the wage.

### 2d. Progress pips instead of a number

Replace `+2 REF` with a dot track filling one dot per tap on every path. Cheap and
truthful, but the result scene still counts the real stat up
(`TrainingDrillModal.tsx:73`), so it makes the difference *unadvertised* rather than
invisible. Kept as the fallback if this spec is rejected.

### 2e. Where the authored ladder is actually heading

Not an option so much as a fact this spec has to be built around, and it was
missing. Two probes already exist here and neither was cited.

`src/audit/__tests__/keeper-drill-gain-probe.test.ts` "finds the Keeper Drills
gain that prices the path against what it delivers." Read its candidate list
before assuming which way it points:

```ts
const CANDIDATE_MULTIPLIERS = [1, 0.75, 0.5, 0.4, 0.3, 0.2];
// "1.0 is today's ladder and the control. The rest walk down toward the point
//  where a keeper tap is worth what a striker tap is worth."
```

It only sweeps **downward**, and its stated target is `ratio 1.5`. Today's
already-halved ladder measures **6.61x** on `training-leverage-rails`. So the
open balance question is not "could Keeper Drills award more than 2?" — it is
"how much *less* than 2 does it have to award to be honest?" A ladder of
`1/1/2/3/4` (multiplier 0.4) is inside the swept range; `2/3/5/7/9` is the
generous end of it.

`keeper-drill-price-probe.test.ts` is the price-dial sibling and records that a
price sweep "bottomed out at 7.3x even at five times the going rate" — which is
why the gain dial is the one under investigation.

**This does not cancel the spec, and it is not a crisis either.** The honest size
of the effect, in the units §6 argues are the right ones:

**Corrected by measurement, step 4.** The tier-1 arithmetic says the gap goes
from +2 to +3 per tap — half again, not the four times the 2:1 to 4:1 ratio
suggests. That is true and it is not the whole story. Measured across 150 weekly
taps, the accumulated drift goes **412 → 776, about 1.9x**, because a keeper on
a weaker ladder climbs far more slowly and therefore takes many more taps before
reaching the stat ceiling that eventually stops the drift.

So a re-tune roughly doubles the lie. That still does not invalidate the design —
the multiplier is read from content and carries the display with it — but it is
the reason the rail exists and the reason it fires at 0.5x and below.

What it does change is the constant. §3 must not hardcode
`KEEPER_DISPLAY_LADDER_MULTIPLIER = 2`, because 2 only means "undo the halving"
for as long as the halving is exactly half. Derive it from the content —
outfield gain over keeper gain at the same tier — and a re-tune carries the
display with it for free, with nothing to remember.

So the probe is step 0 (§9) for a sequencing reason only: if a content change is
about to land, build the display on the settled ladder rather than rebuild after
it. It is not a veto on the spec. See Q4 and §9 step 0.

### 2f. Keep the honest number and explain it

Recorded and rejected, because it was missing from the list: every option above
either changes the number or hides it. None keeps `+2` and kills the
*comparison*, which is what §1 actually describes as the defect.

The codebase has the idiom — `src/ui/components/InfoTip.tsx`, the explainer the
roster column headers use. One string: *"Reflexes is tested on every shot you
face, around 14 a match — worth roughly double a striker's point."* No persisted
field, no drift, no rail, no shadow call, no deletion path, and it gets *more*
true if the ladder is re-tuned downward.

Rejected on three grounds:

- It does not meet the owner's stated goal. §1 asks that the player "believe they
  are spending the same and getting the same." An explainer delivers a different
  outcome — the player understands why it differs — which is a real design
  position but not the one chosen.
- Tooltips are opt-in and this defect is not. `+2` beside `+4` registers before
  anyone decides to tap an info dot.
- `InfoTip` is not currently used anywhere in `TrainingDrillModal`, and the drill
  picker is itself a `Modal`, so the layering is unproven rather than a drop-in.

Worth keeping in view as a *complement* if the display trick ever ships: an
explainer costs nothing and makes the strongest per-TP purchase in the game
legible instead of merely disguised.

**Cost warning:** this probe is not cheap. It runs 150 paired seeds across six
multipliers and two arms plus two reference arms — roughly 2,100 opening
simulations, with a 7,200,000 ms timeout budgeted in the file. Start with
`KEEPER_GAIN_SEEDS=25` for a shape, and only spend the full run if the shape
looks decision-relevant.

---

## 3. The design

Add one persisted integer per player that records **how far the keeper's displayed
Reflexes has been allowed to run ahead of the stored value.** Display adds it in.
Nothing else reads it.

```
displayed REF = attrs.ref + (refDisplayBonus ?? 0)
```

The bonus grows only when the player trains REF, and by exactly the amount needed
to make that tap read as though Keeper Drills used the outfield ladder.

### Why this beats a projection

- **It mirrors the realised gain instead of inferring it.** The rounding in 2c
  never applies, because the number is recorded at the moment the gain is computed,
  not reconstructed afterwards.
- **Untrained players are untouched.** Generated opponents, scouted keepers and
  youth candidates never train, so their bonus is absent and they display their
  true REF. The "D1 keeper reads 375" failure cannot occur.
- **Balance is untouched by construction, not by discipline.** No code in `src/sim/`,
  `src/game/lineup.ts`, `src/game/squad.ts` or `src/game/market.ts` reads the field.
  A reviewer can verify this by grep, not by reasoning about call graphs.
- **Saves survive.** New optional field; absent reads as 0.

### The shadow gain

Compute what this player's own modifiers would have produced from the
outfield-ladder base, and top up the difference:

**Corrected after implementation.** This section used to justify the shadow by
claiming a flat `x2` would print +6 for a young keeper whose outfield equivalent
gets +5. Measured, that is false — the keeper's own +5% position bonus on
Reflexes releases a point on the doubled base, so the shadow prints 6 as well,
and a comparable outfielder also gets 6. While Keeper Drills are *exactly* half,
flat-doubling and shadowing agree nearly everywhere.

The shadow is still the right construction, for a different and better reason:
it stays correct when the ladder stops being exactly half — which is precisely
what `keeper-drill-gain-probe` exists to bring about (§2e). Same argument as
deriving the multiplier from content rather than writing 2.

```ts
// Not a literal 2 — derive it from the content, outfield gain over keeper gain
// at the same tier. The keeper ladder is under active balance review and only
// ever sweeps downward (§2e); a hardcoded 2 silently stops meaning "undo the
// halving" the moment that ladder moves.
const KEEPER_DISPLAY_LADDER_MULTIPLIER = outfieldGain(tier) / keeperGain(tier);

// inside trainPlayerInstantly, only when attribute === 'ref'
const realisedGain = growth.value - player.attrs.ref;
const shadow = applyInstantGrowthModifiers(
  state, player, 'ref', rolledGain * KEEPER_DISPLAY_LADDER_MULTIPLIER,
);
const shadowGain = shadow.value - player.attrs.ref;
const nextDisplayBonus = (player.refDisplayBonus ?? 0) + (shadowGain - realisedGain);
```

`applyInstantGrowthModifiers` is pure arithmetic over `rolledGain` — it consumes no
RNG (`isSuper` and the injury roll are drawn before it, in `trainPlayerInstantly`).
Calling it a second time is therefore free of ordering effects. **Only `growth`'s
`trainingBonusRemainders` / `facilityStaBonusRemainder` are persisted; the shadow's
are discarded.** This is the single most important invariant in the change and
belongs in a comment at the call site.

Semantics of the result: displayed REF is "what this keeper would read if Keeper
Drills had never been halved," carried through this player's real age band,
facilities, archetype, coach and request modifiers, and through SUPER.

### Where that claim is exact, and where it is only close

**Exact** for the structural channel — age band, facility multiplier and request
scale — because those are a multiply-and-round applied to `rolledGain`, and the
shadow rounds the doubled base the same way the real call rounds the single one.

**Approximate** for the percent channel. `applyInstantGrowthModifiers` banks
sub-point percent bonuses as hundredths in `trainingBonusRemainders`
(`training.ts:246-266`), and a goalkeeper always earns one:
`POSITION_TRAINING_ATTRIBUTES.GK` includes `ref` at
`POSITION_TRAINING_BONUS_PERCENT = 5` (`archetype-caps.ts:112-118`), before any
archetype or coach bonus. The shadow call reads the *real* remainder and its own
remainder is discarded, so the displayed total drifts from a true never-halved
keeper by whatever the shadow's carry would have released.

**Corrected after implementation (step 1, 2026-08-04).** An earlier draft claimed
this error "runs in the conservative direction — displayed under-counts." It does
not. The shadow reads the *real* banked balance and earns roughly double from it,
so depending where that balance sits either side can cross 100 first: the
displayed step lands within **one point either way** of twice the stored gain,
with no fixed direction. `keeper-display-bonus.test.ts` pins the bound and
demonstrates both phases.

That is why §6 rails the accumulated total rather than any single tap.

**Rejected fix:** dual-tracking a presentation-only remainder. It buys exactness
in a channel nobody can see and costs a second persisted field, which forfeits
the one property that makes this trick safe to ship — that it is a single named
integer somebody can delete in one commit (Q2). Measure the drift and document
it instead; test 12 in §7 does that.

---

## 4. Change list

Fourteen sites. The original count of ten missed the result-scene chain
(`DrillResultViewModel` and the modal that animates it) and the drill shop,
which is the surface that recreates the whole defect one panel further down the
same screen.

**The stored/displayed split is the rule everything else follows.** `before` and
`after` on `InstantDrillResolution` are the *stored* stat and must stay that way:
`training.ts:203-204` sets `after: growth.value`, which is literally the new
persisted attribute, and `store.test.ts:288` pins that contract by asserting the
saved player's attribute equals `result.after`. Displayed values travel beside
them under their own names, never over them.

(That test asserts on PAC, where displayed and stored are equal, so it would not
actually fail if the fields were overloaded. It is cited as the statement of
intent, not as the tripwire. The tripwire is test 13 in §7.)

### 4.1 State

| # | file | change |
|---|---|---|
| 1 | `src/game/types.ts:92` `CareerPlayer` | add `refDisplayBonus?: number` beside the other optional M2 metadata, with a comment stating it is presentation-only and never read by sim, lineup, or valuation |

### 4.2 Increment

| # | file | change |
|---|---|---|
| 2 | `src/game/training.ts` `trainPlayerInstantly` (~line 145) | compute the shadow gain and carry `refDisplayBonus` onto `trainedPlayer` |
| 3 | `src/game/training.ts` `InstantDrillResolution` | add `displayedBefore` / `displayedAfter` **beside** `before` / `after`, which keep carrying the stored stat. For every non-REF drill the two pairs are equal |

`src/game/progression.ts:202` (`applyTrainingPlan`) also mutates attributes, but it
is referenced only by its own test — dead in the live career. **Reviewer: confirm.**
If it is ever revived it must gain the same increment or displayed REF silently
under-counts.

### 4.3 Single display helper

| # | file | change |
|---|---|---|
| 4 | new `src/application/displayed-attributes.ts` | `displayedAttributeValue(player, attribute)` and `displayedDrillGain(attribute, gain)`. Every read below goes through these two functions so there is one place to audit and one place to delete when the trick is retired |

### 4.4 Reads

| # | file:line | field | note |
|---|---|---|---|
| 5 | `view-models.ts:1878` | `attributes[].value` | squad stat row, consumed only at `SquadTrainingScreen.tsx:1077` |
| 6 | `view-models.ts:1892` | `gain` | the drill row `+N` at `TrainingDrillModal.tsx:547` — authored base x 2 |
| 7 | `view-models.ts:1893` | `currentValue` | row total at `:542` and the accessibility string at `:498` |
| 8 | `view-models.ts` `baseValueAfter` / `trainingAdjustment` | confirm card at `:659` and `:675`. **Both lines shadow, not just the adjusted one** — see #9 |
| 9 | `src/game/training.ts` `instantTrainingPreview` | run the same shadow so the confirm card agrees with the count-up that follows it |
| 10 | `store.ts:182` `InstantDrillResult` | carry `displayedBefore` / `displayedAfter` through alongside the stored pair. `store.trainPlayer` spreads the whole resolution (`store.ts:1278`), so this is a type change plus the field names |
| 11 | `src/ui/models.ts:450` `DrillResultViewModel` | add the displayed pair. This is the typed boundary the modal reads; without it the new fields stop here |
| 12 | `src/ui/TrainingDrillModal.tsx` | count-up at `:572-573` and the gain / SUPER labels at `:582`, `:590` read the **displayed** pair |
| 13 | `view-models.ts:1922-1926` `drillUpgrades` | `ownedGain` and `nextGain` are raw authored gains, printed at `SquadTrainingScreen.tsx:860` and `:879` as `+2 for 10 TP` beside Sprints' `+4 for 10 TP`. Route both through `displayedDrillGain` |
| 14 | `src/persistence/game-state-codec.ts:255` `playerSchema` | declare `refDisplayBonus: nonnegativeInteger.optional()` beside `drillsSinceSuper` |

**On #9 — the confirm card needs both halves shadowed, and a ceiling that
matches the count-up.** `instantTrainingPreview` (`training.ts:81-97`) computes
`baseAfter` from the raw authored gain and `adjustedAfter` from
`applyInstantGrowthModifiers(baseGain)`, and the card prints
`baseValueAfter - currentValue` as its "Base REF / drill" line. Shadow only the
adjusted half and that line still reads `+2` next to a `+4` count-up. All three
values move together:

```ts
baseAfter    = displayCeil(currentDisplayed + baseGain * KEEPER_DISPLAY_LADDER_MULTIPLIER)
adjustedAfter = shadow modifiers over baseGain * KEEPER_DISPLAY_LADDER_MULTIPLIER
adjustment    = adjustedAfter - baseAfter
```

`displayCeil` matters and is easy to miss. `capPlayerTrainingGain` is now
`min(999, max(current, proposed))` (`archetype-caps.ts:328-339`) and it clamps
against the **stored** value. The preview must clamp against the **displayed**
ceiling instead, or near the top of the range the card promises a step the
count-up cannot show — the exact disagreement #9 exists to prevent. See §4.6.

**On #13 — the drill shop is the same screen.** A keeper's four drill rows are
fixed by #6, and then the "Upgrade a path" panel below them prints the halved
number again. Fixing one and not the other moves the defect rather than removing
it, and it was absent from both the original change list and the Q5 sweep.

### 4.5 Must NOT change

Listed explicitly because a reviewer should check each one is absent from the diff:

- anything under `src/sim/`
- `atSafetyCeiling: currentValue >= 999` (`view-models.ts:1906`) — stays on the stored value
- `capPlayerTrainingGain` (`archetype-caps.ts:328`) — it must keep binding the
  stored value. Note for the reviewer's checklist: this is no longer an
  archetype cap of any kind. Cap-free development retired those, and the
  function is now `min(999, max(current, proposed))` with both player and
  attribute arguments unused. The only thing it enforces is the 999 ceiling,
  which is why §4.6 has to name a separate display ceiling rather than reusing it
- `market.ts:313` GK rating / value / wage
- `squad.ts:70`, `squad.ts:135` — the morale-adjusted attrs handed to the sim
- `lineup.ts`, `pyramid.ts`, `youth-intake.ts`, `m2-career.ts`
- `market-view-model.ts:126` `youthStatLine` — intake candidates are untrained, bonus absent, already correct

### 4.6 Clamp

Displayed REF is clamped to 999 for presentation. The stored value is capped
independently by `capPlayerTrainingGain`. Once displayed hits 999 the count-up
stalls while the true stat still climbs. Q3 answers this: **stall the display**,
matching every other stat's ceiling.

The helper in §4.3 owns that clamp, and everything that predicts a step has to
use it rather than the stored one:

```ts
// src/application/displayed-attributes.ts
const displayCeil = (value: number) => Math.min(MAX_PLAYER_ATTRIBUTE, value);
```

**This is the part that is easy to get wrong.** `capPlayerTrainingGain` clamps
against the *stored* value, so a confirm card built on it keeps promising a full
step after the display has stopped moving — the card says `+4`, the count-up
shows nothing, and the manager has been told a number twice and shown neither.
Change #9 therefore runs both `baseAfter` and `adjustedAfter` through
`displayCeil` on the displayed current value, never through
`capPlayerTrainingGain`.

Two consequences worth stating so they are not read as bugs later:

- the drill row's `+N` (#6) is computed from the authored base and does **not**
  clamp — it is the price list, not a prediction about this player;
- `atSafetyCeiling` (§4.5) stays on the stored value, so the "maxed out" state
  and the stalled display are deliberately not the same moment. The display
  stalls first. A keeper in that window reads 999 while still genuinely
  improving, which is the accepted cost of Q3 and another reason §6's rail is
  bounded in absolute points.

---

## 5. What this does and does not deliver

**Exactly uniform:** the drill row. All four of a keeper's paths read `+4` at tier 1,
`+6` at tier 2, and so on. This is the side-by-side comparison the whole change
exists to remove, and it is exact because it is computed from the authored base.

**Uniform under the player's own modifiers:** the confirm card and the count-up.
A young keeper reads what a young keeper *would* have read on the outfield ladder.
It is not compared against another player on screen, so cross-player uniformity is
not required here.

**Unchanged and honest:** every opponent, every scouted keeper, every youth
candidate, every wage, every transfer fee, and everything the match engine sees.

---

## 6. The drift, and the tripwire

`displayed - stored` equals the cumulative shadow surplus, which is approximately
the total REF training ever invested in that player. In an opening career that is a
handful of points and invisible. Over a long career it grows without bound: a
keeper showing 200 may really be 125, and will be scouted, valued, wage-negotiated
and *simulated* as 125.

This is accepted deliberately — the owner's instruction is to fix the start and
adjust later — but "later" must announce itself rather than being discovered by a
confused player.

**Rail:** extend `src/audit/__tests__/long-career-development-probe.test.ts` (it
exists) asserting that across a full career the maximum `refDisplayBonus` on any
user player stays under a documented bound. Set the bound from the first measured
run plus headroom, in the style of `MAXIMUM_KEEPER_LEVERAGE_RATIO`, and record the
measurement in the constant's comment. When a longer career or a re-tuned ladder
outruns it, CI fails and the decision resurfaces.

### The bound is absolute points, not a ratio

The spec's own candidate of `displayed / stored <= 1.4` was reviewed and both it
and the reviewer's counter-proposal of ~1.95 are rejected. **A ratio is the wrong
instrument for this quantity**, and the arithmetic shows it from both ends.

Displayed is `B + 2S` against a stored `B + S`, where `B` is the authored REF the
keeper was generated with and `S` is the total REF training ever bought. So the
ratio is `(B + 2S) / (B + S)`, which starts at 1 and asymptotes to **2**. It can
never reach 2, and it spends its whole life in the last stretch:

| bound | implies | at `B = 34` (an opening D5 keeper) |
|---|---|---|
| 1.4 | `S <= 0.67B` | trips after **~11 tier-1 taps** — a first season |
| 1.95 | `S <= 19B` | needs `S = 646`; the 999 ceiling arrives first, so it **can never fire** |

One rail is a false alarm in season one and the other is decoration. There is no
ratio between them that is meaningfully better, because the ratio compresses
exactly where the harm grows.

The harm is not scale-free. `displayed - stored` **is** the number of Reflexes
points that the scout, the wage negotiation, the transfer valuation and the match
engine all disagree with the manager about. A keeper reading 200 who is really
125 misleads by 75 points whether that ratio is 1.6 or 1.06. So bound the thing
that is actually wrong:

```ts
/**
 * Most points a keeper's displayed Reflexes may run ahead of the stored value
 * before the display trick has to be retired for a real axis rescale (§2b).
 *
 * Measured: <fill from the first long-career-development-probe run>.
 * This is the gap the scout, the wage, the transfer fee and the match engine
 * disagree with the manager by, so it is bounded in points and not as a ratio —
 * the ratio asymptotes to 2 and cannot discriminate. See §6.
 */
const MAXIMUM_KEEPER_DISPLAY_DRIFT = 460;
```

Measure first, then set it. Do not guess the constant — that is what produced the
1.4 candidate.

### Measured 2026-08-04

A D5 opening keeper at Reflexes 46, trained on Keeper Drills every week:

| taps | stored | bonus | displayed |
|---:|---:|---:|---:|
| 150 (5 seasons) | 594 | **412** | 999 (stalled) |
| 260 (stored ceiling) | 999 | 713 | 999 |

Bound set at 460 — the 150-tap figure plus roughly a tenth.

Two things the measurement changed:

1. **It found a bug in step 1.** The banked bonus was being clamped to
   `999 - stored`, so as the stat climbed it was driven *down* — 405 at 150 taps,
   then 5 by the time stored reached the ceiling, while the card still read a
   stalled 999. The field had come to mean "whatever fits under the ceiling"
   rather than "how far the display has been allowed to run ahead", and the rail
   would have measured nothing. The ceiling now applies on read, in
   `displayedValue`, and the banked figure is monotonic. The rail asserts that
   monotonicity so it cannot regress.
2. **It shows how large this gets.** At the stored ceiling the display leads by
   713 points. That is the endgame this trick signs up for, and the argument for
   doing the real axis rescale (§2b) before a career ever reaches it.

---

## 7. Test plan

There is no `src/game/__tests__/training.test.ts`. The live homes are
`instant-training.test.ts` (drill resolution) and `m2-training-growth.test.ts`
(age, facility and remainder patterns). Tests 1-6 and 12 go in a new
`src/game/__tests__/keeper-display-bonus.test.ts` so the trick has one file to
delete with it; test 7 belongs with the codec's own round-trip tests.

Unit, `src/game/__tests__/keeper-display-bonus.test.ts`:

1. A prime-age keeper with no facilities trains REF once: stored +2, `refDisplayBonus` +2, displayed step +4.
2. A 22-year-old keeper: stored +3 (`round(2 x 1.3)`), displayed step **6**, not
   the `round(4 x 1.3) = 5` this line originally predicted. The percent channel
   releases a point on the doubled base, and a comparable outfielder receives it
   too. Measured in step 1; do not "fix" it back to 5.
3. A 31-year-old keeper: stored +1, displayed step equals `round(4 x 0.6) = 2`.
4. SUPER: `rolledGain` 3 and 6 respectively; displayed step matches the outfield SUPER.
5. Keeper Court level 2 present, Gym absent: the multiplier applies to both real and shadow, so the displayed step is the outfield-ladder value under the same Keeper Court.
6. An outfield player training any stat leaves `refDisplayBonus` absent.
7. Saving and reloading a career preserves the bonus; a schema-1 save without the field loads with displayed == stored.

12. **Drift, measured not asserted.** A GK trains REF twenty times with the +5%
    position bonus live. Record `displayed - (stored_start + 2 x total_stored_gain)`
    and assert it stays within one point per ten taps in the under-count
    direction. This is the test that documents §3's approximate channel; if it
    fails upward, the shadow is over-counting and the invariant is broken.

Integration, `src/application/__tests__/`:

8. `selectedPlayerStatOptions` for a GK reports `gain: 4` on Keeper Drills 1 and `gain: 4` on Sprints 1.
9. `atSafetyCeiling` flips at stored 999, not displayed 999.
10. A scouted keeper and a generated opponent keeper report their stored REF unchanged.
13. **`drillUpgrades` for a GK reports `ownedGain: 4` on Keeper Drills tier 1 and
    `nextGain: 6` on tier 2** — the shop panel, matching test 8's drill rows.
14. **The stored/displayed split holds at the store boundary.** After a GK trains
    REF, `lastDrillResult.after` equals the saved player's `attrs.ref` while
    `lastDrillResult.displayedAfter` is strictly greater. This is the real
    tripwire for §4's rule; `store.test.ts:288` only covers PAC, where the two
    are equal and an overload would pass unnoticed.

Regression:

11. Full `src/sim` and `src/game` suites green with no fixture edits. **Any fixture
    that needs editing means the change leaked into balance and the diff is wrong.**
    Note that `keeper-drill-gain-probe` and `keeper-drill-price-probe` are opt-in
    (`describe.skip` without their env vars) and so cannot catch a leak here — 11
    is carried by the rails that do run, chiefly
    `src/audit/__tests__/training-leverage-rails.test.ts`.

Visual: screenshot of the keeper's card showing **both** the four drill rows and
the upgrade panel below them, before and after.

---

## 8. Open questions — answered

Round 1 closed five of these. Only Q4 still needs a decision, and it needs a
probe run rather than an opinion.

- **Q1. Answered: safe.** `applyInstantGrowthModifiers` mutates nothing on the
  player — it spreads a fresh `trainingBonusRemainders` object
  (`training.ts:246`), reads `player.attrs` without writing, and its
  `facilityStaBonusRemainder` block is guarded by `attribute === 'sta'`, which
  the REF path never enters. Calling it twice with the same arguments returns the
  same values. Discarding the shadow's remainders remains mandatory.
- **Q2. Answered: keep the single named integer.** Generalising to a record buys
  nothing today — REF is the only halved ladder — and costs the property that
  makes this safe to ship, which is that one grep and one commit remove it. This
  is also why §3 rejects the dual-remainder fix.
- **Q3. Answered: stall the display at 999.** It matches every other stat's
  ceiling, and the alternatives are worse: letting it exceed 999 breaks the
  shared `assertAttributeValue` range, and dropping the bonus to reveal the true
  number makes a keeper's Reflexes visibly fall mid-career with no in-game cause.
  Document the stall. §4.6 and change #9 carry the consequence.
- **Q4. Still open, and it is the only real one — but not for the reason first
  written here.** An earlier revision of this section claimed the gain probe
  might show the ladder could carry 3 or 4 at equal price, making the whole spec
  unnecessary. That was wrong: the probe sweeps `[1, 0.75, 0.5, 0.4, 0.3, 0.2]`
  and targets a 1.5x leverage ratio against today's 6.61x, so the only direction
  under investigation is **down** (§2e). The halved ladder is not merely
  load-bearing; it may not be halved enough.

  What that changes is smaller than it first appears. A x0.4 ladder moves the
  drift from +2 to +3 per tap — half again, not four times, whatever the 2:1 to
  4:1 ratio suggests. **Decision: build the spec.** The one requirement it adds is
  that `KEEPER_DISPLAY_LADDER_MULTIPLIER` be derived from the content rather than
  written as a literal 2, so a re-tune carries the display with it. Run the probe
  at low seed count first (§9 step 0) purely for sequencing: if a content change
  is imminent, land it before the display layer rather than after.
- **Q5. Answered: the sweep was incomplete.** It missed the drill shop
  (`view-models.ts:1922-1926` printed at `SquadTrainingScreen.tsx:860` and
  `:879`), which is on the same screen as the rows it did find. Corrected sweep:
  three surfaces take the bonus — the squad stat row, the drill popup
  (rows, confirm card and count-up), and the upgrade panel — and two are
  untrained players needing no change (`MarketScreen.tsx:354`, `:478`). A
  first-principles grep confirms no match HUD, lineup screen, season recap or
  dialogue string prints an attribute value: the UI reaches attributes only
  through the view-model layer enumerated in §4.4, never through `attrs.*`
  directly.

### Original wording, kept for the record

- **Q1.** Is the double call to `applyInstantGrowthModifiers` safe in every branch?
  Specifically the `attribute === 'sta'` facility-bonus block and the
  `trainingBonusRemainders` banking — the shadow's returns are discarded, but
  confirm neither reads mutable state that the first call already advanced.
- **Q2.** Should `refDisplayBonus` be generalised now to
  `attributeDisplayBonus?: Partial<Record<keyof Attrs, number>>`? REF is the only
  halved ladder today. A record is more future-proof; a single named integer is
  easier to delete cleanly when the axis is eventually rescaled for real. The spec
  currently chooses the integer.
- **Q3.** Behaviour when displayed REF reaches 999 while stored has headroom: stall
  the display, or let it exceed 999, or drop the bonus and reveal the true number?
- **Q4.** Is this trick worth doing at all given option 2b (real axis rescale) is
  permanent and drift-free? The argument for this spec is that it is presentation-
  scoped and reversible; the argument against is that it is a second number to
  maintain and it decays. A reviewer who prefers 2b should say so plainly.
- **Q5 (answered, stated for confirmation).** A sweep of `src/ui` finds exactly four
  surfaces that print a player's REF. Two are the user's own squad and take the
  bonus — `SquadTrainingScreen.tsx:1077` and `TrainingDrillModal.tsx:542/582/590`.
  Two are untrained players and are already correct with no change —
  `MarketScreen.tsx:354` (`YouthStatLine`, intake candidates) and
  `MarketScreen.tsx:478` (scouting report stats). No match HUD, lineup screen,
  season recap or dialogue string prints an attribute value. Reviewer: confirm the
  sweep rather than trusting it.

---

## 9. Implementation sequence

Fourteen sites, but they fall into five commits that each leave the tree green.
**Step 0 may cancel the other four.**

### Step 0 — Find out where the ladder is going before hardcoding where it is

```
KEEPER_GAIN_SEEDS=25 KEEPER_GAIN_PROBE=1 npm run test:probe -- src/audit/__tests__/keeper-drill-gain-probe.test.ts
```

Low seed count first — the full 150-seed run is ~2,100 opening simulations.

Read the sweep against `training-leverage-rails`' 6.61x. The probe only walks
**down** from today's ladder toward its 1.5x target, so the question it answers
is how much further `gains.ref` has to fall, not whether it can rise (§2e).

Two outcomes, two orders:

- **A re-tune looks imminent** (the sweep lands well below 1.0): land the
  `content/training.json` change *first*, re-run `training-leverage-rails`, and
  build the display layer on the settled ladder. Building first means building
  twice, because the display gap is defined by the gap this change is about to
  widen.
- **Today's ladder holds**: proceed straight to step 1.

Either way, express `KEEPER_DISPLAY_LADDER_MULTIPLIER` as outfield-gain over
keeper-gain read from the content, not as a literal 2, so a future re-tune
carries the display with it.

### Result, 25 seeds, 2026-08-04 — inconclusive, proceeded anyway

```
  x   gains I..V  taps  refAfter  goalsPrev/100TP  ratio  keeperArm L%  ordinary W%  ordinary L%
 1.00    2/3/5/7/9   7.0        70            2.743 -16.00         76.0%         8.0%        80.0%
 0.75    2/2/4/5/7   7.0        70            2.743 -16.00         76.0%         8.0%        80.0%
 0.50    1/2/3/4/5   7.0        55            0.743  -4.33         92.0%         0.0%        96.0%
 0.40    1/1/2/3/4   7.0        55            0.743  -4.33         92.0%         0.0%        96.0%
 0.30    1/1/2/2/3   7.0        55            0.743  -4.33         92.0%         0.0%        96.0%
 0.20    1/1/1/1/2   7.0        55            0.743  -4.33         92.0%         0.0%        96.0%

striker reference: goals created/100TP = -0.171
```

Not decision-grade, for two reasons visible on its face:

- **The striker reference is negative.** The finishing arm scored *fewer* goals
  than the control, so the ratio column's denominator is negative and every
  ratio printed is meaningless. A usable run needs a positive striker lift.
- **The bands collapse.** 1.00 and 0.75 are byte-identical, and 0.50 through 0.20
  are byte-identical to each other — six ladders producing two outcomes. At 25
  seeds the arms are not separating.

What it weakly suggests, pending a real run: halving again moves keeper-only
losses 76% → 92% and ordinary opener wins 8% → 0%, i.e. the lower ladders bite
hard. Nothing here says a re-tune is imminent, and nothing says today's ladder is
safe.

**Decision: proceed to step 1.** The sequencing risk this run was meant to
retire is already covered by deriving the multiplier from content — a later
re-tune carries the display with it and costs no rework. Re-run at the full 150
seeds before acting on the ladder itself.

### Step 1 — The field and the arithmetic (no UI)

1. `types.ts` — `refDisplayBonus?: number` on `CareerPlayer`, commented as
   presentation-only and never read by sim, lineup or valuation (#1).
2. `training.ts` — the shadow gain in `trainPlayerInstantly`, with the
   discard-the-shadow's-remainders invariant as a comment at the call site (#2).
3. `training.ts` — `displayedBefore` / `displayedAfter` on
   `InstantDrillResolution`, beside the untouched stored pair (#3).
4. `game-state-codec.ts` — declare the optional field (#14).

Tests 1-7 and 12 pass here. Nothing on screen has changed yet, which is the point:
if any `src/sim` or `src/game` suite moves at this step, the shadow has leaked
into the real path and the rest of the plan is unsafe to build.

### Step 2 — The single helper

5. `src/application/displayed-attributes.ts` — `displayedAttributeValue` and
   `displayedDrillGain` (#4).

No call sites yet. One file, one place to audit, one place to delete.

### Step 3 — The reads, all of them in one commit

Deliberately not split, because a half-applied display is worse than none: a card
promising `+4` over a count-up landing `+2` is a bug report, whereas the current
uniform `+2` is merely unflattering.

6. Squad stat row, drill rows, row total (#5, #6, #7).
7. Confirm card — `instantTrainingPreview` shadowing base *and* adjusted against
   the display ceiling, then `baseValueAfter` / `trainingAdjustment` (#8, #9).
8. Result chain — `store.ts` → `ui/models.ts` → `TrainingDrillModal` (#10, #11, #12).
9. Drill shop `ownedGain` / `nextGain` (#13).

Tests 8, 9, 10, 13, 14 pass here. Take the §7 screenshot at the end of this step:
drill rows and upgrade panel in one frame, all four paths reading `+4`.

### Step 4 — The tripwire

10. Measure `refDisplayBonus` across a full career in
    `long-career-development-probe`, then set `MAXIMUM_KEEPER_DISPLAY_DRIFT` from
    that measurement plus headroom and assert it (§6). Record the measured number
    in the constant's comment.

Measured, then asserted. A guessed constant here is how the 1.4 candidate
happened.

### Ordering constraints

- Step 1 before everything: the displayed values do not exist until it lands.
- Step 4 after step 1, and it needs no UI — it can run in parallel with step 3.
- Step 2 before step 3, or the reads duplicate the helper inline and there is no
  longer one place to delete.

### The deletion path, for whoever retires this

`grep -rn refDisplayBonus src/` reaches every site. Remove the field, the two
helpers in `displayed-attributes.ts`, the `displayed*` pair on
`InstantDrillResolution` / `InstantDrillResult` / `DrillResultViewModel`, the
codec line, the rail constant and `keeper-display-bonus.test.ts`. Nothing in
`src/sim/` ever referenced it, which is the property that makes that grep
sufficient rather than merely indicative.
