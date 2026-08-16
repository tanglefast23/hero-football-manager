# Shot danger is keeper-relative and computed in the render ring

The renderer needs one number for "how frightening is this shot" to drive its
visual tiers. Three candidates existed: `SHOT.power` (already on the event),
the engine's internal expected-goal product, and the keeper save probability.
We picked **shot danger** = `1 - keeperSaveProbability(...)`, computed in the
render ring at launch from `BallState.shotStrengthD64`, because it is the only
one that is both scale-invariant and free.

## Considered options

**`SHOT.power`** — already on the wire, and what the old `HARD_SHOT_POWER_MIN =
55` used. Rejected on measurement: it is a log projection of the shooter's SHO
against distance, and it ignores the keeper entirely. Across a 24-match probe
its median ran 50 / 70 / 91 / 111 as squad stats scaled ×1 / ×2 / ×4 / ×8, so
14% of shots cleared 55 at Division 5 and **100%** cleared it from ×2 upward.
Player development is cap-free, so no fixed threshold on this scale can survive.
It is also the wrong meaning: a tap-in is a near-certain goal at low power.

**The expected-goal product** (`shotExpectedValue`, `src/sim/engine.ts`) — the
truest "will this score", combining on-target chance, save chance, distance,
goal-facing and corridor clearance. Rejected on cost: it is computed every five
ticks and discarded, so surfacing it means a new event field, an
`ENGINE_VERSION` bump and a golden-replay decision, for a number that is
strictly more spoiler-ish than the one we chose.

**Shot danger** (chosen) — `keeperSaveProbability` is already exported from
`src/sim/engine.ts`, and the renderer already holds the whole `MatchState`, so
this costs no engine change at all. The same probe measured its median at
0.306 / 0.310 / 0.314 / 0.314 across the same ×1–×8 stat spread: it moves 0.008
where `power` moves 61. It also carries Resolve, so a worn-down keeper makes
shots visibly more dangerous for free.

## Consequences

- The render ring imports a function from the sim ring. That is the existing
  direction of dependency and leaves `src/sim/` pure, but it does mean a
  render-only feature reads a simulation seam — keep `keeperSaveProbability`
  exported and treat its signature as a render-facing contract.
- Danger is stamped once at launch, never re-checked in flight, so a Resolve
  drop or a substitution mid-flight cannot make a burning ball flicker.
- Danger is bounded roughly 0.17–0.62 in practice and never approaches 1.0.
  Tier thresholds must be read against that measured range, not against
  intuition about probabilities.
- Danger deliberately ignores `targetX`. A ferocious shot flying wide still
  renders as ferocious, so the effect stays a threat and never becomes a
  verdict.
