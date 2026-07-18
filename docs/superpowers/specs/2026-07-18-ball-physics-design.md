# Ball Physics — Design Spec

**Date:** 2026-07-18 (v2 same day)
**Status:** Draft v2 — user locked Option B (emergent interception, "straight do 1B"); delegated decisions recorded in §8. Next: external review round per process, then implementation plan.
**Target:** engine `m0.6`. Base: `main` **after T1 lands** (the approved positional-movement rework, `2026-07-18-positional-movement.md`, owns `m0.5`). Companion: `2026-07-18-defense-and-player-stats-design.md` — both specs ship as one m0.6 version bump (new rng draws change replay draw order).

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
- **Pass error (PAS is to passes what SHO is to shots):** the solver's ideal `(aim, v0)` gets perturbed by the same triangular model as shots — lateral offset `tri × spreadP` where `spreadP = (BASE_P + (99 − pas) × K_P) × (D/REF) × pressureMult × fatigueMult`, and a power error `v0 × (1 + tri' × (0.05 + (99 − pas) × 0.002))`. Underhit passes die short and get cut out; overhit ones run through to space or the keeper. Four draws per pass, fixed order (lateral 2, power 2).
- Arrival is genuinely contested (Option B, §4): the receiver must trap it, opponents on the path may cut it.

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
control = 0.7 × sho + 0.3 × tec             // external review: TEC = body control & placement
spread = (BASE + (99 − control) × K) × (dist / REF_DIST) × pressureMult × fatigueMult
```

`spreadZ` uses the same formula with its own `BASE_Z/K_Z` (vertical control is worse than lateral — skying a ball is easier than shanking it 10 m wide, so `K_Z > K`). `POST_MARGIN` nominal 150 cm. Rng draw order per shot is fixed and replay-load-bearing: aim side (1), `vz` band (1), `triX` (2), `triZ` (2) — six draws, always, even when a value ends up unused.

- `pressureMult = 1.5` when the existing `pressured` flag is true (marker within 4 m).
- `fatigueMult = 1 + (100 − condition) / 400` (tired legs spray; cheap, deterministic).
- `BASE`, `K`, `REF_DIST` are the tuning dials for the balance round.
- Shot angle needs no explicit term: wide positions are farther from the aim points, and distance already scales the spread — the geometry taxes bad angles on its own. Hidden `consistency` (composure) joins this formula in M1 via the same funnel as morale.

**Outcomes are now geometry, not a table:**

| Where the swept goal-line check lands | Result |
|---|---|
| `abs(xAtLine − center) > GOAL_W/2` | `MISS` (flavor `wide-left` / `wide-right`) |
| `zAtLine > CROSSBAR (300)` | `MISS` (flavor `over`) — the new "skied it" |
| otherwise | on target → GK contest, **modulated by placement**: centrality `c = 1 − abs(xAtLine − gkX)/(GOAL_W/2)` adds `+c × PM` to the keeper's side of the contest |

The user's three named behaviors all emerge: *wide* and *over* from error vs. geometry; *straight at the keeper* because weak shooters aim centrally (b) and central on-target shots are easier to save (placement mod). GK Resolve and the save contest survive unchanged otherwise.

---

## 4. Emergent interception (DECIDED: Option B, user call — "lets straight do 1B")

No precomputed pass outcome. `willSucceed`/`interceptor` are deleted; the ball is a free physical object from the moment it leaves the boot, and possession changes are geometry + reaction contests. (Option A — physical flight with dice-decided outcomes — remains documented in git history as the cheap fallback if the emergent tuning round fails; same flight code either way. Option C — renderer-only fakery — stays rejected: the renderer draws sim truth.)

**Who gets the ball, mechanically:**

- **Opponent cut-out** — an opponent whose distance to the tick's swept segment is inside `CONTROL_R` (150) gets **one reaction attempt per pass flight** (on the first tick the path enters their radius): contest with attacker = their `DEF`, defender = ball-speed difficulty (`speed / K_CUT` through the standard logistic table). A zipped pass whooshes past flat feet; a slowing or underhit one is meat. Success → held, `INTERCEPT` event, +8 gauge (as any reception today).
- **High balls can't be cut** — if the ball's `z > INTERCEPT_H` (250 cm) at the crossing, no attempt (canon defers headers/aerials). This is *why* chipped through-balls beat a flat defensive line — and the price is built in: lofted balls hang longer (slower to arrive) and come down hot (harder trap).
- **Receiver trap (first touch)** — the intended receiver (or any teammate once the ball has slowed below a loose threshold) collects via a `TEC` vs arrival-speed contest (`speed / K_TRAP`). Win → held + `RECEIVE` event. Fail → **bobble**: ball deflects onward at half speed (one tri draw for the nudge direction), still live — re-attempt next tick when it's slower and easier. High-TEC players kill a 25 m/s pass dead; low-TEC ones cough it up for a beat.
- **AI must aim into lanes** — `bestPassTarget` gains a lane-block penalty: minimum opponent distance to the pass segment (deterministic, no draws). Without this, emergent cutting turns midfield into a wall; with it, the AI visibly plays around blocks, which is the point.

