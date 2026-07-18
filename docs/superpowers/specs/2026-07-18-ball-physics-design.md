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

Sanity checks at these values (gravity-first integrator: `vz0 = v` yields apex `Σ(v − G·k)` for `k = 1..`, i.e. `vz = 40` → **60 cm**, `vz = 100` → **~4.5 m**):
- Firm 18 m/s ground pass travels ~14 m in ~1 s, arriving ~10 m/s. Feels like football.
- Driven shot with `vz0 = 40` skips once (apex 60 cm), settles to a roll if it misses.
- Chip with `vz0 = 100` hangs ~2 s, apex ~4.5 m, one low hop, then rolls. Reads as a real chipped ball.

### Contact resolution (one shared resolver, time-of-impact ordered)

At 250–450 cm/tick the ball out-runs the 150 cm pickup radius in a single tick — point-in-radius checks whiff (today's code dodges this only because passes home and shots test `targetX` instead of position). Swept segment tests alone are not enough either: several contacts can occur in the same tick, and their order must be deterministic. One resolver handles every flight tick:

- For each candidate contact, compute the **entry fraction `t ∈ [0,1]`** along the tick using *relative motion* (ball start/end vs player start/end — players move too; a defender stepping across the path mid-tick is a real contact). Player proximity, ground contact (`z` crossing 0), keeper-plane, goal-line and pitch-boundary crossings are all expressed as fractions in this same time domain.
- Sort by **`(t, eventTypePriority, playerIndex)`** — non-player events have no index, so ties need a declared type order: keeper plane → player contact → goal line → ground → boundary (possession/save moments beat passive physics at the same instant). Process in order, with **continuation rules** (round-2 review):
  - *Terminal* outcomes — control won, save resolved, goal — consume the tick's remaining travel.
  - *Non-terminal* outcomes continue along the remaining segment so later candidates still act: a **failed** reaction/trap marks its attempt state and the ball flies on; a **ground bounce** applies the bounce velocity change at its fraction and the remainder of the tick continues with post-bounce velocity; a **wrap** continues from the wrapped entry point (never test the unsplit segment — a wrapped ball would otherwise draw a false collision line across the pitch).
- Goal line: `xAtLine`/`zAtLine` interpolated at the crossing fraction — `xAtLine` decides wide/on-target, `zAtLine` decides over-the-bar.
- **Boundary rules, complete** (round-2 review — non-shot balls reach end lines too): touchlines (x = 0 / `PITCH_W`) **wrap** (canon, doc 03). End lines (y = 0 / `PITCH_H`) *outside* the goal mouth **reflect** — the ball bounces back into play off a low invisible wall (no corners/goal-kick ceremony exists in canon; reflection keeps play flowing, wrap would teleport the ball the length of the pitch). Any ball — shot or not — fully crossing *inside* the mouth (under bar, between posts) is a **GOAL** for the team attacking that end, `by` = last toucher; a defender's spill trickling in is an own goal, and the parry vector always points into the pitch so a keeper can't wrap one into his own net.

### The margin-contest primitive (one draw, three outcomes)

Several m0.6 mechanics need "won comfortably / won narrowly / lost" from a single contest. Two `contest()` calls would change both the odds and the rng draw count, so a new one-draw helper joins `contest.ts`:

```
r = rng()                                    // exactly one draw
pWin         = contestProbability(atk, def, mod)
pComfortable = clamp(pWin − margin, 0, pWin) // margin expressed in probability units
r < pComfortable → 'strong'   (clean take / caught save)
r < pWin         → 'narrow'   (spill / parry)
otherwise        → 'loss'     (whiff / goal)
```

Invariant (tested): changing `margin` redistributes strong↔narrow but **never** changes total win probability.

---

## 2. Kick model

A kick sets `(vel, vz)` once; physics owns the ball afterward. No homing, ever.

**Pass** — pick flight time `n = clamp(round(D / 150), 6, 18)` ticks, then find the launch speed **by simulating the real integrator**, not by closed form. (External review, accepted: the geometric-series formula both requires the forbidden `pow` and disagrees with the integrator's friction-before-move ordering — it under-delivers by ~8% at 14 m and ~2.7 m at 35 m.) The solver runs the exact rolling rules (`trunc(v × ROLL_FRICTION)` then move) for ≤ 18 ticks per candidate and binary-searches integer `v0` for the closest arrival — deterministic, exact including truncation, ~10 candidates × 18 ticks of integer math.

- **Lofted passes get their own solver** (an airborne ball obeys `AIR_DRAG` + bounces, not `ROLL_FRICTION`): choose hang time `m` from distance, then **search integer `vz0` by simulating the integrator** to land nearest tick `m` — no closed form (round-2 review: under gravity-first integration `z(m) = m·vz0 − G·m(m+1)/2`, so the naive `G×m/2` lands a tick early; solvers simulate, period). Then simulate the airborne rules (+ first bounce) to solve horizontal `v0` for the landing point. Used when the ground solver's `v0` exceeds the kicker's leg-speed cap (from `pas`) — chipped long balls emerge from the physics, not a script.
- **Lead point comes from the movement layer, not a velocity field** (external review: `SimPlayer` has no `vel`, and T1 owns where the receiver is going): lead = the receiver's current T1 movement target direction × their `speedFor` × `n`, clamped to the pitch. The pass stores this as immutable `targetPos`.
- **Receiver runs to `targetPos`** — not at the live ball — until the ball arrives there, slows below the loose threshold, or the flight breaks down (then normal chase rules apply). This replaces T1's receiver-chases-ball priority *during* a pass flight and kills the oscillation where kicking the ball changes the movement the lead prediction assumed. Recorded as a T1 amendment (its plan ledger).
- **Pass error (PAS is to passes what SHO is to shots):** the solver's ideal `(aim, v0)` gets perturbed by the same triangular model as shots — lateral offset `tri × spreadP` where `spreadP = (BASE_P + (99 − pas) × K_P) × (D/REF) × pressureMult × fatigueMult`, and a power error `v0 × (1 + tri' × (0.05 + (99 − pas) × 0.002))`. Underhit passes die short and get cut out; overhit ones run through to space or the keeper. Four draws per pass, fixed order (lateral 2, power 2).
- Arrival is genuinely contested (Option B, §4): the receiver must trap it, opponents on the path may cut it.

**Shot** — launch speed from the shooter, vertical flight solved from the vertical target:

```
v0 = 260 + 1.6 × sho        // sho 40 → ~32 m/s; sho 90 → ~40 m/s
targetZ = max(0, aimZ + errZ)   // where the ball should cross the line (§3)
```

`vz0` is **solved, not drawn** (round-1 blocking find: an independent `vz` band never connected the vertical error model to the vertical flight, and under the semi-implicit integrator `vz = 40` tops out at 60 cm, so shots could never clear the 300 cm bar). Round-2 refinement — the solve has a circular dependency (flight time depends on airborne-vs-rolling drag, which depends on `vz0`), so it's a plain **enumeration**: for each candidate integer `vz0` in a small band, simulate the complete 2.5D path (drag switching, bounces and all) to the keeper contact plane, and keep the candidate whose `zAtPlane` is nearest `targetZ`. `targetZ ≈ 0` → a driven roller (`vz0 = 0` wins); `targetZ > 300` → the ball honestly sails over. Bounded cost: ~a dozen candidates × ≤ 20 ticks of integer math per shot.

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

`spreadZ` uses the same formula with its own `BASE_Z/K_Z` (vertical control is worse than lateral — skying a ball is easier than shanking it 10 m wide, so `K_Z > K`). `POST_MARGIN` nominal 150 cm. Rng draw order per shot is fixed and replay-load-bearing: aim side (1), `aimZ` band (1), `triX` (2), `triZ` (2) — six draws, always, even when a value ends up unused (`vz0` is solved from `targetZ`, never drawn).

- `pressureMult = 1.5` when the existing `pressured` flag is true (marker within 4 m).
- `fatigueMult = 1 + (100 − condition) / 400` (tired legs spray; cheap, deterministic).
- `BASE`, `K`, `REF_DIST` are the tuning dials for the balance round.
- Shot angle needs no explicit term: wide positions are farther from the aim points, and distance already scales the spread — the geometry taxes bad angles on its own. Hidden `consistency` (composure) joins this formula in M1 via the same funnel as morale.

**Outcomes are now geometry, not a table:**

| Where the swept goal-line check lands | Result |
|---|---|
| `abs(xAtLine − center) > GOAL_W/2` | `MISS` (flavor `wide-left` / `wide-right`) |
| `zAtLine > CROSSBAR (300)` | `MISS` (flavor `over`) — the new "skied it" |
| otherwise | on target → GK save resolved at the **contact plane** (below), **modulated by placement**: centrality `c = clamp(1 − abs(xAtPlane − gkX)/(GOAL_W/2), 0, 1)` adds `+c × PM` to the keeper's side (clamped — a displaced GK must not produce a negative modifier) |

**The save resolves at a keeper contact plane, not the goal line** (external review, accepted): the plane sits just inside the pitch (`~100 cm` in front of the line), so a parried ball spawns *in play*, never behind the line. The save uses the margin-contest primitive (§1): **strong** → caught, GK holds (today's behavior); **narrow** → **parry** — the ball's outgoing velocity is derived deterministically from the incoming one (reflected off the plane, horizontal speed reduced, direction biased by the impact offset from the GK's center — no extra rng draws), with small `z`/`vz` so it drops into the box for the scramble; **loss** → goal. `CATCH_MARGIN` starts strict (~70–80% of saves are catches).

The user's three named behaviors all emerge: *wide* and *over* from error vs. geometry; *straight at the keeper* because weak shooters aim centrally (b) and central on-target shots are easier to save (placement mod). GK Resolve survives unchanged.

---

## 4. Emergent interception (DECIDED: Option B, user call — "lets straight do 1B")

No precomputed pass outcome. `willSucceed`/`interceptor` are deleted; the ball is a free physical object from the moment it leaves the boot, and possession changes are geometry + reaction contests. (Option A — physical flight with dice-decided outcomes — remains documented in git history as the cheap fallback if the emergent tuning round fails; same flight code either way. Option C — renderer-only fakery — stays rejected: the renderer draws sim truth.)

**Who gets the ball, mechanically:**

- **One control gate for everyone:** no player may touch a ball above `CONTROL_H` (150 cm) — interception attempts, receiver traps, and loose pickups alike (round-2 review killed the separate 250 cm intercept gate: a successful cut becomes held possession, so a higher gate could never actually fire — one constant, aligned with no-aerials canon). A ball above 150 cm simply flies over everyone until it comes down. This is *why* chipped through-balls beat a flat defensive line — and the price is built in: lofted balls hang longer and come down hot.
- **Opponent cut-out** — an opponent whose (relative-motion, §1) contact fraction lands inside `CONTROL_R` (150) gets a reaction attempt: contest with attacker = their `DEF`, defender = ball-speed difficulty (`speed / K_CUT` through the standard logistic table, speed = horizontal + `|vz|` at contact). A zipped pass whooshes past flat feet; a slowing or underhit one is meat. **Bounded rng, deterministically tracked:** each pass flight carries an attempt bitmask (22 bits in the ball state) — one attempt per opponent per flight, marked on first radius entry. Success → held + terminal `PASS_RESULT` (§5), +8 gauge.
- **Receiver trap (first touch)** — the intended receiver (or any teammate once the ball has slowed below the loose threshold) collects via the **unified trap resolver**: a `TEC` vs contact-speed contest (`speed / K_TRAP`). Win → held + terminal `PASS_RESULT`. Fail → **bobble**: ball deflects onward at half speed (one tri draw for the nudge direction), still live. **Retry rule (bounded):** one trap attempt per radius *entry* — the bobble carries the ball out of control range, and re-entry (player catches up to the slower ball) grants the next attempt. Never a per-tick retry loop (unbounded draws, near-guaranteed control). The same resolver body serves passes, tackle spills, GK parries, bobbles, and plain loose balls — one acquisition path, one rng discipline.
- **Pass-flight lifecycle** — a `pass` converts to `loose` (intent cleared, terminal `PASS_RESULT` emitted with outcome `loose`) when: the ball slows below the loose threshold before anyone controls it, the intended receiver becomes unavailable (KO'd/sent off — generalizes the audit's phantom-pass fix), or the ball wraps/settles far from `targetPos`. Restarts (kickoff/half) **finalize first, then clear**: an in-flight pass emits `PASS_RESULT {outcome: 'aborted'}` so the every-flight-terminates guarantee holds (round-2 review); `aborted` flights are excluded from the completion-rate denominator.
- **AI must aim into lanes** — `bestPassTarget` gains a lane-block penalty: minimum opponent distance to the pass segment (deterministic, no draws). Without this, emergent cutting turns midfield into a wall; with it, the AI visibly plays around blocks, which is the point.

**What this buys:** deflections, second balls, underhit passes punished, through-balls rewarded — the "fight for the ball" the defense spec choreographs happens *on real ball trajectories*, not scripted ones.

## 5. Schema / event / renderer impact

- `BallState`: `loose` / `pass` / `shot` all gain `z`, `vz` (and `pass` gains real `vel`); `pass` keeps intent fields `from/to`, gains immutable `targetPos` (§2) and the 22-bit `attemptMask` (§4), and **drops `willSucceed`/`interceptor`** (outcomes are emergent); `shot` keeps `by` (+ derived `power`). `held` unchanged.
- Events (external review, accepted — `PASS.ok` cannot exist when outcomes are emergent): `PASS` becomes `{from, to}` at launch (drop `ok`), and **every flight ends in exactly one** `PASS_RESULT {from, to, outcome: 'complete' | 'intercepted' | 'loose' | 'aborted', by?}` (`by` = actual controller when someone controls it; `aborted` = restart cut the flight short). One ball means flights never overlap, so launch/terminal pairs correlate trivially and the completion rail reads straight off the stream. `MISS` gains `flavor: 'wide-left' | 'wide-right' | 'over'`; `SHOT` unchanged externally; `SAVE` gains `held: boolean` (catch vs parry).
- **Migration checklist** (external review — understated before): update every `PASS.ok` consumer (ticker, tests, gates); redefine `ballSettled` — today a *moving* loose ball counts as settled and could end a half mid-scramble → settled = `held`, or `loose` with `z = 0` and speed < `STOP_SPEED`; restarts clear pass-flight state (attempt bitmask, `targetPos`); new sim modules join the import-layer allowlist test; renderer adds ball shadow + `z`-offset draw with interpolation tests.
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
- **Emergent-pass rails (Option B's safety net):** team-average pass completion 65–85% (straight off `PASS`/`PASS_RESULT`); an all-`pas`-90 XI completes ≥ 8 percentage points more than an all-`pas`-40 XI (same seeds); turnovers per match 20–70 — the multiplicative risk named by review (tight T1 spacing × cover × cut-outs × trap failures compounding into permanent midfield turnover) is exactly what this band guards.
- **Rebound rail:** goals within 20 ticks of a parried save ≤ 15% of total goals (scrappy, not dominant).
- **Heat-economy guard:** parries, spills and bobbles add involvement touches, which feed the Hero Gauge — hero zone entries per match must stay within ±20% of the m0.5 baseline, and the existing zone/attention gates (GATE-1/GATE-3) re-run in full, not just the goal/save rails.
- **Rng-audit tests:** shot creation = exactly 6 draws; pass creation = exactly 4; margin contest = exactly 1 — asserted on fixed seeds so draw-order regressions fail loudly.
- **Contact-resolver tests:** same-tick multi-candidate ordering (earliest fraction wins, index tie-break); moving-player crossing (defender steps through the path mid-tick); high-ball non-control (`z > CONTROL_H` flies over a would-be trap); stopped-pass → `loose` conversion; wrap-boundary segment splitting; parry spawn strictly in front of the line; solver golden values for `vz0` (targets 0 / in-goal / above-bar) and pass `v0` across distance bands.

Unit tests: integrator golden decay curves; bounce settles and `z ≥ 0` invariant; kick solver arrival tolerance across distance bands; swept segment math incl. the fast-diagonal tunneling case; on-target fraction by `sho` tier over fixed seeds; determinism guard + replay parity across the version bump.

## 8. Decision record (2026-07-18)

1. **Passes: Option B — emergent interception, immediately.** User decision ("lets straight do 1B"). §4 is now the design; Option A survives only as the documented fallback if the emergent tuning round can't reach the pass-completion band.
2. **GK parries/rebounds: IN, conservatively tuned.** (Delegated to Claude.) The save contest is unchanged; its *margin* now decides the result: comfortable win → **catch** (GK holds, as today), narrow win → **parry** — the ball spills into the box with real velocity and the free-ball machinery resolves the scramble. One dial (`CATCH_MARGIN`) starts strict (~70–80% catches) so rebounds are an occasional thrill, not the meta; the rebound rail in §7 enforces that. Rationale: in a fully emergent world (decision 1), a ball that glues to gloves on every save would be the *only* scripted outcome left.
3. **Miss flavors: record now, present simply.** (Delegated to Claude.) The `MISS` event carries `wide-left`/`wide-right`/`over` from day one — the data is free at the moment of the swept check and impossible to reconstruct later. UI ships one generic miss banner; the ticker/commentary layer can differentiate ("blazes it over!") whenever presentation work wants it. No UI scope added to m0.6.
