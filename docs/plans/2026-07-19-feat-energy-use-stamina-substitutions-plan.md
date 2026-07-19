---
title: "feat: Add energy use, meaningful fatigue, and automatic substitutions"
type: feat
date: 2026-07-19
---

# Energy Use, Meaningful Fatigue, and Automatic Substitutions

## Overview

Turn stamina from a nearly invisible number into a live match-management system.
Watched matches gain a team-wide **Energy Use** control beneath Formation,
Playstyle, and Swap. **Playstyle** continues to decide tactical intent; Energy
Use decides how hard the team works to carry out that intent.

At the same time, retune Balanced fatigue so the weak opening squads genuinely
need fresh legs. If the original starters are left on for the full match, their
full-time energy should span **0–60%**, with the most exhausted player
reaching approximately **0% near full time**. Halftime restores exactly **+10**.
The uncontrolled team uses deterministic Energy Use decisions and up to three
automatic substitutions; Quick Result auto-manages both teams.

This is a replay-affecting match-engine change. Ship it as `ENGINE_VERSION`
**m1.4**, regenerate the Node/Hermes goldens only after the new behavior and
balance rails pass, and never treat a snapshot update as a substitute for the
version decision.

## Locked Product Decisions

- Add one team-wide Energy Use axis with exactly three player-facing labels:
  **Save Energy**, **Balanced**, and **All Out**.
- Put Energy Use in a second, full-width row beneath the existing three coaching
  buttons; do not compress Formation, Playstyle, Swap, and Energy Use into four
  narrow columns.
- Playstyle controls *what* the team tries to do. Energy Use controls *how hard*
  players move, press, recover, support, and chase loose balls.
- Energy Use never directly boosts SHO, PAS, DEF, TEC, shot selection, pass
  selection, or formation targets.
- Initial mode multipliers:

  | Mode | Off-ball movement intensity | Condition drain |
  |---|---:|---:|
  | Save Energy | `0.90x` | `0.60x` |
  | Balanced | `1.00x` | `1.00x` |
  | All Out | `1.12x` | `1.65x` |

- Low STA applies after the selected mode: `base cost × STA multiplier × Energy
  Use drain multiplier`.
- Balanced opening squads must already tire enough to make substitutions matter;
  All Out is not the only mode in which fatigue becomes relevant.
- Halftime condition recovery changes from `+15` to **`+10`**, clamped at 100.
- Every match keeps the existing maximum of three substitutions.
- Watched match: the user substitutes manually; the opponent substitutes
  automatically.
- Quick Result: both teams substitute and manage Energy Use automatically.
- A player at 0 condition stays on the pitch if no substitute is available. The
  existing fatigue performance funnel and slide-tackle floor continue to make
  that player a major liability; there is no automatic injury or forced removal.
- The Swap button shows a dynamic warning such as `3 TIRED · 0/3 USED`.
  `3 TIRED` means three current on-field players are at or below the tired
  threshold; it is not another substitution counter.

## Non-Goals

- Do not increase the three-substitution limit.
- Do not add per-player effort instructions, roles, or work-rate sliders.
- Do not make Energy Use a new persistent currency or career resource.
- Do not add random AI coaching decisions; every decision must derive from the
  current deterministic match state.
- Do not add injuries, cramps, fouls, cards, or forced removals as part of this
  feature.
- Do not persist a preferred Energy Use mode between matches yet. Every watched
  match starts Balanced; Quick Result starts from the same engine default before
  automatic coaching reacts.
- Do not implement between-match condition carryover in this change. It remains
  a separate career-layer feature even though the design documentation calls for
  it later.

## Current-State Findings

- `src/sim/tactics.ts` currently stores only formation and mentality in
  `TeamTactics`.
- `src/sim/engine.ts` drains condition only through ordinary/sprint movement and
  slide launches. The opening clubs' narrow STA range makes the current
  difference difficult to perceive.
- `src/sim/match.ts` restores `+15` condition at halftime, starts every player at
  100, and only processes coaching inputs for `controlledTeam`.
- `src/render/MatchScreen.tsx` has a three-column coaching row. Energy is visible
  for the current/last carrier, while the Swap grid shows small bars without
  visible numeric percentages until a player is selected.
