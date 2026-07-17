# Kairosoft Economy & Progression Research

Research pass across five Kairosoft simulation games, gathered for reference while designing a soccer club sim with superpowered players. Sources: kairosoft.wiki.gg (a Fandom mirror that stayed reachable; the live kairosoft.fandom.com blocked automated fetches during this session), StrategyWiki, TouchArcade/PocketGamer/Gamezebo/PixelSport reviews, GameplayInside and Esports News UK guides, and community-datamined tip threads.

**Sourcing confidence note:** Kairosoft never published formal design docs, so most of these numbers come from wiki contributors reading the game files or from players who logged results over many hours (the Grand Prix Story 2 "growth rating" table below, for example, is explicitly datamined from 120+ samples). Treat exact numbers as "accurate to what the community measured," not verified against source code. Where I could not confirm something (e.g., player aging in Pocket League Story), I've said so explicitly rather than guessing.

---

## 1. Game Dev Story (2010)

### 1.1 Money sources
- **Game sales** — the primary income. Revenue is driven by critic scores across four stats (Fun, Creativity, Graphics, Sound) and by genre/type/platform fit; a released game keeps selling for "the next few months before it wanes," i.e. sales decay over time rather than being a single lump sum.
- **Contract work** — available from day one. Pays $100K–$1,000K+ per contract, takes 6–13 weeks, and is explicitly called out as the easy, low-skill-floor income source early on ("relatively easy way to generate money... in the beginning phases"), but insufficient by itself later in the game.
- **Console licensing** — once you can develop for other companies' consoles (and eventually your own hardware), platform choice affects per-unit returns.

