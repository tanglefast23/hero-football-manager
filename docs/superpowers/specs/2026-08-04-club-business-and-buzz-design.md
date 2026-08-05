# Club Business, Supporters, and Buzz — design

**Date:** 2026-08-04  
**Status:** approved for implementation; Quick/Watch policy B confirmed 2026-08-05  
**Scope:** supporter growth, managed sponsors, Buzz, facility-upgrade rebalance,
save migration, balance verification, and phone-width UX

**Implementation plan:**
`docs/superpowers/plans/2026-08-04-club-business-and-buzz.md`

The club begins with today's simple D5 sponsor payment. Results and heroes
gradually build a real following. Promotion to D4 opens sponsor choice; Season 3
opens Buzz. The additional income is paired with more expensive facility
upgrades so success creates better decisions instead of making money irrelevant.

---

## 1. Success criteria

The feature is complete only when all of these are observable in a real career:

1. A win and heroes who actually played add supporters after settlement.
2. One or two losses do not lose supporters from the result itself. A third
   consecutive loss always creates a net decline, even with four heroes; a draw
   or win ends the streak.
3. The first move into D4 queues Bert's Sponsor Desk introduction and reveals
   managed sponsor offers in Club > Finances.
4. Sponsor capacity grows from one to three slots, contracts show exact monthly
   pay and objective progress, and earned bonuses pay exactly once.
5. Season 3 queues Bert's Buzz introduction. Goals, wins, and real hero power
   moments fill the meter, which pays exactly twice per season.
6. A Season 3 D5 club can earn and settle Buzz through its basic sponsor while
   managed offers remain locked.
7. A schema-3 save receives the same next monthly sponsor payment it would have
   received before migration, including Chairman's existing modifier.
8. Cup prizes, sponsor payments, objective bonuses, and Buzz payouts enter the
   weekly ledger before financial safety decides on a loan, ultimatum, rescue,
   or forced sale.
9. Facility upgrade prices rise without delaying the proven D5 Training Pitch
   path or creating free refund money on existing buildings.
10. The feature works without truncation, nested controls, missing accessibility
    state, or horizontal scrolling at a 375pt viewport and supported text sizes.

No green unit suite substitutes for these player-visible checks.

---

## 2. Unlock and story sequence

### 2.1 Managed sponsors: first D4 promotion

Managed sponsorship permanently unlocks when `highestDivisionReached(state)`
first reaches D4 or better. The ordinary case is the management morning after a
D5 promotion, not the awards ceremony and not the previous season's final
settlement.

Capacity is based on the best division reached, so relegation never deletes a
signed contract or re-locks a screen:

| Best division reached | Managed slots |
| --- | ---: |
| D5 only | 0 |
| D4 | 1 |
| D3 | 2 |
| D2 or D1 | 3 |

Current division still sets the money anchor. A relegated club keeps its slot
capacity but receives offers sized for its current league.

The one-page Bert inbox sequence is informational and never blocks Advance
Week:

```json
{
  "id": "sponsor-desk",
  "inbox": {
    "title": "SPONSORS ARE CALLING",
    "detail": "Moving up the divisions has put the club on bigger companies' radar."
  },
  "destination": "club-finances",
  "pages": [{
    "kicker": "A bigger division",
    "title": "Now they know our name",
    "body": [
      "We've moved up in the divisions, boss. Bigger sponsors are interested now. Compare the monthly money and the season target, then choose who gets a slot."
    ],
    "focus": "sponsor-desk",
    "objective": "REVIEW THE SPONSOR OFFERS.",
    "buttonLabel": "Show me who's calling."
  }]
}
```

This wording also remains honest for a migrated D4+ career that did not literally
promote on the update's first launch.

### 2.2 Buzz: Season 3

Buzz unlocks on the first management morning with `season >= 3`. It does not
depend on division or managed sponsor access.

```json
{
  "id": "sponsor-buzz",
  "inbox": {
    "title": "THE CLUB IS TRENDING",
    "detail": "The team has a real following now, and sponsors are watching."
  },
  "destination": "club-finances",
  "pages": [{
    "kicker": "A proper following",
    "title": "People are talking",
    "body": [
      "We're famous enough to have a proper social media following now. Goals, wins and hero moments build Buzz. Sponsors pay it out twice each season."
    ],
    "focus": "sponsor-buzz",
    "objective": "REVIEW THE BUZZ METER.",
    "buttonLabel": "Show me the noise."
  }]
}
```

Both sequences use the existing persisted assistant-inbox queue and its
three-item cap. Neither becomes an opening duty.

The existing walk-on renders the authored `body` and spotlight `focus`; it does
not render `kicker`, `title`, `objective`, or `buttonLabel` as standalone
controls. Those fields remain in the JSON because the content schema requires
them, but acceptance does not pretend the button label is visible. The current
whole-screen dismissal remains the only walk-on action. Implementation must not
nest a new button inside that full-screen Pressable.

After dismissal, the handoff must:

1. switch to Club > Finances;
2. reveal the correct Sponsor Desk or Buzz section;
3. scroll its heading above the fixed chrome;
4. move accessibility focus to the section heading, or the first offer when an
   offer action exists; and
5. restore focus to the inbox row if the route is cancelled.

Reduced Motion uses an immediate scroll. The same focus target is required on
native and web.

If D4 and Season 3 unlock together, `sponsor-buzz` remains **held** until a
`sponsor-desk` delivery flag exists from an earlier management week. Completion
is not required. If urgent items displace Sponsor Desk, Buzz stays held too.
Test this with zero through three other occupied inbox slots and across reload.

### 2.3 Migrated D4+ career during an active season

A migrated Week 1–4 career receives deterministic current-season offers before
the standard Sponsor Desk guide can be due. A migrated Week 5–30 career has no
actionable offers, so it receives a dedicated non-actionable Bert sequence:

