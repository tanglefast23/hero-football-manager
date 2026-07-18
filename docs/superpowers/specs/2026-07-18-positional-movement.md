# Positional-Table Movement Rework — v2, post external review

Status: APPROVED for implementation in a fresh session. Engine → m0.5. External review verdict: "greenlight the zonal-table idea" with required changes — all incorporated below. Attribution: the mechanism is documented in the Sensible World of Soccer manual's tactics system (35 ball areas → per-player attempted position); we adopt that model, with the table supplying positional INTENT while movement and active decisions stay separate systems.

## The problem (unchanged from v1)

Current movement = fixed anchor + uniform linear pull toward the ball (0.15x/0.10y) → the formation translates as a rigid sheet ("everyone moves up and down together"), no zone semantics, one presser carries all chase energy, two scalars tune all 22 players.

## Milestone 1 (the versioned implementation)

**Data**
- Build-time generator (committed, like the contest table) + a committed `overrides` file of explicit per-cell/per-slot corrections consumed by the generator. Generated output is authoritative and always regenerable; NEVER hand-edit the emitted JSON.
- `src/sim/formation-tables.json`: `{ grid: {cols: 5, rows: 7}, phases: { inPossession, outOfPossession }, slots: 10 outfield × 35 × [x, y] }` per phase — normalized fractions authored for team 0 (attacks toward y=0). **GK is NOT in the tables** (keeps current behavior in this milestone; angle-narrowing is a separate follow-up commit with its own balance re-run).
- Dedicated kickoff layout: a separate 10-entry restart position list (kickoff has unique spacing/half-pitch constraints; do not reuse the center cell's active-play shape).

**Runtime (engine.ts)**
- Phase = team of the current holder; on `held` by the other team, start a ~10-tick BLEND (lerp between old-phase and new-phase targets) so all ten don't reverse simultaneously; loose/pass/shot states keep the previous phase.
- Sampling: **cell-center convention** — continuous grid coords `(ball.x / cellW − 0.5, ball.y / cellH − 0.5)`, clamped; bilinear over the 4 nearest cell entries. Team 1: **mirror the continuous coordinates before sampling AND rotate targets 180°** (x and y both) — tactical-relative slot semantics ("left back" = attacking-direction left). Property test the convention.
- Sampled targets **round to integer cm** (matches the engine's position convention; moots cross-runtime float questions).
- movementTick priority unchanged: carrier → charge lock → presser → receiver → loose chaser → table target. **Presser lease**: once selected, a presser holds the role for ≥10 ticks unless unavailable (hysteresis kills per-tick flip-flop). Additional pressure emerging from near-cell table targets is MEASURED (support-pressure metric), not assumed.
- `anchorFor` + `BALL_PULL_*` deleted; `restartKickoff` uses the dedicated kickoff layout.

**Verification**
- Table validity: 10×35×2 phases, in-bounds; coherence: defenders' mean y goal-side of midfielders' for defensive-third cells, per phase.
- Spacing: role-specific spacing BANDS with crowding reported as a metric (not a universal min-distance assertion — compact defending legitimately bunches).
- **Defect-targeted test**: correlation of off-ball players' y-velocities must drop vs the current engine (the "rigid sheet" measurement itself). Record before/after values.
- Asymmetry behavioral test (ball far left → near-side response ≫ far-side; far winger tucks inward). Phase test (same cell, opposite phases → materially different shapes; blend transitions smooth over ~10 ticks).
- Full determinism double-runs; ALL acceptance gates + balance rails re-run — if rails break, retune generator/overrides, never gates. ENGINE_VERSION m0.5; goldens/fingerprints regenerate.
- **Debug overlay** (dev-only renderer toggle): draw grid cells + each player's current target point — the tuning instrument.

**Explicitly deferred (follow-ups, each isolated):** GK angle-narrowing (own commit + balance re-run); held-ball foot-offset rendering; grid resolution increase (only if replay evidence shows 7×5 can't express a needed shape); throw-ins/corners/headers (M1 restart variety).

## Review disposition record

Accepted: overrides file; possession phases in m0.5 (+turnover blend); cell-center bilinear; continuous-coordinate mirroring; 180° rotation semantics + property test; GK isolation; dedicated kickoff; role-band spacing + crowding metric; y-velocity correlation test; presser lease; 7×5 retained; debug overlay; SWOS attribution.
Conceded pragmatically: quantize sampled targets to integer cm (already our convention; ends the cross-runtime float debate regardless of position on IEEE basic-op exactness).
