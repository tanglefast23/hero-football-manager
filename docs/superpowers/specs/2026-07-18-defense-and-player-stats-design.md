# Defense Engagement & Player Stats — Design Spec

**Date:** 2026-07-18 (v2 same day)
**Status:** Draft v2 — external review incorporated (accept/pushback ledger in chat); open questions resolved in §Decision record. Next: external review round, then implementation plan.
**Target:** engine `m0.6`. Base: `main` **after T1** (approved positional-movement rework — its zonal tables decide *where* players stand; this spec decides *what they do* on arrival, per the external review's framing).
**Companion:** `2026-07-18-ball-physics-design.md` (tackle spills, traps and second balls all resolve through its free-ball physics; both specs ship as one m0.6 version bump)

## Problem

1. **Defense looks passive.** m0.4 already rolls a tackle contest whenever a defender stands within 2.5 m of the carrier (`tackleTick`, every 10-tick cooldown) — but it is an invisible, instant dice roll: possession teleports, nothing lunges, nothing whiffs. Only one defender (nearest opponent) even converges; everyone else walks back to formation anchors. On screen this reads as "nobody tries to take the ball."
2. **Stats are shallow and one is dead.** Of the canon six, `sta` is defined, validated, rendered — and never read by the engine. The others mostly gate single dice rolls. There is no notion of playing style: nothing distinguishes a reckless defender from a patient one.

## Canon guardrails (obeyed, not re-litigated)

- **Exactly six visible stats** — PAC / SHO (REF for GKs) / PAS / DEF / TEC / STA (docs 03, 05). No seventh trainable stat.
- **Fouls exist only as superpower side effects** (doc 03 simplifications). Slide tackles therefore carry no card/referee risk — their cost is physical.
- **Personality is canon** (doc 05): Fiery, Loyal, Greedy, Joker, Professional, Timid — today it only drives events/negotiation/morale.
- Doc 03 already promises: defenders "mark, press, attempt tackles when in range"; STA "scales all stats down up to −25% late in the match"; contested actions resolve through the logistic table.
- **Positional-movement spec (approved, T1)** supplies shape: zonal tables set every player's intended position per ball cell and phase, and its presser lease (≥ 10 ticks) already prevents defender-swapping flicker. **Movement priority — one total order (round-2 review; supersedes T1's partial chain `carrier → charge lock → presser → receiver → loose chaser → table`):**

  1. down / stagger (movement locked)
  2. slide lunge (locked vector until `slideUntilTick`)
  3. power charge lock (Super Strength wind-up target — a charging player never initiates a slide; `winding` is busy)
  4. ball carrier (attacking dribble target)
  5. pass receiver → immutable `targetPos` (ball-physics §2)
  6. presser engagement: converge, then contain shadow point
  7. loose-ball chase
  8. cover bias (second defender, lease tied to the presser's lease — no flicker)
  9. T1 table target

  Every slot claims a player exclusively; a player can hold at most one engagement. Disengaging falls through to the highest remaining slot. **Amending T1's approved doc with this total order is an explicit implementation-plan step** (the amendment does not yet exist in that document — external review corrected both an earlier "this spec never moves players" overclaim and a partial ordering that left charge locks, presser, receiver and loose-chase unranked).

## The three-layer player model

The user's "aggressiveness stat" question has a canon-shaped answer: **execution and intent are different axes.** Stats say how well an attempt goes; personality says what gets attempted; condition scales everything. No new visible numbers needed.

```
LAYER 1  EXECUTION   the six stats      → contest odds, error spreads, speeds, ranges
LAYER 2  INTENT      personality dials  → which action gets attempted, and when
LAYER 3  CONDITION   fatigue (morale,   → multiplies Layer 1 through effectiveStat()
                     consistency in M1)
```

### Layer 1 — the six stats, full sim mapping

| Stat | Drives today (m0.4) | Adds in m0.6 (this spec + ball physics) |
|---|---|---|
| **PAC** | run speed | slide-lunge reach & speed; chase-down of rolling balls |
| **SHO** | aim spread, shot power | launch speed, aim confidence (corner vs center), error spread (ball-physics spec) |
| **PAS** | pass contest | pass launch solver (lead + lofted range), max leg speed on kicks |
| **DEF** | tackle & intercept contests | contain quality (slows carrier), standing-tackle win, slide win, cover positioning |
| **TEC** | anti-tackle contest | dribble-escape from containment; first touch — high TEC kills an arriving fast ball dead, low TEC bobbles it loose for a beat (free-ball physics makes this visible) |
| **STA** | **nothing (dead)** | condition drain rate; slides/sprints cost extra; low condition scales all contested stats down to −25% (canon), widens shot/pass error (ball-physics `fatigueMult`) |
| **REF** (GK) | save contest | save contest + placement modifier + catch-vs-parry margin (ball-physics spec). GK *positioning* arrives with T7 (angle-narrowing) and reads DEF; GK distribution reads PAS |

Real-football sanity check: FM tracks ~36 attributes, FIFA ~29 sub-stats under 6 face stats. Our compression covers the same space: vision → PAS + risk dial, positioning → DEF + discipline dial, composure → pressure/fatigue multipliers, physicality → deliberately absent (SUPER_STRENGTH is the fantasy version), mental attributes → Layer 2. Kairosoft readability beats simulation depth; six numbers a player can hold in their head is the point.

### Layer 2 — personality dials (the "aggressiveness stat", canon-shaped)

Each canon personality maps to a fixed preset of four dials (0–100), shipped for m0.6 as an **engine tuning constant** — `src/sim/personality-dials.ts`, same species as the physics-constants table (round-2 review: no zod/`content/` infrastructure exists yet and the no-new-deps rule applies; M1's content pipeline migrates this table to zod-validated JSON, recorded there):

| Personality | aggression | risk | workRate | discipline | Signature on the pitch |
|---|---|---|---|---|---|
| **Fiery** | 85 | 65 | 70 | 30 | dives into slides early, presses far, breaks power wind-ups |
| **Loyal** | 50 | 40 | 75 | 70 | tracks back tirelessly, steady |
| **Greedy** | 45 | 70 | 45 | 40 | shoots when a teammate is better placed |
| **Joker** | 55 | 85 | 55 | 25 | audacious chips & ambitious passes; widest decision variance |
| **Professional** | 45 | 35 | 65 | 90 | contains patiently, standing-tackles, holds shape |
| **Timid** | 20 | 25 | 55 | 60 | jockeys forever, rarely commits, safe passes |

Dial → sim hooks (all deterministic thresholds; nominal values are tuning-round fodder):

- **aggression** — contain patience before committing (`~20 × (100 − agg)/50` ticks → Fiery ~0.6 s, Timid ~3.2 s), slide-vs-standing preference, tackle attempt rate. Desperation override: everyone commits sooner inside their own box.
- **risk** — shoot-from-distance range (`2500 × (1 + (risk − 50)/200)`), the existing pass/shoot rng threshold, lofted "hero ball" pass choice (Option B later), Greedy's shoot-first bias in the box.
- **workRate** — press trigger radius (`1200 + 8 × workRate`), whether a second defender bothers covering, chase-back after losing the ball.
- **discipline** — anchor leash (how far from formation slot they'll roam before returning); Joker's low discipline doubles as a decision-variance widener.

**Display (external review adopted):** the player card shows the aggression dial as a readable style chip — **Cautious** (< 40) / **Balanced** (40–65) / **Aggressive** (> 65) — never a fourth visible number. Role and team-tactic instructions become additional dial inputs when the tactics layer lands (M1+).

The intent/execution split creates the four defender types the review named, for free: high DEF + Cautious = patient marker; high DEF + Aggressive = elite ball-winner; low DEF + Aggressive = dives in and gets skipped; low DEF + Cautious = backs off too far. High aggression must never *imply* good defending — aggression decides whether to challenge, DEF decides whether it works.

This makes personality — "visible after a few weeks" per doc 05 — matter on the pitch, so scouting it becomes squad-building strategy for free. **Rejected alternative:** a hidden per-player numeric aggression stat — more variance, but unreadable ("why does MY Fiery guy not slide?") and it duplicates a system canon already has.

### Layer 3 — the condition funnel (STA comes alive)

`effectiveStat()` was left in the code as the declared fatigue hook; it gets its body — and round-2 review demanded the **single-application rule** be explicit, because two reasonable implementations diverge materially late-match:

```
condition ∈ [0, 100], clamped after every drain
effectiveStat(stat) = round(attr × (1 − 0.25 × (1 − condition/100)))   // canon −25% cap
speedFor = round((40 + effectiveStat('pac')) × powerMultiplier)         // its old private
                                                            // 0.75+0.25c scale is DELETED
drain/tick = base × (1 + 0.6 × (100 − sta)/100)   // raw STA modulates drain, nothing else
  base: 0.005 ordinary movement · 0.02 sprint/chase (the existing moved-far rule)
        + 0.4 one-shot per slide launch
```

**Who reads what (each formula applies condition exactly once):**
- Contests (escape, challenge, cut, trap, save) use `effectiveStat` values — no `fatigueMult` on top.
- **Non-contest execution mechanics use `effectiveStat` too** (round-3 review — the matrix must cover them): shot launch speed `v0`, the PAS leg-speed cap, slide reach/speed, DEF contain-point accuracy.
- Shot/pass **error spreads** are the one raw-stat path: **raw** attributes × `fatigueMult` (ball-physics §3) — fatigue widens the miss there; it does not also shrink the same formula's stat.
- Raw `STA` is read by drain alone; `condition` is read by `effectiveStat` and `fatigueMult` alone.

Morale (±10%, doc 05) and consistency (hidden, per-match form draw) are **M1**: they're season-layer state that doesn't exist in `SimPlayer` yet, but they will multiply through this same funnel — the hook is the design.

---

## Defensive engagement: from dice roll to theater

A small state ladder for defenders near the carrier. Every state is visible and animated; the contest math underneath stays the canon logistic table.

```
PRESS ──close──▶ CONTAIN ──patience elapsed──▶ STANDING TACKLE (≤2 m)
 (exists)        (new)                    └──▶ SLIDE TACKLE   (≤4.5 m, needs lunge reach)
                    │
COVER (new, 2nd defender: goal-side bias off its T1 table target, workRate-gated)
```

- **Press** — the movement layer's presser (T1 lease, ≥ 10 ticks — no target flicker) converges; trigger radius scales with workRate.
- **Contain** (new) — within ~3.5 m the defender stops charging and jockeys from a goal-side shadow point. **DEF is approach quality** (review adopted, simplified): high DEF places that block point accurately on the carrier-to-goal line; low DEF's offset is sloppy and easier to skip past — no curved-path simulation needed, the offset error *is* the bad angle. While contained, the carrier must maneuver — a TEC (+PAC-if-sprinting, canon) vs DEF escape contest every 5 ticks; forward progress slows. Contain patience before committing = aggression dial. This state alone kills the "nobody tries" feel: a defender crouched in the carrier's path *is* visible intent.
- **The challenge** — standing poke at ≤ 2 m (existing 10-tick cooldown), or slide at ≤ 4.5 m. Slide eligibility gates: intercept point inside PAC-scaled lunge reach, **ahead of the carrier** (no from-behind lunges), and condition ≥ 30 (exhausted legs don't launch). The slide **commits**: ~1.8× speed along a locked vector for 4 ticks (no homing — same principle as the ball), resolved by swept closest-approach. The carrier's normal decision cadence keeps running during the lunge, so releasing the pass early beats the slide — real counterplay, emergent.
- **Three outcomes, one contest** (review adopted): the **margin-contest primitive** (defined in ball-physics §1: one draw, `strong`/`narrow`/`loss`, total win probability provably unchanged by the margin) resolves every challenge from the DEF-vs-TEC probability:
  - **Clean take** (comfortable win) → defender hooks the ball into their own possession. Standing tackles bias toward this band (the Professional's pickpocket).
  - **Poke loose** (narrow win) → ball **spills** with real velocity in the challenge direction (+ small hop, `vz` 0–20) — free-ball physics takes over, anyone can pounce. Slides bias toward this band: they win contact more often than they win the *ball*.
  - **Whiff** (loss) → standing: 3-tick stagger; slide: **down** ~1.2 s via existing `knockOut(idx, tick + 12, 'slid')` plumbing (new `OutReason`, silent wake — no RECOVERED spam). The floored defender IS the cost, per canon's no-fouls rule — and the dribbler's highlight.
- **The second ball** (review's "then try to get the ball" moment): a spill is not possession. PAC decides who reaches the loose ball; the ball-physics **unified trap resolver** (TEC vs ball speed, one attempt per radius entry) decides who *keeps* it — a rugged low-TEC stopper knocks it away and then fumbles the collection; a technical defender wins it clean and their PAS starts the counter. Every stat in the chain, visibly.

### Implementable transitions (round-1 external review — the contract, not vibes)

- **Engagement state lives on `SimPlayer`:** `engagement: { kind: 'none' | 'contain' | 'slide' | 'cover'; sinceTick; targetIdx }`, plus `staggerUntil`, `slideVec` + `slideUntilTick` (locked at launch), and cover's lease tick. All integer, all in the replay state.
- **Contain mechanics, exactly:** carrier speed × **0.6** while a defender holds contain on them; escape contest every 5 ticks (aligned with the carrier decision cadence — contests run in `tackleTick`, *after* the carrier's own possession decision each tick, so a pass released this tick beats a challenge landing this tick). Escape **win** → `DRIBBLE {won: true}`, contain breaks, and the winner gains **escape immunity vs that defender for 15 ticks** (no instant re-contain loop); the defender must re-approach. Escape **loss** → `DRIBBLE {won: false}`, the slowdown persists and the contain clock keeps running toward the defender's challenge.
- **"Ahead" is a dot product:** the slide's intercept point qualifies only if `(interceptPoint − carrierPos) · attackDir > 0` for the carrier's attacking direction — no from-behind lunges, no trig.
- **Slide resolution is relative-motion swept** (ball-physics §1 resolver): defender segment vs carrier segment for the lunge ticks, contact at the earliest fraction; no contact by `slideUntilTick` → automatic whiff.
- **Tick order within a sim tick — the existing loop, unchanged:** movement (incl. lunge travel) → carrier decision (`possessionTick`; a pass/shot may release the ball) → challenge resolution (`tackleTick`) → ball flight. The release-beats-challenge property falls out of the current `match.ts` ordering; no loop reshuffle. A slide whose contact tick finds the carrier ball-less resolves as a whiff by rule, and the ball flies on.
- **Cancellation:** any engagement ends immediately on turnover, the carrier releasing the ball, ball going loose to a different chase, either player knocked out/unavailable, or restart. Restarts (kickoff/half) additionally clear `staggerUntil` and `'slid'` down-states — nobody teleports to formation while lying down.
- **Two ordering decisions the implementation plan must state explicitly** (round-3 review — safe to defer, not safe to leave implicit): (a) when a containment-escape contest and a patience-expired challenge both come due in the same `tackleTick`, which resolves first (proposal: the challenge — the defender committed first); (b) a player mid-slide cannot begin a power wind-up — the activation is deferred to slide end (taps aren't lost, matching the existing pending-input model), and conversely a `winding` player never initiates a slide (already in the movement priority order).
- GKs never enter contain/slide states (unchanged M0 behavior).

### Superpower compatibility map (round-1 external review — explicit, not implied)

- **Wind-up interruption:** `clean` and `spilled` outcomes interrupt (contact was made); a `whiff` does **not** — so a Fiery defender is organic anti-hero tech (doc 03's Mario Strikers rule gets a face), but diving in and missing protects nobody.
- **`fireSuppressed`** (Fire Torch): suppresses *initiating* any engagement against the burning carrier — contain entry, standing, slide — matching today's tackle suppression. No contain means no escape contests either.
- **`dribbleBonus`** (Super Speed): adds to TEC in containment-escape contests and in challenge defense — mirrors its current tackle-defense role.
- **`defenseBonus`** (Super Strength): adds to DEF in standing/slide challenge contests only (not contain placement — power scope stays tight, as today).
- **Super Strength's knockout hit** currently emits a `TACKLE` event (`powers.ts`): it becomes `style: 'power'` with outcome `spilled` — the flattened carrier's ball pops loose through the physics spill (chip `vz` included), thematically perfect. Every `TACKLE` consumer updates for the third style.
- **Heat (+15 tackle fill): `clean` outcomes only.** A spill isn't a won ball yet — whoever collects it earns the normal reception heat instead. (Guards the Heat economy: spill-heavy aggressive play must not double-charge gauges.)

## Schema / events / renderer impact

- `PlayerDef` + `personality` field, defaulting to `Professional` when absent; `teams.ts` fixtures assign personalities and `validateTeam` (the existing hand-rolled envelope validator) learns the field. **Zod is deferred** (external review: no `content/` directory or zod dependency exists yet, and the no-new-deps rule applies) — the dial presets ship as the `src/sim/personality-dials.ts` tuning constant (see Layer 2); the JSON+zod content pipeline arrives with M1 as canon already plans.
- **Personality-reveal gating** (doc 05: visible "after a few weeks"): the *engine* always knows the personality (dials need it); the style chip on the player card is a season-layer UI reveal. Until revealed, the player's on-pitch behavior is the tell — scouting by watching, which is charming, not a bug. The sim never gates on reveal state.
- `TACKLE` event gains `style: 'standing' | 'slide' | 'power'` (`power` = Super Strength's hit, per the compatibility map) and outcome `'clean' | 'spilled' | 'whiff'` (ticker/commentary can differentiate "crunching slide!" from "picked his pocket"). New `DRIBBLE` event `{by, past, won}` on containment-escape contests — feeds commentary ("skips past him!") and the whole-preset signature tests.
- `PlayerStatus` union gains `'sliding'` and `'down'` — and the renderer needs real **sprite-selection logic**, not just new enum values (external review: `MatchScreen.tsx` currently always draws run-cycle sprites and uses status only for tinting). Work: slide + prone atlas keys from the art branch (`HFM-art-worktree`), selection by status, dust puff, and interpolation tests. Containment deliberately gets no status: the jockeying movement itself reads on screen.
- Gauge: `clean` challenge wins earn the existing +15 tackle fill; spills route heat through the eventual collector (see the superpower compatibility map).
- `ENGINE_VERSION` → `m0.6` shared with ball physics (many new rng draw sites; one version bump, one replay break).

## Balance rails & tests

New rails (same 200-seed harness style):

- Tackle attempts per match **15–50**; challenge-outcome shares per style inside bands over 200 seeds — standing: clean 45–75% / spilled 10–35% / whiff 15–40%; slide: clean 10–30% / spilled 30–60% / whiff 25–50% (locks the margin thresholds — slides must never become reliable clean takes).
- **Dial isolation** (external review: an all-Fiery vs all-Timid match moves all four dials at once and proves nothing about aggression): a **test-only dial table** varies aggression alone (20 vs 85, other dials pinned at 50). Assertions measure only what aggression *directly controls* (round-2 review killed a `DRIBBLE`-loss assertion that actually measured exposure time): the aggressive XI attempts ≥ 2× the tackles and regains possession faster; **and** it accumulates ≥ 2× the slide-whiff down-ticks and concedes more carrier forward progress in the 20 ticks after a failed challenge. Upside and cost both asserted, so "aggression = strictly better" can't ship silently. *Separate* whole-preset tests then check each personality's behavioral signature (Fiery slide share > Professional's; Timid contain time > everyone's).
- **STA, same-seed A/B** (replaces the vague half-difference idea): identical squads except STA 40 vs 80, same seeds — assert (a) the low-STA squad's mean condition at tick 1600 is **4–7 points lower** (round-3 review did the arithmetic: with drain multipliers 1.36 vs 1.12, even wall-to-wall sprinting caps the gap at 7.68 points, so the previous ≥ 10 was unreachable; the band is measured, and widening it means touching the drain coefficient, not the assert), (b) its second-half `effectiveStat` decay is measurably deeper, (c) directionally worse second-half shot/goal deltas over 500 seeds.
- Existing rails (goals/match 1.5–4.0, save rate, blowout guard) still pass, **and the full acceptance-gate suite re-runs** — especially hero-zone cadence and the attention-edge gates, which extra touches from spills can silently inflate (see the Heat-economy guard in the ball-physics spec).

Unit tests: state-ladder transitions on fixed seeds; slide lunge geometry + relative-motion swept resolution (including the whiff-past case and the carrier-releases-mid-lunge whiff); spill velocity determinism; escape-immunity window; cover-lease behavior (no second-defender flicker); restart cleanup of engagement/stagger/`'slid'` states; `effectiveStat` decay curve incl. the speedFor single-application merge; personality dial-table type checks; silent wake for `'slid'`.

## Out of scope (named so they're decisions, not omissions)

- Fouls/cards from tackles (canon: powers only), penalties, set pieces. Per the external review: aggressive tackling is punished physically (whiffs, down-time, lost shape, stamina cost); ordinary foul risk may be *reconsidered later as its own design decision* — it is not smuggled in here.
- Curved approach runs (review proposal, simplified away): DEF-scaled block-point accuracy delivers the same "smart angle vs naive charge" read without path simulation.
- Runner-abandonment as a slide-decision input (review proposal, deferred): requires per-player marking assignments, which don't exist until a marking model does.
- A seventh PHY/strength stat — reviewer concurs: only revisit if playtesting shows heavy and light players can't feel different through DEF/TEC/STA + archetypes.
- Team-level tactics (Normal / Short Pass / Long Ball, doc 03) — a later layer that *biases* these same dials squad-wide; the dial architecture is deliberately shaped to receive it.
- Morale & consistency wiring (M1, via the same `effectiveStat` funnel).
- GK sweeping/rushing decisions (T7 owns GK positioning).

## Decision record (2026-07-18)

1. **Personality presets, displayed as style tiers** (Cautious / Balanced / Aggressive) — locked; external review independently recommended the same shape.
2. **Second-defender cover: IN.** The T1 tables already put the second defender in roughly the right zone; cover adds a small goal-side bias between table target and carrier when the press is active (~10 lines, sells "team defense").
3. **STA funnel: IN for m0.6.** STA-is-dead is exactly what prompted the stats question; morale/consistency follow in M1 through the same funnel.
4. **Slide-win chip: IN** — a spilled ball can pop airborne (small `vz`), courtesy of the ball-physics primitive.
