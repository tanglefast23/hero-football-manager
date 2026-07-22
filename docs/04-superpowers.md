# 04 — Superpowers

The signature system. Powers must feel **rare** (pillar 3), **spectacular** (comic FX), and **fair** (interruptible wind-ups, GK Resolve attrition, license slots). Every power obeys the **timing-sensitivity principle**: an effect is a *spike* tied to a moment, never a smear of passive percentages — activations must visibly change possession or geometry, and expert timing determines how valuable the change becomes.

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

- **Heat** builds from involvement: +20 shot (awarded at launch, including misses), +30 save (GK), +10 when the opponent misses, +18 tackle won, +12 interception, +8 loose-ball recovery, +5 goalkeeper distribution, +3 tackle attempt, and +2 pass received. Role trickle closes the natural-touch gap: +0.02/tick FWD, +0.035 MID, +0.06 DEF, +0.055 GK, with another +0.45/tick while a defender is engaged within 20m of the carrier. Earned, not timed; ordinary passers deliberately do not gain Heat just for releasing the ball.
- **Heat banks until a real opportunity**: at 60 Heat, the hero waits at full charge until their authored useful context appears, then enters the Zone immediately and resets Heat. There is no second luck roll that can miss a short defensive opening. This does not store uses: one Heat bar can create only one live Zone. Tuning target: **~2–3 zones per hero per match**.
- **The window**: ~7 seconds, glow fading as it runs out. Tapping in an already-useful situation fires at **100%**. An early tap commits to a separate, fixed **2-second armed window**: if the useful situation appears during it, the hero fires at **90%**; otherwise it expires and heat decays to half. Because the armed window starts when tapped, choosing *when* to commit remains the decision. An untouched manual window also expires to half heat with no auto-fire.
- **Fire-when-ready policy** (live match-wide `A` mode): auto-fires at the next useful context at **85%**, or at **75%** in the window's final seconds if no context appears — hands-off play and Quick Result stay respectable. Rival heroes always run this policy. **Exception: powers that require a victim (Super Strength, Shadow Mark's ambush, Web Trap's springing) never fire targetless** — their windows simply expire. A rival's glow is therefore a threat you can play around: keep the ball away from him and you starve the zone. That's counterplay, not a bug.
- **Watched-match power control** (match-wide, manual by default): every watched match starts on `M`, where tapping a glowing home hero either fires at **100%** in useful context or arms the fixed 2-second **90%** window. The top-bar `M`/`A` button switches live between manual and the contextual **85%** Fire-when-ready policy (and **75%** final-seconds lapse) used by Quick Result; direct tapping is disabled while `A` is active. Rival heroes are always automatic. Mode changes are replay-recorded and never bypass knockouts.
- **Powers can stack.** Every hero's Heat, Zone, wind-up, and active effect advances independently, including while a teammate's power is running. This makes multi-hero squads feel additive instead of spending roughly a tenth of the match frozen behind the first activation.
- **Wind-up** 1.5s, interruptible by a tackle (hero keeps half their heat). Some powers lock a target at wind-up start and *charge* at them (Super Strength) — the telegraph is the counterplay window. Tackle-interruption applies to a wind-up by the **ball carrier** (Super Speed, Fire Torch): a defender takes the ball, which cancels the charge. A charging Super Strength defender holds no ball, so there is nothing to tackle off them — its counterplay is denying the target (dodge, or pass the ball away) plus the visible telegraph, not a tackle. (audit finding 9: this is intended, not a missing interrupt.)
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
| Fire Torch ⚙ | Flaming run — the nearest opponent within roughly 14m ignites and is knocked out of play briefly; if the hero carries, defenders also shy from challenging. Licensed — never booked | Fire when an opponent closes on the hero, ideally while the hero carries |
| Phase Run | Ghost through one tackle — but cannot shoot while phased | Escape midfield pressure; never at the goalmouth |
| Bend It | Curve your own shot mid-flight around the keeper | Tap **while the ball flies** — the purest window in the game |
| Portal Pass | The team's current carrier drops the ball through a portal onto the best forward runner | When any teammate's lane is blocked and a runner is home free |
| **Midfield / utility** | | |
| ~~Magnet Touch~~ ✂ | The next loose ball in range snaps to you | **Cut at M4** — measured 3.4 Zones and 0 fires per match across 24 seeds. Its trigger is a loose ball near the hero, which almost never coincides with the 7s window |
| Decoy Double | A hologram runner drags one marker away while your team has possession | Trigger just before the through ball; the hero need not carry it |
| Gravity Well | Briefly pulls nearby opponents toward you — lanes open elsewhere | Centrally, right before releasing wide |
| Future Sight | Predict and auto-intercept the next eligible pass | Read the through-ball before it's played |
| Rally Cry | Nearby teammates' heat fills faster while active | When two teammates are near the zone threshold |
| Time Skip ★ | Everyone freezes for one second except the hero | The one moment that decides the match |
| **Defense** | | |
| Shadow Mark | Invisible to enemy *decision-making* until the next challenge — carriers don't avoid you, passers don't respect you; ends after challenging | Cloak before the striker commits to a lane; a wasted ambush is a wasted zone |
| Super Strength ⚙ | Locks the carrier at wind-up, charges, and flattens (steal only if they still hold it). Licensed — never booked | The counterplay is theirs: dump the ball fast |
| Web Trap | First opponent entering the marked zone is rooted | Place it in the expected dribbling lane |
| Gust | The opponent's next pass breaks loose on arrival instead of reaching a clean receiver or interceptor | Arm it while the opponent shapes to pass; the loose ball stays contestable |
| Ice Rink | An area turns slick; opponents entering slip | Siege defense in front of your own box |
| **Goalkeeper** | | |
| Elastic Keeper | Arms stretch to cover the whole goal for the next shot | Hold it for the one-on-one |
| Giant GK | Keeper grows huge for one attack | The corner-kick chaos moment |