- Quick Result runs the same engine with no controlled team, but the engine has
  no automatic substitution or Energy Use policy today.
- Manual substitutions are replay inputs. Automatic opponent decisions must not
  masquerade as controlled-team inputs; they should be deterministic engine
  decisions that regenerate during replay.

## Technical Design

### 1. Add Energy Use to team tactics

Update `src/sim/tactics.ts`:

- Add `ENERGY_USE_MODES = ['SAVE_ENERGY', 'BALANCED', 'ALL_OUT'] as const`.
- Add the `EnergyUse` type and `isEnergyUse()` runtime guard.
- Extend `TeamTactics` with `energyUse: EnergyUse`.
- Centralize the mode tables as checked constants:

  ```ts
  ENERGY_DRAIN_MULTIPLIER = {
    SAVE_ENERGY: 0.60,
    BALANCED: 1.00,
    ALL_OUT: 1.65,
  }

  ENERGY_MOVEMENT_MULTIPLIER = {
    SAVE_ENERGY: 0.90,
    BALANCED: 1.00,
    ALL_OUT: 1.12,
  }
  ```

- Provide small pure queries rather than reading UI labels inside the engine:
  `energyDrainMultiplier(mode)` and
  `energyMovementMultiplier(mode, condition)`.
- Fade All Out's positive movement bonus as condition approaches zero so a
  fully exhausted player cannot obtain a free speed boost after condition is
  clamped at zero. Initial rule:

  ```ts
  allOutMovement = 1 + 0.12 * (condition / 100)
  ```

  Save Energy's deliberate movement reduction remains `0.90x`; Balanced remains
  `1.00x`.

Update `src/sim/types.ts`:

- Add `{ tick; kind: 'SET_ENERGY_USE'; energyUse }` to `MatchInput`.
- Add `{ t; kind: 'ENERGY_USE_CHANGED'; team; energyUse }` to `MatchEvent`.
- Re-export/import `EnergyUse` wherever match types require it.

Update `src/sim/match.ts`:

- Initialize both `state.tactics` entries with `energyUse: 'BALANCED'`.
- Validate `SET_ENERGY_USE` through `isEnergyUse()` and `requireControlledTeam()`.
- Apply the input to the controlled team's tactics and emit
  `ENERGY_USE_CHANGED` on the input tick.
- Extend replay-envelope input validation so malformed modes, missing controlled
  teams, and unknown input kinds fail descriptively.
- Keep initial Energy Use implicit in m1.4 rather than adding unused
  `homeEnergyUse` / `awayEnergyUse` options. The default is always Balanced;
  user changes are inputs and AI changes are derived state.

### 2. Apply effort without duplicating Playstyle

Update `src/sim/engine.ts`:

- Change ordinary condition drain to accept the player's team Energy Use mode.
- Apply drain in this order:

  ```ts
  conditionCost = baseMovementCost
    * staminaDrainMultiplier(rawSTA)
    * energyDrainMultiplier(teamEnergyUse)
  ```

- Apply the same Energy Use drain multiplier to slide-tackle condition cost.
- Scale **off-ball** movement speed by the condition-aware Energy Use movement
  multiplier. Keep the ball carrier's existing controlled-dribble scale
  independent so Energy Use does not become a second attacking playstyle.
- Leave formation targets, mentality targets, pass/shot choice weights, and raw
  action attributes untouched.
- Preserve the single-application fatigue rule: condition continues to enter
  performance through `effectiveStat()` once.

### 3. Retune Balanced opening fatigue

Start with a deliberate calibration pass, not an unmeasured constant change:

- Raise the current ordinary and sprint base costs by approximately `2.6–2.8x`
  as the first candidate. A concrete first run is ordinary `0.014` and sprint
  `0.055`, replacing `0.005` and `0.02`.
- Keep the existing STA multiplier shape for the first harness run. If the final
  energy range is correct but low- versus high-STA separation is still too
  subtle, widen the STA curve in the same change and lock its effect with a
  same-seed test. Do not change launch content ratings merely to hide a weak
  engine curve.
- Change halftime recovery to `+10`.
- Treat the empirical rails below as the contract. The candidate constants may
  move; the outcome targets should not be weakened just to make a test pass.

