# Hero Football Manager — D5 Cash-Flow Rebalance

**Status:** Final implementation spec
**Date:** 2026-08-05
**Scope:** Opening D5 cash flow, assistant-coach salary, income-facility return, finance presentation, save migration, and balance coverage

## Decision

Rebalance the opening economy by raising dependable income and correcting the
assistant-coach price. Do not apply a blanket player-wage cut in the first pass.

The exact first-pass package is:

1. Assistant coaches cost **50% of the same candidate's head-coach wage**.
2. The passive D5 sponsor pays **$3,000 per month**, up from $2,000.
3. A Fan Shop earns **$1 per two supporters per level**, up from $1 per five.
4. A Stadium Stand costs **$10,000** at Level 1, down from $15,000, and adds
   **50% gate income per level**, up from 25%.
5. Level-1 business-facility upkeep falls so the common opening set costs
   **$230/week**, down from $315/week:
   - Training Pitch: $100, unchanged.
   - Coaching Office: $40, down from $80.
   - Fan Shop: $40, down from $65.
   - Stadium Stand: $50, down from $70.
6. Chairman receives a **40% Season-1 wage subsidy**. Cozy remains at 50%.
7. The finances screen adds an honest four-week operating outlook that includes
   scheduled home gates and sponsor payments. Away gates remain $0.
8. The emergency-loan recovery floor remains **$15,000** even though a new
   Stadium Stand becomes cheaper.

These numbers are one calibrated package. Do not land only the cheaper Stadium
Stand or only the assistant reduction and declare the economy fixed; neither
closes the recurring gap by itself.

## Why this is necessary

### Player-observed state

The reported live state is approximately:

- home gate: $1,600;
- Fan Shop merchandise: $107/week;
- player wages: $2,700/week;
- facility upkeep: $315/week;
- one head coach and one assistant, whose wages appear on the separate coaching
  staff line; and
- no ticket income from away matches.

That reading is correct. League and Cup gates are paid only when the user club
is at home. Merchandise is weekly. Sponsor money arrives on Weeks 4, 8, 12, 16,
20, 24, and 28. Wages and upkeep are charged every week.

### Production reproduction

A deterministic trace against the current production rules used the default
launch seed, the real story roster, the cheapest Level-1 head coach, the
cheapest Level-1 assistant, and this guided build order:

1. Week 1: Training Pitch;
2. Week 3: Coaching Office;
3. Week 4: assistant coach and Fan Shop; and
4. Week 5: Stadium Stand.

The trace forced the user club to win its first seven league matches and its
first Cup tie. This is deliberately more generous than the reported playthrough.

| Mode | Cash after seven league matches + first Cup tie | Safety outcome |
| --- | ---: | --- |
| Cozy, current rules | $11,395 | No intervention yet |
| Cozy, assistant at half wage only | $12,395 | No intervention yet |
| Chairman, current rules | $12,928 | Emergency loan triggered in Week 10 |
| Chairman, assistant at half wage only | $13,178 | Emergency loan still triggered in Week 10 |

The Chairman closing balance is misleading by itself: the club fell to
**-$2,107 in Week 9**, then received a **$20,800 emergency loan** in Week 10.
Even an all-win opening cannot avoid the safety system. The assistant reduction
alone changes the size of the rescue; it does not prevent it.

### The two advertised income facilities are not opening solutions today

At roughly 500 supporters:

- the Fan Shop makes about $100 before adjacency and costs $65 in upkeep, so its
  opening net is only about $35–$45/week against a $5,000 build cost; and
- the Stadium Stand's current source comment calculates a **25-season D5
  payback** before Cup gates. It is a long-career investment, not an emergency
  cash solution.

The loan flow and finance guidance currently point the player toward income
facilities. That advice is materially false while their opening returns are this
small.

### Existing balance coverage misses the failure

The current generated-wage rail limits the median wage of one player to 20% of
weekly gross income. It does not constrain the sum of a 16-player squad. The
current story payroll is about $2,495 before coaches, while the D5 test's weekly
gross-income estimate is about $860. Total player payroll is therefore roughly
290% of that estimate before staff and facilities.

