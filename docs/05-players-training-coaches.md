# 05 — Players, Training & Coaches

## Player anatomy

- **Identity**: procedurally generated name + look (skin tone, hair, facial hair, glasses/accessories, body type: slim/normal/heavy/muscular, height: short/normal/tall). Looks are cosmetic *flavor* except body type nudging awakening weights (doc 04).
- **Stats**: PAC / SHO (REF for GKs) / PAS / DEF / TEC / STA. Career ratings run from **1–999** with no player-specific cap. Contests compare the displayed ratings as a log-ratio, so 400 vs 434 means the same advantage as 40 vs 43.4 and no post-99 compression makes the numbers dishonest. PAC uses a separate strictly increasing fixed-point movement table whose ordinary full-condition spread is capped at 2×; STA uses committed endurance/drain tables. The only training hard stop is the universal 999 safety maximum; temporary superpower effects are exceptions and may exceed ordinary match limits.
- **Archetype** (visible): Speedster, Sniper, Playmaker, Anchor, Wall, Engine, All-Rounder, Prodigy. Archetypes change how quickly favored stats train; they never prevent an unfavored stat from growing.

| Archetype | Exact training bonus |
|---|---|
| Speedster | +15% PAC |
| Sniper | +15% SHO |
| Playmaker | +15% PAS and TEC |
| Anchor | +15% DEF and STA |
| Wall | +15% REF and DEF |
| Engine | +15% STA and PAC |
| All-Rounder | +5% all stats |
| Prodigy | +20% all stats |

- **Natural position** (visible): adds another **+5%** to three role skills. GK: REF/DEF/STA; DEF: DEF/STA/PAS; MID: PAS/TEC/STA; FWD: SHO/PAC/TEC.
- **Current rating**: the rounded average of the six attributes the role can use. Outfield players use SHO and ignore REF; goalkeepers use REF and ignore SHO.
- **Potential**: a permanent **SUPER-session chance grade**, not a cap and not a speed multiplier. Every instant drill rolls a chance of a **SUPER TRAINING SESSION** that multiplies the drill's base gain by **1.5×** with a full celebration. **E− is 5%**, and every step adds two points, up to **A+ at 33%**. A pity timer guarantees a SUPER at latest on the 12th drill since a player's last one, so low grades still hit jackpots. The player file shows the grade and exact percentage.
- **Potential progression**: recruitment quality rises with the club. D5 pools are 90% E-tier and 10% D-tier; D4 is 35% E / 60% D / 5% C; D3 is 5% E / 30% D / 60% C / 5% B; D2 is 5% D / 35% C / 60% B; D1 is 25% B / 75% A. Youth intake and scouting both use this division progression, so A and A+ players begin appearing in D1.
- **Hidden**: the coarse scouting/valuation tier behind the grade, consistency, personality (see below).
- **Personality** (visible after a few weeks): Fiery, Loyal, Greedy, Joker, Professional, Timid — drives event outcomes, negotiation behavior, morale swings.
- **State**: age, morale, condition/stamina, injury status, contract (wage, seasons left), fame, power (or none). Career condition is the player's kickoff and substitution-entry condition; it is no longer reset to 100 for the match.

### Generated division ratings

| Division | Club strength band | Support | Specialist focus | GK REF | Typical PAC |
|---|---:|---:|---:|---:|---:|
| D5 | 40–50 | 40 | 94 | 80 | 72 |
| D4 | 90–102 | 88 | 180 | 153 | 90 |
| D3 | 135–151 | 130 | 268 | 228 | 132 |
| D2 | 178–203 | 175 | 356 | 303 | 176 |
| D1 | 223–248 | 214 | 442 | 376 | 216 |

Generated clubs preserve these authored support/specialist/keeper values while
their displayed `squadStrength` is always recomputed from the actual squad.
The keeper ladder trails the specialist SHO ladder rather than the support band:
the frozen 100-match-per-division peer sample produces 4.32–4.60 goals per match
and 54.2–59.5% saves, keeping finishers dangerous without making keepers irrelevant.
The first D4 season has two explicit 39/40 relegation-pack clubs so a prepared
D5 promotion has a real survival contest without flattening established D4.
Non-user players then grow once per season by 3% on Cozy or 4% on Chairman,
including PAC and REF; deterministic stochastic rounding prevents small ratings
from losing their fractional growth forever.

## Growth & aging

