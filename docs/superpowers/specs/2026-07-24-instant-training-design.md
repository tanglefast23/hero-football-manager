# Instant Training — Design Spec

Date: 2026-07-24
Status: Approved (brainstorm with user)
Supersedes: `2026-07-23-training-one-drill-per-player-design.md` (the weekly slot model it introduced is replaced)

## Goal

Training resolves the moment the user picks a drill, not on Advance Week. The user taps, watches the number go up immediately, and can keep tapping as long as Training Points and conditioning allow. Potential stops being a passive percent bonus and becomes a visible chance meter for SUPER (1.5×) training sessions — an honest slot-machine beat inside a deterministic engine.

Why: immediate feedback ("number goes up NOW, because I pressed the button") beats a batched weekly report, and the SUPER roll adds a chase without adding a currency or breaking determinism.

## Core loop

1. Roster → tap **+** on a player → drill popup opens (existing `TrainingDrillModal` entry point).
2. Tap a stat → the drill executes instantly: TP deducted, condition −8, gain applied, ~1s result animation in the popup.
3. Popup stays open with live buttons — chain-tap the same player or close and pick another. The only limits are TP and the injury gamble.

## Engine (`src/game`) — new action

`trainPlayerInstantly(state, playerId, pathId)` — pure, deterministic, seeded-PRNG only.

Validation: player on user club, not injured, TP ≥ drill cost. Drill tier auto-resolves by division via `resolveTrainingDrillForPath` (unchanged).

One atomic step:

- Deduct the drill's TP cost and 8 condition (floor 0). No money cost, no slot count, no weekly cap.
- Compute the gain through the existing pipeline: base drill gain × age multiplier × facility, plus summed percent bonuses (archetype, position, coach) with banked hundredth remainders — **minus the potential percent bonus, which is deleted** (E−=+0% … A+=+14% is gone).
- **SUPER roll**: chance derived from potential grade — target curve ~5% (E−) to ~35% (A+), exact values set in the balance pass. On hit, the whole gain (after modifiers) ×1.5, then normal rounding/remainder banking.
- **Pity timer**: per-player persisted counter `drillsSinceSuper`; reaching N (tuned, ~12) forces a SUPER and resets. Any SUPER resets it.
- **Injury roll at tap time**, computed from **pre-drill** condition using the existing `overtrainingInjuryChancePercent` curve (0% at ≥30 condition; 10% + 2%/point below 30; reduced by Medical Bay). This is exactly the % the UI shows on the button — what you see is the real gamble. If it hits: **the gains still apply** (you trained, then pulled something), injury weeks rolled as today. A SUPER and an injury can land on the same tap; both play out.
- Returns `{ gains, isSuper, injured?, tpSpent, newCondition }` for the UI to animate.

### Deleted from the engine

- `resolveCareerTrainingWeek` and all weekly training resolution in `settleCurrentWeek`.
- Training plan/slot state: `trainingPlan`, slot template, `maxFocusDrillsPerWeek`, one-slot-per-player rule, `trainingCapNotices`.
- Both hard-blocking training interrupts (TP shortfall, capped slot) and the Advance Week guard for them.
- The all-or-nothing affordability check and `skippedTrainingWarning`.
- In weekly wellbeing: the focus-drill condition cost and the overtraining injury roll (both moved to tap time). Weekly wellbeing keeps +12 condition recovery and the injury-week countdown.

Advance Week becomes purely fixtures / economy / events / recovery.

### Save schema

Codec migration: drop `trainingPlan`, `trainingRules.maxFocusDrillsPerWeek` usage, `trainingCapNotices`; add per-player `drillsSinceSuper` (default 0). Existing saves load cleanly; any pending weekly plan is discarded silently.

### Determinism

Each tap is a recorded store action mutating career state via the seeded career PRNG. This is the game ring (`src/game`), not the match sim — no `ENGINE_VERSION` bump. RNG draws per tap: SUPER roll, injury roll (only when risk > 0), injury duration (only on injury).

## UI

**The drill popup is the whole loop.** After picking a stat:

- ~1s result beat inside the popup: small sprite drill animation, `CountedStat`-style count-up (+3 pop) on the stat, TP ticking down in the header.
- Popup stays open: stat values, condition bar, and per-action **injury-risk badge** (0% hidden/green → orange → red as condition drops) all update after every drill.
- **SUPER TRAINING SESSION 1.5×**: ~2s takeover — confetti + fireworks (reuse `makeConfetti`/`Firework` from `ChampionshipCelebrationScreen`), big animated pixel words, screen-shake, haptic, celebratory SFX. Then back to live buttons.
- **Escalating pitch**: chain-training the same player raises the drill-result SFX pitch one step per consecutive drill; resets when switching player or closing the popup.
- **Injury result**: the result beat is interrupted by an injury card ("OUT 3 WEEKS"), sad SFX; that player's train actions grey out.
- Broke state: when TP < cheapest drill cost, drill buttons disable with the TP cost shown — no interrupt, no warning popup.

**Roster screen**: the `0/3 TRAINING` counter disappears. The **+** entry point stays. POT column keeps its letter grade; its meaning is now "SUPER session chance" (copy/tooltip updated).

**Removed UI**: the 3s `TrainingTransitionOverlay` on Advance Week; the player-development spotlight section of `WeeklyReviewScreen`. The weekly review popup itself **stays** for money in/out, injuries, contract warnings, and next fixture.

## Tutorial & guidance

- Bert's "PICK A PLAYER AND A STAT TO TRAIN" hint keeps its target; `first-training-complete` now fires on the first instant drill instead of on slot assignment.
- Created-player still floats to the top of the roster for the first drill.
- Cap deep-links, capped-slot guidance, and skipped-training copy are deleted with their features.

## Balance pass

- Tune SUPER odds per grade (target 5%→35%) and pity N (~12).
- Sanity-check TP income vs. unlimited spend — TP income unchanged; it is now the sole economic throttle. Verified via the long-career development probe; balance-harness assertions must stay green.
- Condition economics unchanged (−8/drill, +12/week recovery): a fresh player affords ~9 drills before entering the red zone; recovery restores 1.5 drills/week of headroom.

## Tests

- New engine tests: gain math parity with the old pipeline (minus potential bonus), SUPER roll determinism + grade curve, pity forcing/reset, injury roll uses pre-drill condition and matches displayed %, gains-apply-despite-injury, TP/condition deduction, rejection when injured or broke.
- Rewritten: drill-popup and training view-model tests, weekly-review test (no development section).
- Deleted with their features: training-settlement, training-interrupts, training-interrupt-enforcement, training-advance-guard, training-cap-feedback, training-cap-deeplink, weekly-plan-summary suites.

## Docs

- Update `docs/05-players-training-coaches.md` (potential = SUPER chance; instant resolution).
- This spec supersedes the 2026-07-23 one-drill-per-player spec.

## Out of scope

- AI clubs still do not train (unchanged).
- No new currencies, no money cost on training (unchanged).
- TP income sources unchanged.
