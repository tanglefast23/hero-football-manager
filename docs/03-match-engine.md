# 03 — Match Engine & Presentation

Two strictly separated layers: a **deterministic simulation core** (pure TypeScript, no rendering, no timers) and a **renderer** (Skia canvas) that plays back what the sim decides. The same sim runs a watched match and an instant Quick Result — identical outcomes for identical seeds *and identical inputs*.

## Deterministic ≠ predetermined

The match is a live simulation: 22 agents making stat-driven decisions, with a dice roll at every contested moment — and **the user's taps are real inputs that change the outcome**. A well-timed Super Speed burst beats a defender who would otherwise have won the ball, creating a goal that would not have happened untapped.

"Deterministic" is an engineering promise, not a gameplay one: every dice roll comes from one seeded generator, and the sim reads no clocks or device state. (Like a deck shuffled once at kickoff — the shuffle is fixed, but which cards get drawn depends on how play unfolds, including your taps.)

- Same seed + same inputs → byte-identical match. This buys replays that match reality, identical behavior across iPhone/Android/PC, reproducible bugs, and the Monte Carlo balance harness (doc 09).
- Same seed + different tap timing → a genuinely different match. Involvement is real.

**Quick Result** runs the same engine with every hero on their pre-set auto behavior and no manual taps — a fair playing-out of the match, not a prediction of what watching would have produced. Both teams also use the engine's deterministic automatic substitutions and Energy Use decisions; in a watched match, only the opponent is auto-coached. Watching and tapping well earns a modest edge (better power timing), by design: attention is rewarded; simming only forgoes that edge, never gets punished beyond it.

## Simulation core

- **Tick-based**: fixed 100ms logical ticks. A match is 2 halves × ~100 seconds of play at 1× speed (≈ 2,000 ticks), presenting as "90 minutes" on the match clock. Total watched runtime with compact power labels and halftime: **3–4 real minutes** (research: the sweet spot across every comparable game).
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

Six visible stats, stored from **1–999**: **PAC** (pace) · **SHO** (shooting; GKs show **REF** reflexes instead) · **PAS** (passing) · **DEF** (defending) · **TEC** (technique/dribbling) · **STA** (stamina). The current overall rating averages those six role-relevant raw stats. Potential is an E− through A+ training-speed grade; it is not a match stat or a player ceiling. Morale, condition and consistency remain separate. (Every player stores all 7 fields — GKs' SHO and outfielders' REF are unused filler.)

Ratings from 1–99 keep their original match behavior exactly. Above 99, the match engine converts the visible raw rating to a diminishing effective rating: raw 200 is generally effective 116, raw 500 is effective 132, and raw 999 is effective 140. PAC uses a separate movement curve: ordinary career development stays around a **38% soft target**, while the rare final stretch from raw 930 to 999 can reach effective PAC 168. This ensures every stat continues to matter while bounding probabilities and animation speed. A sensibly trained star is targeted to become about **25% faster than typical same-division opposition** before promotion; 999 PAC is the **60% trained-only endpoint** versus a typical 90-PAC D1 opponent. Superpowers are applied after this conversion and are explicit exceptions: an active Super Speed hero can exceed the trained movement endpoint, and other authored powers may similarly exceed ordinary shooting, defense, passing, stamina, or goalkeeping limits.

Contested actions resolve as opposed rolls through a logistic curve (in plain terms: the better your stat vs. theirs, the more often you win, but upsets always possible):

```
P(success) = 1 / (1 + e^(-(attacker_stat − defender_stat + situation_mod) / 12))
```

- **Dribble past**: TEC (+PAC bonus if sprinting) vs. DEF.
- **Pass**: PAS vs. distance/pressure threshold; interception check vs. nearest defender's DEF.
- **Shot**: SHO vs. a difficulty score (distance, angle, pressure) produces shot power → GK save roll (REF) modified by **GK Resolve** (below).
- **Stamina**: condition drains through movement and exhausting actions; low STA multiplies that cost, so weak beginner players tire materially faster. The effect continues above 99: compared with 90 STA, 200 STA drains about 18% slower, 500 about 30% slower, and 999 about 36% slower. Drain is floored at 65% of the ordinary cost, so even a maxed player tires and substitutions remain relevant. Low condition scales all stats down by up to −25% late in the match. In the opening squads, an unchanged Starting XI playing on Balanced is tuned to finish across **0–60%**, with its worst player reaching approximately zero only late in the match.

### Playstyle, Energy Use, and fatigue

These are independent coaching axes. **Playstyle** controls tactical intent — Attack, Balanced, or Protect — while **Energy Use** controls how hard the team works to execute it. Energy Use changes off-ball movement, pressing, recovery and support effort; it never directly improves passing, shooting, action selection, raw attributes, or formation targets.

| Energy Use | Off-ball movement | Condition drain |
|---|---:|---:|
| Save Energy | ×0.90 | ×0.60 |
| Balanced | ×1.00 | ×1.00 |
| All Out | up to ×1.12 | ×1.65 |

The All Out movement bonus fades with current condition and reaches no bonus at zero, so an exhausted player cannot keep a free speed advantage. Every match starts Balanced. User changes in watched matches are timestamped replay inputs; automatic teams make deterministic, RNG-free choices from the current score, time, lineups, bench, substitutions used, and team condition.

