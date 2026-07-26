# Duel Punctuation — Beaten Defenders, Breakaways, and the Cover Slide

**Date:** 2026-07-26
**Status:** IMPLEMENTED as engine m1.30. Revised twice — after external review,
then again by measurement during implementation. See "What implementation
changed" for the three design claims in this document that measurement
disproved.
**Author:** brainstormed with Claude

## Problem

Two players lock onto each other and grind up the pitch. The same contact sound
plays on every attempt, the passing rhythm stalls, and slide tackles are almost
never seen.

Measured over 30–40 seeded ROVERS vs UNITED matches (200s each; the probes that
produced these numbers are promoted into the repo as part of Verification below):

| Measurement | Value |
|---|---|
| Standing challenges per match | 121 — one every **1.7s** of match time |
| Of those, the defender wins | 20.5% (25/match) |
| Held-ball ticks with an opponent inside 2.5m | **58%** |
| Lock spells ≥2s (same carrier, same defender) | 10/match; ~6 last ≥3s |
| Ground covered during a long lock spell | 10.9m, travelled together |
| Slides launched / contacting / won | 5.1 / 0.9 / 0.4 per match |

Three separate causes:

**A failed challenge costs the defender nothing.** `standingTackle` sets
`tackleCooldownUntil = tick + 10` and stops there. The defender keeps his feet,
keeps his standoff ring, and re-rolls exactly 1.0s later. Since a carrier
dribbles at 0.37× speed while a defender closes at full speed (see the
`pressStandoffRadius` comment in `engine.ts`), **no carrier can escape a presser
by running** — the only exits are pass, shoot, or lose it.

**Every attempt plays the full contact sound.** `audio.ts` maps any `TACKLE`
with `contact` to `['tackle-thud', 'grunt']`, so 121 body impacts per match, 96
of which changed nothing.

**Slides are gated to defenders, but the duels happen in midfield.** Two probes
were needed here, and both killed an assumed cause:

- Misses are not geometric. Of 204 resolved slides, **0%** missed by drifting
  off target — every slide whose target still held the ball made contact. The
  82.8% that missed did so because the carrier released the ball during the
  0.2–0.4s flight.
- The reason slides are *rare* is the role gate. At the moment a standing
  challenge is lost, the nearest cover is a **MID 79.0%** of the time, a FWD
  18.5%, and a **DEF only 2.5%**. `slideLaunchRange` returns 0 for anyone who is
  not a `DEF`, so across 3,705 lost challenges *any* opponent satisfied every
  slide gate in **0.8%** of them.

The renderer is already ahead of the sim: `tackle-poses.ts` staggers the beaten
challenger on roughly 100 events a match, and `duel-scuff.ts` draws the contact
mark. Both are pure cosmetics over unchanged state. The eye reads a stagger, then
sees the same defender instantly back on the ball. That mismatch is what reads as
slowdown.

## Goals

- A beaten defender pays a real, visible price. **No single defender re-rolls
  past three live failures against one carrier.** This caps the tail rather than
  shortening the median — the median duel is already one attempt; what it kills
  is the 6.5% of duels that run 4–10 attempts.
- The full-weight body impact (`tackle-thud` + `grunt`) drops from one every
  1.7s to roughly **one every 9s**.
- Slide tackles become part of the match's texture, on the authored breakaway
  beat specifically.
- TEC buys something the player can see: beating your man.
- No new currency, no new player input, no fouls or free kicks.

## Non-goals

- Free kicks, cards, or any foul model. The sim has no fouls (`CARD` is a
  declared event type that nothing emits) and this design does not add one — a
  defender on the floor is purely a positional consequence.
- A carrier speed boost. Measurement showed one is not needed (see Numbers).
- Any change to the standoff ring, the presser lease, or dribble speed.
- Heat for the carrier on a forced drop. Considered and declined (owner decision,
  2026-07-26): the mechanic ships Zone-pacing-neutral, the breakaway is its own
  reward, and a Heat reward can be added later as its own measured change.
- Slide *geometry* changes. Aim-leading or a wider `SLIDE_CONTACT_RANGE` would
  repair a failure mode measured at 0%.