```text
The club has already moved up in the divisions, boss. Your current sponsor
income carries on this season. The new offers arrive next pre-season.
```

Its focus target is the active sponsor summary, and it has no “review offers”
objective. Completing this continuity variant also satisfies the one-time
Sponsor Desk introduction, so Bert does not teach the same system twice.

## 3. Supporter growth and decline

### 3.1 What counts

Every played league or Hero Cup match involving the user club creates one
`SupporterMatchImpact`. Penalty shootout advancement counts as a Cup win; only
regulation goals appear in the score and goal calculations.

Let:

```text
tierScale = 6 - currentDivision       // D5=1, D4=2, ... D1=5
heroAppearances = distinct powered user players who took part, capped at 4
```

The components are:

| Cause | Supporter delta |
| --- | ---: |
| User win | `+5 × tierScale` |
| Each distinct hero who appeared | `+1 × tierScale` |
| First or second consecutive loss | `0` |
| Third consecutive loss | `−3 × tierScale` |
| Fourth consecutive loss | `−4 × tierScale` |
| Fifth and later consecutive loss | `−5 × tierScale` |

The hero attraction and result component normally add together. From the third
straight loss onward, cap the combined result at a loss of at least one scaled
supporter unit:

```text
netLossImpact = min(
  -1 × tierScale,
  (heroAppearances - lossPenaltyUnits) × tierScale,
)
```

where `lossPenaltyUnits` is 3, 4, or 5 from the table. Heroes soften a bad run
but can never turn the third-or-later straight loss into growth. A draw or win
resets `consecutiveLosses` to zero. A Cup result participates in the same streak
as league results.

At D5, seven straight losses with no heroes cost 22 supporters, 4.4% of the
division's 500-supporter floor. The same percentage shape holds in every
division because both the crowd floor and delta scale by tier.

### 3.2 Actual participants, not the saved Starting XI

Production results must carry an ordered `participantPlayerIds` snapshot. It
contains every player who actually appeared, including substituted-out players
and substitutes. Hero attraction, appearance Fame, match morale, and Buzz all
read this same snapshot.

Quick Result and watched matches must build `FixtureResult` through one shared
adapter. The watched path must stop manually reconstructing a thinner object.
This fixes the existing bug where a scoring substitute gets goal Fame but no
appearance or win Fame, and where one final lineup is incorrectly reused for
both matches in a double-header.

Canon also promises that an unattended watch and Quick Result resolve
identically. The current alleged parity test runs the Quick configuration twice,
while production Quick auto-coaches the user side and watched does not. Before
audience rewards ship, a production-path test must run actual watched-with-no-
input versus Quick and require identical score, participant/power facts, and
audience impacts. The feature may not create different supporter/Buzz rewards
for two buttons the game promises are equivalent.

**Locked production policy B:** Quick treats the
  user as the controlled side with no tactical inputs, while retaining the same
  persisted Auto Subs choice and emergency-substitution behavior as a watched
  match. The opponent remains auto-coached.

B is recommended because watched Auto Subs is an explicit saved player choice.
A would silently override that choice and can race recorded tactical inputs at
the engine's automatic checkpoints. The exact B contract is:

> Quick Result is an unattended watched match: it uses the same opening
> formation and saved Auto Subs setting, applies no user tactical inputs, and
> auto-coaches only the opponent.

B may be implemented by constructing new Quick envelopes with the existing
`controlledTeam`, formation, and recorded `SUBSTITUTE` contracts. That changes
future Quick outcomes but not how an existing replay is interpreted, so it does
not require an engine bump by itself. Prove old-envelope replay equality. If the
implementation instead changes `automaticTeams`, a `MatchOpts` default, RNG
consumption, or the meaning of an existing envelope, bump `ENGINE_VERSION` and
rebaseline the golden deliberately. The implementation must replace the false
parity test with a production-path equality test before reward code begins.

Use a discriminated result contract rather than optional metadata:

```ts
type UserFixtureResult =
  | {
      source: 'PRODUCTION';
      participantPlayerIds: string[];
      powerFiredPlayerIds: string[];
      // existing score, scorer, and contribution fields
    }
  | {
      source: 'SYNTHETIC';
      // explicit test/harness opt-out; never emitted by the app
    };
```

For a production result:

- IDs are unique and belong to the user club;
- participants are ordered as kickoff XI, then substitutes by first entry;
- `powerFiredPlayerIds` is a unique subset of participants;
- scorer/contribution IDs satisfy the existing score and club invariants; and
- missing or invalid metadata fails the production action instead of falling
  back to the current lineup.

Participant and power ownership must be reconstructed by walking match events
in order, not by inspecting final player slots. Seed each slot with its kickoff
owner; on a power fire, credit the owner in that slot at that tick; on a
substitution, append the incoming player and then replace the slot owner. This
keeps a hero who fires and is later substituted credited correctly.

At match completion, convert those facts into one persisted
`PendingUserMatchImpact`, keyed by fixture ID. It snapshots competition,
league-before-Cup order, outcome, goals, participant IDs, power-fired IDs,
division scale, powered-player status at the time of appearance, and the
realized supporter/Buzz components. Settlement must not rederive hero status:
a player awakening between the league and Cup must not retroactively turn the
earlier appearance into hero attraction.

Synthetic results explicitly earn zero hero attraction and zero hero-moment
Buzz unless the synthetic fixture authors a complete valid impact. Production
code may never emit `source: 'SYNTHETIC'`.

### 3.3 Settlement order

Supporter impacts are queued as matches complete and applied after all gates and
merchandise for that week have been calculated. Therefore:

- a result never retroactively changes its own attendance;
- league and Cup gates in a double-header both use the same pre-week fan count;
- league impact survives the intermediate `phase: 'matchday'` state while the
  Cup is still waiting;