Each team may use all five named bench players, for a maximum of five one-way substitutions; a player who leaves cannot return. The watched player's substitutions remain manual unless Auto Subs is enabled. The opponent evaluates at roughly 50, 60, 70, 80, and 85 minutes and may make at most one same-role outfield substitution at each checkpoint. It selects the most tired eligible outfielder at or below 60%, then ordinarily substitutes only when the best fresh reserve in that role is worth at least three more condition-adjusted role points. Red energy (`0–30`) is an emergency: on the next simulation tick, automatic coaching uses any available same-role fresh reserve regardless of that ordinary value margin. It never spends a routine fatigue substitution on the goalkeeper. Quick Result applies this same policy to both teams. Automatic Energy Use is reconsidered at roughly 65, 75, and 85 minutes: a team averaging 35% condition or less chooses Save Energy whenever no usable automatic fatigue substitution remains — whether the limit is reached or bench, role, or value constraints prevent one. Otherwise a trailing team chooses All Out, a leader chooses Save Energy from minute 75 onward, and a level team stays Balanced. Automatic coaching is regenerated from match state during replay rather than recorded as a fake user input.

### GK Resolve (the anti-frustration keystone)

Borrowed directly from Inazuma Eleven's Keeper Power (see research/match-presentation.md): each GK has a **Resolve bar** (base 100 for every keeper; REF sets how strongly saves resist shots, scaled by remaining Resolve). Power shots and repeated pressure *damage Resolve* instead of auto-scoring; saves get weaker as Resolve drops. An opponent's fire-shot doesn't instantly score — it visibly wears your keeper down, giving you drama without cheapness. Resolve partially regenerates at halftime.

## Superpowers in the engine

A power is a **timed modifier burst** the sim applies to one agent (details in doc 04):

- Each fielded hero builds **Heat** from involvement events (touches, tackles won, shots at launch, saves) plus a small role-aware trickle. At the threshold, Heat banks until that power's authored useful context appears; the hero then enters **the Zone** immediately and resets Heat. No second random roll can discard a short defensive opportunity.
- Every power defines a **useful context** — the situations where firing it actually matters (Super Speed: you have the ball or it's loose nearby; Super Strength: an opposing carrier is in range; a GK power: a shot is incoming). The hero's on-pitch glow intensifies in context, so "when do I tap?" is a readable decision, not a guess.
- **The Zone window** lasts ~7 seconds, glow fading as it runs out. Tap the glowing on-pitch hero during it to fire at **100%**, aimed at the current situation. A manual hero's expired window **decays heat to half — no auto-fire**: the attention premium is catching windows, not a stat bonus. Every watched match starts in manual `M`; the live `M`/`A` button can switch home heroes to automatic fire at the next useful context at **85%**, or at **75%** in the window's final seconds if no context appears (hands-off play and Quick Result stay respectable; rival heroes always run this policy). Powers that require a victim never fire targetless — those windows expire instead, making an opponent's glow a threat you can starve.
- **Powers can stack.** Every hero's Heat, Zone, wind-up, and active effect advances independently while teammates' powers run. The match HUD expands from one to four simultaneous power tiles as the Hero License cap grows, so later heroes retain their own opportunities instead of freezing behind the first activation.
- **Wind-up**: each power owns its readable telegraph length, from a next-tick spatial reveal to Super Strength's 0.5-second charge and longer trap preparations. Interruptible wind-ups preserve visible counterplay; instant or already-planted effects resolve according to their authored contract.
- **Opposing heroes** use powers on their own AI priorities. Division 5 has none so the player's first hero remains unique; rival heroes begin above it and become common from D2 · National Championship upward.
- Simultaneous opposing powers resolve through their authored effects. A dedicated power-clash contest and cut-in is post-launch work, not a current engine promise.

## Presentation (renderer)

- The match stays on the static wide vertical-pitch view through power activations. A power never pauses play or covers the pitch.
- Every home power fires with a compact **player name + power name + icon** card beside the bottom-left player card; rival powers use a compact threat banner. The on-pitch pixel effect carries the cause and result.
- Speed controls: ×1 / ×2, pause. **Quick Result** available for every match from day one (Retro Bowl's per-match Sim pattern) — produces the same result as watching, plus a highlights ticker and optional "watch goals only" replay.
- Goal celebration: 2s banner + crowd burst, skippable. Broadcast dressing: scoreboard bug top-center, match clock, division-colored lower third.
- Match HUD: a fixed bottom-left name + live energy card shows the current carrier and retains the last carrier while the ball travels; glowing home heroes are tapped directly on the pitch. The first coaching row exposes Formation, Playstyle, and Swap; a second full-width row directly selects Save Energy, Balanced, or All Out and shows Team Energy. Swap cards show numeric energy with green (`>60`), amber (`31–60`), and red (`0–30`) states. Its dynamic `N TIRED` prompt counts current on-field players at or below **40%** — for example, `3 TIRED · 0/5` — so exhausted off-ball players are visible before opening Swap. The count is only a UI prompt, not a separate mechanic or the AI's 60% planned-substitution threshold. Speed/pause remain by the scoreboard. Rival heroes always run automatically.

## Halftime

15-second interstitial (skippable): score, shot count, Resolve status, and hero gauges. Every on-field player recovers exactly **+10 condition**, capped at 100. Coaching is not limited to halftime: Formation, Playstyle, Energy Use, and up to five substitutions can be changed during live play, and every user change is recorded in the deterministic replay input stream.

## Outputs

The sim emits a typed event stream (`KICKOFF`, `PASS`, `TACKLE`, `POWER_FIRED`, `GOAL`, …) consumed by: the renderer, the highlights ticker, the post-match report, TP/fan/morale calculations, and tests. One source of truth.