- Forwards sliding. The role relaxation in §6 covers MID only.

## Design

### 1. Margin decides the fall, using the roll that already exists

`standingTackle` currently calls `contest()`, which hides its roll. Inline it to
`contestProbability` plus one explicit `state.rng()` — both already imported —
so **the same draw** decides win/loss and, on a loss, whether the defender goes
down.

Naming note: `contest()`'s parameters are (`attacker`, `defender`) where the
*attacker* is the tackler. Since this feature is about "the defender goes down",
the spec and implementation use `tacklerDef` / `carrierTec` to avoid exactly that
inversion.

```ts
const tacklerDef = effectiveStat(state, tacklerIdx, 'def') + defenseBonus(state, tacklerIdx);
const carrierTec = effectiveStat(state, carrierIdx, 'tec');
const mod = -dribbleBonus(state, carrierIdx);
const delta = tacklerDef + mod - carrierTec;      // > 0 = tackler outguns the carrier
const p = contestProbability(tacklerDef, carrierTec, mod);
const roll = state.rng();                         // ONE draw, exactly as today
const won = roll < p;
// on a loss, update the streak FIRST (staleness check + increment), so
// `streak` below already counts this failure — the third has streak === 3
const dropChance = clamp(BEATEN_DROP_BASE - 0.015 * delta, 0.10, 0.70);
// conditional on losing, roll is uniform on [p, 1] — take its top slice
const dropped = !won && canDrop && (streak >= 3 || roll > 1 - (1 - p) * dropChance);
```

`BEATEN_DROP_BASE = 0.25`, so an even duel (`delta` 0) drops the defender a
quarter of the time he loses; a carrier with a 20-point TEC edge drops him 55% of
the time; a defender 10 points stronger who still loses drops only 10% of the
time (the clamp floor).

What makes this the right shape: **RNG consumption is unchanged** — no extra
draws, so the golden diff comes purely from the new behaviour and not from stream
desync — and the threshold form `1 - (1 - p) * dropChance` yields exactly
`dropChance` *conditional on having lost*, so the stat margin is the only thing
that moves the fall rate. The roll's position inside the losing range is not an
independent "margin of defeat" lever; nothing should later be tuned expecting
one.

**Goalkeepers never drop** (`canDrop = tackler.def.role !== 'GK'`). The save
contest in `shotFlightTick` is gated on `isAvailable`, so a prone keeper would
concede any on-target shot automatically. Measured over 40 matches GKs make zero
standing challenges, so this is insurance rather than a live bug — but it is one
condition and a pinning test, and it stops a future movement change from
silently creating an open-goal exploit.

### 2. A three-failure backstop

New field on `SimPlayer`:

```ts
/** Consecutive beaten standing challenges against one carrier; the third always drops the defender. */
beatenStreak?: { targetIdx: number; count: number; lastFailTick: number };
```

Increments on a loss against the same carrier; resets on a different carrier, a
won challenge, a drop, or a restart. One detail that is not free:

- **Staleness.** The streak is keyed by `targetIdx` and possession changes hands
  constantly, so without decay a defender could carry two failures from a duel
  minutes ago and fall on first contact in a fresh one. A failure more than
  `BEATEN_STREAK_STALE_TICKS = 30` (3s) after `lastFailTick` restarts the count
  at 1 instead of incrementing.
- **Restarts.** `restartKickoff` clears `slideTackle` and `tackleRecoveryUntil`
  today; clearing `beatenStreak` there is a new line that must be added, not
  inherited.

Because the field is optional, three other lifecycle sites need no work:
`makePlayers` leaves it `undefined`, `performSubstitution` builds a fresh
`SimPlayer` literal so a substitute cannot inherit a streak, and decoy clones
are likewise constructed fresh.

Per-defender keying matches reality: 90.9% of measured grinds (runs of 3+
attempts on one carrier) are a single defender re-rolling, and a per-carrier
variant would fire in a near-identical share of grinds (71.1% vs 69.5%) while
dropping a defender who may have failed only once. Comparing `targetIdx` by
equality alone keeps this safe against expired Decoy clones — a stale index
simply fails to match and resets.