- both impacts apply once, in league-then-Cup order, after final settlement;
- fans never fall below zero.

Existing Cup-round fan awards remain separate and are added in the same final
fan update. Every positive realized delta still passes through `recordFanGain`
so Bert's first-fans sequence remains correct.

The Cup tip claiming the Cup is the only non-promotion route to grow the gate
must be rewritten in this same change.

The intermediate league-leg state is saved before the Cup can begin. A cold
reload from that state must retain the league participants, morale input,
supporter impact, and Buzz impact, then consume league followed by Cup exactly
once after the rotated second match. The Cup action remains disabled until the
specific career-save callback that contains the league impact succeeds; a
general `saving` flag is insufficient because replay writes share the queue.
The first failure immediately exposes Retry Save instead of waiting for the
general three-failure save block. A persisted checkpoint token identifies the
fixture and exact state; unrelated or coalesced save success cannot clear it.
Save failure keeps the Cup blocked, and only a successful retry of that exact
checkpoint releases it.

---

## 4. Managed sponsor offers

### 4.1 D5 continuity

Before managed sponsorship unlocks, the current scalar
`ClubState.sponsorMonthlyFee` remains the nominal monthly base. It pays on Weeks
4, 8, 12, 16, 20, 24, and 28 exactly as today.

The scalar becomes the division's baseline anchor after unlock; it is not a
second payment. Actual user income comes from the active portfolio, whose
nominal amounts sum around that anchor.

### 4.2 Slots and baseline shares

At each season opening, divide the current division's baseline across available
slots. Any rounding remainder belongs to the first slot:

| Division | Baseline total | Slots at first arrival | Baseline shares |
| --- | ---: | ---: | --- |
| D5 before unlock | $2,000 | basic sponsor only | $2,000 |
| D5 after a prior D4 unlock | $2,000 | 1 managed | $2,000 |
| D4 | $4,000 | 1 | $4,000 |
| D3 | $6,000 | 2 | $3,000 + $3,000 |
| D2 | $8,000 | 3 | $2,668 + $2,666 + $2,666 |
| D1 | $10,000 | 3 | $3,334 + $3,333 + $3,333 |

Every slot begins with a **provisional continuity contract** that preserves its
share if the manager does nothing. It is replaceable through Week 4, then locks
for the rest of the season when Week 5 begins. Missing the offer screen can
never remove baseline income. A previously promoted club relegated to D5 keeps
one managed slot and never receives a second basic-sponsor payment.

### 4.3 Offers

Offers generate at the beginning of each season and may be accepted during
Weeks 1–4. Each slot receives exactly three candidates: one `STEADY`, one
`BALANCED`, and one `BOLD`. The UI shows one slot at a time, so D2 has three
slot tabs with three cards each rather than nine cards in one scroll.

Accepting an offer atomically replaces that slot's provisional continuity
contract, removes the other two candidates for that slot, and locks only that
slot for the season. Other slots remain independently replaceable through Week
4. When Week 5 begins, all unresolved offers expire and untouched continuity
contracts lock. There is no mid-season cancellation or repeated switching.

The Week 4 sponsor payment settles before the Week 4→5 transition expires
offers and locks untouched continuity. The domain acceptance action validates
that the offer season matches, the current week is at most 4, the offer is still
present, and the assigned slot is still provisional. A stale, duplicated, or
replayed accept attempt fails with zero state or cash mutation.

Offer generation is deterministic from career seed, season, current division,
stable slot, profile, and candidate index. Brands are unique across the active
portfolio and current offer pool when the catalog has enough entries. Generation
consumes no simulation RNG and never calls
`Math.random` or `Date.now`.

Each offer snapshots:

- sponsor content id and rendered name;
- offer season and assigned slot;
- nominal monthly payment;
- objective kind, target, and bonus;
- offer profile (`STEADY`, `BALANCED`, or `BOLD`);
- for a signed contract only, signing season/week and whether it replaced a
  continuity contract.

Content churn cannot brick a save: active financial terms and player-facing
copy are persisted snapshots. A missing catalog entry may stop that brand from
appearing in future offer pools but cannot invalidate an existing contract.

### 4.4 Offer trade-offs

Each slot has a baseline share `M`:

| Profile | Monthly fee | Objective level | Win bonus | Goal bonus | Finish bonus |
| --- | ---: | --- | ---: | ---: | ---: |
| Steady | `1.05 × M` | easy | `0.25 × M` | `0.27 × M` | `0.25 × M` |
| Balanced | `1.00 × M` | normal | `0.85 × M` | `1.00 × M` | `1.10 × M` |
| Bold | `0.99 × M` | hard | `6.50 × M` | `6.50 × M` | `2.80 × M` |

Money rounds to the nearest whole dollar. The offer generator rotates profiles
and objective families so a candidate list cannot contain cosmetic duplicates.
The original one-bonus-per-profile terms passed only when all objective families
were averaged together. They failed the required family split in 20 cells and
created strict dominance. The family-aware terms above were measured across two
disjoint 3,000-seed cohorts: every family-value spread stayed within 10% (worst
`8.672%`) and no profile strictly dominated another in either cohort. Smaller
300-seed windows remain useful diagnostics but are too noisy to approve
dominance, because rare hard-objective completions can change its sign. Bold's monthly floor is
`0.99 × M` because hard Chairman win targets complete near zero in several
cells; no bonus multiplier can balance a `0.90 × M` guaranteed floor when the
bonus almost never lands.

With seven monthly payments, expected value in units of `M` is:

```text
Steady   = 7.35 + familyBonus × pEasy
Balanced = 7.00 + familyBonus × pNormal
Bold     = 6.93 + familyBonus × pHard
```

The bonus multipliers remain subject to the measured band in Section 11.

The first content set uses only objectives derivable from persisted league
results:

