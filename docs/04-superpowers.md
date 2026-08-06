# 04 — Superpowers

The signature system. Powers must feel **rare** (pillar 3), **spectacular** (comic FX), and **fair** (interruptible wind-ups, GK Resolve attrition, license slots). Every power obeys the **timing-sensitivity principle**: an effect is a *spike* tied to a moment, never a smear of passive percentages — activations must visibly change possession or geometry, and expert timing determines how valuable the change becomes.

**Powers break ordinary limits by design.** The raw 999 rating ceiling and PAC's 2× ordinary full-condition speed spread apply to training and ordinary match performance only. An authored power resolves afterward and may temporarily exceed any ordinary stat, fatigue, contest, Resolve, geometry, or movement limit when that is the promised spectacle. Contest and finish effects are authored directly as typed d64 ratio modifiers; other powers use explicit multipliers, geometry, or time. They never add hidden raw stat points or write a raw stat above 999 into the player save.

## Hero License slots (field cap)

League lore: superpowered players require a registered Hero License, and licenses per match are capped.

| Club prestige | Heroes on the pitch |
|---|---|
| Start (D5 · District League) | 2 |
| Reach Div 3 | 3 |
| Reach D1 · Global League | 4 |

You may *own* any number of heroes (bench/rotate them), but only licensed slots play.

## Heat & The Zone (activation)

Replaces the earlier fixed READY-window design (decision 2026-07-17, after statistical audit showed context-auto ≈ blind-auto).