Other rails allow starting cash, prizes, emergency loans, and forced sales to
mask recurring insolvency. The prepared facility probe covers the Training
Pitch path, while the long-career facility policy buys the Fan Shop and Stadium
Stand last rather than following the guided opening path above.

The missing acceptance question is: **can the exact opening the game teaches pay
for its ordinary commitments without needing prizes or a board rescue?**

## Player-facing target

The economy should feel tight, not futile:

- A normal Cozy home week with the four opening facilities should be slightly
  profitable before prize money.
- An away week may lose money because there is no gate, but the next home gate
  and monthly sponsor payment must make the cycle sustainable.
- Prize money, player sales, and Cup runs should fund faster growth, transfers,
  and upgrades. They must not be required to pay ordinary Season-1 bills on
  Cozy.
- Chairman should remain meaningfully leaner, but strong play must not
  deterministically trigger the emergency loan before the seventh league match.
- Building the facilities Bert recommends must improve the situation within the
  same season.

## Exact mechanics

### 1. Assistant-coach wage

Add one canonical role-aware wage helper in the game ring:

```text
coachWeeklyWageForRole(candidate, HEAD) = candidate head wage
coachWeeklyWageForRole(candidate, ASSISTANT) = round(candidate head wage * 50%)
```

Requirements:

- The market card shows both quotes whenever the assistant slot is open, for
  example `Head $500/wk · Assistant $250/wk`.
- Affordability uses the selected role's quote.
- Hiring persists the role-adjusted wage on the employed assistant.
- Weekly settlement, dismissal severance, the staffed-office close flow, and the
  finances screen use the persisted employed wage.
- Coach progression must retain the role adjustment. A promoted assistant must
  not jump back to the full head-coach scale at season rollover.
- Retired-legend loyalty discounts apply before the 50% role adjustment.
- Use integer rounding through one helper; do not duplicate salary arithmetic
  in the UI and domain layers.

This aligns price with the existing effect contract: assistant training and
Motivator bonuses are already half strength, and assistant TP is smaller.

### 2. Passive D5 sponsor

Change only the passive D5 anchor in this pass:

| Division | Current monthly anchor | New monthly anchor |
| --- | ---: | ---: |
| D5 | $2,000 | **$3,000** |
| D4 | $4,000 | $4,000, unchanged |
| D3 | $6,000 | $6,000, unchanged |
| D2 | $8,000 | $8,000, unchanged |
| D1 | $10,000 | $10,000, unchanged |

Requirements:

- New D5 careers begin at $3,000/month.
- An existing D5 career on the exact old passive baseline of $2,000 moves to
  $3,000.
- Preserve a custom or migrated non-baseline sponsor scalar exactly.
- Preserve signed managed sponsor contracts exactly, including a relegated club
  that retained an unlocked Sponsor Desk.
- Chairman continues to apply its 80% sponsor-income multiplier.
- Sponsor cadence remains monthly; do not convert it into a hidden weekly drip.

### 3. Fan Shop

Change the base merchandise formula to:

```text
floor(supporters * combined operational Fan Shop level / 2)
```

Then apply the existing +10% Fan Shop/Stadium adjacency bonus with the existing
integer rounding.

At 500 supporters:

| State | Current | New |
| --- | ---: | ---: |
| Fan Shop L1 alone | $100/week | **$250/week** |
| Fan Shop L1 adjacent to Stadium Stand | $110/week | **$275/week** |

With $40 upkeep, an adjacent Level-1 Fan Shop nets $235/week and repays its
$5,000 build in about 22 settled weeks at a flat 500 supporters. Supporter growth
shortens that period.

### 4. Stadium Stand

Change Level 1 only as follows:

- build cost: **$10,000**;
- build duration: 3 weeks, unchanged;
- gate bonus: **+50% per operational level**;
- Level-1 upkeep: **$50/week**.

Keep the existing Level-2 and Level-3 upgrade costs in the first pass. Their
capital sink was calibrated before Buzz was removed and must be remeasured
before these later prices are approved. Apply the new per-level gate multiplier
to all levels.