| Objective | Easy | Normal | Hard |
| --- | ---: | ---: | ---: |
| Win league matches | 5 | 8 | 12 |
| Score league goals | 18 | 26 | 36 |
| Finish in the league | Top 7 | Top 4 | Top 2 |

Chairman targets are `+2` wins, `+4` goals, or one finishing place tighter
(minimum Top 1). The bonus payment also receives the existing sponsor-income
percentage, preserving Chairman's current 80% sponsor economy.

Objective progress is derived exclusively from persisted league fixtures. It
includes eligible matches already played if an offer is signed after Week 1.
The contract snapshots terms, not mutable progress; final outcome/payment state
is persisted only when settled. Finish-position objectives cannot become final
before Week 30. There is no signing advance and no signing perk.

### 4.5 Payment timing

- Each active sponsor pays an itemized ledger line on Weeks 4, 8, 12, 16, 20,
  24, and 28.
- Objective bonuses settle on Week 30 if met.
- Failed objectives record their outcome for the Sponsor Desk but add no fake
  `$0` income line.
- All sponsor cash is included before financial safety.
- A contract signed before Week 4 settlement participates in the Week 4
  payment; one signed after that settlement is impossible because state has
  already advanced to Week 5.
- Compute difficulty at portfolio level:

  ```text
  actualTotal = floor(sum(nominal slot fees) × sponsorIncomePercent / 100)
  ```

  Then allocate the exact `actualTotal` across itemized slot lines by stable
  slot order using largest remainders. The lines must sum exactly to the legacy
  scalar result at D2/D1 on Chairman. Ledger, Buzz, forecasts, confirmation, and
  accessibility labels all call this same helper.
- A ledger idempotency key of sponsor/season/week/slot makes retries safe.

---

## 5. Buzz

### 5.1 Meter and earnings

Buzz is an integer progress meter from 0 to 100. It is not Money, TP, or an item
the player can spend.

From Season 3, each user match contributes:

| Cause | Buzz |
| --- | ---: |
| User win | +4 |
| Each user goal | +1 |
| Each distinct user hero who fires at least one power | +2 |

`powerFiredPlayerIds` is validated by the shared production result adapter and
snapshotted in `PendingUserMatchImpact`. Repeated fires by the same hero in one
match still count once. A Cup shootout win earns the win component; shootout
kicks are not goals.

Synthetic results with no power metadata earn no hero-moment Buzz. Production
Quick and watched paths must both provide it.

### 5.2 Two settlements

Buzz settles at the final weekly settlement for Weeks 15 and 30. Apply every
current-week pending Buzz impact to the capped meter **before** calculating the
payout, so the Week 15 league match belongs to the first half:

```text
nominalSponsorIncome = managed sponsorship unlocked
  ? sum(active contract fees)
  : userClub.sponsorMonthlyFee

actualMonthlySponsorIncome = floor(
  nominalSponsorIncome × difficulty sponsor percent / 100
)
buzzPayout = round(actualMonthlySponsorIncome × buzz / 100)
```

At 100 Buzz, a half-season payout equals one actual monthly sponsor payment.
After payment the meter resets to zero. A persisted period marker prevents a
Week 15 or Week 30 reload/retry from paying twice.

A D5 Season 3 club uses its basic sponsor's actual monthly value. Buzz therefore
keeps its Season 3 promise without prematurely unlocking managed offers.

Buzz earned in a league/Cup double-header accumulates through both matches and
settles once. The payout line is added before financial safety.

### 5.3 Player feedback

Post-match summary shows one compact line:

```text
BUZZ  64/100   +12  · Win +4 · 4 goals +4 · 2 hero moments +4
```

The weekly ledger uses `Buzz payout · First half` or `Buzz payout · Season end`.
The meter resets only after that line is durably part of the state.

Persist `lastBuzzSettlementSummary` with period, before value, raw earned,
realized earned after the cap, pre-payout value, payout, and reset value. A
normal post-match card may show the projected pending meter. A payout card says
`Reached 64 · Paid $2,560 · Reset to 0`; it must not show `64/100` as the live
post-reset balance.

---

## 6. Weekly settlement contract

The current Cup flow awards prize money after loans and forced sales. That bug
must be fixed as a prerequisite, not copied into sponsors and Buzz.

For a week containing any combination of league, Cup, monthly sponsor, Buzz,
and season-end money, the order is:

1. Complete, validate, and persist one `PendingUserMatchImpact` for every user
   match, saving the league leg before a waiting Cup leg can begin.
2. Derive gates from the pre-week supporter count.
3. Apply current-week Buzz components in league-then-Cup order, cap at 100, and
   calculate/reset an eligible Week 15 or 30 payout.
4. Build a `WeeklySettlementAwards` input containing the just-earned Cup cash
   and fan awards plus all other due awards.
5. Add monthly sponsor lines, Cup prize, Buzz payout, objective bonus, league
   prize, recruitment fund, merchandise, wages, upkeep, and other normal lines.
6. Run financial safety once against the complete line set.
7. Persist one final ledger and cash balance.
8. Apply queued supporter impacts and Cup supporter awards for future weeks.
9. Consume the pending match impacts, then advance construction, requests,
   scouting, and other weekly sidecars.

No screen awards money. `WeeklySettlementAwards` replaces the current
post-settlement Cup mutation; no award path edits a settled ledger afterward.

New and migrated ledger lines accept an optional `idempotencyKey`. New cash
awards require one, with distinct namespaces for monthly sponsor, objective,
Buzz half, Cup round, league prize, and recruitment fund. Before appending, the
engine checks existing ledgers for the key. Ledgers are retained, so a separate
unbounded paid-key set is unnecessary. Test retries before and after save/load
and byte-identical repeated reconciliation.

### 6.1 Season transition order

