# Owner-manager balance pilot — 2026-08-10

## Question

Measure one last production-path career policy before deciding whether the old
balance harnesses should be retired:

1. Spend TP every management week until no eligible policy action remains.
2. Sort the user roster by fixed potential grade. Skip players below 80
   condition, injured players, and players who are away.
3. Give each selected player at most two drills that week. Balance the lowest
   important stat after each drill: FWD SHO/PAC/TEC/STA; MID and DEF
   PAS/DEF/PAC/STA; GK REF/PAS/PAC/STA.
4. Build Training Pitch L1, Coaching Office L1, three Fan Shops and three
   Stadium Stands, then Level 1 support facilities, Pitch upgrades, and drill
   upgrades.
5. Hire the cheapest legal head coach in Week 1 and the cheapest legal
   assistant at the first legal opportunity.
6. Use production age, role, archetype, facility, coach, SUPER, pity, condition,
   injury, potential-grade, story, cash, loan, sale, and board-rescue rules.
7. Select the first available risky story choice and its highest-potential
   legal player target.

## Production corrections and limits

- The requested Week 3 assistant is impossible. The Training Pitch occupies
  the only construction crew in Weeks 1–2. The Office starts in Week 3 and the
  assistant can first be hired in Week 4.
- The board loan is automatic deficit recovery. It cannot be requested as
  construction capital. The policy builds only when current cash covers the
  price.
- “Two drills” is interpreted as at most two drills per eligible player per
  management week. A second pass over the same player is not allowed that week.
- The first-hire player is the created 18-year-old FWD: potential tier 4,
  All-Rounder, and production age/role bonuses. No later transfer recruitment
  is added because it was not defined in this policy.
- Sample size is one deterministic seed on Cozy and the same seed on Chairman,
  run through separate difficulty-filtered invocations.
  This is enough to audit accounting and order-of-magnitude growth. It is not a
  promotion-rate estimate.
- Two production-path blockers were found while running the pilot. Risky story
  leave and unlicensed starters now use one legal lineup-repair pass in the
  harness. The game also overfilled a D2 special-hero host beyond the field
  license cap; excess generated powers are now removed for that host season.

## Pre-cut production constants exercised

- Starting TP: 24.
- Base weekly TP: 20 after the current global 80% scale.
- Training Pitch: 23 weekly TP per operational level.
- Level 1 head coach: 10 weekly TP. Level 1 assistant: 5 weekly TP.
- Tier 1 outfield drill: 10 TP for +4 before modifiers. Keeper drill: 10 TP
  for +2 stored REF, with the player-facing display parity bonus.
- Each drill costs 8 condition. Weekly base recovery is 12.
- Potential changes only SUPER chance. It does not cap growth or multiply every
  ordinary drill.
- Raw player-attribute cap: 999.

## Measured output

Every season reconciled exactly:

`TP start + ambient income + direct story delta - drill spend = TP end`

The unexplained in-season TP delta was 0 in all 21 measured seasons. The two
difficulties were run as separate filtered invocations, so both used seed
`1835101793`.

### Cozy

| Season | Division | Place | XI strength | Created peak | Created drills | Created SUPER | Ambient TP | TP spent |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | D5 | 2 | 55.00 | 157 | 52 | 16 | 1,679 | 1,640 |
| 2 | D4 | 2 | 72.36 | 293 | 60 | 18 | 2,200 | 2,190 |
| 3 | D3 | 9 | 92.91 | 436 | 60 | 23 | 2,502 | 2,520 |
| 4 | D4 | 2 | 112.73 | 573 | 60 | 16 | 2,490 | 2,490 |
| 5 | D3 | 10 | 127.55 | 706 | 60 | 12 | 2,550 | 2,540 |
| 6 | D4 | 2 | 174.36 | 846 | 60 | 17 | 2,550 | 2,550 |
| 7 | D3 | 1 | 225.55 | 953 | 60 | 17 | 2,640 | 2,640 |
| 8 | D2 | 1 | 250.45 | **999** | 31 | 7 | 3,261 | 3,240 |
| 9 | D1 | 1 | 279.00 | **999** | 0 | 0 | 3,360 | 3,355 |

The created FWD ended Season 8 at SHO/PAC/TEC/STA 999/999/999/999. It
received no further drills because all four policy stats were capped.

### Chairman

| Season | Division | Place | XI strength | Created peak | Created drills | Created SUPER | Ambient TP | TP spent |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | D5 | 2 | 53.18 | 138 | 48 | 15 | 1,679 | 1,640 |
| 2 | D4 | 4 | 67.27 | 270 | 60 | 17 | 1,901 | 1,880 |
| 3 | D4 | 2 | 86.73 | 399 | 60 | 10 | 2,520 | 2,520 |
| 4 | D3 | 8 | 106.09 | 532 | 60 | 11 | 2,520 | 2,530 |
| 5 | D3 | 10 | 141.18 | 669 | 60 | 11 | 2,580 | 2,580 |
| 6 | D4 | 4 | 155.36 | 798 | 60 | 9 | 2,580 | 2,580 |
| 7 | D4 | 2 | 171.91 | 901 | 60 | 12 | 2,670 | 2,660 |
| 8 | D3 | 7 | 180.36 | **999** | 59 | 17 | 2,670 | 2,670 |
| 9 | D3 | 6 | 189.09 | **999** | 0 | 0 | 2,700 | 2,700 |
| 10 | D3 | 1 | 211.73 | **999** | 0 | 0 | 2,700 | 2,700 |
| 11 | D2 | 9 | 187.73 | **999** | 0 | 0 | 2,700 | 2,700 |
| 12 | D3 | 3 | 187.64 | **999** | 0 | 0 | 2,700 | 2,700 |