### 1.2 Money sinks
- **Salaries** — paid annually, start of March. All Year-1 salaries are covered by "the government... to encourage game development" — a deliberate, explicit training-wheels mechanic that removes payroll risk entirely for the player's first year.
- **Office upgrades** — Tier 2 costs $600K (unlocks once you've earned $1,000K lifetime); Tier 3 costs $2,500K (unlocks at $3,500K+ earned, or via Global Game Award trophies). Item prices scale up at each office tier.
- **Advertising** — 5+ tiers from Magazine Ads ($30K) up to Lunar Writing ($9,900K), scaling with office level.
- **Hiring fees** — see 1.6.
- **Gamedex expo booth** (annual, July W1) — Skip (free) → Basic booth $150K → Costumed characters $600K → Booth staff $2,500K → Celebrity guest $7,000K (includes a Kairobot appearance).
- **Emergency buffer** — a $150K fund is available if you're short, functioning as a soft bankruptcy backstop.

### 1.3 Secondary currency: Research Data (RP)
- **Earned:** passively by employees both while working AND while idle (a constant, ambient trickle), plus a lump-sum bonus on contract completion sized to contract difficulty. Because contracts can be completed quickly, repeating high-requirement contracts is called out as "a very effective way to gain masses of Research Data."
- **Spent:** leveling employees (levels 1–5, cost rising each level), and "Boosts" — temporary development bonuses with a success-probability up to 80%.
- **Why the dual-currency loop works:** Money is lumpy and delayed — you don't know if a release is a hit until reviews land weeks later, so cash flow is unpredictable. RP, by contrast, drips in constantly just from having staff on payroll, whether or not a game shipped recently. That decouples the "can I afford this" question from the "is my team good enough" question: a cash-poor month never blocks you from leveling up your people, and contracts double as an RP faucet during the dead time between releases.

### 1.4 Staff stats, training, careers
- **4 core stats:** Programming, Scenario, Graphics, Sound — these map directly onto the four game-quality stats (Fun/Creativity/Graphics/Sound) produced during development.
- **8 careers in a strict prerequisite tree**, level cap 5 per career, only one career "active" at a time (switched via a Career Change Manual item):
  - Tier 1 (base): **Coder** (Programming/debugging), **Writer** (Scenario, writes proposals), **Designer** (Graphics), **Sound Engineer** (Sound, composes soundtracks)
  - Tier 2: **Director** (needs Coder Lv5 + Writer Lv5; high salary and hiring fee), **Producer** (needs Designer Lv5 + Sound Engineer Lv5)
  - Tier 3: **Hardware Engineer** (needs Director Lv5 + Producer Lv5; required to build consoles; unlocks console parts at 4+ and 6+ Hardware Engineers on staff)
  - Tier 4: **Hacker** (needs Hardware Engineer Lv5; has all four base talents at high stats, but a much higher salary; cannot build consoles)
  - Advancement requires the employee to personally hit Lv5 in the prerequisite careers — there's no way to buy or skip past this.
- **Salary scaling:** compounds — each level-up multiplies salary by roughly 1.2x.
- **Roster size:** 44 hireable named employees plus 18 outsourced specialists usable only for contract work.

### 1.5 Facilities / building
- The "facility" system here is really the **office tier** (3 tiers total, gated by cumulative earnings or awards) plus **seating layout**, which is mostly cosmetic — seats nearer the exit save a little walking time, a minor efficiency nudge rather than a real system.

### 1.6 Hiring / scouting
- 6 hiring channels, increasing in cost and gated by office tier: Word of Mouth $50K → Magazine Ad $120K → Online Ad $550K → (Office 2) Vocational School $800K → Open House $1,800K → (Office 3) Hollywood Agent $3,500K.
- No salary negotiation as such; the hiring fee only applies when filling an empty desk slot.

### 1.7 Time structure
- Annual cycle. **March** = payroll. **July, week 1** = Gamedex expo. **December** = Global Game Awards (entry requires a game with a total critic score ≥32, the same threshold as Hall of Fame induction). Year 1 payroll is fully subsidized (see 1.2).
- **Game of the Year** needs a total score ≥36, and even a 40 doesn't guarantee the win — there's a competitive/random element against rival studios.

### 1.8 Fans / popularity
- **Fan letters** act as a dynamic reputation signal, broken out by age and gender demographic, that tells you which genre/type/platform combinations are landing with which audience — effectively a market-research feedback loop rather than a single "fame" number.

### 1.9 Difficulty curve
- Early game is protected hard: contracts are a can't-really-fail income stream, Year 1 payroll is free, and a $150K emergency fund exists on top of that.
- Late game manufactures a new money sink to keep cash meaningful: building the "ultimate console" costs roughly **$190 million** plus two years of salary reserve — an explicit aspirational cash target once regular income is trivial.

### 1.10 Special / unique mechanics
- **Genre × Type combo system** — pairing a genre and a type (e.g. RPG + Military) yields a graded outcome from "Not good" to "Amazing!", turning game design itself into a discovery meta-game layered on top of raw stats.
- **Hall of Fame → sequel snowball** — any game scoring 32+ qualifies for a sequel, and sequels start with bonus levels in all four core stats, letting a hit franchise compound rather than resetting to zero each release.
- **Government-subsidized Year 1** — an unusually explicit "this is the tutorial, you cannot go bankrupt yet" design choice.

---

## 2. Grand Prix Story (2011)

### 2.1 Money sources
- **Race prize money** (primary, per race).
- **Sponsors** — up to 2 concurrent contracts. Settled twice yearly (see 2.7). Base payments range from **$72K** (Bridgerock, the entry sponsor won by finishing 1st at Bloomtown) up to **$1,175K** (Kairo Group, late-game) — actual payout can vary from the listed base by roughly ±$25K.
- **Emergency subsidy** — a one-time **$300K bonus** the first time your funds drop critically low in Year 1.

### 2.2 Money sinks
- **Driver salaries** (paid yearly) — an enormous range, from $25K (Bo Bumper) up to $4,000K (Kairobot); most premium named drivers run $2,500K–$3,000K.
- **Mechanic salaries** (paid monthly) — base $2K–$30K, rising to $6K–$90K at level 5.
- **Driver training** — costs money + energy + (if the driver has one) aura. 7 basic methods available from the start: Jog $20K, Read $30K, Dance $26K, Joyride $42K, plus "Odd Jobs" which actually generates +8K income instead of costing. Advanced methods unlock via sponsors: Drag Race $46K, Power Slide $49K, Gear Shift $52K, Drift $56K, Aerobics $46K, Rocket Science $60K, Shop Class $65K.
- **Parts/vehicle research** — costs Research Points, not cash directly.

### 2.3 Secondary currency: Research Points (RP), capped at 999
- **Earned:** gradually during races, from scrapping old vehicles, and passively (small random amounts) from mechanics while they work.
- **Spent:** researching new parts/vehicles, leveling mechanics, unlocking upgrades.

### 2.4 Staff stats
- **Drivers, 6 stats:** Pedal (top speed), Shift (acceleration), Steer (handling) — race-only — plus IQ (EXP gain + vehicle development), Appeal (sponsor value), Tech (dev speed/repair), Analysis (RP generation). Roster stat totals span roughly 166–379.
- **Mechanics, 3 stats:** Appeal, Tech, Analysis. Leveled with RP; also get small random stat bumps just from working.
- **Auras** are driver-exclusive (mechanics can't have them). They're earned by finishing **2nd or 3rd** on a track's first attempt — notably, winning outright on the first try forfeits this reward, an anti-rush incentive. Auras can be spent on installation, racing, training, or building; "golden" (highest-tier) auras are rare and best reserved for top-end parts.

### 2.5 Facilities / building
- 3 unlockable workshops, each adding capacity: Workshop 1 (start) = 2 mechanics/1 driver/1 car → Workshop 2 (after Formula Smile) = 4/2/2 → Workshop 3 (after Formula Asia) = 6/2/2. No adjacency or spatial-placement system in this game — that's new to the sequel (see 3.5).

### 2.6 Hiring / scouting
- Straightforward priced roster; the tip community converges on is to avoid drivers costing more than ~$200K unless clearly superior across the board, and to preferentially pick drivers who net you money rather than just cost fees (some drivers, like Bo Bumper, are "pay drivers" who add funds rather than draw a big salary).

### 2.7 Time structure
- **14 in-game years** total.
- Sponsor contracts are resolved twice a year, at the **start of M1 and M7** — accumulated "ad effect" from the preceding six months is added to each sponsor's running total at that point, and payment is disbursed then. This creates two clear financial checkpoints per year rather than a continuous drip.

### 2.8 Fans / popularity ("Ad Effect")
- Ad Effect is this game's popularity stat, accumulated from race performance and boosted by Appeal-heavy parts (e.g. the Emblem part, the Duck Car). Sponsor thresholds range from 80 (Bridgerock) to 630 (Kairo Group); clearing a sponsor's threshold triggers a special reward (part plans, car plans, new training methods) and unlocks the next sponsor tier, visibly marked with a gold star.

### 2.9 Difficulty curve
- The first Grand Prix (Bloomtown/Formula Smile) is intentionally easy — guides recommend rushing through it just to learn the systems. The $300K emergency bailout backstops Year 1. Advancing to Formula Asia roughly triples your mechanic/data capacity in one step, a deliberate step-change rather than smooth scaling.
- **Endgame carryover (New Game+):** finishing the 14-year campaign lets you restart with your vehicle library (levels, upgrades) intact, but money and RP reset to zero. This is the mechanism that keeps late-game money meaningful — players chase a "perfect," permanently-owned Level 6 / 100%-upgraded vehicle or part (the V12 engine and Kairo Kar are the community-favorite keepers) specifically because it persists across playthroughs.

### 2.10 Special / unique mechanics
- Sponsor income arriving as a **twice-yearly settlement** tied to an accumulating performance score, rather than a boring per-race trickle.
- Auras rewarding **2nd/3rd place, not 1st**, on a track's first visit — discourages steamrolling early content.
- A carryover system that preserves *assets* but not *cash*, which is what gives grinding a "perfect" garage piece long-term meaning even though money itself resets.

---

## 3. Grand Prix Story 2 (2016, free-to-play)

Unlike its predecessor, this is F2P with ads and IAP, and the resource design reflects that directly: one clean currency (RP) in the original splinters into **six** parallel resources here.

### 3.1 Currencies
- **Gold (G)** — everyday cash. Sources: race participation, facility collection, selling items/vehicles, mineral sales, sponsor payments, Swanky's Shop.
- **Research Points (RP)** — "generally more scarce than G." Sources: challenges, dismantling old vehicles (better with a high-Analysis crew), facilities, sponsor rewards, Swanky's Shop. Spent on research, staff skill enhancement, vehicle/part upgrades, and instant repairs.
- **GP Medals (GP)** — the premium currency. Dual-purpose: trade at Swanky's Shop for RP/Money/permits/structures, restart a race mid-run (50 GP), recover a broken vehicle, enter raffles, or skip progress timers. Earned via: 10 GP for 100% race completion / 5 GP for a win, 50 GP per 10 ranks climbed, 1–2 GP per ad watched, 5 GP for a daily share-button tap, free medal offers, 30 GP per friend added (capped at 1,200 GP from 40 friends), and 100–400 GP from push-notification rewards.
- **Fuel** — consumed per race based on vehicle level/power; refilled at rank-up (100%), via facilities, or the item shop.
- **Nitro** — single-use race speed boost; from nitro plants, challenge races, or the item shop.
- **Grain** — earned from versus races (~10% of silo capacity per win); feeds a chicken-raising side loop that produces upgrade eggs.
- **Banana** — powers a separate "Research Lab" study track, distinct from RP research; from maxed fan-appeal gifts, versus races, and sponsor rewards.
- **Design note:** this is the textbook F2P pattern — fork one legible currency into a soft "played the game" resource (RP, Grain, Banana) plus a hard monetization lever (GP Medals), while G stays the everyday spend. Compare to Pocket League Story 2's similar (if less extreme) split in section 5.3.

### 3.2 Money sinks
- **Land:** permits extend length ($5,000 → $105,000 → $905,000, escalating); relocations extend width (rank 9: $20,000; rank 50: $3,000,000).
- **Structures — Storage:** Fuel Tank $1,000, Nitro Tank $1,000, Grain Silo $1,000, Warehouse $2,000 (items), Garage $3,000 (vehicles).
- **Structures — Facility:** Refinery $500, Nitro Plant $10,000, Training Center $5,000, Power/Training/Aero Labs $5,000 each, Design Office $12,000.
- **Structures — Environment** (decorative, but the ones worth having cost *GP Medals*, not G): Skyhigh Tower 3,000 GP, Stylish Castle 1,200 GP, Pyraplex Pyramid 1,200 GP — gating the best passive buffs behind premium currency is a deliberate monetization choice.
- **Vehicle enhancement:** Tuning (10 levels/stat, RP cost climbing 15→580, time climbing 15 min→3 days) and Upgrading (Grade II 80 RP/1hr, III 250 RP/4hr, IV 600 RP/10hr, each also consuming a sacrificial vehicle of matching type/grade).

### 3.3 Staff stats and contracts
- **6 stats:** Strength (speed, test runs), Agility (acceleration, repairs), Tech (handling, development, design), IQ (EXP gain, design), Analysis (dismantling, aero test), Appeal (fans, ads).
- **Growth ratings A–E** determine average combined stat gain per level-up (community-datamined from 120+ samples): A = 24.5, B = 22.5, C = 20.9, D = 19.3, **E = 8.0** — a steep cliff at the bottom tier so a "bad" recruit feels meaningfully worse, not just marginally worse.
- **Drivers:** contracts **renew weekly at 50% of the original hiring price** — an ongoing rent, unlike Grand Prix Story 1's flat annual salary. "Pay drivers" (who add funds instead of costing them) still exist as a rare economic joke/reward.
- **Mechanics:** one-time hiring payment, no renewal. Gain XP via a paid Training Center or manuals; a "Self-Taught" skill grants passive daily XP.
- **Roster caps:** max 3 teams total, 2 teams per race. Mechanic slots start at 2, expand to 4 via relocation at rank 9 (20,000G), then 6 at rank 50 (3,000,000G).

### 3.4 Vehicle development (new 3-stage pipeline)
1. **Design** — primary stat IQ, secondary Tech; special skill Car Designer; built at the Design Office; produces mostly Speed & Acceleration.
2. **Aero Test** — primary Analysis, secondary Tech; special skill Aero-dynamite; Wind Tunnel; produces mostly Handling.
3. **Test Run** — primary Strength, secondary Analysis; special skill Test Drive; Test Track; produces mostly Acceleration.

Each stage runs up to 6 phases, with the best possible dialogue outcomes ("Eureka!", "Amazing Downforce!", "Full Throttle!") landing at phases 3–5 — a small narrative "critical hit" layer on top of the stat math.

### 3.5 Facilities / building — the adjacency system (new, notable)
- **Environment/decoration structures buff nearby production buildings** by tile proximity: directly adjacent tiles get **100%** of the bonus, diagonal/corner tiles get **50%**, one tile further out gets **25%**, and the outer ring gets **10%**.
- Buildings are **relocatable**, so the optimization loop is: park your Design Office next to your best environment structure during the Design stage, then physically swap it out for the Wind Tunnel during Aero Test, then the Test Track during Test Run — always sitting your active development building next to the best available buff. This turns facility layout into an active, repeated spatial puzzle rather than a one-time placement decision.
- Land is a grid, max **11 tiles wide × 30 tiles long**, expanded via the permit/relocation costs above. A Construction Site is required to build or upgrade anything (except environment structures); running multiple Construction Sites speeds work up.

### 3.6 Dismantling (replaces simple scrapping)
- Sacrificing an old vehicle converts it into a reusable "kit" that **preserves its level, durability, grade, and tuning results**, while also granting RP scaled by the vehicle's rank (S>A>B>C>D>E), its potential value, its own "Dis." (dismantle) rate, and your team's Analysis stat.
- Dr. Mochipon gives 1 free instant dismantle per day; further same-day dismantles take 2 hours regardless of staff stats; a first-time bonus grants 3 free instant dismantles up front.

### 3.7 Difficulty / pacing mechanics
- **Fatigue:** drivers/mechanics get fatigued if repeatedly used across multiple development stages in the same session — discourages chain-farming a single star performer and encourages roster depth.
- **Durability:** below 25%, black smoke appears and performance drops; at 0% the vehicle breaks permanently and can only be repaired with GP Medals (a premium-currency-gated failure state) — though the very first time a vehicle breaks, you're compensated 10 GP Medals.
- **Forfeiting** a race nets 10% of the winning prize with zero vehicle damage, but staff only gain 1 EXP — an explicit "safe but slow" fallback option.

### 3.8 Special / unique mechanics
- The **relocatable adjacency-bonus puzzle** (3.5) is the single most distinctive, stealable idea in this game.
- **"Feedback + Race Analysis"** is a community-discovered skill combo that multiplies mechanic EXP gain several-fold — an emergent build synergy the designers apparently left in rather than patched out.
- **"Hype"** is a skill that reliably generates auras on demand, decoupling the aura system from the luck-based placement mechanic used in Grand Prix Story 1.

---

## 4. Pocket League Story (2011/2012) — the primary reference

Kairosoft's own soccer club manager. Japanese title translates to "Soccer Club Story"; this was Kairosoft's first game to get an English-language sequel.

### 4.1 Money sources
- **Sponsors** — pay a fee every match played, plus a one-time signing bonus (money, or an introduction to another sponsor, or unlocking a new hireable player).
- **Ticket revenue** — scales with your Fans stat; adjustable via the "Ticket Price" fan activity (community tip: hold around $10 early, raise to $20–30 once fan count is high).
- **Merchandise** — generated passively from Fans.
- **Facility usage** — every time a player auto-uses a facility between matches, you get a small amount of money (plus RP).
- **Prize money** — league/cup winnings (numbers below are from Pocket League Story 2 but the structure is shared): Amateur League 3,000, Novice Cup 5,000, Regional League 7,500, King Cup 8,000+, with a +3,000 bonus for winning by 4+ goals, and roughly 1,000 guaranteed as a floor per match.
- **Post-match income is itemized on a results screen** — Spectator, Tickets, Prize Money, Merchandise, Sponsors, minus Player Salaries — a fully transparent, line-by-line economy readout after every match.

### 4.2 Money sinks
- **Player salaries** — scale with player level, but are **only charged for matches actually played**. Benched players cost nothing. This removes roster-size cash pressure entirely; the only cost decision is who to field, not who to keep.
- **Facility construction** (14 total, each gated behind a rank or a Team Facilities fan-activity rank): Office (free, starter, can't be removed) → Parking Lot $50K → Running Track $120K → Gift Shop $150K → Meeting Room $220K → Park $300K → Pool $350K → Gym $450K → Convenience Store $500K → Fast Food $520K → Restaurant $550K → Clinic $950K → Modern Gym $1,500K → Hot Spring $1,800K.
- **Facility upgrades** — up to level 5; e.g. Running Track costs $100K → $435K → $770K → $1,105K cumulative through its upgrade path. Small ongoing maintenance ($0.1K–$2.5K) applies per facility.
- **Stadium upgrades:** Re-Sod (boosts practice XP) $500K → $1,000K; Expand Field (unlocks 7 more facility slots) $1,000; Renovate Stadium (+spectator capacity) $800 → $1,850.
- **Sponsor negotiation and fan activities cost RP, not cash** (see 4.3).
- **Hiring** costs cash; community norm is to keep 3–4x a target player's asking price in reserve before attempting to sign them, because the persuasion roll has real variance (graded outcomes shown as C/B/A-tier rolls).

### 4.3 Secondary currency: Research Points (RP), capped at 999 — with three sub-flavors
- **Earned:** ambiently, whenever a player uses a facility between matches (this happens automatically, not by player action) — and the amount is multiplied by coach quality after each match.
- **Notably, RP comes in three named sub-types — Arm, Field, and Bulb — sourced from different facility types.** Training exercises each require a specific RP flavor (e.g. "Barbells" costs 46 Arm-RP; "Goalie Drills" costs 77 Field-RP; "11-Man Elim" costs 95 Bulb-RP), which forces the player to keep a diverse facility mix instead of just building the single "best" facility and spamming it.
- **Spent on:** training (20 distinct exercises — see 4.4), sponsor meetings, and fan activities.
- **Why the dual-currency loop works:** RP is a byproduct of simply fielding a team and letting time pass — it's not tied to match results or ticket sales at all. That means the "quality" investment (training players, courting sponsors, growing your fanbase) never stalls out just because gate receipts were thin one week; cash instead gates the "capacity" layer (which facilities exist, how big your roster is, which stars you can afford to sign).

### 4.4 Player stats and training
- **5 core stats:** Kick, Speed, Tech, Body, Keeper — plus Stamina governing in-match fatigue.
- **Talent/type system:** each player has a talent (Bodybuilder → high Body, Speedster → high Speed, Striker, Technician, Fantasista, Free, Defender, Kid, etc.) that reweights how fast different stats grow from the *same* training session.
- **Max level 30.** Even an "Average" potential player can reach roughly 300 combined stats with full training; Exceptional/World Class/Superstar tiers scale far higher.
- **Position ranking** uses a letter grade (roughly S–F) per player per position.
- **Training** — Special Practice lets you pick 3 players at once per session; 20 documented exercises, unlocked across four tracks: initially available (4 exercises), won from beating a specific themed opponent team (Blowfish, Burrowers, Treefrogs, Hamsters, Poison Oaks, Hipsters — funny animal-team names doubling as unlock gates), via Coach Lecture fan-activity ranks E through S, costing anywhere from 7 RP (Flutter Kicks) up to 135 RP (Bargain Sale).
- **Diminishing returns are built in:** the higher a stat already is, the less a training session adds — a real mechanical incentive to spread training across the roster instead of stacking one star.
- **No confirmed aging or retirement mechanic.** I found no source describing players declining, aging out, or retiring in Pocket League Story — this appears to be absent, unlike Kairosoft's life-sim titles (e.g. their apartment-management games where tenants visibly age and retire). The only age-related rule found is a maximum *hiring* age of 30 (an acquisition filter, not a career arc).

### 4.5 Facilities / building
See 4.2 for costs. Facilities also have a **Low/Normal/High "player efficacy" tier** that governs how fast a visiting player's personal Aura gauge fills (see 4.10).

### 4.6 Hiring / scouting
- Sponsors and Fan Activities are literally *how you discover* hireable players — there's no static shop list. The **Soccer Camp** fan activity, as its rank climbs from F to A, reveals specific named prospects one at a time (e.g. Manning R at rank F, up through Callahan M at 50 RP spent to reach rank A). Scouting is therefore a resource-spend puzzle, not a menu.
- Hiring itself is a persuasion roll with a visible letter-grade outcome (see 4.2); fame and team rank both improve success odds.
- **Coaches** are unlocked via the "Autograph Event" fan activity; each new coach hired also permanently unlocks one of the game's 33 formations, staggering strategic depth behind a hiring decision instead of front-loading it all.

### 4.7 League / promotion structure
- A unified **10-tier team Rank ladder**, driven by an "Evaluation" stat: 1 Unknown → 2 Beginner (Eval. 25) → 3 Local (50) → 4 Amateur (100) → 5 Regional (125) → 6 Pro (200) → 7 Veteran (350) → 8 World Class (450) → 9 Galaxy Class (550) → 10 Soccer Deity (650). Each rank-up unlocks specific new sponsors and facilities.
- Separately, **League Matches** are round-robin, and becoming league champion unlocks access to the next league tier. **Cup Matches** run in parallel and come in two formats — single one-on-one matches, or multi-match tournaments — and are explicitly framed as good training for league play (lower stakes, similar reward logic).
- Total campaign length: **8 years, 4 months.** A New Game+ restart afterward keeps your players, coaches, and their trained stats.

### 4.8 Fans / popularity
- **4 team-wide stats**, all fed by the same core actions (winning matches, signing sponsors, running fan activities):
  - **Evaluation** — drives your rank on the ladder above.
  - **Fans** — increases ticket and merchandise income.
  - **Support** — speeds up how fast a knocked-down player's Aura gauge fills mid-match.
  - **Fame** — makes player and sponsor negotiations easier.
- Because every core loop action feeds this same small stat family, there's effectively no "wasted" action — winning, recruiting, and fan-activity spend all point at the same four numbers.

### 4.9 Difficulty curve
- Multiple independent reviews describe Pocket League Story as nearly impossible to lose or go broke once the loop clicks — one review states plainly "there's no real way to fail... success is simply a matter of grinding away." This is the most forgiving of the three franchises researched here.
- The mechanics behind that: salaries only apply to *played* matches (never a cost for benched depth), RP flows in ambiently regardless of match results, and match income has a guaranteed floor. Together they remove most bankruptcy tension almost entirely.
- **Design contrast worth noting:** Game Dev Story and Grand Prix Story both preserve some real (if softened, one-time-bailout) bankruptcy tension. Pocket League Story instead leans on collection/completion — all the named players, formations, sponsors, and facilities to unlock — as its late-game hook, rather than financial risk. That's a deliberate tradeoff to keep in mind: removing money stress entirely isn't free, it shifts the "why keep playing" question onto content completeness instead.

### 4.10 Match presentation
- **Viewpoint:** an overhead/top-down 2D pixel-art pitch in Kairosoft's house sprite style.
- **Speed / skippability:** after kickoff, the match plays itself automatically — "you sit back and watch your team play" — with players moving, passing, and shooting according to an AI resolving stats + formation + chosen strategy. I found no explicit fast-forward/skip control documented for this first game (Fast Mode as a feature is noted as unlocking only after finishing the whole campaign).
- **Player actions during a match:** before kickoff, choose formation and starting XI; during the match, toggle team strategy between **Normal / Short Pass / Long Pass** via a top-right control (Short Pass rewards high midfielder Speed/Tech, Long Pass rewards high forward Body); and manually trigger a filled **Aura** on whichever player is nearest the ball.
- **Halftime:** a full window to swap strategy and make unlimited substitutions before the second half.
- **Simplifications:** no offside rule and no fouls exist in this simulation — a deliberate readability/pace choice over realism.
- **Reviewer critique (TouchArcade):** watching matches gets old after a few hours — described as "not very stimulating to watch" and the weakest link compared to Kairosoft's more input-dense titles. Worth treating as a cautionary note: an automated sports-match spectacle needs enough moment-to-moment player agency, or it wears thin.
- **I could not verify a distinct "cheer/encourage" tap mechanic** separate from the strategy toggle and aura-trigger described above. Every source describing in-match player interaction mentions only those two input types. If a dedicated cheer button exists, it wasn't documented in any source I found — worth keeping as an open question rather than assuming it's there.

### 4.11 Special / unique mechanics
- **Auras ("limit break"-style):** a personal meter per player that fills either ambiently (from facility visits, at a speed set by that facility's Low/Normal/High tier) or in-match when the player is knocked down — which itself requires a *low* Body stat to trigger, an interesting inversion where your less physically dominant players are the ones who proc the mechanic. A full aura shows as a flame effect and grants boosted speed, kick range, pass accuracy, and tackle resistance until halftime, a goal, or full time. Only the player nearest the ball can activate it, and — notably — **CPU opponents never use auras at all**, making this a purely player-favoring asymmetric mechanic.
- **33 formations, unlocked one per coach hired** — team-building depth is deliberately staggered behind hiring decisions rather than available from day one.
- **Fan Activities as a universal unlock hub:** a single RP-spend action type (running a fan activity, ranking it up) is the trigger that reveals new sponsors, players, coaches, cups, facilities, *and* training methods — every other system's content gate routes through this one mechanic.

---

## 5. Pocket League Story 2 (2016)

Went free-to-download with ads and IAP (the original was a paid premium app), added a premium currency, and was the first Kairosoft game with real online multiplayer.

### 5.1 What changed at a system level
- Deliberately **slowed the match simulation pace** versus the original, specifically to give the player more room to react mid-match with substitutions and formation changes — reviewers describe this as calmer and more strategic, but with less of the original's "boisterous energy."
- Added **weather effects**, **penalty shootouts** (confirmed via a skill that boosts "penalty shootout accuracy"), and per some reviews, a card system (yellow/red, unconfirmed in detail).
- Added **real-time online multiplayer**, unlocked once your team reaches rank 5, connected via 9-digit friend codes.
- Squad cap raised from 30 to **40 players**.

### 5.2 Money sources
- **Match income**, scaling by competition tier (same figures as quoted in 4.1): Amateur League 3,000G, Novice Cup 5,000G, Regional League 7,500G, King Cup 8,000G+, with a +3,000G bonus for a 4+ goal win margin and a roughly 1,000G guaranteed floor.
- **Sponsors** now pay per-match at a rate that scales with the sponsor's own level (max level 10) — e.g. level-1 payments range from 10G (Wairo Foundation) to 63G (Aerospace Co.), while max-level sponsors pay up to 500G (Kairo Inc.). Signing bonuses scale hugely by tier too: 1,000G for early sponsors up to **50,000G** for endgame sponsors (Banana Gardens, KoalaNet).
- **Facility income** — e.g. a level-3 Parking Lot costs 6,550G to build and yields roughly 1,000G/year; a Gift Shop costs 3,000G and yields "hundreds" of Gold per match in merchandise.

### 5.3 Money sinks and the new currency split
- **Hiring:** 2,000G+ per negotiation attempt, scaling up for star players.
- **Facility construction/upgrades:** same shape as the original, priced in Gold.
- **Training** now draws on a separate resource pool called **"light bulbs"** (functionally this generation's RP), earned identically to the original — from facility use.
- **Hearts** — a new currency, earned via the coach's "Use Facilities" tactic (and passively, scaled by coach salary/output). Spent on sponsor negotiation and on buying **skill items** from the shop (e.g. "The Striker's Bible," 20 Hearts, teaches the Kick Up skill for +30 Kick; "Push Your Limits," 35 Hearts, teaches Ultra Stamina for +100 Stamina).
- **Coins** — the premium currency. Used for higher-tier sponsor negotiation (up to 153 Coins for the Drug Company) and for Category Change items (10–40 Coins).
- **Design pattern:** this splits the original's one clean RP pool into a soft "played the game" currency (light bulbs, Hearts — both earned by normal play) plus a hard monetization currency (Coins), while Gold remains the everyday spend. It's the same F2P currency-forking shape seen in Grand Prix Story 2 (section 3.1), just less extreme.

### 5.4 Player stats and categories (far more granular than the original)
- Same 5 core stats plus Stamina, but **"Categories"** (talent types) now have exact documented Influence multipliers *and* hard training-stat caps:

| Category | Stat influence | Training caps (example stats) |
|---|---|---|
| Average (1★) | 100% all stats | Stamina 133, Kick/Speed/Tech/Body 399 each, Keeper 51 |
| Exceptional (2★) | ~138–139% outfield, 100% Keeper | Stamina 184, others 558 |
| World Class (4★) | 163% outfield, 100% Keeper | Stamina 217, others 662 |
| Striker | Kick 208%, Body 158%, Stamina only 74% | — |
| Bodybuilder | Body 221%, Speed only 80% | — |
| Technician | Tech 236%, Body only 88% | — |
| Speedster | Speed 236%, Tech 132% | — |
| Defender | Body 235%, Tech 146% | — |
| Fantasista (5★) | Tech 225%, Kick 186%, all stats 152%+ (best all-rounder) | — |
| Superstar (4★) | Flat 208% across all outfield stats | — |
| Free | Keeper 1007% (!), Kick 171%, Body only 100% — absurd if played in goal despite being an outfield-flavored type | — |
| Average GK → Superstar GK | Speed influence scales hardest: 100% → 201% (Exceptional) → 303% (Spider) → 405% (World Class) → 507% (Superstar) | — |
| Showboat / Kid | Weak stats generally; Showboat brings a large new-fan bump on signing — a pure "fun/collection" signing rather than a competitive one | — |

- Categories appear to be **permanent per player** — no confirmed talent-swap mechanic (a separate "Category Change" shop item exists for level-20+ players, but likely changes something else, such as position; worth verifying in-engine rather than assuming it re-rolls talent).
- Community tips explicitly flag "don't train Average category players" because of the hard caps above — the game telegraphs a clear optimization path (chase Exceptional-or-better rarity) rather than treating all builds as equally viable long-term.

### 5.5 Team chemistry: the "Compatibilities" system (the standout mechanic to steal)
- **6 training categories** (Stamina, Kick, Speed, Tech, Body, Keeper), each with its own lookup table of 3-player-category combinations that grant a training-yield bonus.
- Bonuses range **+15% to +60%** for outfield training, up to **+80%** for Keeper training.
- Example combos: Fantasista + Average + Superstar = +60% Stamina training; Speedster + Striker + Defender = +55% Kick training; Fantasista + Fantasista + Fantasista (stacking three of the *same* rare category) = +55% Speed training; Superstar + Free + Technician = +60% Tech training; Super GK + Technician + Spider = +80% Keeper training.
- The bonus applies to **whatever training you actually run** with that trio, even stats the training session doesn't normally touch — so assembling the right 3-player group for Special Practice becomes its own metagame, independent of your actual match-day lineup.
- Only **one** compatibility bonus applies per session (no stacking multiple matches at once), so there's a single "best possible trio" to hunt for rather than infinite exponential stacking.

### 5.6 Skills system (extends the original's aura-only special-move layer)
- Items teach **permanent skills**, tiered 1–5 stars: 1-star flat stat adds (+30, e.g. Body Up/Kick Up/Speed Up/Stamina Up) scaling up to 3-star (+100 flat, e.g. Ultra Stamina/Ultra Kick/Ultra Body), plus named specialist skills — **Captain** (boosts *all* stats), **Longshot** (extended shooting range), **Raging Bull** (trades Speed for tackle power), **Ace** (forward-only), **Iron Wall** (keeper-only), **Sharpshooter** (boosts penalty shootout accuracy, confirming penalties exist), **Roulette** (a special dribble move).
- **Rare cosmetic "Headgear" items** transform a player's model *and* grant a flat all-stats percentage: Headgear N/W +5%, A/B +10%, C +12%, K +15%, S +20% — tying a pure collectible/cosmetic reward directly to real power, a strong retention hook.
- **Optimization tip from the community:** strip your own flat stat-boost skills (Captain, Ultra Kick) before a training session, because — same diminishing-returns rule as the original game — higher current stats mean lower training yield. Skills that artificially inflate current stats actively hurt training efficiency, so players re-equip them only after training. This looks like an emergent interaction the designers left in rather than patched around.

### 5.7 Formations
- **43 total** (up from 33), unlocked via: 5 starter formations available immediately, coach hires (as before), a new **"Lucky Target Ticket"** gacha-style unlock track running 10 stages, and one fully customizable slot ("Free A/Free B") from a specific unlockable character (Sally Prin).

### 5.8 League / promotion structure
- **8 explicitly named league tiers** (unlike the original's single unified rank ladder): G (Amateur League) → F (Regional) → E (Western) → D (National Division II) → C (National Division I) → B (Snowfall/Northern League) → A (World League) → A+ (Kairo League). A higher grade opens each time you win the championship of the current one.
- **Anti-snowball rule (new):** beating a team by 4+ goals bumps *their* Evaluation by roughly 35% — meaning your future rematches against that team get harder, not easier. This wasn't documented for the original game and looks like a deliberate fix to keep late-game league play from going stale after you've out-leveled everyone.
- **3 concurrent match formats:** League Tournament (round robin vs. the whole league), Tournament Cups (single-elimination bracket), Exhibition (one-off friendlies).
- **Sponsors:** up to **3 concurrent main sponsors** (more generous than the original's cap), with unlimited minor/total sponsors beyond that.

### 5.9 Fan activities (7, richer than the original's list)
Cleanup, Autograph Event, Soccer Camp, Coach Lecture, Exhibition Tour, Team Facilities, Fan Appreciation — each with its own Hearts cost curve per rank and its own unlock gate (an evaluation-rank threshold, or beating a specific rival team), each revealing a different content type (sponsors / players / coaches / cup matches / facilities / coin rewards respectively). **Fan Appreciation** (unlocked after beating National Division I) pays out in **Coins** — premium currency — instead of unlocking new content, a nice full-circle "your fanbase now funds your premium-currency needs" moment late in the game.

### 5.10 Difficulty curve
- Same core forgiveness as the original (per-match-only salaries, ambient RP/light-bulb income), but the hard stat-cap-by-category table (5.4) gives the game a much stronger "build actually matters" signal than the original had — average-category players are explicitly bad long-term investments by design, not just slightly worse.

---

## Top 15 mechanics to adapt for a soccer club sim with superpowered players

1. **Per-match-only wages.** Charge salary only for players actually fielded that match (e.g. $500 × player level, deducted on lineup lock), not for the whole roster. Bench depth becomes free, so squad-building isn't punished — only who you *start* costs anything. (Pocket League Story 1)

2. **An ambient, facility-driven secondary currency.** Every hero on the roster passively generates a small amount of a training resource just by being on the team between matches (not tied to match results or ticket sales at all). This decouples "am I improving my roster" from "did we win the gate money this week." (Pocket League Story 1's RP / Game Dev Story's Research Data)

3. **Split that secondary currency into 2–3 named flavors tied to facility type** (e.g. "Power" from a Gym, "Tactics" from a Film Room, "Spirit" from a Rec Room). Gate specific training moves behind specific flavors so players are pushed to diversify their facility build instead of maxing one building and spamming it. (Pocket League Story 1's Arm/Field/Bulb RP)

4. **A personal "Hero Gauge" limit-break meter, player-favoring only.** Fill it from facility visits and/or getting knocked down in-match; let the player manually trigger it on whoever's closest to the ball for a temporary burst (speed, shot power, tackle immunity) until halftime/goal/full-time. Deliberately never give the CPU access to it — keeps the mechanic feeling like a reward, not a fair fight. Superpowers make this an even more natural fit than it was for a plain soccer sim. (Pocket League Story 1's Auras)

5. **3-hero training-compatibility combos.** Build a lookup table where specific trios of hero archetypes training together grant a training-yield bonus (+15% to +60%, capping at maybe +80% for the rarest matchups), applying to whatever stat you're training regardless of whether the combo "matches" it. Creates a squad-assembly puzzle independent of match-day lineup. (Pocket League Story 2 Compatibilities)

6. **Publish hard stat-cap tables per hero archetype.** Give each power-type (Brawler, Speedster, Technician, all-rounder, goalkeeper-specialist) an explicit ceiling per stat, visible to the player, so build identity is real and "optimize" has a legible floor and ceiling rather than everyone converging on one best build. (Pocket League Story 2 Categories)

7. **A legacy/successor snowball for retired or graduated heroes.** When a star hero's career winds down (or "graduates" from a youth academy), let their replacement recruit start with a stat head-start proportional to how good the outgoing hero was. Rewards sustained investment in one position/role across many seasons instead of resetting to zero. (Game Dev Story's Hall of Fame → sequel bonus)

8. **Guarantee Year 1 can't bankrupt the player.** Cover the first season's full payroll as a "league subsidy" or "startup grant," and offer a low-skill guaranteed-income option (friendlies/youth clinics) alongside real competitive matches, purely so a new manager cannot lose the game before they've learned it. (Game Dev Story's government-covered Year 1 + easy contract income)

9. **Twice-yearly sponsor settlement tied to an accumulating performance score.** Instead of a flat per-match sponsor check, have sponsors track a "Buzz" or "Hype" score built from match performance over each half-season, then pay out — and potentially level up — at two fixed calendar checkpoints per year. Gives the season two clear financial beats instead of one continuous, forgettable trickle. (Grand Prix Story's Ad Effect / M1-M7 settlement)

10. **A relocatable, adjacency-bonus facility layout puzzle.** Let decorative/environment buildings buff nearby production buildings by tile proximity (100% adjacent, 50% diagonal, 25% one further out), and make key training buildings physically moveable so players actively reposition them between training phases (e.g. scouting → power awakening → tactical drilling) to always sit next to the best current buff. Turns facility placement into a recurring active decision instead of a one-time layout. (Grand Prix Story 2)

11. **Two salary models for two player-value tiers.** Give role players a cheap flat seasonal wage, but make marquee superpowered stars renew **weekly** at a percentage of their original signing cost — an ongoing "rent" the player actively feels and has to keep affording, versus a flat set-and-forget cost for depth players. (Grand Prix Story 2's weekly driver renewal vs. Grand Prix Story 1's flat annual salary)

12. **Gate scouting behind fan-engagement activities, not a static transfer list.** Run community events (youth camps, exhibitions, charity matches) that reveal one named prospect at a time as the activity's rank climbs, funded by RP/Hearts rather than cash. Makes fan engagement mechanically load-bearing instead of just a flavor stat, and turns scouting into a resource-spend decision. (Pocket League Story 1 & 2's Soccer Camp / Autograph Event)

13. **Anti-snowball scaling on blowout wins.** When the player beats a weak rival by a wide margin, boost that rival's rating by roughly a third for next time, so grinding easy opponents doesn't leave the whole league trivial by mid-game. Cheap to implement, meaningfully extends late-game challenge. (Pocket League Story 2)

14. **A rotating shop of one-time "Move Manual" items that teach permanent skills.** Separate from stat training — buying and using an item permanently grants a named special move or passive (e.g. a manual that teaches an overhead-kick shot-power skill, or a keeper-specific reflex skill), priced in the soft social currency, with rare cosmetic versions that also grant a small flat all-stats bonus so collectibles matter mechanically. (Pocket League Story 2 Items/Skills)

15. **Keep the core loop's currency family small and single-purpose.** Pocket League Story 1 runs its entire meta-progression off exactly four stats (Evaluation → rank gate, Fans → ticket/merch income, Support → faster hero-gauge fill, Fame → cheaper negotiation), each fed by the same core actions and each used in exactly one place. Resist forking this into F2P-style currency sprawl (see Grand Prix Story 2's six resources, or Pocket League Story 2's Gold/Hearts/Coins/light-bulbs) until there's a specific monetization or pacing reason to — sprawl adds friction faster than it adds depth.

---

## Sources

- [Pocket League Story - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Pocket_League_Story)
- [Pocket League Story 2 - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Pocket_League_Story_2)
- [Training (Pocket League Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Training_(Pocket_League_Story))
- [Facilities (Pocket League Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Facilities_(Pocket_League_Story))
- [Players (Pocket League Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Players_(Pocket_League_Story))
- [Sponsors (Pocket League Story) - Kairosoft Wiki | Fandom](https://kairosoft.fandom.com/wiki/Sponsors_(Pocket_League_Story))
- [Matches (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Matches_(Pocket_League_Story_2))
- [Sponsors (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Sponsors_(Pocket_League_Story_2))
- [Fan activities (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Fan_activities_(Pocket_League_Story_2))
- [Players (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Players_(Pocket_League_Story_2))
- [Categories (Pocket League Story 2) - Kairosoft Wiki | Fandom](https://kairosoft.fandom.com/wiki/Categories_(Pocket_League_Story_2))
- [Compatibilities (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Compatibilities_(Pocket_League_Story_2))
- [Formations (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Formations_(Pocket_League_Story_2))
- [Items (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Items_(Pocket_League_Story_2))
- [Tips (Pocket League Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Tips_(Pocket_League_Story_2))
- ['Pocket League Story' Review – Kairosoft Hits the Football Pitch – TouchArcade](https://toucharcade.com/2012/01/09/pocket-league-story-review/)
- [Pocket League Story 2 Review | Pocket Gamer](https://www.pocketgamer.com/pocket-league-story-2/review/)
- [A beginners' guide to Kairosoft's football manage-'em-up Pocket League Story | Pocket Gamer](https://www.pocketgamer.com/pocket-league-story/a-beginners-guide-to-kairosofts-football-manage-em-up-pocket-league-story/)
- [Pocket League Story Walkthrough – Gamezebo](https://www.gamezebo.com/walkthroughs/pocket-league-story-walkthrough/)
- [Review: Pocket League Story (iPhone) | PIXEL SPORT](https://pixelsport.wordpress.com/2012/01/29/review-pocket-league-story-iphone/)
- [Pocket League Story guide - Esports News UK](https://esports-news.co.uk/2013/04/05/pocket-league-story-guide/)
- [Pocket League Story 2 starter Guide - GameplayInside](https://www.gameplayinside.com/android/pocket-league-story-2-starter-guide/)
- [Game Dev Story - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Game_Dev_Story)
- [Employees (Game Dev Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Employees_(Game_Dev_Story))
- [Creating games (Game Dev Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Creating_games_(Game_Dev_Story))
- [Careers (Game Dev Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Careers_(Game_Dev_Story))
- [Tips (Game Dev Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Tips_(Game_Dev_Story))
- [Grand Prix Story - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Grand_Prix_Story)
- [Sponsors (Grand Prix Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Sponsors_(Grand_Prix_Story))
- [Staff (Grand Prix Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Staff_(Grand_Prix_Story))
- [Tips (Grand Prix Story) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Tips_(Grand_Prix_Story))
- [Endgame (Grand Prix Story) - Kairosoft Wiki | Fandom](https://kairosoft.fandom.com/wiki/Endgame_(Grand_Prix_Story))
- [A beginners' guide to Kairosoft's racing team management simulation Grand Prix Story | Pocket Gamer](https://www.pocketgamer.com/grand-prix-story/a-beginners-guide-to-kairosofts-racing-team-management-simulation-grand-prix-sto/)
- [Grand Prix Story 2 - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Grand_Prix_Story_2)
- [Resources (Grand Prix Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Resources_(Grand_Prix_Story_2))
- [Structures (Grand Prix Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Structures_(Grand_Prix_Story_2))
- [Vehicles (Grand Prix Story 2) - Kairosoft Wiki | Fandom](https://kairosoft.fandom.com/wiki/Vehicles_(Grand_Prix_Story_2))
- [Staff (Grand Prix Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Staff_(Grand_Prix_Story_2))
- [Tips (Grand Prix Story 2) - The Kairosoft Wiki](https://kairosoft.wiki.gg/wiki/Tips_(Grand_Prix_Story_2))