Season rollover performs one guarded business transition:

1. expire old terms;
2. apply promotion/relegation;
3. update highest division reached and retained slot capacity;
4. update the scalar division anchor;
5. create the new provisional continuity portfolio;
6. generate three offers per slot exactly once;
7. stamp portfolio and offer season; and
8. queue eligible guide sequences.

Load reconciliation may restore missing baked sponsor rules, but it may not
regenerate brands, reopen expired offers, or overwrite signed terms when the
portfolio/offer season stamp already matches.

---

## 7. Facility-upgrade rebalance

### 7.1 First calibrated price table

Keep every Level-1 build price, relocation fee, construction time, and weekly
upkeep unchanged in this cycle.

- Level 2: current price ×1.25, rounded to the nearest $500.
- Level 3: current price ×1.50, rounded to the nearest $500.
- Coaching Office Level 2/3: disable the upgrade action until those levels have
  a real benefit. Charging more for a known zero-benefit purchase is forbidden.

| Facility | New Lv2 | New Lv3 |
| --- | ---: | ---: |
| Training Pitch | $10,000 | $18,000 |
| Gym | $9,000 | $16,000 |
| Tech Center | $11,500 | $20,500 |
| Shooting Range | $9,500 | $17,000 |
| Keeper Court | $9,500 | $17,000 |
| Medical Bay | $12,500 | $22,500 |
| Dorm | $7,500 | $13,500 |
| Scout Office | $7,500 | $13,500 |
| Coaching Office | Disabled | Disabled |
| Youth Field | $15,000 | $27,000 |
| Fan Shop | $6,500 | $11,500 |
| Stadium Stand | $19,000 | $34,000 |

Excluding the broken Coaching Office, the table adds $24,500 across all Level-2
upgrades and $71,000 across all Level-3 upgrades: $95,500 of long-career sink
capacity. The essential D5 Training Pitch path rises by only $2,000.

Production-path measurement found the Level-2 Pitch can still be bought in
Week 3 on both difficulties at $10,000. Its two settlement ticks are Weeks 3
and 4, so the upgrade completes after Week 4 settlement and is usable from
Week 5. That is promising evidence, not permission to skip the full balance
suite below.

### 7.2 Historical cost basis

`PlacedFacility` must persist actual `capitalInvested`. Builds and upgrades add
the amount actually paid at transaction time, including an in-flight paid
project. Facility closure refunds half this persisted basis, not half of today's
catalog price.

`capitalInvested` is a nonnegative safe integer. It changes exactly when build
or upgrade cash is paid, never again when construction completes. Relocation,
upkeep, adjacency, and output never affect it. The sequence start upgrade →
save → reload → complete → close must refund the same half-basis as a sequence
without the reload.

Schema-3 migration calculates old basis from the old price table:

- seeded building: completed upgrades only;
- player-built building: historic build plus completed upgrades;
- paid in-flight upgrade: also include its historic upgrade price;
- paid in-flight build: include its historic build price.

The migration carries a frozen schema-3 price table; it must not import the
newly priced live catalog. Its exact rule is:

```text
(seeded ? 0 : old build cost)
+ old completed upgrade costs through current level
+ old target-upgrade cost when this building has a paid UPGRADE project
```

A paid BUILD project is already represented by the first term and is never
added twice.

This prevents an old Level-3 Training Pitch that cost $28,000 from receiving a
refund based on the new $36,000 price.

### 7.3 Facility integrity dependencies

Before charging the new prices:

- the Training Pitch's active UI copy and placement preview must say **+28 TP
  per completed level**, using the exported engine constant rather than a
  duplicated literal;
- Coaching Office upgrades must be disabled until useful;
- closing a staffed Coaching Office opens one confirmation naming the assistant,
  one-week severance, facility refund, and net cash effect. Confirm dismisses
  and closes atomically; cancel changes neither. The refund may fund severance,
  so the player is not forced through an unaffordable dismiss-first dead end;
- the ordinary facility-close domain path rejects a staffed Coaching Office.
  One pure combined transaction is the only allowed path: exact affordability
  uses `cash + refund >= severance`; if false, confirmation is disabled with the
  exact shortage. Success records separate assistant-dismissal and
  facility-closure one-off lines; cancel or rejection leaves staff, facility,
  cash, and transaction history unchanged;
- Coaching Office's disabled upgrade state names the real reason and never
  falls through to a false `Locked · promotion` label;
- new construction is limited to one facility of each type. The catalog disables
  an already-built type and points the player to its grid card to upgrade, move,
  or close it. Legacy saves with duplicates remain valid, but their max-only
  effects still do not stack;

The price increase may not make an existing player-facing trap more expensive.

---

## 8. State, content, and determinism

### 8.1 Suggested state boundary

Add a plain-JSON `clubBusiness` sidecar to `GameState`:

```ts
interface ClubBusinessState {
  supporters: {
    consecutiveLosses: number;
    lastAppliedImpact?: SupporterWeekSummary;
  };
  pendingUserMatchImpacts: PendingUserMatchImpact[];
  sponsorship: {
    activeContracts: SponsorContractSnapshot[];
    offers: SponsorOfferSnapshot[];
    portfolioSeason: number;
    offerSeason?: number;
  };
  buzz: {
    value: number;
    lastSettledSeason?: number;
    lastSettledHalf?: 1 | 2;
    lastSettlementSummary?: BuzzSettlementSummary;
  };
}
```

Unlocks and slot capacity are derived from season and
`highestDivisionReached`; they are not competing mutable booleans.

The discriminated production result adds required `participantPlayerIds` and
`powerFiredPlayerIds`. One game-layer helper converts both quick and watched
simulation results into this exact shape, validates it, and snapshots the
durable pending impact before a double-header can pause.

### 8.2 Content

