# Defense Engagement & Player Stats — Design Spec

**Date:** 2026-07-18
**Status:** Draft — awaiting user review
**Companion:** `2026-07-18-ball-physics-design.md` (tackle spills use its free-ball primitive; both land as engine `m0.5`)

## Problem

1. **Defense looks passive.** m0.4 already rolls a tackle contest whenever a defender stands within 2.5 m of the carrier (`tackleTick`, every 10-tick cooldown) — but it is an invisible, instant dice roll: possession teleports, nothing lunges, nothing whiffs. Only one defender (nearest opponent) even converges; everyone else walks back to formation anchors. On screen this reads as "nobody tries to take the ball."
2. **Stats are shallow and one is dead.** Of the canon six, `sta` is defined, validated, rendered — and never read by the engine. The others mostly gate single dice rolls. There is no notion of playing style: nothing distinguishes a reckless defender from a patient one.

## Canon guardrails (obeyed, not re-litigated)

- **Exactly six visible stats** — PAC / SHO (REF for GKs) / PAS / DEF / TEC / STA (docs 03, 05). No seventh trainable stat.
- **Fouls exist only as superpower side effects** (doc 03 simplifications). Slide tackles therefore carry no card/referee risk — their cost is physical.
- **Personality is canon** (doc 05): Fiery, Loyal, Greedy, Joker, Professional, Timid — today it only drives events/negotiation/morale.
- Doc 03 already promises: defenders "mark, press, attempt tackles when in range"; STA "scales all stats down up to −25% late in the match"; contested actions resolve through the logistic table.

## The three-layer player model

The user's "aggressiveness stat" question has a canon-shaped answer: **execution and intent are different axes.** Stats say how well an attempt goes; personality says what gets attempted; condition scales everything. No new visible numbers needed.

```
LAYER 1  EXECUTION   the six stats      → contest odds, error spreads, speeds, ranges
LAYER 2  INTENT      personality dials  → which action gets attempted, and when
LAYER 3  CONDITION   fatigue (morale,   → multiplies Layer 1 through effectiveStat()
                     consistency in M1)
```

### Layer 1 — the six stats, full sim mapping

| Stat | Drives today (m0.4) | Adds in m0.5 (this spec + ball physics) |
|---|---|---|
| **PAC** | run speed | slide-lunge reach & speed; chase-down of rolling balls |
| **SHO** | aim spread, shot power | launch speed, aim confidence (corner vs center), error spread (ball-physics spec) |
| **PAS** | pass contest | pass launch solver (lead + lofted range), max leg speed on kicks |
| **DEF** | tackle & intercept contests | contain quality (slows carrier), standing-tackle win, slide win, cover positioning |
| **TEC** | anti-tackle contest | dribble-escape from containment; first touch — high TEC kills an arriving fast ball dead, low TEC bobbles it loose for a beat (free-ball physics makes this visible) |
| **STA** | **nothing (dead)** | condition drain rate; slides/sprints cost extra; low condition scales all contested stats down to −25% (canon), widens shot/pass error (ball-physics `fatigueMult`) |
| **REF** (GK) | save contest | save contest + placement modifier (ball-physics spec) |

Real-football sanity check: FM tracks ~36 attributes, FIFA ~29 sub-stats under 6 face stats. Our compression covers the same space: vision → PAS + risk dial, positioning → DEF + discipline dial, composure → pressure/fatigue multipliers, physicality → deliberately absent (SUPER_STRENGTH is the fantasy version), mental attributes → Layer 2. Kairosoft readability beats simulation depth; six numbers a player can hold in their head is the point.

### Layer 2 — personality dials (the "aggressiveness stat", canon-shaped)

Each canon personality maps to a fixed preset of four dials (0–100), shipped as one typed JSON table in `content/` (zod-validated, tunable without code):

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

This makes personality — "visible after a few weeks" per doc 05 — matter on the pitch, so scouting it becomes squad-building strategy for free. **Rejected alternative:** a hidden per-player numeric aggression stat — more variance, but unreadable ("why does MY Fiery guy not slide?") and it duplicates a system canon already has.

### Layer 3 — the condition funnel (STA comes alive)

`effectiveStat()` was left in the code as the declared fatigue hook; it gets its body:

```
effectiveStat = round(attr × (1 − 0.25 × (1 − condition/100)))     // canon −25% cap
drain/tick    = base × (1 + 0.6 × (100 − sta)/100)                 // low STA drains ~1.6×
slide cost    = 0.4 condition;  sprint-chase surcharge per tick
```

`speedFor`'s own condition scale merges into this funnel (condition must apply once, not twice). Morale (±10%, doc 05) and consistency (hidden, per-match form draw) are **M1**: they're season-layer state that doesn't exist in `SimPlayer` yet, but they will multiply through this same funnel — the hook is the design.

---

## Defensive engagement: from dice roll to theater

A small state ladder for defenders near the carrier. Every state is visible and animated; the contest math underneath stays the canon logistic table.

```
PRESS ──close──▶ CONTAIN ──patience elapsed──▶ STANDING TACKLE (≤2 m)
 (exists)        (new)                    └──▶ SLIDE TACKLE   (≤4.5 m, needs lunge reach)
                    │
COVER (new, 2nd defender: goal-side midpoint, workRate-gated)
```