Do not continue deriving the emergency-loan recovery floor from the Stand's
catalog price. Freeze that floor at **$15,000**. The cheaper Stand should leave a
rescued club $5,000 of operating room after construction, not silently reduce
the one fail-soft intervention by the same $5,000.

At 500 supporters and a $4 ticket:

- base D5 home gate: $1,200;
- Level-1 Stand gate: **$1,800**;
- nine league home gates add $5,400/season;
- 30 weeks of Level-1 upkeep cost $1,500;
- net return before Cup gates is $3,900/season; and
- standalone payback is about 2.6 D5 seasons, faster with home Cup ties and the
  Fan Shop adjacency.

The Stand remains slower than the Fan Shop, but it now behaves like a plausible
club-growth investment rather than a 25-season trap.

### 5. Targeted facility upkeep

Do not halve upkeep for the whole catalog. Change the three business/staff
buildings that make up the reported opening problem:

| Facility | Current L1/L2/L3 | New L1/L2/L3 |
| --- | --- | --- |
| Coaching Office | 80 / 130 / 195 | **40 / 65 / 100** |
| Fan Shop | 65 / 105 / 155 | **40 / 65 / 95** |
| Stadium Stand | 70 / 115 / 175 | **50 / 80 / 120** |

Training Pitch upkeep remains 100 / 160 / 240 because its TP output is already
the measured D5 progression engine. Other sporting facilities remain unchanged.

The common Level-1 opening set therefore moves from $315/week to **$230/week**.
Upkeep still matters, and closing a facility remains a valid recovery choice.

### 6. Difficulty

Season-1 wage support becomes:

| Mode | Current | New |
| --- | ---: | ---: |
| Cozy | 50% | 50%, unchanged |
| Chairman | 0% | **40%** |

Chairman remains harder through lower opening support, 80% sponsor income,
faster board intervention, a smaller ordinary emergency-loan allowance, stronger
opponent growth, and the lower cash floor. The subsidy ends after Season 1.

### Worked operating check

Use the real guided opening at the 500-supporter D5 floor: $2,495 player
payroll, a $500 Level-1 head coach, a $250 Level-1 assistant, $230 upkeep, an
adjacent Level-1 Fan Shop, and an operational Level-1 Stadium Stand. The wage
subsidy applies to the **combined $3,245 player-and-coach bill**, not to players
alone.

| Line | Cozy | Chairman |
| --- | ---: | ---: |
| Weekly gross wages | -$3,245 | -$3,245 |
| Season-1 subsidy | +$1,622 | +$1,298 |
| Facility upkeep | -$230 | -$230 |
| Merchandise | +$275 | +$275 |
| One home gate | +$1,800 | +$1,800 |
| **Home-week operating net** | **+$222** | **-$102** |

The executable four-week operating template is
**Home / Away / Home / Away**, with the sponsor payment due in the fourth week,
no Cup gate, and no prizes, events, player sales, or capital purchases.
At flat 500 supporters this reconciles to:

| Four-week line | Cozy | Chairman |
| --- | ---: | ---: |
| Two home gates | +$3,600 | +$3,600 |
| Four merchandise payments | +$1,100 | +$1,100 |
| One sponsor payment | +$3,000 | +$2,400 |
| Net wages after subsidy | -$6,492 | -$7,788 |
| Four upkeep payments | -$920 | -$920 |
| **Four-week operating net** | **+$288** | **-$1,608** |

This makes Cozy sustainable across the home/away rhythm and brings Chairman
close to break-even at the 500-supporter floor while leaving it materially
leaner. The 300-seed representative Season-1 cohort is the deciding Chairman
rail: at 40% support it records 0% safety interventions, $13,074 median ending
cash, and $4,566 median cash with prize and rescue lines excluded. The same
cohort leaves Cozy at $26,919 median, preserving a $13,845 difficulty gap.

### 7. Finances screen

Keep the settled bank statement exact. Add a separate **Next four weeks**
operating outlook:

- include current merchandise for each week;
- include known wage subsidy, wages, coach wages, and operational upkeep;
- include sponsor payments only on their actual due weeks;
- include a projected gate only for scheduled home league matches and known home
  Cup ties, using current supporters, ticket price, and operational Stand level;