- **Heat** builds from involvement: +20 shot (awarded at launch, including misses), +30 save (GK), +10 when the opponent misses, +18 tackle won, +12 interception, +8 loose-ball recovery, +5 goalkeeper distribution, +3 tackle attempt, and +2 pass received. Role trickle closes the natural-touch gap: +0.02/tick FWD, +0.035 MID, +0.06 DEF, +0.04 GK, with another +0.45/tick while a defender is engaged within 20m of the carrier. Earned, not timed; ordinary passers deliberately do not gain Heat just for releasing the ball.
- **Heat banks until a real opportunity**: at 60 Heat for outfield heroes or 5 for a goalkeeper, the hero waits at full charge until their authored useful context appears, then enters the Zone immediately and resets Heat. There is no second luck roll that can miss a short defensive opening. This does not store uses: one Heat bar can create only one live Zone. Tuning target: **~2–3 zones per hero per match**.
- **The Zone does not expire**: the hero glows at full intensity and holds the charge until their useful context appears. Engine m1.27 removed the ~7-second countdown; an unused Zone neither fades nor refunds Heat. The half-Heat refund belongs to the wind-up, not to this state.
- **Powers always fire automatically** (decision 2026-07-25, superseding the manual tap). Every hero on both sides runs the fire-when-ready policy: the power fires at the next useful context at **85%** (`CONTEXT_AUTO_STRENGTH`), the only grade reachable in the shipped game. A watched match and Quick Result therefore resolve identically, and the player's live decisions are Formation, Playstyle, Swap, and Energy Use rather than reflex. **Exception: powers that require a victim (Super Strength, Shadow Mark's ambush, Web Trap's springing) never fire targetless** — they hold their charge instead, for as long as it takes. A rival's glow is therefore a threat you can play around: keep the ball away from them and the charge never converts. Because the Zone no longer expires, that denial has to hold for the rest of the match. That's counterplay, not a bug.
- **There is no manual hero tap, and no `M`/`A` mode switch.** The earlier design fired at **100%** on a well-timed tap and armed a 2-second **90%** window on an early one. It was removed after playtest (commit `ed71a18`) because measurement could not establish a reliable advantage for tapping at Tier 1 — every tap-vs-auto confidence interval crossed zero except Elastic Keeper. The sim retains a `POWER_TAP` input and a `SAVE_FOR_TAP` policy purely as **test instrumentation**: the balance probes use them to measure a power's ceiling, the gate suite uses never-firing as a control, and the replay parity test uses a scripted tap to prove that recorded inputs genuinely change outcomes. Neither is reachable from the game.
- **Powers can stack.** Every hero's Heat, Zone, wind-up, and active effect advances independently, including while a teammate's power is running. This makes multi-hero squads feel additive instead of spending roughly a tenth of the match frozen behind the first activation.
- **Wind-up** is normally 1.5s and interruptible (hero keeps half their heat). Super Strength is the visible 0.5s exception: it locks the current enemy carrier, prevents that target passing or shooting, then lands the charge. Portal Pass, Decoy Double, and Gravity Well resolve on the next simulation tick (0.1s) because they re-check a live receiver, carrier, or lane instead of chasing stale geometry. Tackle-interruption still applies to a wind-up by the **ball carrier** (Super Speed, Fire Torch): taking the ball cancels the charge.
- **A knocked-down hero stays hot**: going out mid-zone pauses the window and resumes it on recovery (confirmed design intent, audit round 2) — getting flattened doesn't extinguish your flow state, and firing the moment you're back up is exactly the comic-book beat. Wind-ups interrupt on knockout (half heat back); already-active powers simply end.
- Every power declares a **useful context** in its content JSON (the auto-AI's trigger and the chip-glow hint). Contexts encode *value moments* — a breakaway, the final third, a dangerous carrier near our box — not mere usability.

**Decision record — stored charges rejected**: "3 stored uses" was considered and cut. A full Heat bar may wait for one useful situation, but it never becomes inventory. Late-game squads therefore cannot hoard 10+ activations for one siege.

**Decision record — the Hero License card exemption (adopted, ENGINE_VERSION m1.12)**: firing a licensed power **never books its user**, and the exemption is **symmetric** — rival heroes get the same free pass. Previously Fire Torch rolled a 15% yellow and Super Strength rolled 25% yellow / 5% straight red on every activation.

Three reasons:

1. **The License already says this.** Hero Licenses are the in-world institution that caps how many powers a club may field (2 → 3 → 4 by division). If the authority licenses a power, using it is sanctioned play; booking a player for it has the rulebook contradicting itself.
2. **The cost was invisible before committing.** Fire Torch's card at least bought a huge effect (an opponent removed for ~9% of the match). Super Strength's 30% card chance — a twentieth of it a straight red with **no substitute keeper or outfielder** — was a hidden tax the player never agreed to, and one sending-off per season traceable to a single power.
3. **It unblocks measurement.** With cards gone, whatever remains of the defensive powers' measured deficit is positional (Future Sight teleporting a defender out of shape, Web Trap anchoring them), which is a far more useful thing to tune.

**What replaces the risk**: nothing yet. Super Strength keeps its telegraphed wind-up and its "deny the target" counterplay, and it still wastes the zone on a miss. If that proves too consequence-free, the intended lever is a **miss penalty** (a whiffed charge costs the zone and leaves the defender out of position), never a return to cards.

`SimPlayer.cards`, the `CARD` event and the `'redcard'` out-reason remain in the schema so saved replays and their UI still deserialize, but nothing in the sim can now produce them.

## The catalog: 20 designed powers

Launch ships **17** of these. Magnet Touch was cut at M4; Bend It and Time Skip remain post-launch candidates. Powers are data files, so later additions do not need bespoke career code. ⚙ = implemented in M0. ★ = legendary, one use per match.

| Power | Effect | The timing decision |
|---|---|---|
| **Attack** | | |
| Super Speed ⚙ | Breakaway burst with the ball (boosts the hero's movement, on or off the ball) | Fire at the start of a dangerous break, not in traffic |
| Blink Run | Teleport past the final defender | The last man is the only man worth blinking past |
| Thunder Strike | Shot heavily damages keeper Resolve *even if saved* | Save it for a clean central strike — it pays off next shot too |
| Fire Torch ⚙ | Flaming run — burns past one, two, or three relevant goal-side defenders at tiers 1–3. Licensed — never booked | Fire when the final-third route to goal is marked |
| Phase Run | Ghost through one tackle — but cannot shoot while phased | Escape midfield pressure; never at the goalmouth |
| Bend It | Curve your own shot mid-flight around the keeper | Fires automatically **while the ball flies** — the tightest context window in the catalogue |
| Portal Pass | The current carrier drops the ball through a portal onto the best forward runner, protected for up to two seconds or until they pass or shoot | When any teammate's lane is blocked and a runner is home free |
| **Midfield / utility** | | |
| ~~Magnet Touch~~ ✂ | The next loose ball in range snaps to you | **Cut at M4** (`124c056`) — 3.4 Zones per match, the highest measured, and 0 fires across 24 seeds. The note written at the time blamed the 7s window, which m1.27 later removed. The durable reason is that a loose ball is not a *sustained* situation: the nearest player wins it on the next tick (`engine.ts` possessionTick), so the trigger evaporates inside the wind-up. `src/sim/types.ts` records the same lesson for the m1.13 additions. Re-examined 2026-08-01 against the hold-until-context engine: stays cut |
| Decoy Double | Creates a temporary extra forward with the copied forward's stats; the clone can receive, carry, pass, and shoot until it pops on expiry, turnover, or restart | Add the extra passing option while your team owns the attack |
| Gravity Well | Moves one or two blockers sideways out of the route to goal and the runner, sends the most open suitable attacker forward, and prioritizes the pass only while its lane stays open | Plant it centrally when a teammate's route is blocked |
| Future Sight | Predicts and steals the next eligible pass, then guarantees an outlet to the furthest-forward onside teammate | Read the through-ball before it's played |
| Rally Cry | Gives one nearby powered teammate one Encore activation beyond the normal cap | Use it where a second hero can cash in the bonus |
| Time Skip ★ | Everyone freezes for one second except the hero | The one moment that decides the match |
| **Defense** | | |
| Shadow Mark | Burrows for two seconds, then waits up to ten seconds for an enemy field carrier in the hunt area before erupting for a guaranteed steal | Hide before the opposition's next dangerous possession |
| Super Strength ⚙ | Locks the carrier for a visible half-second, prevents their action, then flattens them and wins the ball. Licensed — never booked | Fire when a dangerous carrier enters charge range |
| Web Trap | Drops the current carrier's ball and roots that victim while everyone else races for it | Place it in the expected dribbling lane |
| Gust | Bends the opponent's next good pass safely to your goalkeeper, who guarantees a long punt to a teammate | Arm it while the opponent shapes to pass |
| Ice Rink | Slides the current carrier and ball backward toward their own goal while actions are locked | Stop a dribble and push the whole attack backward |
| **Goalkeeper** | | |
| Elastic Keeper | Arms stretch to cover the whole goal for the next shot | Hold it for the one-on-one |
| Giant GK | Keeper grows huge for one attack | The corner-kick chaos moment |

**Cut from the original twelve**: Sticky Feet, Iron Wall, Freeze Zone, Magnet Gloves — all stat-smears; the least fun shape a power can have. Superseded: Rocket Shot → Thunder Strike, Teleport Blink → Blink Run, Hawk Eye → Portal Pass, Time Slow → Time Skip, Clone Dash → Decoy Double.

### Power tiers

Every licensed hero carries their career **Tier 1–3** into the deterministic match definition. The accepted playtest band is intentionally broad: a power may be worth roughly **+1 to +6 squad-strength points** as long as it is useful rather than harmful, fires reliably, and performs the visible action it promises. An upgrade must never make a power weaker. Timing and tier rewards are family-specific visible changes—duration, reach, targets, or destination quality—not hidden unrelated stat boosts.

### Pass spills

A failed ordinary pass no longer always lands cleanly on the selected interceptor. When a pass contest is lost, a seeded 35% spill can deflect it into a loose-ball race; passes with no eligible interceptor also arrive loose. Gust is deliberately different: it redirects the pass to the goalkeeper for a guaranteed teammate punt, while Future Sight remains the clean-steal-and-outlet power.

## Getting powers

1. **Post-match awakening** (primary): after a completed user match, an eligible check has a flat **10% chance**. The first check cannot occur until the **third completed match after the previous awakening**. If it fires, one unpowered participant is selected deterministically from the match and is **guaranteed** to receive a stat-weighted power; there is no failure card and no weekly choice prompt. The final reveal states the power's plain-language effect, then auto-plays a staged 11v11 match clip using the production match renderer. The clip begins with 1.5 seconds of normal play before automatic activation, continues normal play for one second after the power ends, freezes, and then offers Replay or Continue. Coaching controls are hidden so the centred pitch remains the focus. The awakened player's **wage stays locked until their contract expires**; at renewal their agent asks the hero rate (×3–5).
2. **Campaign first hero**: the created player is the sole exception to the 10% roll. Their first completed match guarantees the same automatic cutscene and stat-weighted power, with no origin choice. Rally Cry is excluded while this would be the club's only power; it joins the pool once the awakening would create a powered pair.
3. **Cutscene trigger deck**: every awakening uses the same collapse → discovery → ascension structure. Discovery causes come from a 15-entry comedy bank; every entry is used once before free random repeats begin. The 10.3-second pre-rise music asset begins with the limp, fades over its final second if the player waits on the story prompt, and stops the instant the ascension/rise beat starts.
4. **Pre-powered signings**: rare scouted "hero" players (★ marked), fame-gated (start appearing at Div 3). Huge signing fee + hero wages from day one. The expensive-but-certain door.

Which power a player awakens is weighted by their stats and body type (a PAC-heavy skinny winger leans Super Speed; a DEF-heavy muscular unit leans Super Strength) — awakenings feel *fitting*, not random.

## Balance rails (design promises)

- D5 · District League and D4 · County League are winnable with zero heroes; heroes accelerate, never gate.
- Opposing hero density ramps from zero in D5 · District League—your awakened player is the division's only hero—toward every D1 · Global League team fielding 2–3.
- Hero wages + license caps are the tuning valves; the season-simulation harness (doc 09) verifies the flat 10% post-match cadence and three-match cooldown. The 1,000-seed power harness verifies that upgrading does not create a statistically established harmful reversal.