- **Press** — nearest defender converges (exists today); trigger radius now scales with workRate.
- **Contain** (new) — within ~3.5 m the defender stops charging and jockeys: matches carrier speed from a goal-side shadow point. While contained the carrier must maneuver — a TEC (+PAC-if-sprinting, canon) vs DEF escape contest every 5 ticks; the carrier's forward progress slows. How long a defender contains before committing = aggression dial. This state alone kills the "nobody tries" feel: a defender crouched in the carrier's path *is* visible intent.
- **Standing tackle** (new visible form of the existing contest) — at ≤2 m, a quick poke. Win → **clean take** (possession swaps, today's behavior — the Professional's tool). Lose → 3-tick stagger, carrier plays on. Existing 10-tick cooldown applies.
- **Slide tackle** (the ask) — at ≤4.5 m with the intercept point inside lunge reach (PAC-scaled): the defender **commits** — launches at ~1.8× speed along a locked vector for 4 ticks (no homing, same principle as ball physics), resolved by swept closest-approach against the carrier's path.
  - **Win** → the ball **spills loose** with real velocity in the slide direction (+ optional small hop, `vz` 0–20) — the free-ball physics takes over and anyone can collect. Slides win the ball but create chaos; standing tackles keep it clean. That's the style trade-off, embodied.
  - **Whiff** → carrier skips past untouched; defender is **down** for ~1.2 s via the existing `knockOut(idx, tick + 12, 'slid')` plumbing (new `OutReason`, silent wake — no RECOVERED event spam). The floored defender IS the cost, per canon's no-fouls rule — and the dribbler's highlight.
  - Contest: DEF vs TEC through the standard table; aggression decides *whether* to slide, DEF decides *if it works* — intent vs execution, the two-layer model doing its job.
- **Wind-up interruption** — slides and standing tackles are exactly what `interruptWindup` responds to, so a Fiery defender is organic anti-hero tech (doc 03's Mario Strikers rule gets a face).
- GKs never enter contain/slide states (unchanged M0 behavior).

## Schema / events / renderer impact

- `PlayerDef` + `personality` field; zod default `Professional` for old content; `teams.ts` fixtures and replay-envelope validation updated. Dial presets live in `content/personality-dials.json`.
- `TACKLE` event gains `style: 'standing' | 'slide'` and outcome `'won' | 'spilled' | 'whiff'` (ticker/commentary can differentiate "crunching slide!" from "picked his pocket"). New `DRIBBLE` event `{by, past, won}` on containment-escape contests — feeds commentary ("skips past him!") and makes the aggression rail measurable.
- `PlayerStatus` union gains `'sliding'` and `'down'` → renderer picks slide/prone sprites; needs 2 new poses + dust puff from the art branch (`HFM-art-worktree`). Containment deliberately gets no status: the jockeying movement itself reads on screen.
- Gauge: slide/standing wins reuse the existing +15 tackle fill (canon involvement events).
- `ENGINE_VERSION` → `m0.5` shared with ball physics (many new rng draw sites; one version bump, one replay break).

## Balance rails & tests

New rails (same 200-seed harness style):

- Tackle attempts per match inside a sane band; slide share of attempts responds to aggression.
- **Aggression monotonicity**: all-Fiery XI attempts more tackles and wins possession back faster than all-Timid XI, but loses more `DRIBBLE` contests (beaten by the escape) — both directions asserted via the event stream, so "aggression = strictly better" can't ship silently.
- **STA monotonicity**: a low-STA squad's second-half goal difference degrades vs its first half.
- Existing rails (goals/match 1.5–4.0, save rate, blowout guard) still pass after the tuning round.

Unit tests: state-ladder transitions on fixed seeds; slide lunge geometry + swept resolution (including the whiff-past case); spill velocity determinism; `effectiveStat` decay curve incl. the speedFor single-application merge; personality table zod round-trip; silent wake for `'slid'`.

## Out of scope (named so they're decisions, not omissions)

- Fouls/cards from tackles (canon: powers only), penalties, set pieces.
- Team-level tactics (Normal / Short Pass / Long Ball, doc 03) — a later layer that *biases* these same dials squad-wide; the dial architecture is deliberately shaped to receive it.
- Morale & consistency wiring (M1, via the same `effectiveStat` funnel).
- GK sweeping/rushing decisions.

## Open questions for review

1. **Personality presets vs hidden numeric aggression** — recommendation: presets (readable, uses canon, zero new player-facing numbers). Agree?
2. **Second-defender cover** — ship in m0.5 (recommended: it's ~10 lines on `movementTick` and sells "team defense") or defer?
3. **STA funnel now vs M1** — the code comment deferred fatigue to M1, but this spec touches `effectiveStat` anyway and STA-is-dead is exactly what prompted the stats question. Recommendation: STA now, morale/consistency M1.
4. Should a **clean slide win occasionally chip the ball airborne** (small `vz`)? Pure charm, ~2 lines on top of ball physics. Recommendation: yes.