- label an away fixture `Away game · no gate`;
- exclude prizes, objective bonuses, player sales, requests, events, and
  facilities still under construction; and
- label the result as a projection, never as settled cash.

The existing one-week recurring projection intentionally excludes tickets and
sponsors, so it will continue to look deeply negative even after the four-week
cycle is healthy. Replace it as the primary outlook or clearly subordinate it to
the four-week view.

## Save migration

This rebalance changes persisted assistant wages and gives price protection for
an already purchased Stadium Stand, so raise `GAME_SCHEMA_VERSION` from 4 to 5
and add an explicit 4→5 migration.

Schema-4 assistants stored the full, head-role quote in `weeklyWage`, including
any loyalty discount or progression already earned. For migration only, treat
that persisted number as the candidate head quote and pass it through the
canonical assistant helper once. Do not rebuild it from the current level or
apply a second loyalty discount.

The migration must:

1. halve the persisted active assistant's wage exactly once, using the same
   integer helper as a new hire;
2. leave the head coach and candidate shortlist at their head-coach quotes;
3. change an exact passive D5 $2,000 sponsor scalar to $3,000 only when no
   managed contract owns the current income;
4. credit **$5,000 of Stadium Stand price protection** for each player-funded
   Stand whose persisted basis matches a schema-4 catalog total: $15,000 at
   Level 1, $34,000 at Level 2, or $68,000 at Level 3, including the equivalent
   paid in-flight build or upgrade state;
5. reduce that building's `capitalInvested` by the same $5,000 so a later close
   refunds half the actual post-credit basis;
6. handle a paid in-flight Level-1 Stand build the same way;
7. leave seeded/free buildings and non-catalog custom historical bases
   untouched; duplicate legacy Stands intentionally receive one credit per
   independently paid matching building, with no global one-Stand cap;
8. update user-club cash and append one clear cash-transaction line for the total
   price-protection credit; and
9. preserve all old settled ledgers byte-for-byte.

Add `balance-adjustment` to the closed `CashTransactionKind` and persistence
enum, and use that kind for the migration credit. Do not disguise the credit as
a facility closure, prize, or weekly ledger line. Generate a collision-free
transaction ID and record the post-credit balance.

The migration is idempotent because it runs only across the schema boundary.
Migration tests must cover no assistant, a loyalty-discount assistant, an
operational Stand, an in-flight Stand, an upgraded Stand, a seeded Stand, legacy
duplicate Stands, an exact passive sponsor, a custom sponsor scalar, and a
managed/relegated sponsorship portfolio.

## Balance harness and acceptance gates

### New opening policy

Add a production-path opening cash-flow harness whose policy is explicit and
versioned:

- real story onboarding and created-player wage;
- first eligible Level-1 head coach;
- Training Pitch Week 1;
- Coaching Office Week 3;
- first eligible Level-1 assistant and Fan Shop Week 4;
- Stadium Stand Week 5;
- the real Season-1 schedule and settlement code;
- production supporter facts rather than synthetic score-only results;
- no transfers, scouting, player-request spending, facility upgrades, or event
  cash choices; and
- separately reported capital purchases, recurring operations, Cup/prize money,
  and safety interventions.

### Required gates

Run at least 300 deterministic seeds for each difficulty before approval.

1. **Opening strong-play gate:** settle through the seventh league match in
   Season-1 Week 11; the first Cup tie settled in Week 6, and the Week-5 Stand
   became operational entering Week 8. At that single post-settlement
   checkpoint, neither Cozy nor Chairman may have triggered an emergency loan,
   forced sale, or cash-floor top-up, and P10 closing cash must be at least
   $10,000.
2. **Cozy operating gate:** after all four opening facilities are operational, a
   `Home / Away / Home / Away` cycle with the sponsor due in its fourth week has
   nonnegative operating cash before Cup gates, prizes, player sales, and
   event money. Use the fixed worked template above rather than selecting a
   favorable four-week schedule window.
3. **Cozy Season-1 gate:** under the representative 45% win / 25% draw / 30% loss
   policy, emergency-loan incidence is 0%, P10 closing cash is nonnegative, and
   the median club can still afford at least one $5,000 discretionary purchase.