### 3. "Out of the picture" is an existing field

On a drop:

```ts
tackler.tackleRecoveryUntil = state.tick + BEATEN_FALL_TICKS;      // 8 = 0.8s
tackler.tackleCooldownUntil = state.tick + BEATEN_FALL_TICKS + 4;  // no lunge on standing up
```

`tackleRecoveryUntil` already does everything needed, so no new movement or AI
code is required:

- excludes him from `isAvailable`, so he cannot challenge
- skips his movement entirely in `movementTick`
- invalidates the presser lease, because `resolveMovement`'s lease check calls
  `isAvailable(presserIdx)`

**Timing, precisely.** The tick order is `powerTick → movementTick →
possessionTick → tackleTick`. A drop is set in `tackleTick`, *after*
`resolveMovement` has already run for that tick, so the cover is promoted to
presser on the **next** tick — 100ms later, not the same tick. Any test must
assert next-tick promotion. Explicitly clearing `state.movement.presserIdx` on
drop was considered and rejected as dead code: the lease's own `isAvailable`
check produces an identical re-pick at N+1 either way.

The same ordering means the carrier's first "I'm free" decision waits for his
next decision window (`DECISION_TICKS = 5`, so up to 0.5s), which is accounted
for in Numbers.

### 4. Render

`TACKLE` gains an optional `dropped: true`. The pose is **`knockdown`, not
`fall`** — `fall` has no `untilTick` and its duration is hardcoded to
`TACKLED_RECOVERY_TICKS = 10`, which would run 1.0s of prone animation against an
0.8s sim freeze and leave the defender moving while drawn on the floor.
`knockdown` is purpose-built for this: it holds the player prone until a supplied
`untilTick` and times the get-up to land exactly on recovery.

Touch points, none of which are free:

| File | Change |
|---|---|
| `types.ts` | `dropped?: true` on the `TACKLE` event |
| `tackle-poses.ts` | new branch returning a `challenger` `knockdown` with `untilTick`; new `challengerRecoveryUntil` input, since the existing `targetOutUntilTick` gates on the *target* |
| `MatchScreen.tsx` | pass `dropped` and the challenger's `tackleRecoveryUntil` into `tacklePoses` |
| worklet packing | carry the challenger `knockdown` through the overlay path |

No new art: `knockdown` reuses the existing prone rendering. The `impact` burst
stays knockout-only — a beaten defender gets no burst.

### 5. Audio, tiered

**Only `style: 'standing'` changes.** `slide` and `power` keep today's mapping
exactly, which matters because the current `case 'TACKLE'` arm covers all three
styles and would otherwise silently inherit the new tiers. `dropped` can only
ever be true for a standing challenge.

| style | won | contact | dropped | sound | Projected/match |
|---|---|---|---|---|---|
| standing | ✓ | ✓ | — | `tackle-thud` + `grunt` | ~20 |
| standing | ✗ | ✓ | ✓ | `body-fall` (new, soft) | ~20 |
| standing | ✗ | ✓ | ✗ | `duel-scuff` (new, light) | ~55 |
| standing | ✗ | ✗ | — | silence (unchanged) | — |
| slide | any | ✓ | n/a | `tackle-thud` + `grunt` (unchanged) | ~2 |
| slide | any | ✗ | n/a | silence (unchanged) | — |
| power | any | ✓ | n/a | `tackle-thud` + `grunt` (unchanged) | rare |

Projections assume total standing challenges fall from 121 to roughly 95, since a
drop ends a duel that would otherwise have re-rolled. They are estimates to be
replaced by measurement.

`body-fall` is an owner-supplied asset (`wet_thud.webm`), converted with the
project's own encoder to 24 kHz mono AAC and normalised to **-10.4 dBFS peak /
231 ms** — deliberately well under `tackle-thud`'s -2 dBFS so a fall reads as a
soft wet landing rather than a second impact:

```bash
ffmpeg -y -i wet_thud.webm -ac 1 -ar 24000 \
  -af "silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB:detection=peak,areverse,silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB:detection=peak,areverse,volume=-1.2dB" \
  body-fall.wav
afconvert -f m4af -d aac -b 64000 body-fall.wav body-fall.m4a
```

It lands in `assets/audio/sfx/` alongside the 16 existing hand-supplied assets
(`flame-hit`, `positive`, `bert-voice-*`, …) that sit outside `SFX_CATALOG`, so
the procedural catalog and `verify.mjs` are untouched.

`duel-scuff` is procedural: one new `SFX_CATALOG` entry (~80 ms, target -14 dB)
plus a recipe in `gen-sfx.mjs`, appended at the end of the catalog so the
index-seeded generators stay byte-stable. Naming matches the existing visual of
the same name.

Net effect: the full-weight `tackle-thud` + `grunt` pair goes from 121 a match to
~22 — one per 9s instead of one per 1.7s. One listen-test caveat: ~55 scuffs is
still a sound every ~2s of match time. If it reads as noise in play, the fallback
is visual-only for beaten-stays-up (the `duel-scuff` mark already exists), a
one-line change to the mapping's return array — tuned by ear, not specced harder
here and not worth a config flag.

### 6. The cover slide, scoped to the breakaway

Measurement rules out both easier stories: geometry is not the miss cause (0%
whiff), and the fall mechanic does not deliver slides on its own (any opponent is
slide-eligible in 0.8% of lost challenges, because 79% of covers are midfielders
and `slideLaunchRange` is `DEF`-only).

That role gate is deliberate — its comment says midfielders and forwards should
"keep pressing into standing-tackle range instead of repeatedly abandoning the
team shape with the exaggerated long lunge." So this design overturns it
**narrowly**, for the authored beat only (owner decision, 2026-07-26): a
midfielder may slide *only while a beaten opponent is still on the floor near the
carrier*.

The window needs no new state — a dropped defender is exactly an opponent with
`tackleRecoveryUntil > tick`:

```ts
const BREAKAWAY_WITNESS_RANGE = 1500; // 15m

/** True while one of the carrier's markers is still down near him. */
function breakawayWindowOpen(state: MatchState, carrierIdx: number): boolean {
  const carrier = requirePlayerAt(state, carrierIdx);
  for (const i of activePlayerIndices(state)) {
    const p = requirePlayerAt(state, i);
    if (p.team === carrier.team || p.tackleRecoveryUntil <= state.tick) continue;
    if (dist2(p.pos, carrier.pos) <= BREAKAWAY_WITNESS_RANGE * BREAKAWAY_WITNESS_RANGE) return true;
  }
  return false;
}
```

In `slideLaunchRange`, the role gate becomes: `DEF` always, `MID` only while
`breakawayWindowOpen`, `FWD` and `GK` never. Every other gate — goal-side, the
8–11m band, the condition floor — is unchanged.

Two consequences worth stating rather than discovering:

- **Slide-recovery also opens the window.** `tackleRecoveryUntil` is set by slide
  success/miss recovery too, so a defender already on the floor from his own
  slide lets a midfielder follow up. That is the same picture and is accepted,
  but it widens the trigger beyond drops by roughly the current 5 slides/match.
- **Ordinary midfield pressing is untouched.** `tackleTick` only reaches the
  slide branch when no available opponent is within `STANDING_TACKLE_RANGE`, and
  the window requires a body on the grass, so a midfielder cannot lunge in normal
  play.

Projected effect, to be measured not assumed: slides launched 5.1 → ~7 per match,
and because every slide against a carrier who keeps the ball connects, slide
*contacts* should rise from 0.9 toward ~2.5. If the measured contact rate stays
near 17%, the follow-up (a separate change) is a hurried-release pressure
mechanic, not geometry.

## Numbers, and why 0.8s

At the moment a challenge is lost, the cover defender is a measured **8.2m** from
the carrier (median 7.5m). The carrier dribbles at 4.0 m/s, a defender runs at
10.2 m/s, so the gap closes at up to 6.2 m/s net and the cover reaches the 2m
tackle range in about **1.0s**.