**What this buys:** deflections, second balls, underhit passes punished, through-balls rewarded — the "fight for the ball" the defense spec choreographs happens *on real ball trajectories*, not scripted ones.

## 5. Schema / event / renderer impact

- `BallState`: `loose` / `pass` / `shot` all gain `z`, `vz` (and `pass` gains real `vel`); `pass` keeps intent fields `from/to` but **drops `willSucceed`/`interceptor`** (outcomes are emergent); `shot` keeps `by` (+ derived `power`). `held` unchanged.
- Events: `MISS` gains `flavor: 'wide-left' | 'wide-right' | 'over'`; new `INTERCEPT {by}` and `RECEIVE {by}` (gives the ticker "cut out!"/"clean take" and gives the harness a direct pass-completion metric). `SHOT` unchanged externally; `SAVE` gains `held: boolean` (catch vs parry, §7).
- `PitchFrame` (`src/render/interpolate.ts`): add `ballZ`, lerped like positions. Renderer draws the shadow at `pos` and offsets the ball sprite up by `k × z` with a slight scale — the standard top-down height illusion. Atlas-batched as before; squash-stretch on bounce is optional juice.
- `ENGINE_VERSION` → `m0.6` (shared with the defense/stats spec); `runReplay`'s existing version gate handles old envelopes.

## 6. Determinism rules (unchanged, restated because physics tempts violations)

- All randomness through `state.rng`; every new draw site changes replay draw order → version bump, never silent.
- Integer `pos/z/vel/vz` after every tick (`Math.trunc`, matching the loose-ball precedent).
- No `Math.sin/cos/exp/pow` anywhere in `src/sim/` (IEEE-754 guarantees `+ − × ÷ sqrt` bit-identical across engines; transcendentals are implementation-defined — the reason `contest-table.json` exists).

## 7. Balance & test plan

Rails will drift (a new miss mode lowers on-target share). Tuning order:

1. `BASE/K/REF_DIST` until team-average control ≈ 50 gives ~55–65% shots on target.
2. Placement mod `PM` until save rate sits ~0.70–0.80 (rail: 0.55–0.90).
3. Pass dials (`BASE_P/K_P`, `K_CUT`, `K_TRAP`, lane penalty) until completion lands in its band.
4. `CATCH_MARGIN` until ~70–80% of saves are catches; then re-check goals/match 1.5–4.0.

New rails to add:
- Shots-on-target fraction band (locks the miss model itself).
- Stat monotonicity: a `sho = 90` striker converts ≥ 1.5× a `sho = 40` striker over 500 matches (the actual point of the feature, asserted).
- **Emergent-pass rails (Option B's safety net):** team-average pass completion inside ~65–85% (from `PASS`→`RECEIVE`/`INTERCEPT` streams); `pas = 90` playmaker completes measurably more than `pas = 40`; possession doesn't collapse into endless midfield turnovers (possession-share band).
- **Rebound rail:** goals scored within ~2 s of a parried save stay a small share of total goals (scrappy, not dominant).

Unit tests: integrator golden decay curves; bounce settles and `z ≥ 0` invariant; kick solver arrival tolerance across distance bands; swept segment math incl. the fast-diagonal tunneling case; on-target fraction by `sho` tier over fixed seeds; determinism guard + replay parity across the version bump.

## 8. Decision record (2026-07-18)

1. **Passes: Option B — emergent interception, immediately.** User decision ("lets straight do 1B"). §4 is now the design; Option A survives only as the documented fallback if the emergent tuning round can't reach the pass-completion band.
2. **GK parries/rebounds: IN, conservatively tuned.** (Delegated to Claude.) The save contest is unchanged; its *margin* now decides the result: comfortable win → **catch** (GK holds, as today), narrow win → **parry** — the ball spills into the box with real velocity and the free-ball machinery resolves the scramble. One dial (`CATCH_MARGIN`) starts strict (~70–80% catches) so rebounds are an occasional thrill, not the meta; the rebound rail in §7 enforces that. Rationale: in a fully emergent world (decision 1), a ball that glues to gloves on every save would be the *only* scripted outcome left.
3. **Miss flavors: record now, present simply.** (Delegated to Claude.) The `MISS` event carries `wide-left`/`wide-right`/`over` from day one — the data is free at the moment of the swept check and impossible to reconstruct later. UI ships one generic miss banner; the ticker/commentary layer can differentiate ("blazes it over!") whenever presentation work wants it. No UI scope added to m0.6.