4. **Chairman Season-1 gate:** the same representative policy has emergency-loan
   incidence below 10%, while its median ending cash remains at least $10,000
   below Cozy's median. Difficulty must remain visible.
5. **Income attribution gate:** tickets, passive sponsor uplift, merchandise,
   subsidy, each upkeep reduction, and the assistant reduction reconcile to the
   exact final cash difference with no unexplained dollar.
6. **Facility-return gate:** at the D5 500-supporter floor, Level-1 Fan Shop
   payback is no more than one season and Level-1 Stadium Stand payback is no
   more than three seasons, both including their own upkeep and excluding prizes.
7. **No prize masking:** report operating cash both with and without Cup/league
   prizes. A green final balance cannot pass a recurring-cash gate merely because
   the club won a trophy.
8. **Long-career regression:** rerun the Club Business accounting/cohort probes,
   the facility pacing probe, the real-player division ramp, promotion survival,
   market affordability, full Jest, and TypeScript.

The existing continuous D5→D1 probe is a **regression and progression smoke**,
not a financial approval gate. Its locked policy renews every player who will
re-sign at the full asking wage and deliberately does not model a human
manager's sell/release/replacement decisions around the hero wage cliff. In the
post-change one-seed smoke, both modes reached and completed D1, but Cozy ended
at its -$15,000 floor and Chairman at its -$30,000 floor because annual player
wages rose far faster than upkeep or sponsorship. Report that warning; do not
misattribute it to facilities or use it to weaken the user-locked 3–5× hero
renewal rule inside this opening-economy pass. A later-career contract-strategy
balance gate needs its own approved player policy and cohort.

If this exact package misses a rail, tune dependable income in this order:

1. passive D5 sponsor;
2. Fan Shop merchandise;
3. Stadium Stand gate return;
4. targeted business-facility upkeep; then
5. ordinary player wages only as the final lever.

Do not increase starting cash to make a failing operating curve pass. Starting
cash changes runway, not sustainability.

## Tests to add or update

- Assistant quote, affordability, hire, weekly ledger, progression, dismissal,
  staffed-office closure, save round-trip, and 4→5 migration tests.
- Market UI/source-contract coverage showing distinct head and assistant wages.
- Exact Fan Shop values at 500 and 546 supporters, with and without adjacency.
- Exact Stadium gates at Levels 0–3 and best-level-only behavior.
- Facility upkeep totals for the four-building opening set.
- D5 passive sponsor migration and custom/managed sponsor preservation.
- Cozy and Chairman subsidy lines in Season 1 and their absence in Season 2.
- Four-week finance projection for home, away, sponsor, Cup, construction, and
  no-match weeks.
- The new 300-seed opening and Season-1 acceptance probes.

## Non-goals

- No settable ticket prices or attendance elasticity.
- No away-match gate or travel stipend.
- No pay-only-when-fielded wages.
- No change to the hero renewal multiplier.
- No new currency.
- No sponsor signing perks.
- No replacement for the removed Buzz feature.
- No transfer-value or player-request cost change in this pass.
- No blanket facility-price, upkeep, or upgrade rewrite.
- No match-engine or replay-format change; `ENGINE_VERSION` does not move.

## Implementation order

1. Add the opening cash-flow harness and pin the current failing baseline.
2. Add role-aware assistant wages and schema-5 migration coverage.
3. Apply D5 sponsor and difficulty changes.
4. Apply Fan Shop, Stadium Stand, and targeted upkeep changes.
5. Add the four-week finance outlook and update player-facing copy.
6. Run focused economy tests and the 300-seed approval cohorts.
7. Run the full regression suite and typecheck.
8. Smoke a fresh Cozy career and a fresh Chairman career through the seventh
   league match, then verify a migrated save containing the reported four
   facilities and two coaches.

## Completion standard

This work is complete only when the exact guided opening is solvent by the gates
above, the user's existing save receives the assistant correction and Stand
price protection, away games are clearly explained as no-gate weeks, and the
finance screen shows the real multi-week rhythm without relying on future prize
money to make an impossible weekly picture look acceptable.