Sponsor brands and offer copy live in typed `content/sponsors.json`, validated by
Zod and baked explicitly into `CareerSetup` and `GameState` as sponsor rules,
like the other game catalogs. Load reconciliation receives validated launch
content and restores missing rules before it generates an eligible migrated
offer pool. The persistence migration itself never imports content. The pure
`src/game` ring does not import JSON or React Native.

The initial objective rules are code/data inputs to pure deterministic
functions. Active terms are snapshotted in the save, so later content edits do
not rewrite signed contracts.

This feature changes career/economy state and does not consume match RNG.
Constructing future Quick envelopes from existing controlled-team options and
recorded inputs changes the production caller, not replay interpretation, so B
does not require an `ENGINE_VERSION` bump by itself. If implementation changes
engine defaults, RNG consumption, or an existing envelope's meaning, that
separate change requires the usual version decision.

---

## 9. Save migration: schema 3 to 4

Raise `GAME_SCHEMA_VERSION` from 3 to 4 and add an explicit 3→4 rung. The rung
must operate only on data guaranteed by schema 3.

Implementation order is stricter than feature order: the complete final v4
shape, codec, migration rung, facility-basis constructors, and application load
reconciliation land atomically **before** any path can persist a new field. A
serializer must refuse a schema-3 object that already contains `clubBusiness`,
`capitalInvested`, or baked sponsor rules; remigrating such a contaminated save
could erase a waiting match impact or overwrite real basis. Tests assert that no
new-shape save is ever emitted with `schemaVersion: 3`.

### 9.1 Sponsor preservation

For the user club:

1. Read its exact nominal `sponsorMonthlyFee`.
2. If managed sponsors are still locked, create no managed slots and retain the
   basic sponsor path.
3. If D4+ has already been reached, create continuity contracts whose nominal
   sum equals that exact scalar; do not apply a new division table during
   migration.
4. Give migrated continuity contracts no current-season objective and no
   retroactive bonus.
5. Preserve the existing Week `% 4 === 0` payment cadence.
6. Ensure settlement reads either the basic scalar or the portfolio, never both.
7. Apply the same existing difficulty percentage after migration.

The codec creates only data it can derive from schema 3. Application load
reconciliation attaches validated sponsor rules and then:

- in Weeks 1–4, deterministically generates the current-season three-per-slot
  offers before the actionable guide can be due; or
- in Week 5 or later, stamps the offer window expired, keeps continuity income,
  and queues the non-actionable migrated-career copy from Section 2.3.

The acceptance fixture is exact: load a schema-3 save immediately before a
sponsor week, settle both the old and migrated forms, and assert identical
sponsor line amount and final cash.

### 9.2 Buzz migration

Migration never invents past Buzz or pays a past half-season. Existing ledgers
are authoritative at a boundary:

| Migrated state | Current period | Mark as already consumed |
| --- | --- | --- |
| Season <3 | locked, value 0 | none |
| Season 3+, Week 1–14 | first half, value 0 | previous season H2 |
| Week 15 manage/matchday, no W15 ledger | first half, value 0 | previous season H2 |
| Week 16–29 | second half, value 0 | current season H1 |
| Week 30 manage/matchday, no W30 ledger | second half, value 0 | current season H1 |
| Week 30 with W30 ledger or `season-end` | closed, value 0 | current season H2 |
| Next-season Week 1 | new first half, value 0 | previous season H2 |

If a Week 15 or Week 30 ledger already exists, that half is consumed regardless
of a stale phase field. An unsettled boundary may collect only matches played
after migration; no migration path appends a Buzz ledger line.

### 9.3 Supporters and facilities

- Initialize loss streak and pending supporter impacts to zero/empty. Existing
  fan totals are unchanged.
- Migrate actual historical facility cost basis using the old catalog, including
  paid projects under construction.
- Do not recalculate old cash transactions, old ledger balances, or old refunds.

### 9.4 Migration tests

Required coverage:

- full representative schema-3 career, not a three-key partial object;
- schema 3→4 and schema 2→3→4 ladder;
- missing rung and future-version refusal;
- serialize/parse round trip of all new state;
- D5, D4, D3, and D2 sponsor continuity sums;
- D5 after prior unlock, with one managed slot and no basic double payment;
- Chairman next-payment equality;
- no double payment;
- no retroactive Buzz;
- current and in-flight facility cost basis;
- malformed sponsor snapshots fail clearly;
- removed sponsor content does not brick a signed contract;
- Week 2, Week 4 before settlement, Week 5, Week 15 before settlement, Week 16,
  Week 30 matchday, Week 30 season-end, and next-season Week 1 truth-table cases;
- crash/reload after a league leg with a waiting rotated Cup lineup;
- start facility upgrade → save/reload → complete → close cost-basis invariant.

The existing schema-2 Player Requests reconciliation defect is a separate P1
save bug and must be fixed before claiming the expanded migration ladder safe.

---

## 10. Club > Finances UX

### 10.1 Visibility

- D5 before Season 3 and before D4: no Sponsor Desk card. Existing sponsor cash
  remains visible in the ledger.
- Season 3 while still D5: show a compact **Club Buzz** card and the basic
  sponsor's actual monthly amount; do not show offer controls.
- D4+: show **Sponsor Desk** with active slots, offers during Weeks 1–4,
  objective progress, next payment, and Buzz when Season 3 is active.
- Migrated D4+ Week 5–30: show the continuity contract plus `New offers next
  pre-season`; do not render an empty actionable offer area.

### 10.2 Phone layout

At 375pt:

- one sponsor card per row and one active slot panel at a time;
- no horizontal carousel or table;
- sponsor names and objectives wrap to as many lines as needed; they never
  truncate. Content validation caps sponsor display names at 28 characters and
  short objective labels at 72 characters, but layout must still grow safely;
