# Real-Player Balance Harness — Opener and Early Progression

**Date:** 2026-07-30

**Status:** Revised draft for independent audit (r2) — no implementation or balance
change approved

**Owner intent:** Balance against how engaged people actually prepare, including
training, coaches, facilities, and drill upgrades. Test an ordinary Cozy manager and
a smart Chairman manager, plus crossed difficulty diagnostics.

## Executive decision

Do **not** implement revision 1 of this spec. Two independent external reviews found
the same load-bearing factual error, and a fresh production-code audit confirmed it:

> There is no club-wide three-player or three-slot weekly training limit.

The retired weekly-plan system had such a cap. Instant training replaced it.
Production hard-gates drills through player ownership, existing injury, available
TP, and `TRAINING_PRIORITY` promise debt. Condition is a cost and potential injury
risk, not a hard gate; useful stat headroom is a player-policy concern. Existing
probes that choose three players are test policies, not proof of a game rule.

Revision 2 makes four decisions:

1. Model the real instant-training constraints and treat training distribution as the
   central experiment.
2. Build a small decision-grade opener harness before a full autonomous-career bot.
3. Measure the current opponent before trying the proposed +5 role-stat buff.
4. Keep two-season and ten-season progression as later, separately approved phases.

### Recommended opener contract

Joe originally expected roughly a 5% chance of winning. Unless he explicitly chooses
a guaranteed scripted result, the recommended contract is therefore:

- **statistical loss-first**
- maximum opener win rate: **5%**
- minimum opener loss rate: **90%**
- primary promises:
  - Ordinary × Cozy
  - Smart × Chairman
- crossed cells remain diagnostics:
  - Ordinary × Chairman
  - Smart × Cozy

A statistical rail passes only when the upper 95% confidence bound for wins is at or
below 5% **and** the lower bound for losses is at or above 90%.

If the actual product requirement is “the opener must be lost in every career,” stop
fitting stats and author the tutorial result. No probabilistic +5 buff can guarantee
zero wins.

This recommended contract still requires owner confirmation before an opponent change
can ship. The truthful baseline can be measured first.

## External-review synthesis

| Feedback | Agreement | Orchestrator decision |
|---|---|---|
| No three-player weekly training cap exists | Both reviewers agreed; production confirms | **Accepted.** Remove every cap/slot claim and add an absence-of-cap contract test. |
| Nine opening drills are mandatory | Both rejected this | **Accepted correction.** Nine drills are an Ordinary policy; ten are affordable before kickoff. |
| Training concentration may be a Smart exploit | Both agreed | **Accepted.** Add four-player, extra-FWD, and full-concentration sensitivity arms. |
| Measure before adding +5 | Both agreed | **Accepted.** Current opponent always runs first. |
| Revision 1 is too broad | Both agreed | **Accepted.** V1 answers the opener; early and full career move to later phases. |
| Existing 1,000-seed and 10-seed claims are not archived | Both agreed | **Accepted.** Treat them as unarchived observations until reproduced into a versioned artifact. |
| Human traces should block the opener | Both rejected this | **Accepted.** Human calibration is later and non-blocking for the first measurement. |
| Watched Smart controller, UI parity, and Chairman-to-Cozy logic belong in V1 | Both rejected this | **Accepted.** Move them to the roadmap/separate product spec. |
| Full calibration plus held-out program is required for +5 | Reviewers differed | **Simplified.** Use one frozen 1,000-seed baseline. If several buffs are compared, confirm the selected candidate once on a second frozen 1,000-seed cohort. |
| Choose authored loss immediately | Both said it is correct only for a literal guarantee | **Not chosen automatically.** Recommend the statistical 5%/90% contract because it matches the stated expectation; make a literal guarantee an explicit owner override. |

## Corrected production truth

The harness must call production functions and content. It must not copy these rules
into an alternate simulator.

### Training capacity

`trainPlayerInstantly` checks:

- player belongs to the user club
- player is not injured
- any active `TRAINING_PRIORITY` promise is satisfied first
- the club owns the drill's TP cost

Production behavior:

- Tier I costs **10 TP**
- each instant drill costs **8 condition**
- ordinary weekly condition recovery is **12**
- each completed Dorm level adds **4** recovery
- an injury roll occurs only when a drill **starts below 30 condition**
- the engine has no per-week drill counter
- the engine has no per-week distinct-player limit
- the retired `maxFocusDrillsPerWeek` field is removed during save migration

