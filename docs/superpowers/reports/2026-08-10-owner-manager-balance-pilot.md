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
   Stadium Stands, then Pitch upgrades, support facilities, and drill upgrades.
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
- Sample size is one deterministic seed on Cozy and the same seed on Chairman.
  This is enough to audit accounting and order-of-magnitude growth. It is not a
  promotion-rate estimate.
- Two production-path blockers were found while running the pilot. Risky story
  leave and unlicensed starters now use one legal lineup-repair pass in the
  harness. The game also overfilled a D2 special-hero host beyond the field
  license cap; excess generated powers are now removed for that host season.

## Production constants exercised

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

The unexplained TP delta was 0 in all 22 measured seasons.

### Cozy

| Season | Division | Place | XI strength | Important-stat median | Created FWD highest important stat | Ambient TP | TP spent |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | D5 | 2 | 54.82 | 53.5 | 134 | 1,978 | 1,920 |
| 2 | D4 | 7 | 67.64 | 55.0 | 202 | 2,430 | 2,430 |
| 3 | D4 | 2 | 82.45 | 58.0 | 284 | 2,520 | 2,520 |
| 4 | D3 | 9 | 91.55 | 58.5 | 348 | 2,520 | 2,520 |
| 5 | D4 | 2 | 125.18 | 74.0 | 427 | 2,580 | 2,580 |
| 6 | D3 | 9 | 131.00 | 81.5 | 502 | 2,580 | 2,580 |
| 7 | D4 | 1 | 166.00 | 179.5 | 557 | 2,670 | 2,660 |
| 8 | D3 | 1 | 165.73 | 202.5 | 613 | 2,670 | 2,670 |
| 9 | D2 | 2 | 180.36 | 260.0 | 678 | 3,321 | 3,300 |
| 10 | D1 | 1 | 216.09 | 352.0 | 738 | 3,390 | 3,390 |

Created FWD important stats at the end of Season 10 were SHO 738, PAC 735,
TEC 736, STA 732.

### Chairman

| Season | Division | Place | XI strength | Important-stat median | Created FWD highest important stat | Ambient TP | TP spent |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | D5 | 2 | 53.55 | 52.0 | 138 | 1,794 | 1,740 |
| 2 | D4 | 5 | 66.45 | 52.0 | 210 | 2,430 | 2,430 |
| 3 | D4 | 2 | 81.18 | 55.0 | 292 | 2,520 | 2,520 |
| 4 | D3 | 8 | 93.27 | 57.0 | 358 | 2,520 | 2,520 |
| 5 | D3 | 10 | 112.91 | 62.5 | 441 | 2,580 | 2,580 |
| 6 | D4 | 4 | 129.91 | 172.5 | 508 | 2,580 | 2,580 |
| 7 | D4 | 2 | 149.27 | 172.5 | 571 | 2,670 | 2,670 |
| 8 | D3 | 3 | 158.18 | 196.0 | 627 | 2,670 | 2,670 |
| 9 | D3 | 9 | 164.64 | 270.0 | 687 | 2,700 | 2,700 |
| 10 | D4 | 3 | 179.45 | 330.5 | 745 | 2,700 | 2,700 |
| 11 | D4 | 3 | 161.36 | 164.0 | 809 | 2,700 | 2,700 |
| 12 | D4 | 1 | 181.64 | 200.5 | 865 | 2,700 | 2,700 |

Created FWD important stats at the end of Season 12 were SHO 863, PAC 865,
TEC 860, STA 862. The run was censored before D1 because the economy and forced
sales caused repeated D3/D4 movement, not because the created player lacked
growth.

## Facilities, stories, and economy

- Season 1 capital spend was $69,500 in each difficulty. This exactly covers
  Pitch L1, Office L1, three Fan Shops, three Stadium Stands, and Pitch L2.
- Cozy reached Pitch L3 in Season 9. Chairman remained at Pitch L2.
- Neither run bought a drill tier upgrade or built a stat-training facility.
  Therefore the 738/865 result does not depend on high drill tiers or Gym,
  Tech Center, Shooting Range, Keeper Court, or Dorm bonuses.
- Direct story TP was small: Cozy +4 total; Chairman +12 total. Risky stories
  can matter in individual careers, but story TP did not drive this result.
- The Cozy run used one emergency loan, 12 forced sales, and 99 board rescues.
  The Chairman run used one emergency loan, 32 forced sales, and 185 rescues.
  The commercial-build policy did not create a stable late-career economy.
- Squad SUPER counts were 27–61 per season. The created player's tier-4
  potential and age bonuses are included in its measured growth.

## Current opponent ladder

| Division | Strength band | Support | Star focus | GK REF |
|---:|---:|---:|---:|---:|
| D5 | 40–50 | 40 | 94 | 80 |
| D4 | 55–63 | 54 | 111 | 94 |
| D3 | 67–75 | 65 | 133 | 113 |
| D2 | 80–90 | 77 | 159 | 135 |
| D1 | 107–120 | 103 | 212 | 180 |

The Cozy policy won D1 with XI strength 216 and a created-player peak of 738.
The current D1 field is therefore far below this policy's output.

## Questions for independent review

1. Does the evidence support keeping 999, raising it, or reducing growth first?
2. Which TP and training-gain sources actually caused the created-player curve?
3. Are provisional no-change opponent bands around D5 45–60, D4 65–85,
   D3 95–125, D2 145–185, and D1 200–250 defensible from this pilot?
4. Which claims are not justified because there are only two runs?
5. Identify any policy-fidelity, accounting, or production-path defect that
   would materially invalidate the conclusion.