Balanced, no-substitution opening-match rail, measured for every shipped club
on both sides of the fixture over at least 25 career/match seeds. Run each side
once as the controlled/no-auto-substitution team so the rail observes its
original XI rather than fresh replacements:

- Every member of every original starting XI finishes inside `0–60` inclusive.
- Each XI has at least one player at `0–5` by full time.
- No player reaches 0 before minute 75 unless All Out was selected.
- By minute 70, at least three players per XI are at or below
  the tired threshold and are credible substitution candidates.
- Higher STA must remain causally valuable: in a same-seed synthetic comparison,
  the high-STA XI retains materially more condition than the low-STA XI.
- Save Energy must preserve materially more condition than Balanced; All Out
  must consume materially more than Balanced under the same seed and team.

### 4. Extract a shared substitution executor

Refactor only the duplicated mechanism, not the surrounding match state:

- Create `src/sim/substitutions.ts` and move the mutation currently inside
  `processCoachingInput()` into
  `performSubstitution(state, team, playerIndex, replacementId)`. Both
  `match.ts` and `auto-coaching.ts` import this inward-only module; neither new
  module imports `match.ts`, avoiding a circular dependency.
- Keep manual `SUBSTITUTE` validation exactly as strict as today and continue to
  append the user's input to the replay input log.
- Have both manual coaching and automatic coaching call the same executor so
  bench removal, fresh condition, inherited power policy, slot retention,
  substitution counts, and `SUBSTITUTION` events cannot drift.
- Preserve the goalkeeper-for-goalkeeper rule. Automatic fatigue substitutions
  should ignore goalkeepers in this first version; it should never waste a
  routine substitution on the keeper.
- Automatic replacements should prefer the same role and use stable player ID
  tie-breaking. If no same-role reserve exists, skip that checkpoint instead of
  placing a forward into a defensive slot.

### 5. Add deterministic automatic coaching

Create `src/sim/auto-coaching.ts` as pure simulation code. It imports no game,
render, UI, wall-clock, or ambient-randomness APIs.

#### Which teams are automatic

- Watched match (`controlledTeam` is 0 or 1): only the other team is automatic.
- Quick Result (`controlledTeam` is undefined): both teams are automatic.
- Replay uses the same `controlledTeam` option, so automatic decisions regenerate
  from the same state without being serialized as fake user inputs.

#### Automatic substitutions

- Evaluate at three fixed late-match checkpoints corresponding roughly to 55,
  70, and 80 minutes.
- Make at most one substitution at each checkpoint and never exceed three.
- Rank eligible on-field outfielders by lowest condition, then stable player ID.
- Rank same-role bench replacements by role-relevant fresh ability, then stable
  player ID.
- Use one checked-in role-value query for both sides of the comparison, applying
  the existing condition scale to the outgoing player's component attributes:

  ```ts
  DEF = 0.50 * DEF + 0.20 * PAC + 0.15 * PAS + 0.15 * TEC
  MID = 0.35 * PAS + 0.30 * TEC + 0.20 * PAC + 0.15 * DEF
  FWD = 0.40 * SHO + 0.25 * TEC + 0.20 * PAC + 0.15 * PAS
  ```

  Use integer weights (for example 50/20/15/15) in production to avoid
  floating comparison ambiguity. Require the fresh reserve to beat the tired
  starter by at least three role-value points.
- Substitute only when:
  - the outgoing player is at or below the calibrated threshold (initially 60),
  - the fresh reserve's role-relevant value exceeds the tired starter's current
    effective value by a small locked margin, and
  - the replacement is still available.
- The opening-team integration rail should show that AI teams normally use all
  three substitutions while stronger/high-STA teams may rationally use fewer.
- Consume no RNG. The same state must always produce the same candidate and
  replacement.

#### Automatic Energy Use

At fixed checkpoints, choose one mode from score, time, remaining substitutions,
and mean on-field condition. Convert minutes with integer arithmetic against
`TOTAL_TICKS`; define substitution checkpoints at 55/70/80 and Energy Use
checkpoints at 65/75/85 rather than relying on wall-clock time:

