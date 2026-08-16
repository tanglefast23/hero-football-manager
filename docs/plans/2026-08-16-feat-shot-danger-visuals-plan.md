---
title: 'feat: Show shot danger on the pitch'
type: feat
date: 2026-08-16
---

# Show Shot Danger On The Pitch

## Overview

Give every shot a visible grade drawn from **shot danger** — the chance it beats
the keeper it is actually facing. Replace the broken `SHOT.power >= 55` hard-shot
treatment with a three-tier ladder: ordinary shots are unchanged, dangerous shots
get a boot burst, and the rare scorching shot burns for its whole flight with a
looping fire crackle and a heavy impact chord.

This is a **render-only, zero-copy** change. It must not alter simulation
decisions, RNG consumption, replay events, match outcomes, `ENGINE_VERSION`, or
any translated string. It adds no `content/` prose and touches no locale catalog.

Terms are defined in `CONTEXT.md`. The choice of danger over `SHOT.power` and
over the engine's expected-goal product is recorded in
`docs/adr/0001-shot-danger-is-keeper-relative.md`.

## Proposed Solution

1. Add `shotDanger(state, ball)` to a new pure module in the render ring. It
   resolves the defending keeper index, calls the sim's exported
   `keeperSaveProbability` with `ball.shotStrengthD64`, and returns
   `1 - probability`. Add `shotTier(danger)` returning `0 | 1 | 2`.
2. Stamp the tier once, on the tick the ball becomes `kind: 'shot'`. Hold it in a
   `MatchScreen` ref and mirror it into a shared value for the UI thread. Clear
   both the moment the ball stops being a shot.
3. Replace the `hard-shot` VFX kind with `dangerous-shot`, triggered by tier ≥ 1
   instead of `power >= 55`. Delete `HARD_SHOT_POWER_MIN` and
   `isHardShotPower`. Keep the emitter's existing anchor, direction and
   determinism hash; feed `intensity` from danger rather than `power / 100`.
4. Add a tier-2 ball flame as a **state-driven worklet overlay**, not a VFX
   emitter. It draws while the shared value says the airborne ball is scorching,
   so it lives exactly as long as the flight. Anchor it to the ball's
   interpolated ground position plus `ballVisualOffset(height)`. Keep the shape
   itself in a pure `ball-flame.ts` recipe, the way `match-vfx.ts` is split from
   `ProceduralMatchEffects` — geometry sealed inside a `usePathValue` closure
   can be neither unit-tested nor rendered headlessly, and the browser pane
   cannot photograph a 0.9-second flight because its RAF is frozen between tool
   calls.
5. Recolour and lengthen the existing ball-flight trail by tier. No new draw
   call: the eight circles already exist and are already tier-agnostic.
6. Extend the fire-crackle predicate in `MatchScreen` with a third clause for a
   scorching ball in flight. The existing edge-tracking ref and the idempotent
   `startFireAmbience` / `stopFireAmbience` pair need no change.
7. Add a `shot-scorch` cue from the supplied explosion recording. Return it
   alongside `kick-shot` for tier-2 shots, so the existing cue supplies the
   transient the recording lacks.
8. Add both measurement probes as opt-in calibration tests that pin the tier
   thresholds against a real match census.

## Exact Contracts

- **Shot danger**: `1 - keeperSaveProbability(state, gkIdx, ball.shotStrengthD64)`,
  clamped `0..1`. Keeper power bonuses are deliberately excluded; the render ring
  does not reach into `keeperSaveBonus`.
- **Tier thresholds**: tier 1 at danger `>= 0.33`, tier 2 at danger `>= 0.50`.
  Fixed constants, not per-match percentiles.
- **Measured rarity** at these thresholds: about 3 tier-1 and 1.5 tier-2 shots per
  match, stable from ×1 to ×8 squad stats.
- **Stamped once**: danger is read on the first tick the ball is `kind: 'shot'`
  and never recomputed during flight.
- **Off-target shots still burn.** `ball.targetX` is never read. About half of all
  shots miss, and suppressing the effect on those would make it a verdict.
- **Escalation only.** Tier 0 renders exactly as today. Nothing renders below the
  current ordinary-shot puff.
- **Rival shots** use the same silhouette and timing with the rival colour family.
- **Ball tint is unchanged.** The ball keeps its white Atlas core; flame is drawn
  around it, never through `colorBlendMode="modulate"`.
- **Flame colour**: the reserved `#ff6a00` flame accent, with the existing cream
  and gold VFX roles. Fewer and shorter tongues than `WorkletFlameLayer`, so a
  burning ball never reads as an ignited player.
- **No new Skia node count.** The flame reuses the existing overlay path budget;
  the trail reuses its eight circles.
- **Reduce Motion**: flame freezes to a static readable shape, trail keeps its
  current length, sound is unaffected.
- **`reduce-effects`**: tier 2 falls back to the tier-1 boot burst. The cue and
  the fire loop still play. The effect is never dropped outright.

## Audio

| Item      | Decision                                                                     |
| --------- | ---------------------------------------------------------------------------- |
| Tier 0    | `kick-shot` only, unchanged                                                  |
| Tier 1    | `kick-shot`, pitch-bent down; no new asset                                   |
| Tier 2    | `['kick-shot', 'shot-scorch']` as a chord, plus the fire loop for the flight |
| Fire loop | The existing `flame-loop.m4a`, via the existing per-frame predicate          |

- `shot-scorch` is rendered from the supplied recording: trim the 0.57s silent
  tail to 1.43s, down-mix to 24 kHz mono, then `npm run audio:levels` to land it
  on −16 LUFS max-momentary under the −1 dBTP ceiling. It arrives at −10.5 LUFS
  with a +0.1 dBTP true peak, so it is over both.
