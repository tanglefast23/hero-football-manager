# 03 — Match Engine & Presentation

Two strictly separated layers: a **deterministic simulation core** (pure TypeScript, no rendering, no timers) and a **renderer** (Skia canvas) that plays back what the sim decides. The same sim runs a watched match and an instant Quick Result — identical outcomes for identical seeds *and identical inputs*.

## Deterministic ≠ predetermined

The match is a live simulation: 22 agents making stat-driven decisions, with a dice roll at every contested moment — and **the user's taps are real inputs that change the outcome**. A well-timed Super Speed burst beats a defender who would otherwise have won the ball, creating a goal that would not have happened untapped.

"Deterministic" is an engineering promise, not a gameplay one: every dice roll comes from one seeded generator, and the sim reads no clocks or device state. (Like a deck shuffled once at kickoff — the shuffle is fixed, but which cards get drawn depends on how play unfolds, including your taps.)

- Same seed + same inputs → byte-identical match. This buys replays that match reality, identical behavior across iPhone/Android/PC, reproducible bugs, and the Monte Carlo balance harness (doc 09).
- Same seed + different tap timing → a genuinely different match. Involvement is real.

**Quick Result** runs the same engine with every hero on their pre-set auto behavior and no manual taps — a fair playing-out of the match, not a prediction of what watching would have produced. Both teams also use the engine's deterministic automatic substitutions and Energy Use decisions; in a watched match, only the opponent is auto-coached. Watching and tapping well earns a modest edge (better power timing), by design: attention is rewarded; simming only forgoes that edge, never gets punished beyond it.

## Simulation core

- **Tick-based**: fixed 100ms logical ticks. A match is 2 halves × ~100 seconds of play at 1× speed (≈ 2,000 ticks), presenting as "90 minutes" on the match clock. Total watched runtime with cut-ins and halftime: **3–4 real minutes** (research: the sweet spot across every comparable game).
- **Seeded randomness**: one seed per match stored in the save; user inputs (power taps, subs, tactic changes) are recorded as a timestamped input stream alongside it. Seed + input stream = byte-identical replay. No `Math.random`, no `Date.now` inside the sim — ever.
- **11v11**, positions grouped GK / DEF / MID / FWD by formation. The coaching UI starts with three statistically validated shapes: 4-4-2, 5-3-2, and 3-4-3. A coach can permanently teach the fourth validated shape, 4-3-3. The engine retains 3-5-2 and 4-5-1 for replay and old-save compatibility, but they stay hidden from new unlocks until balance sweeps show they are real choices rather than traps.
- **Simplifications** (Pocket League Story precedent): no offside, no throw-in ceremony (ball wraps), fouls exist *only* as superpower side effects.

## Player agents

Each of the 22 agents runs a small role state machine every few ticks:

- **Ball carrier**: choose dribble / pass / shoot, weighted by stats, position, pressure, formation, and Playstyle (Balanced / Attack / Protect; called `Mentality` internally).
- **Teammates**: make runs, offer passing lanes (formation anchors + ball-side drift).
- **Defenders**: mark, press, attempt tackles when in range.
- **GK**: positioning, save attempts, distribution.

Passes and shots **travel through space** — a pass is a moving ball that can be cut out en route, never a teleport. If it isn't watchable, it isn't in the sim.

## Stats → outcomes

Six visible stats, 1–99: **PAC** (pace) · **SHO** (shooting; GKs show **REF** reflexes instead) · **PAS** (passing) · **DEF** (defending) · **TEC** (technique/dribbling) · **STA** (stamina). The current overall rating averages those six role-relevant stats. Potential is a fixed A+ through F− grade derived from the player's role-aware projected overall with every personal cap filled. Morale, condition and consistency remain separate. (Storage note: every player carries all 7 attribute fields — GKs' SHO and outfielders' REF are unused filler; 'six visible' refers to the UI, not the data shape.)

Contested actions resolve as opposed rolls through a logistic curve (in plain terms: the better your stat vs. theirs, the more often you win, but upsets always possible):

```
P(success) = 1 / (1 + e^(-(attacker_stat − defender_stat + situation_mod) / 12))
```

- **Dribble past**: TEC (+PAC bonus if sprinting) vs. DEF.
- **Pass**: PAS vs. distance/pressure threshold; interception check vs. nearest defender's DEF.
- **Shot**: SHO vs. a difficulty score (distance, angle, pressure) produces shot power → GK save roll (REF) modified by **GK Resolve** (below).
- **Stamina**: condition drains through movement and exhausting actions; low STA multiplies that cost, so weak beginner players tire materially faster. Low condition scales all stats down by up to −25% late in the match. In the opening squads, an unchanged starting XI playing on Balanced is tuned to finish across **0–60%**, with its worst player reaching approximately zero only late in the match. Between-match condition carryover remains a separate career-layer feature and is not part of m1.5.

### Playstyle, Energy Use, and fatigue

These are independent coaching axes. **Playstyle** controls tactical intent — Attack, Balanced, or Protect — while **Energy Use** controls how hard the team works to execute it. Energy Use changes off-ball movement, pressing, recovery and support effort; it never directly improves passing, shooting, action selection, raw attributes, or formation targets.

| Energy Use | Off-ball movement | Condition drain |
|---|---:|---:|
| Save Energy | ×0.90 | ×0.60 |
| Balanced | ×1.00 | ×1.00 |
| All Out | up to ×1.12 | ×1.65 |

The All Out movement bonus fades with current condition and reaches no bonus at zero, so an exhausted player cannot keep a free speed advantage. Every match starts Balanced. User changes in watched matches are timestamped replay inputs; automatic teams make deterministic, RNG-free choices from the current score, time, lineups, bench, substitutions used, and team condition.

