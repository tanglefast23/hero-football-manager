---
date: 2026-07-19
topic: training-transition-overlay
---

# Training Transition Overlay

## What We're Building

After a successful **Advance Week**, cover the next screen for about three seconds with a
training-ground vignette. Show up to three assigned players, each paired with one of the
locked drills, while listing every drill in the plan. If no affordable focus plan is active,
show one outfield player kicking a ball across the screen instead.

## Why This Approach

Reuse the existing transparent full-body chibi sprite atlas and animate its transforms in
one Skia Atlas draw call. This keeps several recognizable named trainees on screen without
shipping a separate animation image pack. It costs only a small temporary render surface,
not a new set of character frames.

## Key Decisions

- The career advances synchronously behind the overlay; the overlay only appears when the
  week number really changes, so tutorial blocks and event redirects do not fake progress.
- Show at most three distinct assigned players for clarity and performance.
- Pair visible players with selected drills in order; show all selected drill names in the
  heading even when there are more drills than visible players.
- Respect Reduce Motion with a short static version instead of a three-second animation.
- Do not change simulation state, RNG, replay behavior, or `ENGINE_VERSION`.

## Open Questions

- None for the first pass. Dedicated drill props and extra sprite poses can be added later
  only if playtesting shows the code-driven motion is not expressive enough.

## Next Steps

Build the pure scene selector, the batched overlay, focused tests, and iOS bundle verification.