1. If no substitutions remain and mean on-field condition is `<= 35`, choose
   Save Energy.
2. Otherwise, if trailing after roughly 65 minutes, choose All Out.
3. Otherwise, if leading after roughly 75 minutes, choose Save Energy.
4. Otherwise, choose Balanced.

Only emit `ENERGY_USE_CHANGED` when the derived mode actually changes. Stable
checkpoint evaluation prevents per-tick mode flicker when the score changes.

Call automatic coaching from `tick()` after due user inputs are processed and
before movement. Within automatic coaching, perform a checkpoint substitution
before calculating the checkpoint Energy Use choice, so the mode decision reads
the actual post-substitution XI and remaining-substitution count. A coaching
choice therefore affects that tick's movement in a documented order, and a user
input always owns the controlled team.

### 6. Build the second coaching row

Update `src/render/MatchScreen.tsx`:

- Replace the single horizontal `coachBar` container with a vertical coaching
  dock containing:
  1. the existing three-button Formation / Playstyle / Swap row; and
  2. a full-width Energy Use row.
- The second row contains:
  - label `ENERGY USE`;
  - three directly selectable segments: `SAVE ENERGY`, `BALANCED`, `ALL OUT`;
  - current on-field `TEAM ENERGY` percentage, rounded from the controlled XI.
- Do not make the user cycle through modes. Each mode is visible and directly
  tappable, which makes the trade-off readable during a short match.
- Derive displayed mode from the newest pending `SET_ENERGY_USE` input first,
  then from `match.tactics[controlledTeam].energyUse`, matching the current
  Formation and Playstyle optimistic-display pattern.
- On press, queue the input for `match.tick + 1` and show a short banner such as
  `ENERGY USE · ALL OUT`.
- Tapping the already displayed mode is a no-op. Disable all coaching controls
  once `match.phase === 'fulltime'` so the 1.5-second presentation hold cannot
  append an input that will never be simulated.
- On processed `ENERGY_USE_CHANGED` events for the controlled team, keep the same
  banner behavior as Formation and Playstyle.
- Rename the existing player-facing `MENTALITY` button/banner label to
  `PLAYSTYLE` while retaining the internal `Mentality` type. This matches the
  product language and makes the distinction from Energy Use explicit without
  causing an unnecessary engine rename.
- Visually distinguish modes using the existing bible palette; the selected
  segment needs more than color alone (border/fill plus selected state).
- Add `accessibilityRole="button"`, selected accessibility state, and a concise
  consequence in each accessibility label.
- Keep minimum 44-point touch targets. On short phones, reduce decorative
  padding and icon space before shrinking touch targets or obscuring the pitch.
  Read both width and height from `useWindowDimensions()` and use the existing
  React Native layout path; do not add device-name branching.

### 7. Make fatigue visible before opening Swap

Update the existing match HUD and Swap UI in `src/render/MatchScreen.tsx`:

- Use three energy bands consistently:
  - green: `> 60`;
  - amber/gold: `31–60`;
  - red: `0–30`.
- Show a numeric energy percentage on every on-field Swap card, not only in the
  accessibility label or after selection.
- Compute `tiredCount` from controlled on-field players at or below `40`.
- When `tiredCount > 0`, change the Swap secondary copy to
  `<count> TIRED · <used>/3`; otherwise retain `<used>/3 USED`.
- Continue showing the tired count after all substitutions are used even though
  the Swap button is disabled; this explains the team's state while the Energy
  Use row still offers Save Energy.
- Extend the Swap accessibility label to announce both tired count and remaining
  substitutions.
- Fresh bench players remain visibly `100%` so the benefit is immediately
  comparable.

### 8. Replay and engine-version discipline

Update `src/sim/match.ts`, replay tests, and runtime golden files:

- Bump `ENGINE_VERSION` from `m1.3` to **`m1.4`** in the same change as the
  behavior.
- Validate and replay `SET_ENERGY_USE` alongside Formation, Playstyle, and
  Substitute inputs.
- Verify automatic coaching is regenerated rather than added to `inputLog`.
  `inputLog` remains a record of user/coaching inputs, while automatic decisions
  remain deterministic consequences of engine state.