Useful gain/headroom remains a policy and UI concern. A smart policy should not spend
TP on a drill whose visible preview shows no improvement.

### Opening resources and timing

- fresh career: **30 TP**
- base weekly TP: **24**
- Level 1 head coach: **12 TP per settlement**
- Training Pitch: **28 TP per completed level per settlement**
- the first fixture is Week 3
- Week 3 opens in management, so training can happen before entering matchday
- a Week 1 Training Pitch completes into Week 3 management
- it is operational for Week 3's DEF/Duels gain multiplier
- it awards no +28 before kickoff; its first +28 arrives after the opening match
- facility drill multipliers are **1.00 / 1.25 / 1.50 / 2.00**

### Longer progression facts

- head coach TP: `10 + 2 × level`
- assistant TP: `5 + level`
- matching coach specialties improve relevant drill gains
- retained coaches improve through the production auto-level rule
- drill TP costs: **10 / 15 / 21 / 28 / 36**
- drill base gains: **5 / 8 / 12 / 17 / 23**
- Tiers I–V become available in D5/D4/D3/D2/D1
- tier-upgrade prices: **$3,000 / $8,000 / $18,000 / $40,000**
- an available tier must still be bought
- only one facility construction project may run at a time

### Known stale descriptions

These are truth-cleanup tasks, not evidence for the harness:

- `content/glossary.json` still says Training Pitch +10 TP per level
- `src/ui/screens/ClubFinancesScreen.tsx` still displays +10 TP
- `docs/05-players-training-coaches.md` and `docs/06-economy.md` describe older TP
  and drill rules
- `src/game/pyramid.ts` still contains a stale comment about three weekly training
  slots
- the README says the opener is the third-strongest D5 opponent, while production
  makes it the strongest

Correct these separately when implementation is approved. Do not change production
balance merely to match stale copy.

## Evidence status

Two local observations motivated this work:

- a 1,000-seed run of the old PAC-only policy
- a 10-seed smoke using coach, Training Pitch, and role-correct drills

Neither result has a committed configuration-plus-outcome artifact in this
repository. They may be mentioned as **unarchived local observations**, but they are
not decision evidence and must not anchor a balance change.

The existing `scale-invariant-opening-gate.json` is a valid historical artifact for a
different policy and engine checkpoint. It does not establish today's real-player
opening rate.

V1 must reproduce its own baseline and save the artifact before quoting a result.

## Questions V1 must answer

1. After the intended Week 1 coach, Training Pitch, and role-correct training, is the
   current opener still loss-first?
2. Does spending the final affordable Week 3 drill make the opener materially easier?
3. Is concentrating training on the created FWD an exploit, or does the resulting
   fatigue cancel the stat gain?
4. Does a four-player Smart spread change the result versus three-player breadth?
5. Do Cozy and Chairman produce identical opener results for the same policy and seed
   while their action/resource traces remain identical?
6. If the current opponent fails the opener rail, does the proposed +5 role-stat arm
   restore it without creating ugly blowouts?

## V1 non-goals

V1 does not claim to model an entire ten-season player.

It does not include:

- ten-season career cohorts
- transfers, youth, contract strategy, hero-wage strategy, aging, or retirement
- a deterministic watched-match Smart controller
- app-wide management-action recording
- replaying human management traces
- full UI/store parity
- a complete rare-branch matrix
- Chairman-to-Cozy prompt logic or copy
- a permanent opponent-club rebalance

Those remain useful later. They do not block measuring the training question that
prompted this spec.

## Opening TP and condition contract

Both player profiles:

- create a legal FWD
- hire the intended Level 1 head coach in Week 1
- start the Training Pitch in Week 1
- use only production drill previews and production instant-training actions
- retain real condition, caps/headroom, modifiers, and injuries

### TP timeline

| Moment | TP before | Policy action | TP after |
|---|---:|---|---:|
| Week 1 management | 30 | Three Tier I taps | 0 |
| Week 1 settlement | 0 | +24 base +12 coach | 36 |
| Week 2 management | 36 | Three Tier I taps | 6 |
| Week 2 settlement / Week 3 begins | 6 | +24 base +12 coach | 42 |
| Week 3 Ordinary | 42 | Three Tier I taps | 12 |
| Week 3 Smart | 42 | Four Tier I taps | 2 |

