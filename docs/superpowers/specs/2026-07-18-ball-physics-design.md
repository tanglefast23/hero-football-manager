# Ball Physics — Design Spec

**Date:** 2026-07-18
**Status:** Draft — awaiting user review
**Target:** match engine `m0.5` (implementation branches from `feature/m0-match-engine`, engine version bump required — new rng draws change replay draw order)

## Problem

Three complaints, all real (verified against `src/sim/engine.ts` at m0.4):

1. **Ball speed is constant.** Passes move at a fixed `PASS_SPEED = 250` every tick and home onto the receiver (`moveToward`), so they can neither slow down nor miss. Shots fly at a constant `vel.y = ±300` until the goal line. Only loose balls decay, and their `×0.8/tick` decay kills them in ~1 second.
2. **No grass.** There is no height axis and no bounce. A ball can't skip, hop, or get eaten by the turf.
3. **Shots are only wrong in one dimension.** Aim spread exists (`200 + (99 − sho) × 10`, uniform, lateral) but there is no "over the bar," no distance or pressure effect, and no reason weak shooters hit it straight at the keeper.

## Goals

- Kicked balls start fast and visibly slow down; ground friction ≫ air drag; each grass contact eats a chunk of energy.
- Shots can miss **wide**, go **over the bar**, or arrive **straight at the keeper**, with frequency and clustering controlled by the shooter's `sho` stat, distance, and pressure.
- Same determinism contract as today: seeded PRNG only, integer state after every tick, no transcendental functions (`sin`/`cos`/`exp`/`pow`) at runtime — vector math + `sqrt` only.
- Balance rails (`balance-rails.test.ts`) still pass after a tuning round.

## Non-goals (explicitly out)

- Spin / Magnus curve (future hero-power hook — the z-axis foundation enables it later).
- Wind/weather friction modifiers (future doc-07 event hook; the constants table below makes it a one-line multiply later).
- Player body collisions, headers as a distinct mechanic, GK positioning AI.
- Raising the 10 Hz tick rate. Render interpolation already smooths flight; sub-tick micro-bounces are deliberately collapsed (see `SETTLE_VZ`).

## Units

Already centimeters and 100 ms ticks (pitch 6800×10500 for 68×105 m). Real constants drop straight in: gravity 9.81 m/s² ≈ **10 cm/tick²**; a 30 m/s shot = **300 cm/tick** (the current hardcoded `300`).

---

## 1. Core model: 2.5D arcade ballistics

One kinematic body shared by every in-flight ball kind:

```ts
pos: Vec        // cm on pitch plane (existing)
z: number       // cm above grass, 0 = grounded (NEW)
vel: Vec        // cm/tick horizontal (existing on loose/shot, new on pass)
vz: number      // cm/tick vertical (NEW)
```

### Constants (one exported table — this IS the grass feel, and the future weather hook)

| Constant | Value | Meaning |
|---|---|---|
| `GRAVITY` | 10 | cm/tick² downward while airborne |
| `AIR_DRAG` | 0.99 | horizontal multiplier per airborne tick (air barely slows a ball) |
| `ROLL_FRICTION` | 0.94 | horizontal multiplier per grounded tick (grass drags hard; ~1.1 s half-life) |
| `RESTITUTION` | 0.45 | vertical bounce keeps 45% of impact speed (grass is dead, not a gym floor) |
| `BOUNCE_FRICTION` | 0.80 | horizontal multiplier applied once per ground contact (turf bite) |
| `SETTLE_VZ` | 25 | bounce weaker than this collapses to rolling (kills sub-tick bounce jitter) |
| `STOP_SPEED` | 5 | rolling slower than this (0.5 m/s) stops dead |

### Integrator (`ballPhysicsTick`, semi-implicit Euler, integer state)

```
if airborne (z > 0 or vz > 0):
    vz  -= GRAVITY
    vel  = trunc(vel × AIR_DRAG)
    pos += vel;  z += vz
    if z <= 0:                       // ground contact
        z  = 0
        vz = trunc(−vz × RESTITUTION)
        vel = trunc(vel × BOUNCE_FRICTION)
        if vz < SETTLE_VZ: vz = 0    // now rolling
else (rolling):
    vel  = trunc(vel × ROLL_FRICTION)
    pos += vel
    if |vel| < STOP_SPEED: vel = 0   // at rest
```

Only `+ − × trunc compare` — bit-identical on every device. Truncation doubles as static friction (the ball genuinely stops).