- **Age curve**: 16–23 fast growth (training ×1.3), 24–29 prime (×1.0), 30+ decline (−1 to −3 PAC/STA per season, training ×0.6). Retirement announced at 33–38 (personality-weighted).
- **Match XP**: minutes played grant small position-relevant gains — playing your kids matters.
- **Legacy system**: when a club legend (5+ seasons, high fame) retires, choose one: they become a **coach candidate**, or they mentor a youth intake who arrives with +15% starting stats and the legend's archetype ("the new Flint kid"). Long-service investment pays forward (Game Dev Story's hall-of-fame snowball, adapted).
- **Visual identity**: 193 stable player looks ship across portraits and match sprites (168 outfield, 25 goalkeeper). All 160 launch-league players are distinct; later youth, academy, and transfer players retain the same deterministic face everywhere they appear. The pool combines structural face/hair silhouettes with restrained skin, predominantly natural hair colour, a small curated set of vivid dyes and bleach treatments, jewellery, scars, facial hair, and hairline variants under [11-art-style.md](11-art-style.md). Twenty historical and nine present-day football silhouettes provide loose visual inspiration, but the shipped identities remain fictional and use no real names, badges, or exact portrait copies.

## Training (the TP loop)

Instant, tap-to-train — drills resolve the moment they are picked:

