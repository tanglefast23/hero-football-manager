# 03 — Match Engine & Presentation

Two strictly separated layers: a **deterministic simulation core** (pure TypeScript, no rendering, no timers) and a **renderer** (Skia canvas) that plays back what the sim decides. The same sim runs a watched match and an instant Quick Result — identical outcomes for identical seeds *and identical inputs*.

## Deterministic ≠ predetermined

The match is a live simulation: 22 agents making stat-driven decisions, with a dice roll at every contested moment — and **the user's taps are real inputs that change the outcome**. A well-timed Super Speed burst beats a defender who would otherwise have won the ball, creating a goal that would not have happened untapped.

"Deterministic" is an engineering promise, not a gameplay one: every dice roll comes from one seeded generator, and the sim reads no clocks or device state. (Like a deck shuffled once at kickoff — the shuffle is fixed, but which cards get drawn depends on how play unfolds, including your taps.)

- Same seed + same inputs → byte-identical match. This buys replays that match reality, identical behavior across iPhone/Android/PC, reproducible bugs, and the Monte Carlo balance harness (doc 09).
- Same seed + different tap timing → a genuinely different match. Involvement is real.

**Quick Result** runs the same engine with every hero on their pre-set auto behavior and no manual taps — a fair playing-out of the match, not a prediction of what watching would have produced. Watching and tapping well earns a modest edge (better power timing), by design: attention is rewarded; simming only forgoes that edge, never gets punished beyond it.

## Simulation core

- **Tick-based**: fixed 100ms logical ticks. A match is 2 halves × ~100 seconds of play at 1× speed (≈ 2,000 ticks), presenting as "90 minutes" on the match clock. Total watched runtime with cut-ins and halftime: **3–4 real minutes** (research: the sweet spot across every comparable game).
- **Seeded randomness**: one seed per match stored in the save; user inputs (power taps, subs, tactic changes) are recorded as a timestamped input stream alongside it. Seed + input stream = byte-identical replay. No `Math.random`, no `Date.now` inside the sim — ever.
- **11v11**, positions grouped GK / DEF / MID / FWD by formation (6 formations at launch: 4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1, 3-4-3).
- **Simplifications** (Pocket League Story precedent): no offside, no throw-in ceremony (ball wraps), fouls exist *only* as superpower side effects.

## Player agents

Each of the 22 agents runs a small role state machine every few ticks:

- **Ball carrier**: choose dribble / short pass / long pass / shoot, weighted by stats, position on pitch, pressure, and team tactic (Normal / Short Pass / Long Ball).
- **Teammates**: make runs, offer passing lanes (formation anchors + ball-side drift).
- **Defenders**: mark, press, attempt tackles when in range.
- **GK**: positioning, save attempts, distribution.

Passes and shots **travel through space** — a pass is a moving ball that can be cut out en route, never a teleport. If it isn't watchable, it isn't in the sim.

## Stats → outcomes

Six visible stats, 1–99: **PAC** (pace) · **SHO** (shooting; GKs show **REF** reflexes instead) · **PAS** (passing) · **DEF** (defending) · **TEC** (technique/dribbling) · **STA** (stamina). Hidden: potential (1–5★), morale, condition, consistency. (Storage note: every player carries all 7 attribute fields — GKs' SHO and outfielders' REF are unused filler; 'six visible' refers to the UI, not the data shape.)

Contested actions resolve as opposed rolls through a logistic curve (in plain terms: the better your stat vs. theirs, the more often you win, but upsets always possible):

```
P(success) = 1 / (1 + e^(-(attacker_stat − defender_stat + situation_mod) / 12))
```

- **Dribble past**: TEC (+PAC bonus if sprinting) vs. DEF.
- **Pass**: PAS vs. distance/pressure threshold; interception check vs. nearest defender's DEF.
- **Shot**: SHO vs. a difficulty score (distance, angle, pressure) produces shot power → GK save roll (REF) modified by **GK Resolve** (below).
- **Stamina**: drains per sprint/action; low STA scales all stats down up to −25% late in the match. Carries over partially between matches — rotation matters.

### GK Resolve (the anti-frustration keystone)

Borrowed directly from Inazuma Eleven's Keeper Power (see research/match-presentation.md): each GK has a **Resolve bar** (base 100 for every keeper; REF sets how strongly saves resist shots, scaled by remaining Resolve). Power shots and repeated pressure *damage Resolve* instead of auto-scoring; saves get weaker as Resolve drops. An opponent's fire-shot doesn't instantly score — it visibly wears your keeper down, giving you drama without cheapness. Resolve partially regenerates at halftime.

## Superpowers in the engine

A power is a **timed modifier burst** the sim applies to one agent (details in doc 04):

- Each fielded hero has a **Hero Gauge** (0–100) that fills from involvement events (touches, tackles won, shots, goals conceded for keepers) plus a small time trickle — earned, not a timer.
- Every power defines a **useful context** — the situations where firing it actually matters (Super Speed: you have the ball or it's loose nearby; Super Strength: an opposing carrier is in range; a GK power: a shot is incoming). Contexts are shown to the player (the chip glows brighter in context), so "when do I tap?" is a readable decision, not a guess.
- **Full gauge** → 8-second window: tap the hero's chip to fire at **100%**, aimed at the current situation. If the window lapses, the hero auto-fires at **75%** at the next useful context (hard deadline: +4 more seconds). Pre-match, each hero can be set to **Fire when ready** — the AI fires automatically at the next useful context at **85%**. The attention ladder is deliberate: your tap > hero's instincts > wasted lapse, so watching earns an edge and simming stays respectable.
- **Wind-up**: 1.5s telegraph (glow + rising jingle) during which a tackle can interrupt the power (Mario Strikers rule — the counterplay that stops power-snowballing).
- **Opposing heroes** use powers on their own AI priorities. They appear rarely in Div 5–4, commonly from Div 2 up.
- Power vs. power in the same moment → contested roll with a special clash cut-in.

## Presentation (renderer)

- **Two cameras** (the universal pattern from research): a static wide vertical-pitch view for all normal play, and a **spectacle cut-in** (comic-panel overlay, 2–3s max) exclusively for power activations, clashes, and goals.
- Every power fires with a **name banner + icon** ("🔥 FIRE TORCH — Dario Flint") so a glance explains what happened.
- All cut-ins are **tap-to-skip after first viewing per power** (three games got the same review complaint about unskippable spectacle; we won't).
- Speed controls: ×1 / ×2, pause. **Quick Result** available for every match from day one (Retro Bowl's per-match Sim pattern) — produces the same result as watching, plus a highlights ticker and optional "watch goals only" replay.
- Goal celebration: 2s banner + crowd burst, skippable. Broadcast dressing: scoreboard bug top-center, match clock, division-colored lower third.
- Match HUD: hero chips bottom row (portrait + gauge ring, ≥44pt tap targets), tactic button, speed/skip top-right.

## Halftime

15-second interstitial (skippable): score, shot count, Resolve status, hero gauges — with buttons for subs (3 per match) and tactic changes. The one strategic checkpoint mid-match.

## Outputs

The sim emits a typed event stream (`KICKOFF`, `PASS`, `TACKLE`, `POWER_FIRED`, `GOAL`, …) consumed by: the renderer, the highlights ticker, the post-match report, TP/fan/morale calculations, and tests. One source of truth.
