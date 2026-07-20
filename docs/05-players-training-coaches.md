# 05 — Players, Training & Coaches

## Player anatomy

- **Identity**: procedurally generated name + look (skin tone, hair, facial hair, glasses/accessories, body type: slim/normal/heavy/muscular, height: short/normal/tall). Looks are cosmetic *flavor* except body type nudging awakening weights (doc 04).
- **Stats**: PAC / SHO (REF for GKs) / PAS / DEF / TEC / STA, 1–99.
- **Archetype** (visible): Speedster, Sniper, Playmaker, Anchor, Wall, Engine, All-Rounder, Prodigy — each has stat-growth multipliers and the **hard per-stat training caps** below (Pocket League Story 2's proven "build identity" pattern). Caps are shown to the player — informed investment, no wasted training. Existing exceptional or legacy players above a cap keep that rating but cannot train it higher.

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
- **Hidden**: potential (1–5★, revealed by scouting level), consistency, personality (see below).
- **Personality** (visible after a few weeks): Fiery, Loyal, Greedy, Joker, Professional, Timid — drives event outcomes, negotiation behavior, morale swings.
- **State**: age, morale, condition/stamina, injury status, contract (wage, seasons left), fame, power (or none).

## Growth & aging

- **Age curve**: 16–23 fast growth (training ×1.5), 24–29 prime (×1.0), 30+ decline (−1 to −3 PAC/STA per season, training ×0.6). Retirement announced at 33–38 (personality-weighted).
- **Match XP**: minutes played grant small position-relevant gains — playing your kids matters.
- **Legacy system**: when a club legend (5+ seasons, high fame) retires, choose one: they become a **coach candidate**, or they mentor a youth intake who arrives with +15% starting stats and the legend's archetype ("the new Flint kid"). Long-service investment pays forward (Game Dev Story's hall-of-fame snowball, adapted).

## Training (the TP loop)

Weekly plan, set once and it repeats until changed:

- **Free base layer**: every player automatically runs Basic Conditioning each week — small, free gains. Nobody ever stagnates completely.
- **Focus drills (the TP decision)**: pick up to **3 squad-wide focus drills** per week; each costs Money + TP once and applies to every player you assign to it. Drills map to stats (Sprints→PAC, Finishing→SHO, Rondo→PAS+TEC, Duels→DEF, Circuit→STA, Keeper Drills→REF). Choosing *which three* is the weekly puzzle.
- **TP income**: win 30, draw 20, loss 14, +2 per goal, +10 man-of-the-match, +5 ambient from facilities. The win/loss gap is deliberately narrow (~2:1) — losing slows you down, it never buries you (cozy pillar). Tuning target for the harness: an average club affords ~2 of 3 focus drills per week.
- **Gain formula**: `base gain × archetype multiplier × facility level (1.0–2.0) × coach bonus × age curve × diminishing returns (higher current stat = smaller gains)`.
- **Stamina price**: training drains condition; overtraining (condition < 30%) risks injury (2–6 weeks). The Medical Bay facility shortens recoveries.
- **Chemistry trios** (Pocket League Story 2's standout mechanic, adapted): specific 3-archetype combinations training together grant +15% to +60% gains for the whole trio (e.g. Speedster + Sniper + Playmaker = +40% attack drills). Combos are discoverable in-game and collectible in a Chemistry Codex. One combo bonus per week.

## Coaches

Exactly **one head coach** may be employed at a time (assistant slot unlocks with the Coaching Office facility). The current coach must be dismissed before another Hire action is available. Dismissal is a deliberate two-step process and costs exactly **one week of that coach's wage** as severance, paid immediately.

- **Profile**: two specialties from {Attack, Defense, Fitness, Technique, Goalkeeping, Motivator}, level 1–5, weekly wage, personality.
- **Effects**: +10%/level training gains in specialty drills; tactic execution quality in matches (how tightly agents follow the chosen tactic); Motivator specialty slows morale decay and speeds Hero Gauge fill +5%/level.
- **Unlocks**: selected coach candidates permanently teach one formation or advanced drill (Pocket League Story's "coach = content gate" pattern). The current validated tactical unlock is 4-3-3 and appears on only one candidate; after it is learned, later markets do not re-offer it. The engine-only 3-5-2 and 4-5-1 shapes remain hidden because the current balance sweep makes them trap choices.
- **Market**: 3–5 candidates refresh each pre-season; better coaches gated by division + fame. Coaches gain 1 level per 2 full seasons employed. Retired club legends appear as candidates with loyalty discounts.
- **Identity, age & portraits**: launch ships 32 curated multicultural coaches, each hired at age 30–60 with a deterministic resting/joy portrait, a distinct staff-only touchline wardrobe (formal, smart-casual, training, or weatherwear), visible age-band cues, and one unmistakable caricature trait under the respectful rules in [11-art-style.md](11-art-style.md). The pool begins with Amara Okafor, Kenji Sato, Valentina Cruz, Imani Adeyemi, Freja Lindholm, Priya Nair, Mateo Silva, Hana Park, Leila Haddad, Nia Thompson, Tomás Ferreira, Aiko Tanaka, Sibusiso Dlamini, Sofia Rossi, Jamal Rahman, and Mei Chen, then adds 16 equally authored identities. Gameplay specialties and quality remain deterministic and independent of ethnicity, age, clothing, or appearance.
- **Feedback contract**: a successful hire removes that candidate from the shortlist and opens a full staff card with portrait, name, level, specialties, and wage. Dismissal shows the exact severance before confirmation, then a filed departure card; only then does the vacancy accept another hire.

## Scouting & transfers

- **Scout missions**: pick a region + focus (position / age / "rumored hero"), pay 1,000–5,000, results in 2–3 weeks: a shortlist with fuzzy stats (ranges narrow with your Scout facility level). "Rumored hero" missions are expensive, Div 3+, and usually wrong — but sometimes find a pre-powered star.
- **Buying**: transfer fee to the club + contract negotiation with the player (doc 06). Transfer windows: pre-season + 2 weeks mid-season.
- **Selling**: list a player; AI clubs bid within a valuation band: `f(stats total, age curve, potential, power tier ×4–8, contract seasons left, your division)`. Trained-up players sold at peak age are a legitimate money engine (user-locked decision: player sales are a core income).
- **Youth intake**: 1–2 random 16–17 year olds offered each pre-season for a small signing bonus; quality scales with your Youth Field facility.

## Roster rules

- Every launch club carries **16 players**: 2 GK, 5 DEF, 5 MID, 4 FWD. Matchday: 11 starters + 5 bench players, with a maximum of 3 substitutions. Future Dorm upgrades may raise the broader career squad cap, but never the in-match substitution limit.
- Morale: fed by wins, playing time, fair wages, event outcomes. Low morale = stat penalty ±10% and transfer-request risk.
