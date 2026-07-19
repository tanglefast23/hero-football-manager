# Goalkeeper catches and airborne ball presentation

**Date:** 2026-07-19
**Status:** Approved by direct user request; implementation slice of the existing ball-physics design

## Problem

A saved shot currently travels to the goal line before the save contest resolves. On a save, the ball then snaps immediately to the goalkeeper and can be passed again on the next decision boundary. Visually, this can read as a goal that bounced back out.

All current passes and shots also use only pitch-plane `x/y` motion, so goalkeeper distribution and lifted shots cannot read as airborne, cast a shadow, or fly over a player.

## Decision

Implement the smallest coherent 2.5D slice of the approved design in `docs/superpowers/specs/2026-07-18-ball-physics-design.md`:

- Resolve an on-target save when the shot reaches the goalkeeper's live plane, before the goal line.
- A caught save becomes a held-ball state for exactly six 100 ms simulation ticks (0.6 seconds) before the goalkeeper distributes.
- Post-catch goalkeeper distribution is always lofted. The existing deterministic pass contest remains in place for this slice, but the intended receiver or pre-rolled interceptor cannot control the ball above the shared 150 cm control height.
- Shots use a deterministic 70/30 driven-to-lifted launch mix. Driven shots stay on the pitch plane. Lifted shots follow an integer, gravity-driven arc that reaches a safe in-goal height rather than introducing an over-the-bar outcome in this presentation-focused slice.
- The renderer interpolates ball height, lifts the ball sprite above its ground coordinate, and draws a ground shadow whenever height is non-zero.

## Ball-flight math

Use the approved integer semi-implicit Euler step with centimetres and 100 ms ticks:

```text
vz <- vz - g
z  <- max(0, z + vz)
```

with `g = 10 cm/tick^2`. For a flight of `n` ticks that should arrive at height `h`, solve the initial vertical velocity as:

```text
vz0 = round((h + g * n * (n + 1) / 2) / n)
```

This gives deterministic arcs without trigonometry or platform-sensitive floating-point functions. A goalkeeper pass solves for ground height at arrival; a lifted shot solves for 110 cm at the goal plane. Ball height affects control eligibility, while the existing horizontal pass and shot contest model remains unchanged.

## Research boundary

Real football flight includes aerodynamic drag and lift, as measured in wind-tunnel and trajectory work, but reproducing full aerodynamics would add tuning and replay complexity without improving this top-down pixel presentation proportionally. The game therefore uses a deterministic arcade parabola plus shadow: physically legible, inexpensive, and consistent with the approved 2.5D design.

The goalkeeper's 0.6-second hold is intentionally presentation-compressed. It is far below the real Law 12 possession limit and exists to make a catch readable before play restarts.

## Acceptance checks

- A saved shot never reaches or crosses the goal line in sim/render state.
- The goalkeeper remains visibly in caught possession for six ticks.
- The first post-catch pass has positive vertical velocity and rises above the 150 cm control gate.
- An airborne pass overlapping a player at more than 150 cm is not controlled; control becomes possible only at or below the gate.
- Roughly 30% of a large deterministic sample of shots is lifted.
- Ball height is interpolated and the shadow remains at the pitch-plane coordinate.
- Replay golden, determinism, balance rails, TypeScript, and focused render tests pass after the engine-version bump.
