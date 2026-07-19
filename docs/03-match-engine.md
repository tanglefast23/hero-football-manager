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
- **11v11**, positions grouped GK / DEF / MID / FWD by formation. The coaching UI currently exposes the four statistically validated shapes: 4-4-2, 4-3-3, 5-3-2, and 3-4-3. The engine retains 3-5-2 and 4-5-1 for replay compatibility, but they stay hidden until balance sweeps show they are real choices rather than traps.
- **Simplifications** (Pocket League Story precedent): no offside, no throw-in ceremony (ball wraps), fouls exist *only* as superpower side effects.

## Player agents

Each of the 22 agents runs a small role state machine every few ticks:

- **Ball carrier**: choose dribble / pass / shoot, weighted by stats, position, pressure, formation, and mentality (Balanced / Attack / Protect).
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

- Each fielded hero builds **Heat** from involvement events (touches, tackles won, shots at launch, saves) plus a small time trickle — earned, not a timer. Above a threshold, each tick rolls a small seeded entry chance scaled by heat: the hero enters **the Zone** (heat resets, glow starts). Semi-random entry means watching the pitch for who's catching fire is real gameplay; heat-weighting means it's earned luck.
- Every power defines a **useful context** — the situations where firing it actually matters (Super Speed: you have the ball or it's loose nearby; Super Strength: an opposing carrier is in range; a GK power: a shot is incoming). The hero's on-pitch glow intensifies in context, so "when do I tap?" is a readable decision, not a guess.
- **The Zone window** lasts ~7 seconds, glow fading as it runs out. Tap the glowing on-pitch hero during it to fire at **100%**, aimed at the current situation. A manual hero's expired window **decays heat to half — no auto-fire**: the attention premium is catching windows, not a stat bonus. Every watched match starts in manual `M`; the live `M`/`A` button can switch home heroes to automatic fire at the next useful context at **85%**, or at **75%** in the window's final seconds if no context appears (hands-off play and Quick Result stay respectable; rival heroes always run this policy). Powers that require a victim never fire targetless — those windows expire instead, making an opponent's glow a threat you can starve.
- **One power active per team at a time**; while one is active or winding, teammates' zones and heat freeze (paused, never wasted). No stacking — and the spectacle cut-in only ever has one thing to show.
- **Wind-up**: 1.5s telegraph (glow + rising jingle) during which a tackle can interrupt the power (Mario Strikers rule — the counterplay that stops power-snowballing).
- **Opposing heroes** use powers on their own AI priorities. They appear rarely in Div 5–4, commonly from Div 2 up.
- Power vs. power in the same moment → contested roll with a special clash cut-in.

## Presentation (renderer)

- **Two cameras** (the universal pattern from research): a static wide vertical-pitch view for all normal play, and a **spectacle cut-in** (comic-panel overlay, 2–3s max) exclusively for power activations, clashes, and goals.
- Every power fires with a **name banner + icon** ("🔥 FIRE TORCH — Dario Flint") so a glance explains what happened.
- All cut-ins are **tap-to-skip after first viewing per power** (three games got the same review complaint about unskippable spectacle; we won't).
- Speed controls: ×1 / ×2, pause. **Quick Result** available for every match from day one (Retro Bowl's per-match Sim pattern) — produces the same result as watching, plus a highlights ticker and optional "watch goals only" replay.
- Goal celebration: 2s banner + crowd burst, skippable. Broadcast dressing: scoreboard bug top-center, match clock, division-colored lower third.
- Match HUD: a fixed bottom-left name + live energy card shows the current carrier and retains the last carrier while the ball travels; glowing home heroes are tapped directly on the pitch; bottom coaching bar cycles the three selected formations, cycles mentality, and opens Swap; speed/pause remain by the scoreboard. Rival heroes always run automatically.

## Halftime

15-second interstitial (skippable): score, shot count, Resolve status, and hero gauges. Coaching is not limited to halftime: formation, mentality, and up to three substitutions can be changed during live play, and every change is recorded in the deterministic replay input stream.

## Outputs

The sim emits a typed event stream (`KICKOFF`, `PASS`, `TACKLE`, `POWER_FIRED`, `GOAL`, …) consumed by: the renderer, the highlights ticker, the post-match report, TP/fan/morale calculations, and tests. One source of truth.