Total available before kickoff is **102 TP**.

- Ordinary policy: **9 taps / 90 TP / 12 TP banked**
- Smart policies: **10 taps / 100 TP / 2 TP banked**

Nine taps are not a production maximum. Ten taps are not a club-wide cap either; they
are simply the maximum affordable at Tier I on this exact opening route.

### Condition outcomes

| Allocation | Kickoff condition |
|---|---|
| Nine-tap FWD/DEF/GK spread | FWD 92, DEF 92, GK 92 |
| Ten-tap four-player spread | FWD 92, DEF 92, GK 92, MID 92 |
| Nine anchors + extra Week 3 FWD tap | FWD 84, DEF 92, GK 92 |
| All ten taps on the FWD | FWD 44 |

The concentrated FWD route is legal: its condition path is
`100 → 76 → 88 → 64 → 76 → 44`, with weekly recovery between groups. Every tap
starts at 30 or above, so it does not trigger the overtraining injury roll. It begins
the match Fatigued, however, and condition affects match performance. The harness
must measure that tradeoff rather than assume concentration is strongest.

### Canonical contract versus population run

Use a fixed canonical fresh-career fixture to prove the exact TP and condition math.
All intended taps must complete there.

In the 1,000-seed population run:

- apply visible headroom and injury rules
- log every fallback or skipped tap
- keep every seed in the outcome rate
- never inject TP or discard an inconvenient career

If a production-generated opening unexpectedly prevents the canonical route, report
it as a policy-path deviation rather than hiding it.

## Opening player profiles and allocation arms

### Ordinary manager — primary

Player model: engaged, follows guidance, makes the obvious striker/defender/keeper
improvements, but does not empty every remaining TP point.

Creation:

- PAC 50
- SHO 65
- PAS 50
- DEF 50
- TEC 50
- STA 50

Training:

- Week 1: main/created FWD SHO, best healthy starting DEF DEF, starting GK REF
- Week 2: the same three paths
- Week 3: the same three paths
- one tap per named player per week
- bank the final 12 TP

This is an explicit engaged-ordinary behavior hypothesis, not an engine constraint.

### Smart manager — primary breadth policy

Player model: understands the connected systems, spends every safely affordable
opening drill, and develops four starters rather than only three.

Creation:

- PAC 55
- SHO 65
- PAS 50
- DEF 35
- TEC 60
- STA 50

Training:

- Weeks 1–2: main FWD SHO, best healthy starting DEF DEF, starting GK REF
- Week 3: those same three, plus the best healthy starting MID
- MID path: choose the larger visible uncapped preview between PAS and TEC; PAS wins
  a complete tie
- spend 100 TP and bank 2

### Smart sensitivity A — extra FWD

Use the Smart creation and the same nine anchor taps, but spend the tenth tap on the
created FWD's SHO. This tests whether one additional high-impact tap is stronger than
bringing a fourth player into the development core.

### Smart sensitivity B — concentration ceiling

Use the Smart creation. Spend every safe affordable opening tap on created-FWD SHO
while the visible preview remains useful; then fall back to FWD PAC, FWD TEC, and the
role-spread paths in that order.

This is an exploit/ceiling diagnostic, not a claim about an ordinary or typical smart
person.

### Historical controls

- current three-player PAC-only probe policy
- no-training control

Controls provide context. Neither is called a real player.

### Stable player selection

- created FWD when available
- otherwise highest visible role-rated healthy starting FWD
- highest visible role-rated healthy starting DEF
- starting GK
- highest visible role-rated healthy starting MID
- visible lineup/display order breaks ties
- opaque player ID is allowed only as the final reproducibility tie-break

If a primary stat has no visible useful gain, choose the next production
role-natural path:

- FWD: SHO → PAC → TEC
- DEF: DEF → STA → PAS
- GK: REF → DEF → STA
- MID: larger visible PAS/TEC preview, then STA

## Four crossed cohorts

Run both primary policies on both difficulties with identical seeds:

| Policy | Cozy | Chairman |
|---|---|---|
| Ordinary | Primary accessibility promise | Difficulty-cliff diagnostic |
| Smart breadth | Too-easy diagnostic | Primary expert promise |