- Update the parity test wording: Quick Result and a watched match with a
  controlled team now intentionally differ if the watched user declines to
  substitute. Parity means identical engine configuration plus identical inputs
  is byte-identical; it no longer means two different automation policies must
  produce the same result.
- Regenerate `src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap` only
  after the new rails and causal tests pass.
- Recompute `EXPECTED_RUNTIME_GOLDEN` in `src/sim/runtime-golden.ts` and verify
  the same fingerprint under Node and the Hermes boot assertion.
- Do not migrate old replay envelopes. Existing `m1.3` replays should continue
  to fail clearly with an engine-version mismatch rather than play incorrectly.

## Implementation Phases

### Phase 1 — Tests and deterministic contracts

- [x] Add `EnergyUse`, mode guards, multipliers, and tactics-state unit tests.
- [x] Add replay-validation tests for valid and invalid `SET_ENERGY_USE` inputs.
- [x] Add same-seed mode-separation tests proving
      `Save Energy > Balanced > All Out` final condition.
- [x] Add a condition-aware movement test proving All Out moves a fresh off-ball
      player farther while its bonus disappears at zero condition.
- [x] Add exact halftime `+10` and clamp tests.
- [x] Add opening-match no-substitution harness rails before finalizing drain
      constants.

### Phase 2 — Engine behavior and tuning

- [x] Extend team tactics and coaching inputs/events.
- [x] Apply Energy Use to off-ball movement, ordinary drain, and slide drain.
- [x] Retune base condition costs against the opening-match rail.
- [x] Extract the shared substitution executor.
- [x] Implement deterministic automatic substitution and Energy Use checkpoints.
- [x] Add auto-coaching unit tests for watched home, watched away, Quick Result,
      exhausted/no-subs, trailing, leading, no-compatible-reserve, and tie cases.

### Phase 3 — Match UI and accessibility

- [x] Add the second Energy Use row beneath the three existing coaching buttons.
- [x] Add pending-mode display, processed-event banner, and direct mode selection.
- [x] Add Team Energy, three-band coloring, numeric Swap-card energy, and the
      dynamic tired count.
- [x] Rename the current player-facing Mentality label/banner to Playstyle while
      leaving the engine type and input kind unchanged.
- [x] Verify swap overlay pause behavior and coaching input scheduling remain
      unchanged.
- [x] Verify compact and standard phone heights without shrinking touch targets.

### Phase 4 — Integration, replays, and documentation

- [x] Wire Quick Result to automatic coaching for both teams through the shared
      engine path; do not create a second quick-only substitution simulator.
- [x] Bump to `m1.4`, regenerate the parity snapshot, and update the Hermes
      runtime fingerprint after deliberate review.
- [x] Update `docs/03-match-engine.md` with the Energy Use/Playstyle separation,
      mode multipliers, +10 halftime recovery, automatic coaching, energy bands,
      and substitution behavior.
- [x] Update `README.md`'s current engine version.
- [x] Record measured opening-match fatigue distributions and mode comparisons
      in the implementation handoff rather than claiming success from unit tests
      alone.

## Implementation Measurements (2026-07-19)

- The shipped-content rail covered all ten launch clubs, home and away, across
  25 seeds each (500 controlled no-substitution matches). Every starter who
  remained on the pitch finished at 0–60%; every XI had a player at 0–5%; every
  XI had at least three players at or below 40% by minute 70; and no Balanced
  player reached zero before minute 75.
- The same-seed mode rail retained more than eight percentage points between
  Save Energy, Balanced, and All Out team averages in both directions. The
  synthetic high-STA XI also retained more than eight points over the low-STA XI.
- Existing balance rails remained inside their locked bands: 1.950 goals and
  13.040 shots per normal match, 0.6692 save rate, six maximum normal-match
  goals, and a maximum mismatch margin of 12.
- The automatic-power timing gate passed over 400 seeds: contextual auto-fire
  scored 486 goals versus 468 for blind immediate firing. The separate attention
  gate retained a +0.1775 goal mean with a positive 95% confidence lower bound.
- Native iPhone 17 Pro verification showed eight tired players and 33% Team
  Energy at minute 49 after selecting All Out early; at minute 60 the Swap sheet
  showed numeric values from 0–49% and paused the match correctly. Save Energy
  remained selectable afterward, and all coaching controls disabled at full time.