That cover clock, not the fall length, governs the breakaway. A 0.8s fall lands
just inside it. Against that, three effects push the real window slightly the
other way: the cover is leased a tick late (§3), it steers to the standoff ring
before entering tackle range, and the carrier's own reaction waits up to 0.5s for
a decision window. So 0.8s is a defensible starting point rather than a proven
optimum, and both it and the drop rate are swept in Verification.

What does vary is where the cover starts: inside 6m in 29% of drops (0.65s, a
cleaner handover), 6–10m in 41% (a beat of space), and beyond 10m in **30%** —
those are the genuine breakaways, and the case where a longer fall could still
matter. At `BEATEN_DROP_BASE = 0.25` that is roughly 20 falls a match (one per
10s), of which ~6 open into real space.

**Limit on this analysis:** the counterfactual could not be measured directly.
Today the glued defender re-challenges within 1.0s, so a cover only ever arrives
in 3.6% of lost challenges — there is nothing to sample. The 1.0s figure is
arithmetic from measured speeds and is the *fastest* case, a straight-line chase.

## Verification

- `ENGINE_VERSION` m1.29 → m1.30. Replay-affecting, so **both** goldens are
  rebaselined as a deliberate decision, per CLAUDE.md:
  - the detailed Jest snapshot in `parity-replay.test.ts`
  - `EXPECTED_RUNTIME_GOLDEN` in `runtime-golden.ts`, a hash over every event
    payload that is asserted in Node CI *and* the app's Hermes boot path. Adding
    `dropped` changes it; missing this fails CI and breaks app boot.
- Balance harness assertions must still pass. Two distinct pressures, not one:
  - **Goals.** ~20 turnovers-into-space per match will raise scoring against a
    current ~2.4 goals/match and 1.5–4.0 rails.
  - **Heat.** `TACKLE_ATTEMPT_GAUGE = 3` against `ZONE_HEAT_THRESHOLD = 60` means
    20 attempts fund one Zone. Cutting 121 → ~95 attempts removes ~78 Heat a
    match from defenders, about **1.3 Zones' worth**. Zone-opening counts per
    role belong in the before/after table, not just the goals rails.
- Sweep both dials rather than only `BEATEN_DROP_BASE`: `BEATEN_FALL_TICKS`
  ∈ {8, 12, 15} × `BEATEN_DROP_BASE` ∈ {0.15, 0.25, 0.35}, reporting goals,
  Zone openings, falls/match, and lock spells ≥3s. Ship 8/0.25 unless the sweep
  contradicts it.
- Hard targets: lock spells ≥3s → ~0, `tackle-thud` ≤ 25/match, falls ≈ 20/match,
  no single duel exceeding 3 attempts by one defender. Observational: slide
  launches and contact rate.
- New unit tests: the delta→drop-chance mapping at its edges and clamps; the
  three-streak backstop, its staleness window, and each reset path (including
  `restartKickoff`); GKs never drop; a dropped defender blocked from both
  challenging and moving; cover promoted to presser on the tick **after** the
  drop; `breakawayWindowOpen` true only while a nearby opponent is down; a MID
  slide rejected outside the window and accepted inside it; the full audio matrix
  including slide and power styles unchanged; `knockdown` `untilTick` equal to the
  sim recovery tick.
- Probes are promoted from the scratchpad into
  `src/audit/__tests__/duel-punctuation-probe.test.ts` — that directory and the
  `-probe.test.ts` suffix are what `testPathIgnorePatterns` actually matches, so
  they stay opt-in via `npm run test:probe` instead of adding ~60s to every CI
  run.

## What implementation changed

Three claims above were wrong, and the corrections are the useful part of this
document. Shipped values live in `engine.ts`; the numbers here are why.

**1. The drop-chance clamp band, not the base rate, sets the rate.** A carrier's
TEC usually exceeds his marker's DEF (measured mean delta at a lost challenge:
-19.7 even, -36.8 for the weaker side of a +20 mismatch), so the curve sits above
its ceiling in nearly every duel. The specced `[0.10, 0.70]` band produced **36
falls a match** — one every 5.5s, the slapstick the design set out to avoid — not
the ~20 projected. Shipped `[0.12, 0.20]`, measured at 23.6 falls a match.