- Ship it as `.wav`, for the same reason `goal-net-hit` stays lossless — arrived
  at by measurement, against the prediction that AAC would be safe here. The
  source is hard-clipped flat, and AAC reconstruction of a flat top overshoots
  about 9 dB at any pre-gain (+5.9 dBTP at unity, still +1.4 after an 8 dB cut).
  The levelling pass then had to pull it 12 dB to clear the ceiling, landing it
  at −21 LUFS: 5 dB under target and inaudible beneath the chord. PCM lands on
  its sample peak exactly and levels to −16 LUFS with no limiting. 67 KB.
- **It must never play alone.** The recording sits at full scale for its first
  350 ms with no attack, so on its own it reads as a rumble rather than a hit.
  `kick-shot` supplies the boot contact at 0 ms.
- The fire-loop predicate becomes an **OR of three sources**: an active Fire
  Torch caster, an ignited player, and a scorching ball in flight. It must stay
  one predicate. A second start/stop pair would let a landing shot silence a
  Fire Torch hero who is still burning.
- Pitch bend borrows `RAPID_SFX_PITCH_SPREAD` from `management-sfx.ts`. Match
  cues have one `AudioPlayer` per key, so a bent `kick-shot` is a
  `setPlaybackRate` before `play()`, not a new voice pool.

## Technical Constraints

- `src/sim/` gains nothing and changes nothing. `keeperSaveProbability` is
  already exported and already pure.
- No `ENGINE_VERSION` bump. No golden-replay snapshot update. If either becomes
  necessary, the design has drifted — stop and re-check.
- No simulation RNG, no `Math.random`, no `Date.now` in any new render code. The
  tier is a pure function of match state.
- The tier-2 flame cannot use the `match-vfx.ts` emitter model. Emitters have a
  fixed 668 ms lifetime; a shot flight runs 1 to about 35 ticks. It must be a
  state-driven overlay.
- React state updates at tick rate (10/20/30 Hz), so the flame must be driven
  from a shared value on the UI thread to stay smooth at ×3.
- A second scorching shot inside 1.43 s retriggers the single `shot-scorch`
  player and cuts the first off. At a measured 1.5 per match this is accepted.

## Acceptance Criteria

### Functional

- [ ] A shot with danger below 0.33 renders and sounds exactly as it does today.
- [ ] A shot at danger ≥ 0.33 draws the boot burst, with intensity rising with
      danger across the full measured 0.17–0.62 range.
- [ ] A shot at danger ≥ 0.50 burns for its whole flight, plays the
      `kick-shot` + `shot-scorch` chord, and starts the fire crackle.
- [ ] The fire crackle stops on the exact frame the flame stops drawing.
- [ ] A Fire Torch hero burning through a scorching shot's landing keeps the fire
      crackle running.
- [ ] A scorching shot that flies wide still burns for its whole flight.
- [ ] A saved scorching shot draws the save-impact effect at raised intensity.
- [ ] Rival scorching shots use the rival colour family, same silhouette.
- [ ] Reduce Motion freezes the flame and keeps the audio.
- [ ] `reduce-effects` degrades tier 2 to the tier-1 burst and keeps the audio.
- [ ] A ×8-stat squad produces the same tier rarity as a Division 5 squad.

### Quality Gates

- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest src/render src/sim` green.
- [ ] `src/render/__tests__/match-vfx.test.ts` no longer asserts
      `HARD_SHOT_POWER_MIN`; it asserts the danger thresholds instead.
- [ ] `npm run audio:levels:check` green with `shot-scorch` present.
- [ ] Gate 1 and gate 10 untouched — this change adds no English key and no
      `content/` prose, so no locale catalog moves.
- [ ] The golden-replay snapshot is unchanged, proving the sim did not move.
- [ ] `git grep HARD_SHOT_POWER_MIN` returns nothing.

## Risks and Mitigations

- **The flame reads as a power firing.** Mitigated by a distinct recipe: fewer,
  shorter, harder tongues than `WorkletFlameLayer`, and no `zone-enter` cue.
- **Threshold rot, the exact failure that killed `55`.** Mitigated by keeping the
  two calibration probes in `src/audit/__tests__/` and asserting the tier rarity
  holds at ×1 and ×8 stats. If a future balance change moves the danger
  distribution, that probe is the thing that says so.
- **Fire loop leaks on an abnormal exit** — a half boundary, a pause at full
  time, or a graphics recovery mid-flight. Mitigated by reconciling the predicate
  from state every frame rather than from events, which is why the existing Fire
  Torch loop already survives a KO or an interruption.
- **The chord clips.** Two cues at once can sum above the ceiling. Mitigated by
  levelling `shot-scorch` with the rest of the set and checking the sum, the same
  way `match-control-whistle.wav` sums three layers before levelling.
- **Perf on old devices.** The flame adds no draw call and no node, but it does
  add per-frame worklet path work during flight. If frame pacing degrades, the
  existing two-stage adaptation already catches it and drops tier 2 to tier 1.

## Internal References

- `CONTEXT.md` — shot power, shot danger, shot tier
- `docs/adr/0001-shot-danger-is-keeper-relative.md`
- `docs/03-match-engine.md` — shot resolution, GK Resolve, presentation rules
- `docs/11-art-style.md` — the `#ff6a00` flame accent, the anti-aliasing ban
- `docs/plans/2026-08-11-feat-procedural-match-vfx-plan.md` — the emitter model
  this replaces the hard-shot half of
- `src/sim/engine.ts` — `keeperSaveProbability`, `shotStrengthAt`
- `src/render/match-vfx.ts` — emitter recipes and determinism hash
- `src/render/WorkletMatchOverlays.tsx` — `WorkletFlameLayer`, ball shadow
- `src/render/audio.ts` — `filesForEvent`, `startFireAmbience`