## SpecFlow and Edge Cases

### Watched user flow

1. Match starts Balanced.
2. Player taps Save Energy or All Out; the UI shows the pending selection.
3. The input applies on the next sim tick, emits an event, and changes only the
   controlled team's future movement/drain.
4. Player may switch modes again without a cooldown; accumulated fatigue is the
   cost, so rapid toggling grants no refund.
5. Swap opens and pauses the match as today. Substitutes enter at 100 and inherit
   the current team-wide Energy Use mode automatically.
6. If all three substitutions are spent, Save Energy remains available.

### Opponent and Quick Result flow

1. Uncontrolled teams start Balanced.
2. Fixed checkpoints evaluate score, condition, bench, and substitutions.
3. Automatic choices execute before movement and emit ordinary match events.
4. A replay regenerates exactly the same choices from seed, teams, options, and
   user inputs.

### Required edge-case handling

- Mode input at the same tick as a manual substitution: process both in input-log
  order, then run automatic coaching for the other team.
- Mode input queued immediately before full time: if its tick is simulated it
  applies; an input beyond the replay tick bound is rejected as today.
- Full-time presentation hold: all coaching controls are disabled and no pending
  input can be added after the final simulated tick.
- Condition at zero: clamp drain, remove the All Out movement upside, keep the
  player available for walking/basic play, and preserve the slide floor.
- Halftime: apply +10 exactly once to on-field players; bench players remain at
  their existing fresh state.
- Substitute enters during All Out: starts at 100, immediately uses All Out on
  subsequent movement ticks, and receives no retroactive drain.
- Automatic team has no same-role reserve: skip instead of breaking shape.
- Automatic team has no bench or has used three substitutions: no-op safely.
- Automatic team loses or gains the lead after a checkpoint: wait for the next
  checkpoint; do not flicker modes every tick.
- Controlled team may be home or away; every input, tired count, team average,
  event banner, and auto-coaching exclusion must respect `controlledTeam`.
- Reduced motion changes presentation only and must not affect Energy Use or
  automatic coaching.
- Paused/backgrounded matches consume no sim ticks and therefore no condition.

## Acceptance Criteria

### Functional

- [x] The watched-match coaching dock shows Formation, Playstyle, and Swap in the
      first row and Energy Use in a second full-width row.
- [x] Save Energy, Balanced, and All Out are directly selectable and visibly
      selected.
- [x] Formation/Playstyle combinations remain independent from Energy Use.
- [x] Mode changes are deterministic replay inputs and change actual movement and
      condition outcomes.
- [x] Balanced opening starters left on for the entire match finish across the
      agreed inclusive 0–60 condition range, with the worst player near zero
      after minute 75.
- [x] Halftime restores exactly +10 condition.
- [x] Low STA drains faster than high STA in every mode.
- [x] Save Energy preserves condition; All Out produces more immediate movement
      at a substantially higher condition cost.
- [x] The opponent automatically makes rational, role-compatible substitutions
      and never exceeds three.
- [x] Quick Result auto-coaches both teams through the production engine.
- [x] The user retains manual substitution control in watched matches.
- [x] Swap shows numeric energy and a dynamic tired count before the overlay is
      opened.

### Determinism and balance

- [x] Same seed, teams, options, and ordered inputs produce byte-identical scores,
      events, automatic decisions, and final conditions.
- [x] Home/away control orientation produces the same mode and substitution rules.
- [x] Automatic coaching consumes no RNG.
- [x] Existing goal, shot, save, slide, power-cadence, and blowout rails remain in
      their accepted bands after fatigue retuning.
- [x] `ENGINE_VERSION` is m1.4 and both Node and Hermes goldens agree.

### UI and accessibility

- [x] Every segment has a 44-point minimum target, an accessibility label, and a
      selected state that does not rely on color alone.
- [x] Energy modes, Team Energy, tired count, and remaining substitutions remain
      readable on a compact iPhone-height simulator and a current large iPhone.
- [x] The additional row does not cover the pitch, scoreboard, hero tap targets,
      or Swap sheet actions.
