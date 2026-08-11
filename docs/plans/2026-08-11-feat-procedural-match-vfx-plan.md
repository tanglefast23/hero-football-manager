---
title: 'feat: Add procedural match VFX'
type: feat
date: 2026-08-11
---

# Add Procedural Match VFX

## Overview

Replace the current continuous tackle debris and isolated scuff/puff treatments
with one deterministic procedural VFX language for five real match events:
slide tackle, standing tackle, hard shot, save impact, and power interruption.
Add one Dev Harness case for each effect using the production match scene.

This is a render-only change. It must not alter simulation decisions, RNG
consumption, replay events, match outcomes, or `ENGINE_VERSION`.

## Proposed Solution

1. Add a pure TypeScript recipe module for emitter types, stable phase timing,
   bounds, particle geometry, hard-shot classification, and emitter expiry.
2. Add a five-node Skia renderer that batches active event emitters into ink,
   cream, grass, blue, and gold paths above the player Atlas.
3. Restyle the existing two-node worklet slide layer: large backward 15% dust and
   80% grass above the Atlas, with phased shards, pixel snapping, and reduced
   secondary motion.
4. Capture each new event with its own before/after `PitchFrame` inside the tick
   loop. Record event emitters from those frames so five-tick catch-up cannot
   move a contact, shot, or save anchor.
5. Add a development-only `matchVfxQa` initializer that produces each real
   event through production engine functions, then freezes on a useful phase.
6. Add a `Match VFX` Dev Harness entry with five bookmarkable cases. Motion
   changes and Replay remount the full fixture and reset match/VFX/audio state.

## Exact Contracts

- Phase step: `334 ms` of presentation time.
- Phase count: `4`.
- Event duration: `1,336 ms`; inactive at or after that age.
- Retained event-emitter cap: `16`; append newest and evict oldest.
- Stable seed inputs: match seed, emitter kind, event tick, actor, target, and
  rounded anchor. No runtime RNG.
- Hard-shot threshold: `SHOT.power >= 55`.
- Ordinary shots: retain the current small strike puff and do not draw the new
  hard-shot burst.
- Standing tackles: won, lost, and dropped standing contacts draw exactly one
  burst. Slide, power, and no-contact tackles do not use that recipe.
- Full path order above Atlas: 15% slide dust, 80% grass, ink backing, cream
  causal core, save-blue, and hero-gold.
- Reduced Motion: hold a static causal core and remove traveling particles.
- Adaptive reduction: retain the causal core and remove secondary particles.
- Late catch-up events use their captured tick frame and keep normal expiry.

## Event Mapping

| Effect             | Existing production event                 | Anchor                                              |
| ------------------ | ----------------------------------------- | --------------------------------------------------- |
| Slide tackle       | `SLIDE_STARTED`, then slide action buffer | Launch-to-live travel path plus contact point       |
| Standing tackle    | `TACKLE` with `style: "standing"`         | Event-frame midpoint of challenger and target       |
| Hard shot          | `SHOT` with `power >= 55`                 | Event-frame striker foot and initial ball direction |
| Save impact        | `SAVE`                                    | Event-frame keeper and incoming-ball side           |
| Power interruption | `POWER_INTERRUPTED`                       | Event-frame interrupted hero position               |

## Technical Constraints

- Use `visualTick` as the only animation clock.
- Use `snapDevicePixels` for every screen-space edge.
- Render hard-edged geometry with antialiasing disabled.
- Keep one fixed number of Skia path nodes, not one node per emitter.
- Preserve the existing Atlas and camera group order.
- Keep all work out of `src/sim/`; current events are sufficient.
- Preserve `DECOY_POP` ownership of the existing puff.
- Do not run balance, soak, or large seed rails.

## Acceptance Criteria

### Functional

- [x] Slide tackles show a large backward 15% dust trail and dominant 80% grass
      fragments above players.
- [x] Slide debris changes through four deterministic phases without runtime
      randomness.
- [x] Standing tackles show one compact contact burst and do not also draw the
      old duel scuff.
- [x] Shots at power 55 or higher show a short boot-impact burst; ordinary
      shots keep the existing small puff and do not stack both treatments.
- [x] Saves show a directional glove-impact and turf response at the keeper.
- [x] Interrupted powers show a broken energy mark at the interrupted hero.
- [x] Pause freezes every effect at 1x and 3x playback.
- [x] Reduce Motion keeps a static causal mark and removes moving particles.
- [x] Adaptive reduced effects keep causal marks and remove secondary particles.
- [x] Each effect has a bookmarkable Dev Harness case inside production
      `MatchScreen`, with Replay and Full/Reduced Motion controls.
- [x] Changing motion mode or replaying resets match state, emitter history,
      presentation age, and audio ownership.

### Quality Gates

- [x] Pure recipe tests cover determinism, all phase boundaries, expiry,
      emitter cap/eviction, exact hard-shot threshold, and reduced geometry.
- [x] Renderer tests cover seven total fixed path nodes, pixel snapping, layer
      order, standing-tackle exclusivity, ordinary-shot exclusion, and Decoy Pop.
- [x] Event-frame tests cover a five-tick catch-up without anchor drift.
- [x] Showcase tests prove every fixed fixture emits its intended real event.
- [x] Harness tests cover all five cases and fixture reset on Replay/motion change.
- [x] Focused Jest suites pass.
- [x] TypeScript passes.
- [x] The live Dev Harness is opened, muted immediately, inspected for every
      case, then closed with its server stopped.

## Risks and Mitigations

- **Frequent tackle clutter:** keep a strict emitter cap and batch concurrent
  emitters in fixed paths.
- **Old-device cost:** remove secondary particles first and keep a fixed path
  node count.
- **False hard-shot semantics:** keep the exact threshold in the render ring
  and test 54/55.
- **Catch-up anchor drift:** capture before/after frames inside each tick.
- **Harness drift:** arrange real match state and assert the real event instead
  of injecting a decorative-only event.
- **Pixel shimmer:** snap both edges on both axes through the shared helper.

## Internal References

- `src/render/WorkletMatchOverlays.tsx`
- `src/render/slide-tackle-effects.ts`
- `src/render/duel-scuff.ts`
- `src/render/MatchScreen.tsx`
- `src/render/power-match-showcase.ts`
- `src/ui/dev-harness/entries/live-match-controls.tsx`
- `src/ui/dev-harness/registry.ts`
- `docs/11-art-style.md`