The Chairman created FWD also reached SHO/PAC/TEC/STA 999/999/999/999 in
Season 8. The run was censored before D1 because its economy and forced sales
caused repeated relegation, not because its created player lacked growth.

## Facilities, stories, and economy

- Cozy spent $96,500 in Season 1: Pitch L1, Office L1, three Fan Shops, three
  Stands, and Gym/Dorm/Tech/Shooting/Keeper L1. It added the remaining support
  facilities and Pitch L2 in Season 2. Chairman completed the same L1 set and
  Pitch L2 by the end of Season 2.
- Cozy reached Pitch L3 and began drill upgrades only in Season 8, after the
  created player was almost capped. Chairman never reached Pitch L3 or bought a
  drill upgrade. The cap result therefore does not depend on higher drill tiers.
- The created player's SHO/PAC/TEC/STA did use Level 1 Shooting Range, Gym, and
  Tech Center bonuses as those facilities became operational.
- Direct story TP remained small: Cozy +28 total; Chairman +12 total. Risky
  stories did not drive the cap result.
- The Cozy run used one emergency loan, 5 forced sales, and 43 board rescues.
  The Chairman run used one emergency loan, 35 forced sales, and 208 rescues.
  The commercial-build policy did not create a stable late-career economy.
- The created player consumed 480–600 TP per full season. Total ambient income
  was 1,679–3,360 TP, so this player's curve was limited by the two-drill weekly
  rule, not by total TP after the opening weeks.

## Current opponent ladder

| Division | Strength band | Support | Star focus | GK REF |
|---:|---:|---:|---:|---:|
| D5 | 40–50 | 40 | 94 | 80 |
| D4 | 55–63 | 54 | 111 | 94 |
| D3 | 67–75 | 65 | 133 | 113 |
| D2 | 80–90 | 77 | 159 | 135 |
| D1 | 107–120 | 103 | 212 | 180 |

The Cozy policy won D1 with XI strength 279 and a capped created player. That is
strong evidence of an outlier-progression problem. It is not enough evidence to
replace the ladder: opponent teams also receive per-season growth, and one seed
does not establish promotion rates.

## Questions for independent review

1. Keep 999. Both runs reached it; raising the cap would hide the curve.
2. The created-player curve is caused primarily by 48–60 drills per season,
   Tier 1 gain, age/role/archetype modifiers, SUPER, and Level 1 stat facilities.
   Total TP is not binding for that highest-priority player after the opener.
3. Lowering TP is still relevant to whole-squad growth, but it cannot slow the
   created player unless weekly TP falls below the price of two drills. Per-drill
   gain and training multipliers must also be reviewed.
4. Do not ship opponent-band changes from two runs. Preserve the ladder's
   measured ratio steps and use a new policy run after progression is reduced.
5. Treat the old “balanced best team” harness as non-authoritative for design.
   Retain deterministic accounting, replay, invariant, and trajectory probes.

## Post-cut rerun — 2026-08-10

The approved progression cut changed all four binding levers:

- Outfield gains: `4/7/11/16/22` → `2/4/6/9/10`.
- Keeper gains: `2/4/6/8/11` → `1/2/3/5/5`.
- Facility multipliers: `1.25/1.50/2.00` → `1.10/1.20/1.30`.
- Youth multiplier: `1.30` → `1.10`.
- All positive TP grants: 80% → 40%, including event rewards.

The same seed and policy were rerun once per difficulty. Both accounting rails
reconciled and both probe invocations passed.

| Difficulty | Season 1 | First D4 season | Best division | Season 8 created peak | Season 12 created peak | Reached 999? |
|---|---|---|---|---:|---:|---|
| Cozy | D5, 7th | Season 4, 9th | D4 | 385 | 553 | No |
| Chairman | D5, 7th | Season 4, 9th | D4 | 293 | 413 | No |

The cap problem is removed through Season 12. It is not a small pacing change:

- Both runs took three seasons to first leave D5.
- Neither run reached D3 in 12 seasons. Both moved repeatedly between D5 and D4.
- Cozy still gave the created player 60 drills and 600 TP in most full seasons.
  Lower gain per drill, not TP scarcity, slowed that player.
- Mature whole-club TP income settled at about 1,020 per season. Concentrating
  440–600 TP on the created player left too little growth for the rest of the XI.
- Cozy ended with 38 forced sales and 256 board rescues. Chairman ended with 55
  forced sales and 281 rescues. The facility-first commercial policy still did
  not produce a stable economy.

Verdict: the new values stop an optimized created player from reaching 999 too
quickly, but the full package is much harsher than one extra season per
division. Do not lower opponent bands from this one seed. If the desired result
is one additional season rather than a D5/D4 loop, keep the drill, youth, and
facility cuts and retest a 50–60% TP scale before changing the division ladder.
