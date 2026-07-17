# 03 — Match Engine & Presentation

Two strictly separated layers: a **deterministic simulation core** (pure TypeScript, no rendering, no timers) and a **renderer** (Skia canvas) that plays back what the sim decides. The same sim runs a watched match and an instant Quick Result — identical outcomes for identical seeds.

## Simulation core

- **Tick-based**: fixed 100ms logical ticks. A match is 2 halves × ~100 seconds of play at 1× speed (≈ 2,000 ticks), presenting as "90 minutes" on the match clock. Total watched runtime with cut-ins and halftime: **3–4 real minutes** (research: the sweet spot across every comparable game).
- **Seeded randomness**: one seed per match stored in the save. Replays, Quick Result, and watched play all produce byte-identical outcomes. No `Math.random`, no `Date.now` inside the sim — ever.
- **11v11**, positions grouped GK / DEF / MID / FWD by formation (6 formations at launch: 4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-5-1, 3-4-3).
- **Simplifications** (Pocket League Story precedent): no offside, no throw-in ceremony (ball wraps), fouls exist *only* as superpower side effects.

## Player agents

Each of the 22 agents runs a small role state machine every few ticks:

- **Ball carrier**: choose dribble / short pass / long pass / shoot, weighted by stats, position on pitch, pressure, and team tactic (Normal / Short Pass / Long Ball).
- **Teammates**: make runs, offer passing lanes (formation anchors + ball-side drift).
- **Defenders**: mark, press, attempt tackles when in range.
- **GK**: positioning, save attempts, distribution.

## Stats → outcomes

Six visible stats, 1–99: **PAC** (pace) · **SHO** (shooting; GKs show **REF** reflexes instead) · **PAS** (passing) · **DEF** (defending) · **TEC** (technique/dribbling) · **STA** (stamina). Hidden: potential (1–5★), morale, condition, consistency.

Contested actions resolve as opposed rolls through a logistic curve (in plain terms: the better your stat vs. theirs, the more often you win, but upsets always possible):

```
P(success) = 1 / (1 + e^(-(attacker_stat − defender_stat + situation_mod) / 12))
```

- **Dribble past**: TEC (+PAC bonus if sprinting) vs. DEF.
- **Pass**: PAS vs. distance/pressure threshold; interception check vs. nearest defender's DEF.
- **Shot**: SHO vs. a difficulty score (distance, angle, pressure) produces shot power → GK save roll (REF) modified by **GK Resolve** (below).
- **Stamina**: drains per sprint/action; low STA scales all stats down up to −25% late in the match. Carries over partially between matches — rotation matters.

### GK Resolve (the anti-frustration keystone)

Borrowed directly from Inazuma Eleven's Keeper Power (see research/match-presentation.md): each GK has a **Resolve bar** (base 100, scaled by REF). Power shots and repeated pressure *damage Resolve* instead of auto-scoring; saves get weaker as Resolve drops. An opponent's fire-shot doesn't instantly score — it visibly wears your keeper down, giving you drama without cheapness. Resolve partially regenerates at halftime.

## Superpowers in the engine

A power is a **timed modifier burst** the sim applies to one agent (details in doc 04):

- Each fielded hero has a **Hero Gauge** (0–100) that fills from involvement events (touches, tackles won, shots, goals conceded for keepers) plus a small time trickle — earned, not a timer.
- **Full gauge** → 8-second window: the player taps the hero's chip to fire (full effect, directed at the current situation), or it **auto-fires at 75% effect** when the window lapses. Pre-match, each hero can be set to "Fire when ready" (auto, full effect, no window) for hands-off players.
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
