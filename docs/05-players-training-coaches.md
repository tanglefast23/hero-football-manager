# 05 — Players, Training & Coaches

## Player anatomy

- **Identity**: procedurally generated name + look (skin tone, hair, facial hair, glasses/accessories, body type: slim/normal/heavy/muscular, height: short/normal/tall). Looks are cosmetic *flavor* except body type nudging awakening weights (doc 04).
- **Stats**: PAC / SHO (REF for GKs) / PAS / DEF / TEC / STA, 1–99.
- **Archetype** (visible): Speedster, Sniper, Playmaker, Anchor, Wall, Engine, All-Rounder, Prodigy — each has stat-growth multipliers and the **cap shape** below (Pocket League Story 2's proven "build identity" pattern). Individual potential sets the height of a player's personal caps; archetype redistributes that ceiling so, for example, a Speedster still peaks higher in PAC than SHO. Actual personal caps are shown in the player file — informed investment, no wasted training. Existing exceptional or legacy players above a personal cap keep that rating but cannot train it higher.

| Archetype | PAC | SHO | PAS | DEF | TEC | STA | REF |
|---|---:|---:|---:|---:|---:|---:|---:|
| Speedster | 95 | 70 | 82 | 68 | 84 | 88 | 60 |
| Sniper | 82 | 95 | 80 | 65 | 90 | 82 | 55 |
| Playmaker | 82 | 78 | 95 | 74 | 95 | 86 | 65 |
| Anchor | 76 | 68 | 84 | 95 | 82 | 90 | 75 |
| Wall | 70 | 60 | 76 | 95 | 78 | 90 | 95 |
| Engine | 90 | 80 | 88 | 84 | 86 | 95 | 65 |
| All-Rounder | 88 | 88 | 88 | 88 | 88 | 88 | 88 |
| Prodigy | 99 | 99 | 99 | 99 | 99 | 99 | 99 |
- **Current rating**: the rounded average of the six attributes the role can use. Outfield players use SHO and ignore REF; goalkeepers use REF and ignore SHO.
- **Potential**: a permanent grade from **A+** through **F−** based on the role-aware overall the player reaches when every personal cap is full. Normal training raises the current rating toward that ceiling but never lowers or rerolls the grade. The player file also shows the exact projected maximum.

| Grade | Projected max | Grade | Projected max | Grade | Projected max |
|---|---:|---|---:|---|---:|
| A+ | 97–99 | A | 94–96 | A− | 91–93 |
| B+ | 88–90 | B | 85–87 | B− | 82–84 |
| C+ | 79–81 | C | 76–78 | C− | 73–75 |
| D+ | 70–72 | D | 67–69 | D− | 64–66 |
| E+ | 61–63 | E | 58–60 | E− | 55–57 |
| F+ | 52–54 | F | 49–51 | F− | 48 or below |

- **Potential progression**: the scale is absolute across the whole game. Higher divisions and stronger scouting pools contain better potential distributions; promotion changes who can be found, not what an A or C means.
- **Hidden**: the coarse scouting/valuation tier behind the grade, consistency, personality (see below).
- **Personality** (visible after a few weeks): Fiery, Loyal, Greedy, Joker, Professional, Timid — drives event outcomes, negotiation behavior, morale swings.
- **State**: age, morale, condition/stamina, injury status, contract (wage, seasons left), fame, power (or none).

## Growth & aging

- **Age curve**: 16–23 fast growth (training ×1.5), 24–29 prime (×1.0), 30+ decline (−1 to −3 PAC/STA per season, training ×0.6). Retirement announced at 33–38 (personality-weighted).
- **Match XP**: minutes played grant small position-relevant gains — playing your kids matters.
- **Legacy system**: when a club legend (5+ seasons, high fame) retires, choose one: they become a **coach candidate**, or they mentor a youth intake who arrives with +15% starting stats and the legend's archetype ("the new Flint kid"). Long-service investment pays forward (Game Dev Story's hall-of-fame snowball, adapted).
- **Visual identity**: 193 stable player looks ship across portraits and match sprites (168 outfield, 25 goalkeeper). All 160 launch-league players are distinct; later youth, academy, and transfer players retain the same deterministic face everywhere they appear. The pool combines structural face/hair silhouettes with restrained skin, predominantly natural hair colour, a small curated set of vivid dyes and bleach treatments, jewellery, scars, facial hair, and hairline variants under [11-art-style.md](11-art-style.md). Twenty historical and nine present-day football silhouettes provide loose visual inspiration, but the shipped identities remain fictional and use no real names, badges, or exact portrait copies.

## Training (the TP loop)

Weekly plan, set once and it repeats until changed:

- **Free base layer**: every player automatically runs Basic Conditioning each week — small, free gains. Nobody ever stagnates completely.
- **Focus drills (the TP decision)**: pick up to **3 squad-wide focus drills** per week. Money is charged for each assigned player who can gain from that drill; TP is charged once per selected drill, and capped player/drill pairs are skipped. The seven single-stat paths are Sprints→PAC, Finishing→SHO, Rondo→PAS, Duels→DEF, First Touch→TEC, Circuit→STA, and Keeper Drills→REF. Each path has I/II/III tiers worth +3/+5/+8 base gain; only one tier from the same path may be selected in a plan. Tier I starts unlocked in D5, Tier II unlocks permanently after reaching D4, and Tier III unlocks permanently after reaching D2.
- **Cap-safe plans**: a capped player no longer rejects the whole plan. That player skips only the capped drill, useful player/drill pairs still train, and the manager receives a one-shot inbox warning naming the player and drill so the repeating plan can be adjusted. A drill with no eligible assigned players is not charged that week.
- **TP income**: match results award no TP. A fresh career starts with 30 TP and an operational Level 1 Training Pitch; improvement income then arrives after every weekly settlement from completed Training Pitches (**+10 TP per facility level**) and employed coaches (head coach **10 + 2× level**, assistant **5 + level**), plus explicit event effects. A Level 1 pitch alone therefore funds one basic 10-TP drill every week. Losing never slows training income, while hiring and upgrading staff or grounds creates a visible development budget.
- **Gain formula**: `base gain × archetype multiplier × facility level (1.0–2.0) × coach bonus × age curve × diminishing returns (higher current stat = smaller gains)`.
- **Stamina price**: training drains condition; overtraining (condition < 30%) risks injury (2–6 weeks). The Medical Bay facility shortens recoveries.
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
- **Selling**: list a player; AI clubs bid within a valuation band: `f(stats total, age curve, potential, power tier ×4–8, contract seasons left, your division)`. Trained-up players sold at peak age are a legitimate money engine (user-locked decision: player sales are a core income).
- **Youth intake**: 1–2 random 16–17 year olds offered each pre-season for a small signing bonus; quality scales with your Youth Field facility.

## Roster rules

- Every generated launch club carries **16 players**: 2 GK, 5 DEF, 5 MID, 4 FWD. Story onboarding deliberately trims the user's club before adding the created player, so the playable story begins at **15/17** with one place reserved for Week 3 Youth and one for the first scout target. Matchday: 11 starters + 5 bench players, with a maximum of 3 substitutions. Future Dorm upgrades may raise the broader career squad cap, but never the in-match substitution limit.
- Morale: fed by wins, playing time, fair wages, event outcomes. Low morale = stat penalty ±10% and transfer-request risk.
