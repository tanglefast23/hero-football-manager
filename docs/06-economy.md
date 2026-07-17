# 06 — Economy

Design stance: **premium game, economy tuned purely for fun** (no monetization pressure). Three currencies, each with exactly one job — the research's clearest warning was currency sprawl, so every new resource idea must replace one of these, not join them.

| Currency | One job | Earned | Spent |
|---|---|---|---|
| **Money** | Capacity | Sponsors, tickets, prizes, player sales | Wages, transfers, facilities, scouting, events |
| **Training Points (TP)** | Improvement | Match results & performances (+small facility trickle) | Training drills, drill unlocks |
| **Hero Essence (HE)** | Hero progression | Power events, first-time hero feats, season awards | Power upgrades (Lv2/Lv3), Hero Lab attempts, power reroll (rare) |

Money is lumpy and stressful; TP flows steadily from playing; HE is precious (a few per season). That separation means a cash crisis never halts player development, and hero progression can't be bought with cash alone.

## Income (all four, per user decision)

1. **Sponsors** — the backbone. 1 slot at start → 3 by fame tier. Each sponsor: monthly fee + season objective bonus ("finish top 3": +5,000) + a signing perk (cash advance, or unlocks a scout region/drill). Offers refresh each pre-season; better divisions and fame unlock better sponsors. A **Buzz meter** (goals, wins, hero moments) settles into a sponsor bonus twice per season (Grand Prix Story's twice-yearly settlement — two financial "paydays" beat a flat trickle).
2. **Tickets & fans** — home gate = fans × attendance rate × ticket price. Fans grow on wins, star heroes fielded, promotions; shrink slowly on losing streaks. Ticket price is settable (too high = attendance drops — a gentle lever, not a spreadsheet).
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

An 8×6 tile grid (expandable). Buildings: Training Pitch, Gym, Tech Center, Shooting Range, Keeper Court, Medical Bay, Dorm, Scout Office, Coaching Office, Youth Field, Fan Shop, Stadium Stand tiers, Hero Lab (endgame). Each: build cost, up to Lv3, small weekly upkeep.

**Adjacency bonuses** (Grand Prix Story 2's stealable puzzle, simplified): certain pairings buff each other when adjacent (Gym+Dorm: +10% STA gains; Fan Shop+Stadium: +10% merch; Medical+Training Pitch: −20% injury odds; Hero Lab+anything: rumors…). Buildings are **relocatable for a small fee**, so layout is a recurring optimization toy. Discovered pairings log into the Codex.

## First-pass tuning table (Div 5 baseline — all numbers subject to the balance harness, doc 09)

| Item | Value |
|---|---|
| Starting cash / squad | 25,000 · 13 players + 1 coach |
| Player wage (Div 5) | 150–400/wk (squad ≈ 3,200/wk) |
| Coach wage | 500/wk (Lv1) |
| Season 1 subsidy | League pays 50% of wages |
| Sponsor (Div 5, 1 slot) | 2,000/mo + 3,000–5,000 objective |
| Home gate (500 fans) | ≈ 1,200/match |
| Prize: Div 5 champion / runner-up | 20,000 / 10,000 |
| Cup: per round win / trophy | 2,000–8,000 / 25,000 |
| Facility Lv1 build | 5,000–15,000 |
| Focus drill (squad-wide, max 3/week) | 400–1,200 + 10–25 TP each |
| TP income per match | win 30 · draw 20 · loss 14 (+2/goal, +10 MOTM, +5 ambient/wk) |
| Transfer (decent Div 5 player) | 5,000–15,000 |
| Pre-powered hero signing | 100,000+ + 2,500+/wk (Div 3 era) |
| Emergency loan | 20,000 once, 10%/season interest |

**Pressure curve targets**: Season 1 wages ≈ 60–70% of baseline income (tight but survivable); mid-game surplus flows to facilities and transfers; late game hero wages + Hero Lab + stadium tiers keep money meaningful (Game Dev Story's "ultimate console" pattern — always one aspirational sink ahead of you).