A policy may not branch directly on the difficulty label. It may react only to a
visible state difference the difficulty has already caused.

Cozy and Chairman currently use the same opening opponent squads and match rules.
Their differences are economy and later rival growth. Therefore:

- same policy
- same seed
- same action/resource trace

must produce the same opener result in Cozy and Chairman. A difference is a harness
or product-contract failure.

Run the two Smart sensitivity arms on at least the primary Smart × Chairman cell.
Running them on Cozy as well is cheap and provides an additional identity check.

## Minimal public-observation boundary

The opening policy may receive only information visible before the opener:

- current season, week, and phase
- cash and TP
- visible facility construction/operational state
- visible coach candidates and hired-coach terms
- visible player role, lineup status, attributes, condition, injury, and drill
  preview/headroom
- visible drill tier/cost/gain
- visible fixture identity

It may not receive:

- career seed or fixture match seed
- PRNG state
- future outcomes
- hidden scouting or awakening values
- test-only opponent calculations
- full `GameState`

A minimal adapter produces this observation. The policy returns action intents. A
separate adapter applies those intents through production actions.

Full-state analytics may calculate strength and diagnostic metrics after an action,
but that recorder is never passed back to the policy.

## Production-path and ledger rules

Use:

- `createLaunchCareerSetup`
- story onboarding and created-player actions
- `buildCareerFacility`
- `hireCareerCoach`
- `instantTrainingPreview`
- `trainPlayerInstantly`
- `advanceWeek`
- the production opening match-team builder
- `quickMatchForFixture`
- real matchday completion and onboarding completion

Never:

- add TP directly
- write player attributes directly
- reset condition
- remove an injury
- inject cash
- author the user's score
- change division/standings directly
- swallow an invalid action and continue

Every action record includes:

```text
policy/version
seed and engine/content/source fingerprints
season/week/phase
action attempted
completed or skipped
visible reason
cash before/delta/after
TP before/source-or-cost/after
player/role/path/stat before/gain/after
condition before/after
coach and facility modifiers
opponent variant
score and match diagnostics
```

TP must reconcile exactly:

```text
opening TP
+ base weekly TP
+ coach TP
+ completed Training Pitch TP
+ any other named production source
- exact production drill costs
= closing TP
```

Unexplained resource changes invalidate the run.

## V1 test strategy

### 1. Production-truth contract tests

Normal CI:

- four or more distinct players can legally train in one week when TP permits
- the same player can train repeatedly in one week when TP, injury, and promise
  gates permit; repeated taps deduct condition and can introduce overtraining risk
- no `maxFocusDrillsPerWeek` production rule survives save loading
- each tap costs 8 condition
- weekly recovery is 12 plus the real Dorm bonus
- injury risk begins only when a tap starts below 30
- Week 1–3 TP follows `30 → 0 → 36 → 6 → 42`
- Ordinary closes pre-kickoff at 12 TP
- Smart closes pre-kickoff at 2 TP
- the Week 1 Training Pitch is operational for Week 3 DEF training
- the Pitch contributes no +28 until the post-opener settlement
- same-policy Cozy and Chairman traces/results are identical when resources have not
  diverged

### 2. Fast executable sentinel

Use a small fixed seed list on every normal or scheduled CI run:

- all four primary cells
- both Smart sensitivities
- current PAC control
- production actions and production opener
- deterministic action/ledger snapshot

The sentinel detects drift. It does not decide balance.

### 3. Decision-grade opener artifact

Use one frozen, precommitted 1,000-seed cohort:

- paired seeds across policies and difficulties
- current opponent first
- real opener engine path
- 10,000-resample fixed-seed bootstrap intervals
- per-seed rows retained
- artifact written to a stable repository fixture/report location

Primary endpoints:

- win/draw/loss
- score and goal-difference distribution
- shots and shot quality
- saves
- user/opponent matchday strength
- TP spent/banked
- stat gains by role/path
- kickoff condition
- action-path deviations

Decision:

- **Pass:** win upper bound ≤5% and loss lower bound ≥90%
- **Fail:** win lower bound >5% or loss upper bound <90%
- **Inconclusive:** neither pass nor fail; at least one interval crosses its threshold