Sanity checks at these values:
- Firm 18 m/s ground pass travels ~14 m in ~1 s, arriving ~10 m/s. Feels like football.
- Driven shot with `vz = 40` skips once (apex 80 cm), settles to a roll if it misses.
- Chip with `vz = 100` hangs 2 s, apex 5 m, one 1 m hop, then rolls. Reads as a real chipped ball.

### Swept collision checks (required, not optional)

At 250–450 cm/tick the ball out-runs the 150 cm pickup radius in a single tick — point-in-radius checks whiff (today's code dodges this only because passes home and shots test `targetX` instead of position). All of these become **segment tests** against the tick's travel `[posBefore → posAfter]`:

- Player pickup / interception: point-to-segment distance (vector projection + `sqrt`).
- Goal line: y-crossing test, with `xAtLine` and `zAtLine` interpolated at the crossing fraction — `xAtLine` decides wide/on-target, `zAtLine` decides over-the-bar.

---

## 2. Kick model

A kick sets `(vel, vz)` once; physics owns the ball afterward. No homing, ever.

**Pass** — pick flight time `n` (ticks) from distance band, then the closed-form launch speed that makes friction *deliver* the ball rather than a constant-speed ray:

```
v0 = D × (1 − ROLL_FRICTION) / (1 − ROLL_FRICTION^n)
```

- Flight time nominal: `n = clamp(round(D / 150), 6, 18)` ticks (0.6–1.8 s; a tuning dial like the constants table).
- Aim at the receiver's **predicted** position (`pos + vel × n`, one iteration — the lead pass).
- Cap `v0` by kicker leg speed (from `pas`). If the distance needs more than the cap: **lofted pass** — split into `vz`, which legitimately extends range because `AIR_DRAG` < `ROLL_FRICTION`. Chipped long balls emerge from the friction model instead of being scripted.
- Arrival is no longer exact — the receiver collects via the swept pickup check, or the ball rolls past and is simply live. Under Option A (below) this is presentation-level slop only.

**Shot** — launch speed from the shooter:

```
v0 = 260 + 1.6 × sho        // sho 40 → ~32 m/s; sho 90 → ~40 m/s
vz = 15–40 (driven, from a small rng band)
```

The save contest's `power` input becomes the ball's **arrival speed** at the line (`power = vAtLine / K_POWER`). This is the physical version of today's hand-rolled `sho − dist/200`: launch speed encodes `sho`, drag encodes distance — the linear penalty falls out of the ballistics instead of being scripted. The `SHOT` event keeps `power` (now the derived value) for gauge/commentary compatibility.

**Every other release** (clearances, GK parries if adopted, knock-ons) uses the same primitive: set `(vel, vz)`, walk away.

---

## 3. Shot error model (`sho` = shot control)

Two ideas carry all of it:

**(a) Error is angular at the boot, so distance amplifies it for free.** Offset the aim point at the goal line by an error that scales with distance — same foot-error misses by more from 25 m than from 8 m. No trig: the offset is applied along the goal line (x) and vertically (z), never as a rotated angle.

**(b) Aim placement depends on confidence.** Good shooters aim near the posts; weak shooters aim near the middle (and their bigger error sprays from there):

```
aimX = GOAL_CENTER_X ± (sho / 99) × (GOAL_W/2 − POST_MARGIN)   // side: 1 rng draw
aimZ = 60–120 cm (low corner bias)
```

**Error sample** — triangular distribution (two rng draws, bounded, gaussian-ish, no `Math` functions):

```
tri = rng() + rng() − 1                     // [−1, 1], peaked at 0
errX = tri × spread;  errZ = tri' × spreadZ
spread = (BASE + (99 − sho) × K) × (dist / REF_DIST) × pressureMult × fatigueMult
```

`spreadZ` uses the same formula with its own `BASE_Z/K_Z` (vertical control is worse than lateral — skying a ball is easier than shanking it 10 m wide, so `K_Z > K`). `POST_MARGIN` nominal 150 cm. Rng draw order per shot is fixed and replay-load-bearing: aim side (1), `vz` band (1), `triX` (2), `triZ` (2) — six draws, always, even when a value ends up unused.

- `pressureMult = 1.5` when the existing `pressured` flag is true (marker within 4 m).
- `fatigueMult = 1 + (100 − condition) / 400` (tired legs spray; cheap, deterministic).
- `BASE`, `K`, `REF_DIST` are the tuning dials for the balance round.

**Outcomes are now geometry, not a table:**

| Where the swept goal-line check lands | Result |
|---|---|
| `abs(xAtLine − center) > GOAL_W/2` | `MISS` (flavor `wide-left` / `wide-right`) |
| `zAtLine > CROSSBAR (300)` | `MISS` (flavor `over`) — the new "skied it" |
| otherwise | on target → GK contest, **modulated by placement**: centrality `c = 1 − abs(xAtLine − gkX)/(GOAL_W/2)` adds `+c × PM` to the keeper's side of the contest |

The user's three named behaviors all emerge: *wide* and *over* from error vs. geometry; *straight at the keeper* because weak shooters aim centrally (b) and central on-target shots are easier to save (placement mod). GK Resolve and the save contest survive unchanged otherwise.

---

## 4. The pass-interception fork (the one real architecture decision)

- **Option A — physical flight, scripted outcome (recommended now).** Keep the `pas`-vs-`def` contest and `willSucceed`/`interceptor` precompute exactly as today; the ballistic ball is simply *aimed at the winner's* predicted spot and collected by the swept check. The mid-flight-KO fallthrough (audit's phantom-pass fix) generalizes: nobody eligible → ball just keeps rolling. Pass success rates, possession share, and the balance rails barely move; only shot outcomes need retuning. All the visible feel (zip → slow → arrive) ships.
- **Option B — emergent interception (later).** No precompute; opponents crossing the swept path get a `def`-based reaction contest to take the ball. Deflections and through-balls beating a flat back line become real. Costs: pass success becomes emergent (full rebalance), and the pass-target AI must learn to pass into space or it will look dumb. Do it as its own milestone on top of the same primitive.
- **Option C — cosmetic decay in the renderer only. Rejected:** the renderer draws sim truth in this codebase, and a fake ball position breaks tap-timing fairness the moment rebounds or interceptions depend on where the ball actually is.