Each team retains the three-substitution limit. The watched player's substitutions remain manual. The opponent evaluates at roughly 55, 70, and 80 minutes and may make at most one same-role outfield substitution at each checkpoint. It selects the most tired eligible outfielder at or below 60%, then substitutes only when the best fresh reserve in that role is worth at least three more condition-adjusted role points. It never spends a routine fatigue substitution on the goalkeeper. Quick Result applies this same policy to both teams. Automatic Energy Use is reconsidered at roughly 65, 75, and 85 minutes: a team averaging 35% condition or less chooses Save Energy whenever no usable automatic fatigue substitution remains — whether the limit is reached or bench, role, or value constraints prevent one. Otherwise a trailing team chooses All Out, a leader chooses Save Energy from minute 75 onward, and a level team stays Balanced. Automatic coaching is regenerated from match state during replay rather than recorded as a fake user input.

### GK Resolve (the anti-frustration keystone)

Borrowed directly from Inazuma Eleven's Keeper Power (see research/match-presentation.md): each GK has a **Resolve bar** (base 100 for every keeper; REF sets how strongly saves resist shots, scaled by remaining Resolve). Power shots and repeated pressure *damage Resolve* instead of auto-scoring; saves get weaker as Resolve drops. An opponent's fire-shot doesn't instantly score — it visibly wears your keeper down, giving you drama without cheapness. Resolve partially regenerates at halftime.

## Superpowers in the engine

A power is a **timed modifier burst** the sim applies to one agent (details in doc 04):

- Each fielded hero builds **Heat** from involvement events (touches, tackles won, shots at launch, saves) plus a small time trickle — earned, not a timer. Above a threshold, each tick rolls a small seeded entry chance scaled by heat: the hero enters **the Zone** (heat resets, glow starts). Semi-random entry means watching the pitch for who's catching fire is real gameplay; heat-weighting means it's earned luck.
- Every power defines a **useful context** — the situations where firing it actually matters (Super Speed: you have the ball or it's loose nearby; Super Strength: an opposing carrier is in range; a GK power: a shot is incoming). The hero's on-pitch glow intensifies in context, so "when do I tap?" is a readable decision, not a guess.
- **The Zone window** lasts ~7 seconds, glow fading as it runs out. Tap the glowing on-pitch hero during it to fire at **100%**, aimed at the current situation. A manual hero's expired window **decays heat to half — no auto-fire**: the attention premium is catching windows, not a stat bonus. Every watched match starts in manual `M`; the live `M`/`A` button can switch home heroes to automatic fire at the next useful context at **85%**, or at **75%** in the window's final seconds if no context appears (hands-off play and Quick Result stay respectable; rival heroes always run this policy). Powers that require a victim never fire targetless — those windows expire instead, making an opponent's glow a threat you can starve.
- **One power active per team at a time**; while one is active or winding, teammates' zones and heat freeze (paused, never wasted). No stacking — and the spectacle cut-in only ever has one thing to show.
- **Wind-up**: 1.5s telegraph (glow + rising jingle) during which a tackle can interrupt the power (Mario Strikers rule — the counterplay that stops power-snowballing).
- **Opposing heroes** use powers on their own AI priorities. They appear rarely in D5 · District League and D4 · County League, then commonly from D2 · National Championship upward.
- Power vs. power in the same moment → contested roll with a special clash cut-in.

## Presentation (renderer)

- **Two cameras** (the universal pattern from research): a static wide vertical-pitch view for all normal play, and a **spectacle cut-in** (comic-panel overlay, 2–3s max) exclusively for power activations, clashes, and goals.
- Every power fires with a **name banner + icon** ("🔥 FIRE TORCH — Dario Flint") so a glance explains what happened.
- All cut-ins are **tap-to-skip after first viewing per power** (three games got the same review complaint about unskippable spectacle; we won't).
- Speed controls: ×1 / ×2, pause. **Quick Result** available for every match from day one (Retro Bowl's per-match Sim pattern) — produces the same result as watching, plus a highlights ticker and optional "watch goals only" replay.
- Goal celebration: 2s banner + crowd burst, skippable. Broadcast dressing: scoreboard bug top-center, match clock, division-colored lower third.
- Match HUD: a fixed bottom-left name + live energy card shows the current carrier and retains the last carrier while the ball travels; glowing home heroes are tapped directly on the pitch. The first coaching row exposes Formation, Playstyle, and Swap; a second full-width row directly selects Save Energy, Balanced, or All Out and shows Team Energy. Swap cards show numeric energy with green (`>60`), amber (`31–60`), and red (`0–30`) states. Its dynamic `N TIRED` prompt counts current on-field players at or below **40%** — for example, `3 TIRED · 0/3` — so exhausted off-ball players are visible before opening Swap. The count is only a UI prompt, not a separate mechanic or the AI's 60% substitution threshold. Speed/pause remain by the scoreboard. Rival heroes always run automatically.

## Halftime

15-second interstitial (skippable): score, shot count, Resolve status, and hero gauges. Every on-field player recovers exactly **+10 condition**, capped at 100. Coaching is not limited to halftime: Formation, Playstyle, Energy Use, and up to three substitutions can be changed during live play, and every user change is recorded in the deterministic replay input stream.

## Outputs

The sim emits a typed event stream (`KICKOFF`, `PASS`, `TACKLE`, `POWER_FIRED`, `GOAL`, …) consumed by: the renderer, the highlights ticker, the post-match report, TP/fan/morale calculations, and tests. One source of truth.
