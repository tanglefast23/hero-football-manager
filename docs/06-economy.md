# 06 — Economy

Design stance: **premium game, economy tuned purely for fun** (no monetization pressure). Two currencies, each with exactly one job — the research's clearest warning was currency sprawl, so every new resource idea must replace one of these, not join them.

| Currency | One job | Earned | Spent |
|---|---|---|---|
| **Money** | Capacity | Sponsors, tickets, prizes, player sales | Wages, transfers, facilities, scouting, events |
| **Training Points (TP)** | Improvement | Weekly facilities and coaches, plus explicit events | Focus drills |

Money is lumpy and stressful; TP flows steadily from investments in staff and grounds rather than match results. That separation keeps a losing run from starving player development. Heroes advance through awakenings and recruitment rather than a separate resource track.

## Income (all four, per user decision)

1. **Sponsors** — the backbone. 1 slot at start → 3 by fame tier. Each sponsor: monthly fee + season objective bonus ("finish top 3": +5,000) + a signing perk (cash advance, or unlocks a scout region/drill). Offers refresh each pre-season; better divisions and fame unlock better sponsors. A **Buzz meter** (goals, wins, hero moments) settles into a sponsor bonus twice per season (Grand Prix Story's twice-yearly settlement — two financial "paydays" beat a flat trickle).
2. **Tickets & fans** — every home match, league or Cup, earns its own gate: fans × attendance rate × ticket price. A double-header week can therefore show separate League and National Cup gate lines. Fans grow on wins, star heroes fielded, promotions; shrink slowly on losing streaks. Ticket price is settable (too high = attendance drops — a gentle lever, not a spreadsheet).
3. **Prize money** — league placement paid at season end + per-round cup prizes. Promotion pays a bonus.
4. **Player sales** — doc 05. The "training facilities print money" loop.

Post-match, an **itemized income statement** shows every line (tickets, sponsor fee, prize, merch trickle − wages) — Pocket League Story's transparent readout, kept.

## Expenses

Weekly wages (players + coach + staff), transfer fees, facility construction/upkeep, scouting missions, training money costs, event choices, loan interest.

## Salaries & contracts (user-locked design)

- **Weekly wages for everyone** (we deliberately rejected Pocket League Story's "pay only when fielded" — it removes the tension this game wants).
- Contracts run 1–3 seasons. At expiry: renewal negotiation or free exit.
- **Raises are structural**: renewal ask = current wage × (1 + growth since signing) × fame factor × personality (Greedy +20%, Loyal −10%).
- **The hero wage cliff**: awakened players keep their pre-awakening wage until renewal (locked-in bargain), then ask hero rates (×3–5). Contract timing around awakenings is a core strategic layer.
- Underpaid stars (wage < 70% of market): morale drain, transfer requests, rival poach offers.

### Negotiation (mood meter + card mini-game)

Numbers rule; the mini-game influences (user spec: helps, never fully decides).

1. Player/agent has a hidden ask and a visible **mood face** (angry → thrilled).
2. You offer wage + years + one perk (guaranteed starter, captaincy, training priority, jersey #10) — perks offset cash.
3. Up to 3 rounds. Each round you may play one **Pitch Card** from a dealt hand of 3 (Flattery, Trophy Promise, Hometown Ties, Money Talks, Straight Talk…). Card vs. personality match shifts mood one step (Joker loves Flattery; Professional hates it). **Hard cap: cards move the effective ask ±20% max** — a great pitch gets a discount, never a miracle.
4. Insulting offers (< 50% of ask) end talks and dent morale/fame.

## Facilities (the club grounds grid)

An 8×6 tile grid (expandable). Buildings: Training Pitch, Gym, Tech Center, Shooting Range, Keeper Court, Medical Bay, Dorm, Scout Office, Coaching Office, Youth Field, Fan Shop, and Stadium Stand tiers. Each: build cost, up to Lv3, small weekly upkeep.

Facility quality is promotion-gated: D5 clubs build Level 1, reaching D4 permanently unlocks Level 2, and reaching D2 permanently unlocks Level 3. Existing higher-level buildings from older saves remain operational, but further upgrades follow the earned ceiling.

The club owns **one works crew**, so only one build or upgrade project may run at once. Paying for a building starts construction and occupies its tiles immediately, but it produces **no benefit and no upkeep until completion**. An upgrade keeps the facility's current level active while work proceeds; the higher level begins only on completion. A completed Training Pitch creates **+10 TP per level each week**. Relocation is unavailable for the building under construction. Completion resolves at weekly settlement, appears in the Weekly Review with the finished building sprite, and uses the dedicated win fanfare.

| Facility group | Lv1 build | Lv2 upgrade | Lv3 upgrade |
|---|---:|---:|---:|
| Training Pitch, Gym, Dorm, Scout Office, Coaching Office, Fan Shop | 1 week | 1 week | 2 weeks |
| Tech Center, Shooting Range, Keeper Court, Medical Bay | 2 weeks | 2 weeks | 3 weeks |
| Youth Field, Stadium Stand | 3 weeks | 2 weeks | 3 weeks |

**Adjacency bonuses** (Grand Prix Story 2's stealable puzzle, simplified): certain pairings buff each other when adjacent (Gym+Dorm: +10% STA gains; Fan Shop+Stadium: +10% merch; Medical+Training Pitch: −20% injury odds). Buildings are **relocatable for a small fee**, so layout is a recurring optimization toy. Discovered pairings log into the Codex.

## First-pass tuning table (D5 · District League baseline — all numbers subject to the balance harness, doc 09)

| Item | Value |
|---|---|
| Starting cash / squad | 45,000 · 15/17 players after creating the rookie; head-coach vacancy filled through the market |
| Player wage (D5) | 150–400/wk (squad ≈ 3,200/wk) |
| Coach wage | 500/wk (Lv1) |
| Season 1 subsidy | League pays 50% of wages |
| Sponsor (D5, 1 slot) | 2,000/mo + 3,000–5,000 objective |
| Home gate (500 fans) | ≈ 1,200/match |
| Prize: D5 champion / runner-up | 20,000 / 10,000 |
| Cup: per round win / trophy | 2,000–8,000 / 25,000 |
| Facility Lv1 build | 5,000–15,000 |
| Focus drill (single-stat, max 3/week) | Tier I +3: 350–600 + 9–15 TP; Tier II +5: 700–1,000 + 18–25 TP; Tier III +8: 1,100–1,500 + 28–38 TP |
| Weekly TP income | Training Pitch +10/level; head coach 10 + 2× level; assistant 5 + level; match result +0 |
| Transfer (decent D5 player) | 5,000–15,000 |
| Pre-powered hero signing | 100,000+ + 2,500+/wk (Div 3 era) |
| Emergency loan | 20,000 once, 10%/season interest |

**Pressure curve targets**: Season 1 wages ≈ 60–70% of baseline income (tight but survivable); mid-game surplus flows to facilities and transfers; late game hero wages + stadium tiers keep money meaningful (Game Dev Story's "ultimate console" pattern — always one aspirational sink ahead of you).