- **Instant drills (the TP decision)**: tap **+** on any player, pick a stat in the drill popup, and choose **1–9 consecutive runs**; the picker stops at the number the current TP bank can afford. Every run resolves separately with its own gain, SUPER roll, injury roll, and skippable presentation before the next run begins. There is **no weekly plan, no slot limit, and no settlement step** — the only limits are the TP bank and the conditioning gamble. Training costs TP only, never money. The seven paths are Sprints→PAC, Finishing→SHO, Rondo→PAS, Duels→DEF, First Touch→TEC, Circuit→STA, and Keeper Drills→REF. Their I/II/III tiers give +3/+5/+8 base gain and cost 6/10/15 TP per tap. Tier I starts in D5, Tier II unlocks permanently after reaching D4, and Tier III unlocks permanently after reaching D2.
- **SUPER sessions**: each tap rolls the player's Potential-grade chance (5%–33%, pity within 12 drills) for a **1.5× gain** with fireworks, confetti, screen shake, and haptics. This is the dopamine core of the loop.
- **Training-priority promise**: agreeing the TRAINING_PRIORITY contract perk creates a **five-drill debt** — the promised player owns your next 5 drills. Their badge shows the countdown, other players' drills are blocked with an in-popup reminder (“Boss! You promised me the next 3 drills.”), and an injury pauses the debt rather than deadlocking training.
- **999 ceiling**: a maxed stat's drill option is greyed out and disabled; drill options show only the current stat value, never a cap. Nothing blocks Advance Week — there is no plan to waste TP on.
- **TP income**: match results award no TP. A fresh career starts with 30 TP and an empty grounds grid, plus enough extra cash to build the $8,000 Level 1 Training Pitch as its guided first project. Every weekly settlement pays a **24 TP** baseline whether or not a pitch exists, and the pitch itself pays nothing until it opens; from then on each settlement adds **+28 TP per completed facility level**. Employed coaches (head coach **10 + 2× level**, assistant **5 + level**) and explicit event effects can add more. A Level 1 pitch therefore takes the week from 24 TP to 52 — two basic 10-TP drills to five. Losing never slows training income, while hiring and upgrading staff or grounds creates a visible development budget.
- **Gain formula**: age and the relevant facility multiply the base drill gain (1.5× on a SUPER). Archetype + natural position + coach percentages then add together as a bonus on that adjusted gain; Potential no longer adds a percentage — its whole job is the SUPER roll. Fractional bonuses bank per player/stat until they become a whole visible point. There is **no high-stat training slowdown** and no personal ceiling.
- **Stamina price**: every drill costs 8 condition (weekly settlement restores +12). A drill that **starts below 30%** condition is an honest injury gamble — the exact percentage (10% + 2% per point under 30, reduced by Medical adjacency) rolls at drill time, and a hit means 2–6 weeks out (the drill's gain still lands first). A selected batch containing any such run gets a second safety gate that names the risky-run count and offers **Continue anyway**, **Continue with max safe** (automatically reduces to and starts the largest non-risky batch), or **Cancel** back to the number picker. The Medical Bay shortens recoveries.
- **Chemistry trios** (Pocket League Story 2's standout mechanic, adapted): specific 3-archetype combinations training together grant +15% to +60% gains for the whole trio (e.g. Speedster + Sniper + Playmaker = +40% attack drills). Combos are discoverable in-game and collectible in a Chemistry Codex. One combo bonus per week.

## Coaches

Exactly **one head coach** may be employed at a time (assistant slot unlocks with the Coaching Office facility). The current coach must be dismissed before another Hire action is available. Dismissal is a deliberate two-step process and costs exactly **one week of that coach's wage** as severance, paid immediately.

- **Profile**: two specialties from {Attack, Defense, Fitness, Technique, Goalkeeping, Motivator}, level 1–5, weekly wage, personality.
- **Effects**: a head coach adds +10%/level to matching training gains and generates `10 + 2× level` TP weekly; an assistant adds +5%/level and generates `5 + level` TP weekly. Fractional coach growth is banked per player and attribute until it becomes a whole stat point, so a Level 1 bonus cannot disappear to weekly rounding. Attack→SHO, Defense→DEF, Fitness→PAC+STA, Technique→PAS+TEC, Goalkeeping→REF. Motivator instead slows morale loss and speeds Hero Gauge fill by +5%/head level or +2.5%/assistant level.
- **Unlocks**: selected coach candidates may permanently teach a formation. The current validated tactical unlock is 4-3-3 and appears on only one candidate; after it is learned, later markets do not re-offer it. The engine-only 3-5-2 and 4-5-1 shapes remain hidden because the current balance sweep makes them trap choices. Drill tiers are selected directly in the weekly plan rather than taught by a coach.
- **Market**: 3–5 candidates refresh each pre-season; better coaches gated by division + fame. Coaches gain 1 level per 2 full seasons employed. Retired club legends appear as candidates with loyalty discounts.
- **Identity, age & portraits**: launch ships 32 curated multicultural coaches, each hired at age 30–60 with a deterministic resting/joy portrait, a distinct staff-only touchline wardrobe (formal, smart-casual, training, or weatherwear), visible age-band cues, and one unmistakable caricature trait under the respectful rules in [11-art-style.md](11-art-style.md). The pool begins with Amara Okafor, Kenji Sato, Valentina Cruz, Imani Adeyemi, Freja Lindholm, Priya Nair, Mateo Silva, Hana Park, Leila Haddad, Nia Thompson, Tomás Ferreira, Aiko Tanaka, Sibusiso Dlamini, Sofia Rossi, Jamal Rahman, and Mei Chen, then adds 16 equally authored identities. Gameplay specialties and quality remain deterministic and independent of ethnicity, age, clothing, or appearance.
- **Feedback contract**: candidate cards show the exact numerical effect for both roles and say **Available to hire**; there is no fictional club-pitch step. A successful hire removes that candidate from the shortlist and opens a full staff card with portrait, name, level, specialties, effects, and wage. Employed head and assistant coaches live under **Squad → Coaching Staff**, where either may be dismissed. Dismissal shows the exact one-week severance before confirmation, then a filed departure card; only then does the vacancy accept another hire.

## Scouting & transfers

- **Scout missions**: pick a region + focus, pay 1,000–5,000, and receive a shortlist in 2–3 weeks. D5 starts with Local plus a South America DEF brief; D4 adds another rotating international brief; D3 adds expensive, usually-wrong Rumored Hero searches; D2 adds Elite Prospect searches for young players with 4–5★ potential. Scout Office level independently controls report accuracy. All earned briefs survive relegation.
- **Buying**: transfer fee to the club + contract negotiation with the player (doc 06). Transfer windows: pre-season + 2 weeks mid-season.
- **Selling**: list a player; AI clubs bid within a valuation band. The six role-relevant ratings are measured relative to the selling division's support anchor, with base transfer anchors of **$6,500 / $9,500 / $14,500 / $22,000 / $32,000** from D5→D1 before age, potential, power tier ×4–8, and contract control. This keeps a support signing affordable after the raw-rating rebase while preserving a strong quadratic premium for stars. Generated support wage anchors are **$150 / $230 / $340 / $500 / $700 per week** from D5→D1. Awakened players still keep their old wage until renewal, when the locked ×3–5 hero cliff applies.
- **Youth intake**: 1–2 random 16–17 year olds offered each pre-season for a small signing bonus; quality scales with your Youth Field facility.

## Roster rules

- Every generated launch club carries **16 players**: 2 GK, 5 DEF, 5 MID, 4 FWD. Story onboarding deliberately trims the user's club before adding the created player, so the playable story begins at **15/17** with one place reserved for Week 2 Youth and one for the first scout target. Matchday: 11 starters + 5 bench players, and all five bench players may be used as one-way substitutions. Future Dorm upgrades may raise the broader career squad cap, but never the in-match substitution limit.
- Morale: fed by wins, playing time, fair wages, event outcomes. Low morale = stat penalty ±10% and transfer-request risk.