The spec's own tuning advice was backwards: it said to lower `BEATEN_DROP_BASE`
if scoring drifted. Lowering it *worsens* a mismatch (a 0.15 base measured a
3.26x fall-rate asymmetry against 2.68x at 0.25), because the ceiling still lets
a lopsided duel drop often while ordinary duels drop less. **Tune the ceiling for
blowouts, the base for tempo.**

**2. Standing-challenge volume did not fall.** The audio table projected 121 ->
~95 attempts because a drop ends a duel. Measured: 122.5, unchanged — the floored
defender simply returns 0.8s later, and the presser role rotates. The audio win
came entirely from tiering, not from fewer events: `tackle-thud` fell 121 -> 30.2
a match (one per 6.6s, not the one-per-9s the goals claimed).

**3. Midfield breakaway slides were cut.** §6 was built and reverted:

| Variant | slides/match | even goals | +20 p95 margin | rails |
|---|---|---|---|---|
| HEAD (before) | 5.1 | 2.380 | 9 | pass |
| MID slides, unrestricted | 10.6 | 2.390 | 10 | **fail** |
| ...gated on a real chance of winning | 10.6 | 2.355 | 10 | **fail** |
| ...also limited to own defensive third | 6.4 | 2.220 | 9 | pass |
| **shipped: no MID slides** | 6.3 | 2.180 | 9 | pass |

Unrestricted it handed the dominant side ~4 extra winning challenges a match and
broke the blowout rail. Gating on win chance did not help — the strong side's
midfielders were the ones passing the gate. Restricting to the own third passed,
but left the whole path at **0.10 slides a match**: three conditions and four
constants for two slides per twenty matches.

Cut, because the slides arrived from defenders anyway. Flooring a beaten defender
leaves the carrier in open space, and a carrier in space keeps the ball rather
than passing — which was the measured cause of slide misses all along. With no
change to `slideLaunchRange`: launches **5.1 -> 8.9**, contact rate **17% ->
44%**, slides won **0.4 -> 1.4** per match.

**Shipped result** (`duel-punctuation-probe`, 30 seeds):

| | before | after |
|---|---|---|
| lock spells >= 3s | ~5.6/match | **0.3/match** |
| `tackle-thud` | 121/match (1 per 1.7s) | **30.2/match (1 per 6.6s)** |
| falls | — | 23.6/match (1 per 8.5s) |
| slides landing | 0.9/match | **4.0/match** |
| even-match goals | 2.380 | 2.180 |

Scoring did not inflate — it fell slightly. The Heat concern in Verification is
moot for the same reason volume didn't fall: attempt count is unchanged, so
`TACKLE_ATTEMPT_GAUGE` income is unchanged.

## Risks

- **Scoring drift.** Mitigation: `BEATEN_DROP_BASE` is one constant, swept
  against the harness before merge. If goals clear ~3.0, prefer lowering the
  drop rate over shortening the fall — the fall is already matched to the cover
  clock.
- **Zone pacing.** The Heat reduction above is a second-order effect that no
  balance rail measures directly. If defender Zone openings fall materially,
  the fix is a small `TACKLE_ATTEMPT_GAUGE` increase, not a drop-rate change.
- **TEC double-dips.** TEC already lowers the defender's win rate and now also
  raises his drop chance. Intended (it is the stat that should buy beating your
  man), but it makes TEC the strongest attacking attribute in duels and should be
  re-checked against the per-attribute value table.
- **Slapstick.** Bodies hitting the deck too often reads comic rather than
  dramatic. 0.25 was chosen over 0.35 for this reason.
- **Shape damage.** A prone defender is frozen out of the formation for 0.8s, and
  a breakaway MID slide pulls a second player out of shape. At ~20 drops and ~2
  extra slides a match this is small per player, but it is a real cost — watch the
  off-ball y-velocity correlation measurement, which exists to catch exactly this.
