# 06 — Economy

Design stance: **premium game, economy tuned purely for fun** (no monetization pressure). Two currencies, each with exactly one job — the research's clearest warning was currency sprawl, so every new resource idea must replace one of these, not join them.

| Currency | One job | Earned | Spent |
|---|---|---|---|
| **Money** | Capacity | Sponsors, tickets, prizes, player sales | Wages, transfers, facilities, scouting, events |
| **Training Points (TP)** | Improvement | Weekly facilities and coaches, plus explicit events | Focus drills |

Money is lumpy and stressful; TP flows steadily from investments in staff and grounds rather than match results. That separation keeps a losing run from starving player development. Heroes advance through awakenings and recruitment rather than a separate resource track.

## Income (all four, per user decision)

1. **Sponsors** — the backbone. D5 keeps its automatic baseline sponsor. Reaching D4 permanently unlocks one managed slot, D3 unlocks two, and D2 unlocks three; relegation never removes an earned slot. Each slot offers Steady, Balanced, and Bold terms during Weeks 1–4: exact monthly pay plus one league objective and an exactly-once Week-30 bonus. Untouched slots preserve their baseline income, so missing the offer window is never a punishment. There are **no signing perks or sponsor unlock perks** in this system. Payments land on Weeks 4, 8, 12, 16, 20, 24, and 28. A Season-3 **Buzz meter** (goals, wins, hero power moments) settles into sponsor cash at Weeks 15 and 30.
2. **Tickets & fans** — every home match, league or Cup, earns its own gate: fans × attendance rate × the division's ticket price. A double-header week can therefore show separate League and Hero Cup gate lines. **Matchday variance (2026-08-06):** on report-eligible settlements — weeks the player's club actually played, excluding the season-final settlement, which routes to the season review — the gate's base and the Fan Shop's per-level income each take an independent seeded weekly roll: 90% of rolls land uniformly in −10%…+10%, and 1 in 10 is a **surge** of +11%…+20% (the Financial Report's fire-spin banner weeks). Rolls derive from persisted career data (careerSeed, season, week, source), so reloads can never re-spin and Quick Result banks the same money as a watched match; quiet weeks bank the baseline, which is why the Finances tab's four-week outlook is labelled "typical". The straight bonus band adds ≈ +1.55% expected value per eligible rolled line. Wins and each distinct hero who actually played grow the following at a division-scaled rate. The first two consecutive losses cause no result-based decline; the third and later losses shrink support slowly, and a draw or win resets the streak. Ticket pricing and demand elasticity are deliberately deferred rather than advertised as a shipped control.
3. **Prize money** — league placement paid at season end + per-round cup prizes. Promotion pays a bonus.
4. **Player sales** — doc 05. The "training facilities print money" loop.

Post-match, the **Financial Report** shows every line (tickets, sponsor fee, prize, merch trickle − wages) — Pocket League Story's transparent readout, kept, now revealed as slot reels with the facility math shown as base × multiplier. Fan Shop merchandise computes per level: `floor(fans / 2)` per combined shop level, times the combined level, plus the adjacency bonus — so the on-screen ×N chip is exact, not approximate.

## Expenses

Weekly wages (players + coach + staff), transfer fees, facility construction/upkeep, scouting missions, event choices, loan interest. Instant drills cost TP only.

## Salaries & contracts (user-locked design)

- **Weekly wages for everyone** (we deliberately rejected Pocket League Story's "pay only when fielded" — it removes the tension this game wants).
- Contracts run 1–3 seasons. At expiry: renewal negotiation or free exit.
- **Raises are structural**: renewal ask = current wage × (1 + growth since signing) × fame factor × personality (Greedy +20%, Loyal −10%).
- **The hero wage cliff**: awakened players keep their pre-awakening wage until renewal (locked-in bargain), then ask hero rates (×3–5). Contract timing around awakenings is a core strategic layer.
- **Scale-invariant anchors**: a generated support player's weekly wage is anchored by division (D5→D1: 150/230/340/500/700) and scaled by their seven-stat average relative to that division's support rating. Transfer bases use 6,500/9,500/14,500/22,000/32,000 and a quadratic role-rating premium. Larger raw ratings therefore represent better football rather than an accidental economy multiplier.
- Underpaid stars (wage < 70% of market): morale drain, transfer requests, rival poach offers.
- **A transfer request is reversible.** Sustained low morale raises one (the patience threshold is per-personality); winning the player back withdraws it. Withdrawal sits a clear 20 points above the mood that raised it, so a Greedy player asks at 30 and drops it at 50 while a Loyal one asks at 12 and drops it at 32 — the gap stops the flag flickering on a single result. Granting his player requests is a direct lever, since a grant pays +5 morale. Until 2026-08-02 the flag could only ever be set, so a squad accumulated permanent "wants to leave" alerts nothing could clear.

### Negotiation (mood meter + card mini-game)

Numbers rule; the mini-game influences (user spec: helps, never fully decides).

1. **Renewals show the agent's asking wage up front**; transfers keep the ask hidden. The manager plausibly knows what their own player wants and does not know what a stranger at another club wants. A visible **mood face** (angry → thrilled) runs alongside in both cases. *(Changed 2026-08-06: the renewal ask was previously hidden, and the season-end card showed a wage-times-four estimate that measured 13–61% under the real number.)*
2. You offer wage + years + one perk (guaranteed starter, captaincy, training priority, jersey #10) — perks offset cash.
3. Up to 3 rounds. Each round you may play one **Pitch Card** from a dealt hand of 3 (Flattery, Trophy Promise, Hometown Ties, Money Talks, Straight Talk…). Card vs. personality match shifts mood one step (Joker loves Flattery; Professional hates it). **Hard cap: cards move the effective ask ±20% max** — a great pitch gets a discount, never a miracle.
4. Insulting offers (< 50% of ask) end talks and dent morale/fame. A three-round walk-away ends talks with **no** penalty — the damage is reserved for the insult.
5. **Renewals may also be signed in one tap at the full asking price**, with no promise attached. Negotiating is how you pay less: term, promise and pitch cards together land a signed deal at roughly 86–92% of the ask, or about 69% with two loved cards. Forgoing that discount is the whole cost of the shortcut, so there is no cap and no surcharge on it. Promises stay inside the negotiation, where their squad cost can be read before they are agreed. *(Added 2026-08-06.)*
6. **A signed hero renewal can land as low as ×2.0** rather than the advertised ×4. Measured floor is ×1.99, not the ×2.8 first reported: the hero ×4 is not the only multiplier, and loyalty (−20% at maximum) and a LOYAL personality (−10%) both cut the ask *before* the negotiation discounts apply to it — `4 × 0.8 × 0.9 × 0.69 ≈ 1.99`. Reaching it needs a hero with no stat growth and no fame since signing (so, awakened late with the contract expiring that same summer) plus two loved pitch cards; any real development pushes the multiple back above ×2.5.

   **Accepted, not floored** (owner decision 2026-08-06). A loyal, well-managed hero being cheap to keep is a reward for keeping him loyal and negotiating well, not a leak. ×4 remains what you pay for convenience or for negotiating badly, so the cliff still bites everyone who does not work at it. The advertised ×3–5 therefore describes the *ask*, not the signed wage. `hero-renewal-floor.test.ts` pins the measured floor so a future rebalance cannot move it unnoticed; a balance rail reporting minimum and median signed hero wage remains the right instrument before any retune.

## Facilities (the club grounds grid)

An 8×6 tile grid (expandable). Buildings: Training Pitch, Gym, Tech Center, Shooting Range, Keeper Court, Medical Bay, Dorm, Scout Office, Coaching Office, Youth Field, Fan Shop, and Stadium Stand tiers. The club may build up to **three Fan Shops and three Stadium Stands**; every other facility is limited to one. Each placed building is upgraded individually to Lv3 and pays its own weekly upkeep. Every Shop and Stand level adds its full income effect to the club total.

Facility quality is partly promotion-gated: Levels 1 and 2 are available from D5, and reaching D2 permanently unlocks Level 3. Level 2 used to wait for D4 and was moved down after measurement — locking the club's main training accelerator behind the promotion it was needed to earn produced 0 promotions across 6 careers × 10 seasons. Existing higher-level buildings from older saves remain operational, but further upgrades follow the earned ceiling.

The club owns **one works crew**, so only one build or upgrade project may run at once. Paying for a building starts construction and occupies its tiles immediately, but it produces **no benefit and no upkeep until completion**. An upgrade keeps the facility's current level active while work proceeds; the higher level begins only on completion. New careers receive an extra **$8,000** in their starting budget and are guided to place the Training Pitch as their first build, so paying for it returns cash to the previously balanced opening level. It pays nothing before it opens; from then on every weekly settlement creates **+28 TP per completed level**. Relocation is unavailable for the building under construction. Completion resolves at weekly settlement, appears in the Weekly Review with the finished building sprite, and uses the dedicated win fanfare.

Additional sponsor and Buzz income is paired with higher upgrade prices while every Level-1 build remains unchanged. Level-2 prices are the previous price ×1.25 and Level-3 prices ×1.50, rounded to the nearest $500. A building records the cash actually invested, so closing it refunds half its historical basis rather than half today's catalog price. Coaching Office Levels 2–3 are disabled until those levels have a real benefit; charging for a no-effect upgrade is not allowed.

| Facility | Lv1 build | Lv2 upgrade | Lv3 upgrade |
|---|---:|---:|---:|
| Training Pitch | $8,000 · 2 weeks | $10,000 · 2 weeks | $18,000 · 3 weeks |
| Gym | $7,000 · 2 weeks | $9,000 · 2 weeks | $16,000 · 3 weeks |
| Tech Center | $9,000 · 2 weeks | $11,500 · 2 weeks | $20,500 · 3 weeks |
| Shooting Range / Keeper Court | $7,500 · 2 weeks | $9,500 · 2 weeks | $17,000 · 3 weeks |
| Medical Bay | $10,000 · 2 weeks | $12,500 · 2 weeks | $22,500 · 3 weeks |
| Dorm / Scout Office | $6,000 · 1 week | $7,500 · 1 week | $13,500 · 2 weeks |
| Coaching Office | $6,500 · 1 week | Disabled | Disabled |
| Fan Shop | $5,000 · 1 week | $6,500 · 1 week | $11,500 · 2 weeks |
| Youth Field | $12,000 · 3 weeks | $15,000 · 2 weeks | $27,000 · 3 weeks |
| Stadium Stand | $10,000 · 3 weeks | $19,000 · 2 weeks | $34,000 · 3 weeks |

**Adjacency bonuses** (Grand Prix Story 2's stealable puzzle, simplified): certain pairings buff each other when adjacent (Gym+Dorm: +10% STA gains; Fan Shop+Stadium: +10% merch; Medical+Training Pitch: −20% injury odds). Each named bonus applies once even when several copies form the same pairing. Buildings are **relocatable for a small fee**, so layout is a recurring optimization toy. Discovered pairings log into the Codex.

## First-pass tuning table (D5 · District League baseline — all numbers subject to the balance harness, doc 09)

| Item | Value |
|---|---|
| Starting cash / squad | 45,000 · 15/17 players after creating the rookie; head-coach vacancy filled through the market |
| Player wage (D5) | 150–400/wk (squad ≈ 3,200/wk) |
| Coach wage | 400/wk per level (Lv1 400 → Lv5 2,000); an assistant costs half the same figure, so 200/wk at Lv1 |
| Season 1 subsidy | League pays 50% of wages |
| Sponsor (D5, 1 slot) | 2,000/mo + 3,000–5,000 objective |
| Home gate (500 fans) | ≈ 1,200/match |
| Prize: D5 champion / runner-up | 20,000 / 10,000 |
| Cup: per round win / trophy | 2,000–8,000 / 25,000 |
| Facility Lv1 build | 5,000–12,000 |
| Focus drill (single-stat) | TP only, five tiers; tier 1 is the D5 starting drill and each tier up costs more TP for a bigger gain (exact gains and TP costs: `content/training.json`) |
| Drill tier upgrade (per path) | $3,000 / $8,000 / $18,000 / $40,000 for tiers 2–5 |
| Weekly TP income | 24 baseline; Training Pitch +28/completed level; head coach 10 + 2× level; assistant 5 + level; match result +0 |
| Transfer (decent D5 player) | 5,000–15,000 |
| Pre-powered hero signing | 100,000+ + 2,500+/wk (Div 3 era) |
| Emergency loan | Once per career: max(20,000 Cozy / 10,000 Chairman, deficit + 15,000), repaid at 10% over the next season |

**Pressure curve targets**: Season 1 wages ≈ 60–70% of baseline income (tight but survivable); mid-game surplus flows to facilities and transfers; late game hero wages + stadium tiers keep money meaningful (Game Dev Story's "ultimate console" pattern — always one aspirational sink ahead of you).
