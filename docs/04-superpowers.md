# 04 — Superpowers

The signature system. Powers must feel **rare** (pillar 3), **spectacular** (comic FX), and **fair** (interruptible wind-ups, GK Resolve attrition, license slots). Every power obeys the **timing-sensitivity principle**: an effect is a *spike* tied to a moment, never a smear of passive percentages — activations must visibly change possession or geometry, and expert timing determines how valuable the change becomes.

## Hero License slots (field cap)

League lore: superpowered players require a registered Hero License, and licenses per match are capped.

| Club prestige | Heroes on the pitch |
|---|---|
| Start (Div 5) | 2 |
| Reach Div 3 | 3 |
| Reach Div 1 | 4 |
| Win Continental Hero Cup | 5 |

You may *own* any number of heroes (bench/rotate them), but only licensed slots play.

## Heat & The Zone (activation)

Replaces the earlier fixed READY-window design (decision 2026-07-17, after statistical audit showed context-auto ≈ blind-auto).

- **Heat** builds from involvement: +8 per touch, +15 tackle won, +20 shot (awarded at launch, including misses — commitment is the act), +12 save (GK), +0.02/tick trickle. Earned, not timed.
- **Zone entry is semi-random, heat-weighted**: above 60 heat, each tick rolls a small seeded-RNG entry chance scaling with heat. A player having a great match visibly tends to catch fire — reading the game predicts the glow. Heat resets on entry. Tuning target: **~2–3 zones per hero per match**.
- **The window**: ~7 seconds, glow fading as it runs out. **Tap during the zone = 100%** directed fire. A manual hero's expired window **decays heat to half — no auto-fire**. The attention premium is real: attentive players catch more windows.
- **Fire-when-ready policy** (explicit pre-match setting per hero): auto-fires at the next useful context at **85%**, or at **75%** in the window's final seconds if no context appears — hands-off play and Quick Result stay respectable. Rival heroes always run this policy. **Exception: powers that require a victim (Super Strength, Shadow Mark's ambush, Web Trap's springing) never fire targetless** — their windows simply expire. A rival's glow is therefore a threat you can play around: keep the ball away from him and you starve the zone. That's counterplay, not a bug.
- **One power active per team at a time.** While one is active or winding, teammates' zones and heat **freeze** (paused, never wasted). Anti-stacking is the resource's shape, not a rule bolted on — and the spectacle camera only ever needs to dramatize one thing.
- **Wind-up** 1.5s, interruptible by a tackle (hero keeps half their heat). Some powers lock a target at wind-up start and *charge* at them (Super Strength) — the telegraph is the counterplay window.
- Every power declares a **useful context** in its content JSON (the auto-AI's trigger and the chip-glow hint). Contexts encode *value moments* — a breakaway, the final third, a dangerous carrier near our box — not mere usability.

**Decision record — banked charges rejected**: "3 stored uses" was considered and cut. Banking rewards hoarding: a late-game squad of 4–5 heroes could pool 10+ activations into one siege for a near-guaranteed goal, collapsing every match into the same solve. Zones can't be hoarded by construction.

## The catalog: 20 designed powers

Launch ships **at least 12** of these (final launch set chosen at M4 by playtest popularity; the rest become post-launch content drops — powers are data files). ⚙ = implemented in M0. ★ = legendary, one use per match.

| Power | Effect | The timing decision |
|---|---|---|
| **Attack** | | |
| Super Speed ⚙ | Breakaway burst with the ball (boosts the hero's movement, on or off the ball) | Fire at the start of a dangerous break, not in traffic |
| Blink Run | Teleport past the final defender | The last man is the only man worth blinking past |
| Thunder Strike | Shot heavily damages keeper Resolve *even if saved* | Save it for a clean central strike — it pays off next shot too |
| Fire Torch ⚙ | Flaming run — defenders shy from challenging the carrier; one marker ignites until the ref extinguishes them | Fire when a marker is glued to you in the final third |
| Phase Run | Ghost through one tackle — but cannot shoot while phased | Escape midfield pressure; never at the goalmouth |
| Bend It | Curve your own shot mid-flight around the keeper | Tap **while the ball flies** — the purest window in the game |
| Portal Pass | Ball drops out of a portal onto the best forward runner | When the lane is blocked and a runner is home free |
| **Midfield / utility** | | |
| Magnet Touch | The next loose ball in range snaps to you | Fire as a 50/50 drops |
| Decoy Double | A hologram runner drags one marker away | Trigger just before the through ball |
| Gravity Well | Briefly pulls nearby opponents toward you — lanes open elsewhere | Centrally, right before releasing wide |
| Future Sight | Predict and auto-intercept the next eligible pass | Read the through-ball before it's played |
| Rally Cry | Nearby teammates' heat fills faster while active | When two teammates are near the zone threshold |
| Time Skip ★ | Everyone freezes for one second except the hero | The one moment that decides the match |
| **Defense** | | |
| Shadow Mark | Invisible to enemy *decision-making* until the next challenge — carriers don't avoid you, passers don't respect you; ends after challenging | Cloak before the striker commits to a lane; a wasted ambush is a wasted zone |
| Super Strength ⚙ | Locks the carrier at wind-up, charges, and flattens (steal only if they still hold it) | The counterplay is theirs: dump the ball fast |
| Web Trap | First opponent entering the marked zone is rooted | Place it in the expected dribbling lane |
| Gust | Shove an opponent's in-flight shot or pass off course | A defensive *reaction* — tap during their shot |
| Ice Rink | An area turns slick; opponents entering slip | Siege defense in front of your own box |
| **Goalkeeper** | | |
| Elastic Keeper | Arms stretch to cover the whole goal for the next shot | Hold it for the one-on-one |
| Giant GK | Keeper grows huge for one attack | The corner-kick chaos moment |

**Cut from the original twelve**: Sticky Feet, Iron Wall, Freeze Zone, Magnet Gloves — all stat-smears; the least fun shape a power can have. Superseded: Rocket Shot → Thunder Strike, Teleport Blink → Blink Run, Hawk Eye → Portal Pass, Time Slow → Time Skip, Clone Dash → Decoy Double.

Power levels: Lv1 (as awakened) → Lv2 (+duration/magnitude) → Lv3 (+secondary effect). Upgrades cost Hero Essence (doc 06).

## Getting powers (three doors)

1. **Chance events** (primary, doc 07): risky event choices carry a small base awakening chance, plus a **pity counter** — each risky choice that doesn't awaken adds +6% to the next one (persists across events, resets on awakening), and taking risks raises how often mystery events appear. Season 1 additionally guarantees a second-hero opportunity chain (the license cap must have something to bite on). Net cadence target: **~1 awakening per 1.5–2 risk-taking seasons** — asserted in the balance harness, not hoped for. Key hook: an awakened player's **wage stays locked until their contract expires** — awaken a player on a fresh 3-season deal and you've got a bargain hero; at renewal their agent knows what they're worth (×3–5 wage demand).
2. **Pre-powered signings**: rare scouted "hero" players (★ marked), fame-gated (start appearing at Div 3). Huge signing fee + hero wages from day one. The expensive-but-certain door.
3. **Hero Lab** (endgame facility): pay 15,000 + 3 HE per attempt on a chosen player; 10% awakening odds, +5% per failed attempt on that player (pity), 10% risk of a 4-week "lab accident" injury. Turns late-game cash piles into hero pipeline.

Which power a player awakens is weighted by their stats and body type (a PAC-heavy skinny winger leans Super Speed; a DEF-heavy muscular unit leans Super Strength) — awakenings feel *fitting*, not random.

## Balance rails (design promises)

- Div 5–4 are winnable with zero heroes; heroes accelerate, never gate.
- Opposing hero density ramps: Div 5 ~10% of teams field one → Div 1 all field 2–3 → Hero Cup full squads.
- Hero wages + license caps + Essence scarcity are the three tuning valves; the season-simulation harness (doc 09) verifies "no-hero playthrough reaches Div 3 by season 4", "full-hero endgame team wins Hero Cup ~60% per season", "risk-taking manager awakens ~1 hero per 1.5–2 seasons", and — per the timing audit — that **attentive tapping measurably beats reasonable auto, which beats blind firing**, per power, with a predeclared confidence-interval-positive margin.