- [x] Red/amber/green energy states and numeric percentages agree everywhere.

## Verification Commands and Manual Checks

Run narrow checks first:

```bash
npx jest src/sim/__tests__/engine.test.ts src/sim/__tests__/tactics.test.ts --runInBand
npx jest src/game/__tests__/matchday.test.ts src/render/__tests__/match-control.test.ts --runInBand
npx jest src/application/__tests__/match-stamina-balance.test.ts --runInBand
npx jest src/sim/__tests__/parity-replay.test.ts src/sim/__tests__/runtime-golden.test.ts --runInBand
npx tsc --noEmit
```

Then run the broader gates:

```bash
npx jest src/sim/__tests__/balance-rails.test.ts --runInBand
npm test -- --runInBand
```

Manual simulator pass:

1. Start the opening match on Balanced and observe Team Energy plus tired count.
2. Confirm several starters visibly enter amber/red and the worst approaches zero
   only late in the match if ignored.
3. Replay the same seed using Save Energy and confirm visibly slower off-ball work
   plus materially higher condition.
4. Replay using All Out and confirm faster pressure/support plus clearly faster
   fatigue without direct shot/pass buffs.
5. Spend all three substitutions, switch to Save Energy, and confirm the control
   remains available and meaningful.
6. Watch the opponent make up to three substitutions with visible substitution
   events.
7. Run Quick Result, load its saved replay, and confirm both teams' automatic
   coaching reproduces.
8. Repeat as the away team to catch controlled-team index mistakes.
9. Check compact and large iPhone simulators at 1x, 2x, and 3x playback.

## Risks and Mitigations

- **Fatigue collapses match quality:** the large drain increase can reduce shots,
  passing, and goals late. Keep the existing balance rails authoritative and
  tune base drain, not outcome tests, when they fail.
- **All Out becomes free at zero condition:** fade its movement bonus with current
  condition.
- **Save Energy becomes mandatory:** prove Balanced and All Out retain situational
  value through movement and score-state tests; do not let Save preserve energy
  without a visible positional cost.
- **Energy Use duplicates Playstyle:** apply it only to movement intensity and
  condition cost, never decision weights or formation targets.
- **AI substitution changes replay semantics:** derive automatic choices from
  engine state without RNG and share one substitution executor.
- **Quick Result diverges into separate logic:** keep all decisions in `src/sim/`
  and invoke the same tick loop in watched and quick modes.
- **Bottom controls crowd compact phones:** use a dedicated responsive coaching
  dock, keep direct segments, and reduce decoration before touch-target size.
- **Golden updates hide accidental drift:** bump to m1.4 first, inspect event and
  balance changes, then regenerate snapshots and the Hermes fingerprint.

## Primary Files

- `src/sim/tactics.ts` — Energy Use type, guards, and multipliers.
- `src/sim/types.ts` — tactics state, input, and event contracts.
- `src/sim/engine.ts` — movement intensity and condition-drain application.
- `src/sim/match.ts` — defaults, input processing, halftime, substitution
  validation/invocation, replay validation, tick order, and engine version.
- `src/sim/substitutions.ts` — the one mutation path used by manual and automatic
  substitutions plus stable role-value comparison.
- `src/sim/auto-coaching.ts` — deterministic uncontrolled-team decisions.
- `src/render/MatchScreen.tsx` — second control row, Team Energy, tired count,
  energy colors, and mode banners.
- `src/game/matchday.ts` — Quick Result integration assertions, without duplicating
  simulation logic.
- `src/sim/__tests__/engine.test.ts` — drain and movement unit contracts.
- `src/sim/__tests__/tactics.test.ts` — replayable control and substitution tests.
- `src/sim/__tests__/auto-coaching.test.ts` — automatic policy and edge cases.
- `src/application/__tests__/match-stamina-balance.test.ts` — shipped-content
  opening-match fatigue rails.
- `src/sim/__tests__/balance-rails.test.ts` — existing gameplay distribution gates.
- `src/sim/__tests__/parity-replay.test.ts` and `src/sim/runtime-golden.ts` — m1.4
  replay forcing functions.
- `docs/03-match-engine.md` and `README.md` — canonical behavior and version.