- money, target, progress, and next-payment week may not ellipsize;
- active status, success, and failure use text/icon plus color, never color alone;
- actions have at least a 44pt hit region and pressed feedback;
- confirmation names the slot, monthly amount, objective, and bonus;
- no Pressable contains another Pressable;
- signing success stays on screen with the active contract visibly replaced;
- reduced motion removes decorative movement without removing state feedback.

Slots use a real tab contract: `tablist`/`tab`/`tabpanel`, `aria-selected`, and
linked tab/panel IDs on web plus the native selected state. Web focus roves
between tabs; Arrow Left/Right and Home/End change focus/selection predictably.
Each offer card has an immediate `Review offer` button;
offers are not radios and do not use checked semantics. Review opens a true
confirmation modal. Confirm signs; Cancel, Escape, and Android Back close it
without changing the contract. Web background content becomes inert/hidden,
Tab stays inside the modal, and initial focus lands on its heading.
Cancel/Escape/Back restores focus to the triggering Review button. After
Confirm that offer no longer exists, so focus moves to the replacement active
contract or stable slot heading. Successful signing is announced once through a
polite live region and leaves the new active contract visible.

Suggested active card:

```text
┌──────────────────────────────────┐
│ NORTHSTAR TOOLS        ACTIVE 1/1│
│ Contract $4,000 / month          │
│ You receive $3,200 · Next: W12   │
│ Win 8 league matches       5 / 8 │
│ Target bonus                 $4k │
└──────────────────────────────────┘
```

Suggested Buzz card:

```text
┌──────────────────────────────────┐
│ CLUB BUZZ                 64 /100│
│ Next payout: Week 15             │
│ At today's rate: $2,560          │
│ Wins +25 · Goals +17 · Heroes +22│
└──────────────────────────────────┘
```

### 10.3 Accessibility

The feature must not repeat the project's current web accessibility-state bug.
Selectable tabs set both native `accessibilityState` and explicit web ARIA state
through a shared cross-platform control. Sponsor progress has an accessible
label such as:

```text
Northstar Tools. Active sponsor. Contract value four thousand dollars per month.
On Chairman, the club receives three thousand two hundred dollars per month.
Objective: win eight league matches. Five of eight complete.
Contract bonus: four thousand dollars. Club receives three thousand two hundred.
```

Normal-size text meets WCAG AA contrast. Focus order follows visual order.
Measured touch regions are at least 44pt; a utility class name alone is not
proof. Cozy may omit the duplicate `You receive` line because contract and
actual are equal. Chairman always shows both nominal contract and actual club
receipt on candidate cards, confirmation, active cards, forecasts, and spoken
labels. Buzz estimates use only the actual receipt.

Worst-case text QA uses the supported 1.6 Dynamic Type cap. The in-app Text Size
preference currently applies to story/review copy and is not expanded to Club
Finances by this feature; acceptance must not claim otherwise. The current
match-only High Contrast preference is likewise not silently treated as a Club
Finances feature; this screen's default semantic text palette must pass contrast
without that toggle.

### 10.4 Copy sweep

Update every player-facing claim that this feature invalidates, including:

- economy docs still promising sponsor perks;
- the Cup tip claiming it is the only non-promotion fan-growth path;
- sponsor slot/fame wording replaced by the D4/D3/D2 progression;
- handbook/glossary descriptions of fans and sponsors;
- all monthly/half-season labels so no screen calls a nominal number the actual
  Chairman payment.

The Bert handoff and sponsor section also require observable focus targets in
the production view model; a `focus` string that merely routes to Club >
Finances without revealing, scrolling, and focusing the requested section does
not satisfy the sequence.

---

## 11. Balance verification

### 11.1 Counterfactual measurement

Use two complementary deterministic harnesses:

1. **Frozen-outcome accounting replay.** Feed identical schedules, squads,
   results, participant facts, power moments, and intended purchase policy to
   control and feature economies. Report exact income attribution and the first
   point where a higher price becomes unaffordable. Match outcomes stay frozen.
2. **End-to-end policy cohort.** Run the same manager policy on both economies
   and allow affordability, training, transfers, and later results to diverge.
   Use this for promotion, survival, intervention, and cash-distribution rails.

The accounting control uses current scalar sponsors and fan behavior. The
feature run uses offers, objectives, Buzz, supporter growth, and new upgrade
prices.

Attribute incremental cash separately:

1. monthly offer delta from the division baseline;
2. sponsor objective bonuses;
3. Buzz payouts;
4. extra gate income from ordinary supporter changes;
5. extra Fan Shop income from those supporter changes;
6. added facility-upgrade capital cost.

Do not use a divergent end-to-end result to explain exact cash attribution; that
is the frozen replay's job. Do not use frozen results to claim real progression
is safe; that is the policy cohort's job.

### 11.2 Required rails

- Training Pitch is still bought in Week 3, completes after Week 4 settlement,
  and is operational from Week 5 on Cozy and Chairman in the prepared D5 path.
- A trained/building career promotes from D5 within two seasons; an idle career
  does not accidentally promote because of cash changes.
- In the first complete Buzz-active season, the 25th percentile of realized new
  sponsor/Buzz/fan income is at least $2,500, or 1.25 times the mandatory
  $2,000 Level-2 Pitch uplift. The earlier twice-uplift target was rejected by
  the 300-seed D5 cohort because it exceeded even typical realized income; this
  rail still requires the lower quartile to cover the full uplift with a 25%
  buffer. Report D5-with-basic-sponsor and D4+-managed cohorts separately.
- Matched financial-intervention rate is no worse than the current-price
  control. Do not require zero Chairman loans; an all-draw Chairman baseline
  already borrows.
- Preserve the $15,000 first-D4 recruitment fund and the existing prepared
  signing/survival rails.