**Cut from the original twelve**: Sticky Feet, Iron Wall, Freeze Zone, Magnet Gloves — all stat-smears; the least fun shape a power can have. Superseded: Rocket Shot → Thunder Strike, Teleport Blink → Blink Run, Hawk Eye → Portal Pass, Time Slow → Time Skip, Clone Dash → Decoy Double.

### Power tiers

Every licensed hero carries their career **Tier 1–3** into the deterministic match definition. Tier 1 is balanced at the weakest control policy: about **+2 squad-strength points** under automatic firing. A well-placed manual tap receives an internal 15% timing reward and targets **+2.5–3 points** while the replayed `POWER_FIRED.strength` remains the honest timing grade (100% tap, 90% armed, 85% context auto, 75% lapse). Tier 2 scales effect magnitude and duration to 1.2×. Tier 3 scales them to 1.45× each, producing close to twice Tier 1's sustained influence and targeting **+4 points**. Family calibration changes only each power's visible authored effect, never unrelated actions by the hero.

### Pass spills

A failed ordinary pass no longer always lands cleanly on the selected interceptor. When a pass contest is lost, a seeded 35% spill can deflect it into a loose-ball race; passes with no eligible interceptor also arrive loose. Gust uses this same visible loose-ball outcome deliberately, while Future Sight remains the clean-steal power.

## Getting powers

1. **Post-match awakening** (primary): after a completed user match, an eligible check has a flat **10% chance**. The first check cannot occur until the **third completed match after the previous awakening**. If it fires, one unpowered participant is selected deterministically from the match and is **guaranteed** to receive a stat-weighted power; there is no failure card and no weekly choice prompt. The awakened player's **wage stays locked until their contract expires**; at renewal their agent asks the hero rate (×3–5).
2. **Campaign first hero**: the created player is the sole exception to the 10% roll. Their first completed match guarantees the same automatic cutscene and stat-weighted power, with no origin choice. Rally Cry is excluded while this would be the club's only power; it joins the pool once the awakening would create a powered pair.
3. **Cutscene trigger deck**: every awakening uses the same collapse → discovery → ascension structure. Discovery causes come from a 17-entry comedy bank; every entry is used once before free random repeats begin.
4. **Pre-powered signings**: rare scouted "hero" players (★ marked), fame-gated (start appearing at Div 3). Huge signing fee + hero wages from day one. The expensive-but-certain door.

Which power a player awakens is weighted by their stats and body type (a PAC-heavy skinny winger leans Super Speed; a DEF-heavy muscular unit leans Super Strength) — awakenings feel *fitting*, not random.

## Balance rails (design promises)

- D5 · District League and D4 · County League are winnable with zero heroes; heroes accelerate, never gate.
- Opposing hero density ramps: around 10% of D5 · District League teams field one → every D1 · Global League team fields 2–3.
- Hero wages + license caps are the tuning valves; the season-simulation harness (doc 09) verifies the flat 10% post-match cadence and three-match cooldown, plus — per the timing audit — that **attentive tapping measurably beats reasonable auto, which beats blind firing**, per power, with a predeclared confidence-interval-positive margin.