Apply the rail to Ordinary × Cozy and Smart × Chairman. Crossed and sensitivity cells
diagnose why a primary cell passes or fails.

The baseline artifact records:

- exact seed list
- policy names and semantic versions
- policy configuration
- engine version
- content fingerprint
- save/schema version
- source commit
- bootstrap seed/resample count
- per-seed outcome/action/resource rows
- runtime and sharding metadata

Do not quote the old local measurements as validated after this artifact exists.

## Conditional opening-opponent experiment

Run this only if the current opponent fails the confirmed statistical rail.

### Proposed +5 scenario

For the opening fixture only:

- clone the opponent's selected starters and bench
- use canonical roster roles, not temporary formation slots
- FWD: +5 SHO
- DEF: +5 DEF
- GK: +5 REF
- MID: unchanged
- clamp at the production rating maximum
- do not mutate saved career state, caps, contracts, or later fixtures

This fixture-local clone is the sole experimental exception to the no-direct-stat
rule.

### Selection and confirmation

- If +5 is the only predeclared candidate, compare it on the same paired baseline
  cohort and report the paired shift.
- If results are inspected and several sizes/variants are tried, treat that cohort as
  development data.
- Register one selected candidate and its rails.
- Run that candidate once on a second frozen 1,000-seed confirmation cohort.
- If confirmation fails or is inconclusive, do not tune against those opened seeds;
  a changed candidate requires a new confirmation cohort.

Also reject a candidate that satisfies W/D/L only by creating an implausible blowout:

- materially larger heavy-loss tail
- excessive goal difference
- shots/saves inconsistent with a teaching match
- no visible chance for the user's training to matter

If the current opponent passes, ship **no +5 change** from this work.

Any accepted replay-affecting tuning requires an explicit `ENGINE_VERSION` and golden
replay decision.

## Phase 2 — two-season early-progression diagnostic

This phase addresses Joe's broader concern:

> When a real player keeps gaining TP from coaches and facilities, buys better drills,
> and uses those systems consistently, does D5 become too easy?

It does not block the V1 opener result.

### Before implementation

1. Benchmark the real full-division runner on this checkout.
2. Lock the early-progression endpoints and acceptable precision.
3. Pre-register the sample size.
4. Start with an exploratory **50 paired seeds per cell**, not a permanent CI gate.

Do not reinstate the previous fixed 400-per-cell ten-season commitment without a
runtime and precision budget.

### Required systems

The two-season policy must use production:

- base, Training Pitch, head-coach, and assistant TP
- coach specialties and auto-leveling
- Training Pitch construction/upgrades
- Coaching Office and assistant eligibility
- Shooting Range, Keeper Court, Tech Center, and Gym when their core paths are active
- drill-tier offers, purchases, costs, and gains
- instant-training TP and condition constraints
- injuries and weekly recovery
- lineups and Hero Licenses needed for legal matches
- every real league fixture needed for the table
- promotion and next-season transition

### Simple policy shape

Keep this auditable rather than pretending to be a perfect autonomous manager.

Ordinary:

- three-player core: FWD SHO, DEF DEF, GK REF
- repeat round-robin useful taps while affordable and while each player's configured
  matchweek condition floor remains satisfied
- first eligible head coach, retain natural improvement
- build/upgrade Training Pitch first, then Coaching Office, then the three relevant
  role facilities
- hire first eligible assistant when legal and affordable
- inspect drill offers every week; buy relevant upgrades when affordable above the
  visible reserve

Smart:

- four-player core: FWD SHO, DEF DEF, GK REF, MID PAS/TEC
- spend every useful affordable tap within its configured condition floor
- choose the best visible coach using relevant specialty, weekly TP, level, and cost
- replace only on a predeclared visibly meaningful improvement
- prioritize Training Pitch, Coaching Office, assistant, active role facilities, and
  relevant drill tiers

The session/adherence budget, condition floors, cash reserve, coach-replacement
threshold, and facility order must be versioned policy constants reviewed before the
run. They are behavioral assumptions, not balance constants.

### Early-progression metrics

- first-five and Season 1 W/D/L, points, and goal difference
- Season 1/2 league position and promotion
- cash minimum/end, warnings, loans, and forced sales
- TP earned by source, spent, and banked
- taps and stat gains by player/role/path
- kickoff condition and injuries
- coach/facility/drill purchase and first-use timing
- user strength versus field strength at each matchday