- Across a canonical one-of-each long-career facility plan, the $95,500 added
  upgrade sink absorbs a substantial majority of the new cumulative cash by
  D1; target 70–100%, then tune offer/Buzz values before widening this band.
- Report objective completion probability and expected season value for every
  profile × objective family × division × difficulty. Target each profile's
  measured expected value within ±10% of the others in the same cohort and no
  strict dominance. The calibrated family-aware terms in Section 4.4 must
  continue to pass both canonical and held-out cohorts.
- Typical active play reaches a meaningful Buzz payout without capping at 100
  every half. Target median 55–85 and cap rate below 25% in matched cohorts.
- Ordinary supporter gain must not erase the 500-fan promotion step or make the
  Cup's existing 212-fan full-run reward trivial.
- A seven-loss D5 streak remains slow decline, not a career collapse.
- Cozy and Chairman both remain fail-soft with no new unrecoverable state.
- Preserve D2→D1 promotion pacing and first-D1 survival in addition to D5 and
  first-D4 rails. Level-3 upgrades land exactly when Tier-4 drills and D1-quality
  recruitment compete for cash, so D5 evidence alone cannot approve them.

Run enough fixed seeds for stable percentiles and report the sample size,
median, P25/P75, intervention rate, promotion timing, and cap rate. A single
seed is a smoke test, not balance evidence.

---

## 12. Verification matrix

### Pure game tests

- supporter formula at every streak boundary and division;
- third-or-later loss remains net-negative with four heroes;
- draw/win reset, Cup shootout win, zero-floor fans;
- heroes must actually participate;
- substitute participant gets correct fan/Fame/morale credit;
- league/Cup rotation uses each match's own participants;
- Quick/watched result adapter equality for the same unattended input policy;
- deterministic sponsor offer generation and no duplicate candidates;
- slot capacity at D5/D4/D3/D2/D1 and after relegation;
- three offers per slot, partial signing/reload, per-slot lock, and Week 5 expiry;
- continuity income equals division anchor;
- all objective families, Chairman targets, and exactly-once bonuses;
- Buzz components, cap, two payouts, resets, and D5 basic sponsor payout;
- Week 15's match contributes before first-half Buzz pays and resets;
- D2/D1 Chairman aggregate rounding and deterministic line allocation;
- payout/prize-before-safety ordering, including a Cup win that prevents a
  forced sale;
- double-header gates use pre-week fans and apply both supporter/Buzz impacts
  once;
- new facility prices, disabled Coaching Office upgrade, and persisted refunds;
- six-season byte-identical replay of the game state for the same seed/actions;
- stable ledger idempotency keys across retry and save/load;

### Application and persistence tests

- watched and Quick paths both populate participants/power moments;
- first D4 and Season 3 guide scheduling, including simultaneous unlock order;
- guide displacement with zero through three occupied inbox slots;
- one-shot guide persistence across save/load;
- sponsor selection confirmation and contract lock;
- schema migration matrix in Section 9;
- season transition preserves chosen terms until expiry and does not overwrite
  them with the scalar baseline;
- all sponsor/Buzz cash lines save before any recovery action;
- cold reload between league and Cup legs preserves each match's participant
  impact and consumes both once;

### 375pt production-screen cases

Add real dev-harness states that feed the production screen and view model:

1. D5 before all unlocks;
2. Season 3 D5 with Buzz but no offers;
3. first D4 season, one slot and three offers;
4. D3 with two unsigned slot panels, then one signed/one provisional;
5. D2/D1 with three unsigned slot panels, then a partial portfolio;
6. completed and failed objectives;
7. Buzz at 0, 64, 100, and immediately after payout;
8. long sponsor name, largest money value, and wrapped objective;
9. Cozy and Chairman actual-payment wording;
10. default palette contrast audit, largest supported text, reduced motion,
    screen-reader traversal, keyboard/web traversal, and Android Back on
    confirmation;
11. migrated Week 5 continuity with no impossible offer action;
12. Week 4 offers versus Week 5 expiry;
13. Sponsor Desk and Buzz walk-ons, focus handoff, and queue displacement;
14. actual DOM/AX selected state and keyboard tab navigation; modal initial
    heading focus, inert background, containment, cancellation/confirmation
    focus restoration, signing announcement, and measured 44pt hit regions.

Acceptance requires screenshots and interaction notes at 375pt, not only string
or snapshot tests. Any web preview is muted immediately and closed with its
server when QA ends.

---

## 13. Canon superseded on approval

This design intentionally replaces three current promises rather than silently
coexisting with them:

| Current canon | This design |
| --- | --- |
| D5 begins with one managed sponsor slot and objective | D5 keeps passive baseline income; managed choice begins at D4 |
| Sponsor slots unlock by fame tier | Slot capacity permanently unlocks at D4/D3/D2 |
| Sponsors include signing perks | Sponsor perks are cut; contracts contain monthly pay and an objective bonus only |

The implementation change must update `docs/06-economy.md`,
the README decision log, handbook/glossary/tips, and tests in the same branch.
Until that lands, the existing checked-in canon remains the source of truth.

---

## 14. Non-goals and hardest risk

Out of scope:

- sponsor perks or sponsor-exclusive unlocks;
- ticket-price controls or demand elasticity;
- Chemistry;
- sponsor negotiation;
- a third currency;
- new match behavior, art assets, or native dependencies;
- making Coaching Office levels useful in this feature cycle.

The hardest part is **not** rendering sponsor cards. It is preserving one honest,
deterministic financial story across watched matches, Quick Result,
league/Cup double-headers, weekly safety, season rollover, and schema-3 saves.
That work touches high-value career data and balance, so cutting participant
snapshots or settlement-order tests would create regressions. The safe scope cut,
if one is ever needed, is the variety of sponsor brands/objective families—not
the migration, atomic settlement, or Quick/watched parity foundations.
