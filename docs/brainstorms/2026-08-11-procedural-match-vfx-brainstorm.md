---
date: 2026-08-11
topic: procedural-match-vfx
---

# Procedural Match VFX

## What We're Building

Add five short, deterministic pixel effects to the production match scene:
slide tackle, standing tackle, hard shot, save impact, and power interruption.
Every effect also gets a bookmarkable Dev Harness case that runs it inside the
real `MatchScreen` with the production pitch, players, ball, camera, and HUD.

The goal, goalpost-hit, and header ideas are out of scope because the current
match does not model those moments separately. The save effect communicates a
directional glove impact and turf response; it does not invent a new goalkeeper
dive animation.

## Why This Approach

Reuse the Sim Intelligence World architecture: pure geometry recipes, stable
phases, no runtime randomness, and fixed batched Skia paths. Do not copy its
fire or sparkle artwork. HFM effects must use the HFM palette, pixel grid,
event stream, and existing player/ball anchors.

## Key Decisions

- Slide-tackle dust uses 15% opacity.
- Slide-tackle grass uses 80% opacity and is the dominant debris layer.
- Four deterministic phases change every 334 ms of match presentation time.
- Pausing freezes effect age. Match speed changes presentation speed normally.
- Reduce Motion freezes a readable contact shape and removes traveling debris.
- Old-device effect reduction removes secondary particles before causal marks.
- Effects do not use simulation RNG, `Math.random`, `Date`, or wall-clock time.
- Dust and grass stay above the player Atlas. Dust remains at 15% opacity, but
  uses a wide, dense footprint so it reads over the sliding body.
- Standing-tackle VFX replaces the existing duel scuff instead of stacking over it.
- A hard shot is `SHOT.power >= 55`; an ordinary shot keeps its current small puff.
- One fixed set of Skia paths batches all active emitters by visual role.
- Each event anchor uses its own before/after tick frames, not a later catch-up frame.
- Every new recipe must ship with a production-context Dev Harness fixture.

## Open Questions

None.

## Next Steps

Implement from `docs/plans/2026-08-11-feat-procedural-match-vfx-plan.md`.