## 5. Schema / event / renderer impact

- `BallState`: `loose` / `pass` / `shot` all gain `z`, `vz` (and `pass` gains real `vel`); intent fields (`from/to/willSucceed/interceptor`, `by/power`) stay. `held` unchanged.
- Events: `MISS` gains `flavor: 'wide-left' | 'wide-right' | 'over'`. `SHOT` unchanged externally.
- `PitchFrame` (`src/render/interpolate.ts`): add `ballZ`, lerped like positions. Renderer draws the shadow at `pos` and offsets the ball sprite up by `k × z` with a slight scale — the standard top-down height illusion. Atlas-batched as before; squash-stretch on bounce is optional juice.
- `ENGINE_VERSION` → `m0.5`; `runReplay`'s existing version gate handles old envelopes.

## 6. Determinism rules (unchanged, restated because physics tempts violations)

- All randomness through `state.rng`; every new draw site changes replay draw order → version bump, never silent.
- Integer `pos/z/vel/vz` after every tick (`Math.trunc`, matching the loose-ball precedent).
- No `Math.sin/cos/exp/pow` anywhere in `src/sim/` (IEEE-754 guarantees `+ − × ÷ sqrt` bit-identical across engines; transcendentals are implementation-defined — the reason `contest-table.json` exists).

## 7. Balance & test plan

Rails will drift (a new miss mode lowers on-target share). Tuning order:

1. `BASE/K/REF_DIST` until team-average `sho` ≈ 50 gives ~55–65% shots on target.
2. Placement mod `PM` until save rate sits ~0.70–0.80 (rail: 0.55–0.90).
3. Re-check goals/match 1.5–4.0; nudge shot-attempt range if needed.

New rails to add:
- Shots-on-target fraction band (locks the miss model itself).
- Stat monotonicity: a `sho = 90` striker converts ≥ 1.5× a `sho = 40` striker over 500 matches (the actual point of the feature, asserted).

Unit tests: integrator golden decay curves; bounce settles and `z ≥ 0` invariant; kick solver arrival tolerance across distance bands; swept segment math incl. the fast-diagonal tunneling case; on-target fraction by `sho` tier over fixed seeds; determinism guard + replay parity across the version bump.

## 8. Open questions for review

1. **Option A vs B** for passes — recommendation is A now, B as its own later milestone. Agree?
2. **GK parries/rebounds** (save margin decides catch vs. spill; spilled balls are live in the box): high charm, high balance blast radius. Recommended: design hook now (`catch` threshold constant), ship OFF, enable in its own tuning round. Agree?
3. **Miss-flavor presentation** — does commentary/skit presentation (doc 03) want `wide-left/right` vs `over` distinguished, or is a single `MISS` flavor enough for M0.5 UI?