Do not tune promotion/economy from the exploratory 50-seed run until numeric rails and
a decision-grade sample are separately approved.

## Deferred north-star roadmap

After the opener and two-season diagnostic are understood:

1. calibrate Ordinary and Smart behavior against consented human playtests
2. add transfers, youth, contracts, hero wage cliffs, aging, and retirement
3. add a deterministic watched-match Smart policy if live-coaching balance needs a
   statistical gate
4. add app/store parity for sentinel journeys
5. add targeted fixtures for rare branches
6. benchmark and design a deliberate ten-season pre-launch career study

Human traces are required before calling a long-career bot “population average.” They
are not required to learn whether correct Week 1–3 preparation makes the opener too
easy.

### Chairman-to-Cozy recommendation

This becomes a separate product-feature spec after Ordinary × Chairman evidence
exists.

The balance harness may later report:

- sustained low points pace
- poor goal difference
- bottom-two frequency
- repeated financial rescue
- false-positive rate for Smart × Chairman

It must not silently switch difficulty or define recommendation copy inside V1.

## Implementation sequence after approval

### Phase 0 — make the instrument truthful

1. Add absence-of-weekly-cap, TP, condition, Training Pitch, and difficulty-identity
   contract tests.
2. Add the minimal public observation and intent boundary.
3. Replace the opening probe's PAC-only primary policy with versioned policy arms
   while retaining PAC as a control.
4. Extend its output to the full versioned action/resource artifact.
5. Correct stale +10 TP and three-slot player-facing descriptions separately.

### Phase 1 — answer the opener

1. Run the current opponent on the frozen 1,000 seeds.
2. Publish the artifact and CI-based verdict.
3. If it passes, stop: no opponent buff.
4. If it fails, run the predeclared +5 experiment.
5. Use a second confirmation cohort only if candidate selection followed inspection.

### Phase 2 — answer early progression

1. Benchmark the real two-season runner.
2. Lock endpoints, behavioral constants, and sample/precision.
3. Run the exploratory crossed cohort.
4. Decide whether a decision-grade early-career gate is justified.

### Phase 3 — pre-launch career research

Only after separate approval: expand toward human calibration, watched coaching, full
management, and ten-season balance.

## Auditor questions

1. Is every three-slot assumption gone?
2. Are nine and ten opening taps clearly policies rather than engine limits?
3. Are the four-player, extra-FWD, and concentration arms the right realistic bounds?
4. Can either policy see information the app does not show?
5. Does every stat/TP/condition change come from production actions?
6. Is the proposed 5% win / 90% loss rail the intended statistical contract?
7. If a literal loss is intended, should the match simply be authored?
8. Does +5 produce a teaching loss rather than a blowout?
9. Is the opener artifact reproducible without relying on console output or prose?
10. Are Phase 2's policy constants and runtime budget locked before its results are
    used for tuning?

## Primary references

- `src/game/training.ts` — instant-training gates, gain, TP, condition, and injury
- `src/game/player-wellbeing.ts` — recovery, Dorm bonus, and overtraining threshold
- `src/persistence/game-state-codec.ts` — removal of retired weekly training/cap state
- `src/application/launch.ts` — starting TP and career setup
- `src/application/assistant-guide.ts` — intended Week 1 guided route
- `src/game/career.ts` — weekly settlement and facility timing
- `src/game/facilities.ts` — Training Pitch TP and facility catalog
- `src/game/coach-weekly.ts` — coach TP, specialties, and progression
- `src/game/training-paths.ts` — paths, tiers, and unlocks
- `src/game/management.ts` — facilities and drill purchases
- `src/game/market-career.ts` — coach hiring
- `src/game/matchday.ts` — production Quick Result
- `src/game/difficulty.ts` — Cozy/Chairman differences
- `src/audit/__tests__/opening-matches-probe.test.ts` — existing opener runner
- `src/audit/__tests__/division-ramp-probe.test.ts` — existing real-engine career
  runner
- `src/audit/fixtures/scale-invariant-opening-gate.json` — historical, different
  policy artifact
- `content/training.json` — live drill costs/gains
- `content/glossary.json` — known stale +10 TP copy
