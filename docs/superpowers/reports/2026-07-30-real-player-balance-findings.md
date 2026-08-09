# Real-Player Balance Harness — Findings

**Date:** 2026-07-30
**Status:** Measured, then one content change shipped — the Keeper Drills gain
ladder. No engine change; `src/sim/` is untouched and `ENGINE_VERSION` stays
`m2.0`. Every result below Result 1 is the pre-change baseline unless a section
says otherwise; the post-change numbers live under "Shipped".

**Owner ruling, 2026-07-30:** the opener does not need to reach 5% wins; around
10% is acceptable. The keeper ladder alone delivers that, so the launch-grant
cut and the opponent buff measured further down were **not shipped**. Both
sections are retained as evidence for the decision, not as a record of live
values.

**Spec:** `docs/superpowers/specs/2026-07-30-real-player-balance-harness-design.md`

## What was built

| Component | Path | Runs in CI |
|---|---|---|
| Public observation boundary | `src/audit/opening/observation.ts` | — |
| Action intents | `src/audit/opening/intents.ts` | — |
| Versioned policy arms | `src/audit/opening/policies.ts` | — |
| Production-path runner and TP ledger | `src/audit/opening/runner.ts` | — |
| Deterministic bootstrap intervals | `src/audit/opening/stats.ts` | — |
| Production-truth contract | `src/audit/__tests__/opening-production-truth.test.ts` | yes |
| Fast drift sentinel | `src/audit/__tests__/opening-sentinel.test.ts` | yes |
| Keeper leverage rail | `src/audit/__tests__/training-leverage-rails.test.ts` | yes |
| Opener decision probe | `src/audit/__tests__/real-player-opening-probe.test.ts` | opt-in |
| Per-TP path leverage probe | `src/audit/__tests__/training-path-leverage-probe.test.ts` | opt-in |
| Division entry probe | `src/audit/__tests__/division-entry-probe.test.ts` | opt-in |
| Keeper drill price sweep | `src/audit/__tests__/keeper-drill-price-probe.test.ts` | opt-in |
| Keeper drill gain sweep | `src/audit/__tests__/keeper-drill-gain-probe.test.ts` | opt-in |
| Opponent buff experiment | `src/audit/__tests__/opening-opponent-buff-probe.test.ts` | opt-in |
| Preparation budget sweep | `src/audit/__tests__/opening-prep-budget-probe.test.ts` | opt-in |

Every arm reaches the game only through production actions — `hireCareerCoach`,
`buildCareerFacility`, `trainPlayerInstantly`, `advanceWeek`,
`quickMatchForFixture`, `completeMatchday`. The runner never adds TP, writes an
attribute, resets condition, clears an injury, injects cash, or authors a score.
A run whose TP ledger does not reconcile throws rather than being averaged in.

Policies see only `OpeningObservation`: the clock, cash, TP, visible facility and
staff state, own-club attributes/condition/injury, production drill previews, and
the fixture identity. They cannot read the career seed, the match seed, PRNG
state, opponent attributes, or `GameState`.

## Reproducing

```bash
npx tsc --noEmit && npm test
```

```bash
OPENING_BALANCE_PROBE=1 OPENING_BALANCE_SEEDS=500 \
  OPENING_BALANCE_ARTIFACT=src/audit/fixtures/real-player-opening-baseline.json \
  npm run test:probe -- src/audit/__tests__/real-player-opening-probe.test.ts
```

```bash
PATH_LEVERAGE_PROBE=1 PATH_LEVERAGE_SEEDS=250 \
  npm run test:probe -- src/audit/__tests__/training-path-leverage-probe.test.ts
```

```bash
DIVISION_ENTRY_PROBE=1 DIVISION_ENTRY_SEEDS=4 DIVISION_ENTRY_SEASONS=7 \
  npm run test:probe -- src/audit/__tests__/division-entry-probe.test.ts
```

```bash
KEEPER_GAIN_PROBE=1 KEEPER_GAIN_SEEDS=150 \
  npm run test:probe -- src/audit/__tests__/keeper-drill-gain-probe.test.ts
```

```bash
OPPONENT_BUFF_PROBE=1 OPPONENT_BUFF_SEEDS=300 \
  npm run test:probe -- src/audit/__tests__/opening-opponent-buff-probe.test.ts
```

```bash
PREP_BUDGET_PROBE=1 PREP_BUDGET_SEEDS=800 PREP_BUDGET_OFFSET=5000 \
  PREP_BUDGET_GRANTS=0 PREP_BUDGET_BUFFS=10 \
  npm run test:probe -- src/audit/__tests__/opening-prep-budget-probe.test.ts
```

## Production truth confirmed

The spec's stated production rules all hold, pinned by
`opening-production-truth.test.ts`:

- no club-wide weekly drill cap and no distinct-player cap exist
- 30 starting TP, 24 base weekly, `10 + 2 x level` head-coach TP, 28 TP per
  operational Training Pitch level
- Tier I costs 10 TP; drill costs 10/15/21/28/36 and gains 5/8/12/17/23
- each instant drill costs 8 condition; weekly recovery is 12 plus 4 per Dorm level
- an injury roll happens only when a drill starts below condition 30
- the Week 1 Training Pitch is operational for Week 3 but pays no TP before kickoff

Three facts the spec did not record, all now pinned by tests:

1. **Without a head coach the pre-kickoff bank is 78 TP, not 102.** The 102 figure
   assumes the Week 1 Level 1 hire. 78 TP buys 7 Tier I taps; 102 buys 10.
2. **The opening opponent is the strongest club in Division 5**, not the third
   strongest as `README.md` still states.
3. **The Training Pitch is the DEF drill multiplier and no other path's.**
   `trainingFacilityType` in `src/game/training.ts` routes `sho`, `ref`,
   `pas`/`tec`, and `pac`/`sta` to their own buildings; `def` is the only
   attribute left over, so it falls through to `training-pitch`. Building the
   club's TP engine also subsidises Duels by 25% at level 1.

## Result 1 — the opener fails the contract, by a wide margin

500 paired seeds, artifact at `src/audit/fixtures/real-player-opening-baseline.json`.
Contract: win rate upper bound at or below 5%, loss rate lower bound at or above 90%.

| Cell | W% | D% | L% | W 95% CI | Verdict |
|---|---:|---:|---:|---|---|
| Ordinary x Cozy | 23.4 | 28.8 | 47.8 | 19.8–27.2 | **FAIL** |
| Smart x Chairman | 23.8 | 27.4 | 48.8 | 20.2–27.6 | **FAIL** |
| Ordinary x Chairman | 23.4 | 28.8 | 47.8 | 19.8–27.2 | diagnostic |
| Smart x Cozy | 23.8 | 27.4 | 48.8 | 20.2–27.6 | diagnostic |
| Smart extra-FWD | 19.6 | 28.6 | 51.8 | 16.4–23.2 | diagnostic |
| Smart concentration | 2.4 | 4.4 | 93.2 | 1.2–3.8 | diagnostic |
| Joe observed, coach | 23.8 | 35.8 | 40.4 | 20.2–27.6 | diagnostic |
| Joe observed, no coach | 17.0 | 31.2 | 51.8 | 13.8–20.4 | diagnostic |
| PAC control | 6.8 | 12.8 | 80.4 | 4.6–9.0 | control |
| No training | 2.2 | 9.4 | 88.4 | 1.0–3.6 | control |

Both primary cells miss the rail by roughly five times. The reported
two-wins-from-two opening that prompted this work is unremarkable at a 23.8% win
rate — that outcome occurs about 6% of the time.

Three things the table settles:

- **Only the untrained control is near the contract.** At 2.2% W / 88.4% L, a
  manager who touches nothing sits about where the opener is supposed to sit.
  Every prepared arm is four to eleven times over the win cap. The opener was
  never tuned against a player who prepares.
- **The historical PAC-only probe policy understated the problem.** At 6.8% W it
  is much closer to the rail than any role-correct arm, which is why earlier
  artifacts measured on that policy did not surface this.
- **Concentration is a trap, not an exploit.** Ten taps into one striker returns
  2.4% W / 93.2% L — worse than doing nothing. The kickoff fatigue and the
  untouched rest of the squad more than cancel the stat gain. The spec was right
  to test it and wrong to fear it.

## Result 2 — defensive training is too strong, but only the goalkeeper path

250 paired seeds, whole opening bank into one path, matched no-drill control.

| Path | Stat pts / 100 TP | GD lift / 100 TP | W% | D% | L% |
|---|---:|---:|---:|---:|---:|
| keeper-drills | 84.7 | **3.790** | 21.6 | 47.6 | 30.8 |
| finishing | 83.6 | 0.410 | 4.4 | 6.4 | 89.2 |
| first-touch | 63.0 | 0.410 | 1.6 | 11.2 | 87.2 |
| duels | 85.9 | 0.310 | 4.4 | 7.2 | 88.4 |
| rondo | 63.0 | 0.300 | 2.0 | 8.8 | 89.2 |
| circuit | 75.6 | 0.040 | 2.4 | 7.2 | 90.4 |
| sprints | 83.6 | 0.030 | 2.0 | 7.2 | 90.8 |

**Outfield defence is fine.** `duels` at +0.31 sits alongside `finishing` at
+0.41 and `rondo` at +0.30. **Goalkeeper training is the outlier at +3.79, about
nine times the next path.** Seven keeper taps alone move the opener from ~90%
losses to 30.8% losses and 21.6% wins; no other single path moves it at all.

The cause is contest exposure rather than drill pricing. Every path converts TP
into attribute points at a comparable rate (63–90 per 100 TP), so the drill
ladder is consistent. What differs is how often the attribute is read:

- `ref` is contested on every opposing shot — 10 to 14 a match
  (`engine.ts:769`, `engine.ts:832`, `engine.ts:869`)
- `sho` is read only on the trained striker's own 3 to 4 shots
- `def` is read at four contest sites but spread across eleven defenders, so
  upgrading one moves a fraction of the club's defending

The keeper starts at `ref` 46 and seven taps roughly double him, in the one slot
every opposition attack must pass through.

This is the same asymmetry the unshipped
`docs/superpowers/plans/2026-07-30-attack-defense-training-leverage.md`
measured at 1.89x in the sim. That plan was never implemented: there is no
`finisherRouting` code in `src/sim/`, no `training-leverage-rails.test.ts`, and
no m2.1 entry in `README.md`.

The Training Pitch's accidental DEF subsidy is real but minor: it lifts `duels`
from 85.9 to 89.8 stat points per 100 TP and its GD lift from 0.31 to 0.38.
Worth fixing for coherence, not urgent for balance.

## Result 3 — division entry has three different shapes, none of them the intended ramp

> **Correction, 2026-07-31.** Every W-D-L figure below is wrong. The probe
> recorded each National Cup week as a fabricated 0-0 draw, because cup scores
> live in `state.m2.nationalCups` and it looked them up in `state.fixtures`. The
> draw counts, the D3 "draw-lock", and the conclusion drawn from them in the
> paragraph after the table are all artifacts. The entry-gap column is
> unaffected — it is read from squad attributes before kickoff. Corrected
> measurements and the fix are in
> `docs/superpowers/reports/2026-07-31-division-scaling-findings.md`.

4 careers, 7-season budget, all 90 fixtures per season through the real engine.

| Entering | Mean gap vs field | First-5 record | Entries |
|---|---:|---|---:|
| D5 | −4.0 | 8W / 10D / 2L | 4 |
| D4 | −31.6 | 29W / 36D / 30L | 19 |
| D3 | −87.4 | 2W / 20D / 3L | 5 |

- **D5 is too easy.** A −4 gap, and all four careers promoted in season 1.
- **D4 is the real wall.** 19 entries against 4 for D5 means careers stall here
  for years. Seed 4015838 spent seasons 2 through 7 in D4 without promotion.
- **D3 does not punish, it stalls.** A club arriving 87 points behind draws 20 of
  its 25 opening matches. Seed 4000000, season 7: squad 84.2 versus field 170.5,
  record 0W-5D-0L, goal difference 0.

The D3 behaviour follows from the contest curve. `ratingD64` is a logarithm and
`contestProbability` consumes the difference of logs, so only the ratio matters.
`DIVISION_STRENGTH_BANDS` scales roughly 2x per division (D5 `[40,50]`, D4
`[90,102]`, D3 `[135,151]`, D2 `[178,203]`, D1 `[223,248]`), which pushes every
contest into the flat region of the curve: attacks stop converting and scorelines
go quiet. The displayed strength numbers imply annihilation; the pitch delivers
stalemate.

**Limitation.** This probe records the user club's own first five matches. Whether
rival-versus-rival D3 fixtures are equally draw-heavy is not measured here, and
should be checked before concluding the effect is engine-wide rather than
specific to a promoted club's position on the curve.

## Result 4 — Cozy and Chairman are the same game at the opening

Pinned by contract test, not inferred. For the same seed and policy, the two
modes produce byte-identical action traces, TP ledgers, squad strengths, and
opener scorelines. `difficulty.ts` separates them only by
`seasonOneWageSubsidyPercent`, `sponsorIncomePercent`,
`negativeWeeksBeforeIntervention`, `emergencyLoanAmount`, `cashFloor`, and
`opponentGrowthPercent` (3% versus 4% a year, cap 700 versus 800).

Chairman is a harder budget, not a harder game. On-pitch divergence only
accumulates through rival growth over several seasons. Whether that matches the
intent is a product question this measurement cannot answer.

## Recommendations

No change was made. In rough order of value:

1. **Fix `ref` leverage, not the opener.** Removing the goalkeeper path from the
   opening would already put every remaining arm at roughly 4% W / 88% L —
   essentially on the contract — without touching the opponent. That points at
   the root cause rather than the symptom, and it affects the whole career, not
   just week 3. The reviewed approach already exists in the m2.1 finisher-routing
   plan. Any such change is replay-affecting and needs an `ENGINE_VERSION`
   decision plus a golden-replay update.
2. **Do not ship the spec's +5 opponent buff as the primary fix.** It treats a
   symptom whose cause is a single training path, and a buff large enough to
   absorb a doubled keeper would produce the blowouts the spec itself rejects.
3. ~~**Revisit `DIVISION_STRENGTH_BANDS`.**~~ **Withdrawn 2026-07-31.** The D3
   draw-lock was a probe artifact, and peer matches measured decisive at every
   division — goals rise and draws fall as the pyramid climbs. The bands are
   fine; see the 07-31 report.
4. **Re-tune D5 difficulty or the promotion requirement.** A −4 entry gap with
   4-of-4 season-1 promotions leaves no growth room in the first division.
5. **Give `def` its own training facility.** The Training Pitch is currently the
   DEF multiplier only because `def` is the leftover case in
   `trainingFacilityType`. Small effect, but it is an accident rather than a
   design.
6. **Correct the stale documentation** the harness contradicts: the `README.md`
   third-strongest-opponent claim, the `+10 TP` Training Pitch text in
   `content/glossary.json` and `ClubFinancesScreen.tsx`, and the three-weekly-
   training-slots comment at `src/game/pyramid.ts:194`.

## Shipped — the Keeper Drills ladder

`content/training.json` now prices Keeper Drills by exposure rather than
uniformly:

| Tier | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| Every other path | 5 | 8 | 12 | 17 | 23 |
| **Keeper Drills** | **2** | **3** | **5** | **7** | **9** |

TP costs are unchanged at 10/15/21/28/36. `src/content/schemas.ts` still pins
every drill's gain exactly; the pin is now per path rather than global, so
content cannot drift and the exception is explicit rather than a hole.

**No `ENGINE_VERSION` decision.** `src/sim/` is byte-identical to before, the
golden replay passes untouched, and every saved replay stays valid. This is
what makes gain the right lever: it changes how fast a keeper develops between
matches, not how any match resolves.

### Measured effect

| Metric | Before | After |
|---|---:|---:|
| Leverage ratio, exposure-normalised | 14.14 unnormalised / ~2.6 normalised | **1.46** |
| Keeper-only opener loss rate | 31.7% | **68.3%** |
| Keeper path GD lift per 100 TP | 3.790 | 2.230 |
| Keeper path opener W/D/L | 21.6 / 47.6 / 30.8 | 8.4 / 24.4 / 67.2 |
| Ordinary x Cozy opener wins | 23.4% | **10.2%** |
| Smart x Chairman opener wins | 23.8% | **10.8%** |
| REF gained per Ordinary career | +25.4 | +10.5 |

Every other path is unchanged — finishing 0.410, duels 0.310, sprints 0.030 —
confirming the change was surgical.

### What it did not fix

The opener still misses its contract: 10.2% wins against a 5% cap, and 71.8%
losses against a 90% floor. But the cause has moved. Ordinary's per-career stat
gains are now `ref +10.5, def +27.7, sho +25.2` — the keeper is no longer the
outlier, and the residual win rate comes from ordinary outfield training. Fifty
points of DEF and SHO across three starters simply outweigh the opening
opponent's 8.6-point squad-mean edge.

That is a different problem with different levers — a stronger opening opponent,
or less preparation time before the Week 3 fixture — and it is not a training
balance defect. The spec's conditional +5 opponent experiment is now the
appropriate next step, measured against this baseline rather than the old one.

Baseline artifact: `src/audit/fixtures/real-player-opening-keeper-gain.json`.

## Appendix — two engine fixes were attempted and reverted

Two engine-side explanations for the keeper's dominance were implemented,
measured, and backed out. Recording both so the next attempt does not repeat
them.

### Attempt 1: REF drove shot accuracy as well as saves

`shotSpreadAt` judged the shooter's aim against the opposing keeper's REF, so
one attribute widened the shot *and* saved it — two multiplied penalties.
Replacing the aim reference with a midpoint of the shooter's SHO and the
keeper's REF preserved scale invariance and halved REF's slope in that channel.

Result: goals prevented per 100 TP moved 3.536 to 3.476, a 1.7% effect.
Not the mechanism.

A literal constant, as first proposed, was rejected before implementation: with
the keeper side pinned, a D1 striker at SHO 442 saturates
`contestProbability` to 1.0 and collapses `closeRangeSpread` to its 500 floor,
which is exactly the scale invariance `ratingD64` exists to preserve.

### Attempt 2: REF suppressed the opponent's shot count

`shotExpectedValue` calls `keeperSaveProbability` directly, and the attacking AI
uses that to choose shoot-versus-pass — so a trained keeper both deterred shots
and saved them. Measured at 60 paired seeds, seven keeper taps cut opponent
shots from 14.1 to 7.6 a match on top of lifting saves from 51% to 89%.

Splitting the seam — full-strength REF for the save that resolves, dampened REF
for the shooter's estimate — fixed the suppression (14.1 to 12.4) but moved
goals conceded only 0.47 to 0.70, while doubling league-wide shot volume
(control user shots 2.6 to 5.2). A far larger change than the defect it
addressed, and it made the leverage ratio worse by diluting the striker arm.

Both changes were reverted. `git checkout src/sim/engine.ts` restored the
measurement exactly (3.536 / 0.250 / 14.14), which is itself the regression
evidence that nothing else moved.

### What the attempts established

The leverage is arithmetic, not a defect. Seven taps add about 59 REF to a base
of 46 — a 129% increase — and the save contest converts that into 51% to 89%
saves:

| Keeper REF | Save rate vs a D5 shot |
|---:|---:|
| 46 (untrained) | 51.3% |
| 60 | 66.7% |
| 80 | 80.1% |
| 105 (7 taps) | 88.6% |

Drill gains are absolute rather than proportional, so a drill is worth most on a
low stat. The keeper holds the lowest stat that matters, in the only slot every
attack must pass through, and faces 14.1 shots a match against the striker's
2.6. Reaching the 1.5x target needs a 9x reduction in keeper value per TP; no
decision-layer or aim-layer change approaches that.

Three levers remain, none of them a bug fix:

1. **Lower `gains.ref` across the keeper ladder.** The preferred lever, and the
   only content-side dial that reduces what a tap is *worth* rather than how
   many taps fit in the budget. Swept below. Content-only, no `ENGINE_VERSION`
   decision.
2. **Reprice the drill.** Also content-only, but it plateaus — see the price
   sweep below for why.
3. **Cap REF against the division's scale**, so a D5 keeper cannot reach a D3
   rating. Roster and caps work rather than sim work.

### Attempt 3: replacing REF with a fixed aim constant

Implemented literally as originally planned — `shotSpreadAt` and
`positionThreat` judging the shooter against a constant rather than the keeper's
REF. It made both rails worse:

| Metric | Before | Fixed constant |
|---|---:|---:|
| Leverage ratio | 14.14 | 16.25 |
| Keeper-only opener loss rate | 31.7% | 21.7% |
| Goals prevented per 100 TP | 3.536 | 3.869 |

Removing REF from the aim channel also removed the *opposing* keeper from the
user's own aim, and the user's squad is the weaker one, so the change helped the
stronger side more. Reverted.

### Why gain beats price

The save curve is concave: REF 46 to 60 buys 15.4 points of save rate, 80 to
105 buys 8.5. Raising `tpCost` removes taps from the cheap tail and leaves the
expensive first tap intact, which is why the price sweep never fell below 7.3x
even at five times the going rate. Lowering `gains.ref` shrinks every tap
including the first, which is the numerator the ratio is built from.

`src/audit/__tests__/training-leverage-rails.test.ts` now runs in CI as a
ratchet at 18x with the 1.5x target recorded beside it. Lower it when a change
earns it; never raise it.

### Keeper drill price sweep

150 paired seeds, `src/audit/__tests__/keeper-drill-price-probe.test.ts`. The
multiplier scales the whole keeper ladder, not just Tier I — the leverage comes
from the keeper's contest exposure, which grows with the division rather than
shrinking, so re-pricing one tier would leave the problem intact from D4 onward.

| x | Ladder I–V | Taps | REF after | Goals prev/100 TP | Ratio | Keeper-arm L% | Ordinary W% |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1.0 | 10/15/21/28/36 | 7.0 | 105 | 3.610 | 15.16 | 34.0% | 22.7% |
| 1.2 | 12/18/25/34/43 | 6.0 | 96 | 3.370 | 14.16 | 38.7% | 19.3% |
| 1.5 | 15/23/32/42/54 | 5.0 | 88 | 3.156 | 13.25 | 46.0% | 19.3% |
| 2.0 | 20/30/42/56/72 | 3.0 | 71 | 2.911 | 12.23 | 63.3% | 19.3% |
| 3.0 | 30/45/63/84/108 | 2.0 | 63 | 2.000 | 8.40 | 78.7% | 7.3% |
| 4.0 | 40/60/84/112/144 | 1.0 | 54 | 2.167 | 9.10 | 79.3% | 7.3% |
| 5.0 | 50/75/105/140/180 | 1.0 | 54 | 1.733 | 7.28 | 79.3% | **4.7%** |

Striker reference: 0.238 goals created per 100 TP.

Two things the sweep settles:

- **Price reaches the opener contract, but only at x5.** Ordinary wins fall to
  4.7% with Tier I at 50 TP — five times every other Tier I drill, and visibly
  strange next to them. x3 gets most of the way (7.3%) at a price that still
  reads as deliberate rather than broken.
- **Price barely touches the leverage ratio.** It never falls below 7.3x, because
  raising the cost removes *taps* rather than reducing what a tap is worth; the
  first tap is the most valuable one and survives every price. Price is a
  legitimate partial lever for the opener, but it does not fix the underlying
  per-TP asymmetry — only levers 2 and 3 do.

A x1.2 bump (Tier I at 12 TP) moves the opener from 22.7% to 19.3% wins. Real,
small, and safe; it is a component of a fix rather than a fix.

## Verification

- `npx tsc --noEmit` — clean
- `npm test` — 248 suites, 2061 tests passed, 1 skipped
- New CI tests: 13 production-truth contracts, 11 sentinel assertions,
  4 leverage-ratchet assertions
- `ENGINE_VERSION` remains `m2.0`; no replay-affecting change shipped


## Recommended next step

Run the spec's conditional opponent experiment against the post-keeper baseline.
The opener now sits at 10.2% wins with the training side balanced, so the
remaining gap is an opponent-strength question rather than a drill question —
which is exactly the experiment the spec pre-registered and deferred.

Two candidates worth measuring together:

1. **The predeclared +5 arm** (FWD SHO, DEF DEF, GK REF on the opening fixture's
   clone only), now against 10.2% rather than 23.4%.
2. **Less preparation before kickoff.** The club banks 78 TP with no coach and
   102 with one, across two idle weeks. Moving the first fixture earlier, or
   lowering the 30 TP launch grant, scales every path down at once instead of
   singling one out.

Reject any candidate that reaches the rail by widening the heavy-loss tail; the
opener is a teaching match, and the current 5th-percentile goal difference of
-4 is already the edge of that.

## The opponent experiment — run, and it does not resolve cleanly

The spec's conditional experiment, run because the opener still missed its
contract after the training side was balanced. 300 paired seeds, both primary
cells, buff applied to a fixture-local clone only.

| Cell | Buff | W% | D% | L% | Verdict | GF-GA | Tail | Shots |
|---|---:|---:|---:|---:|---|---|---:|---|
| Ordinary x Cozy | 0 | 10.7 | 17.7 | 71.7 | FAIL | 0.68-2.17 | -4 | 3.6/12.2 |
| Ordinary x Cozy | **5** | **10.0** | 14.3 | 75.7 | **FAIL** | 0.71-2.49 | -5 | 3.2/12.9 |
| Ordinary x Cozy | 10 | 4.7 | 8.0 | 87.3 | INCONCLUSIVE | 0.50-2.88 | -5 | 2.8/13.0 |
| Ordinary x Cozy | 15 | 1.7 | 7.7 | 90.7 | INCONCLUSIVE | 0.45-3.22 | -6 | 2.3/13.1 |
| Ordinary x Cozy | 20 | 1.3 | 5.0 | 93.7 | PASS | 0.39-3.75 | -7 | 2.4/13.5 |
| Ordinary x Cozy | 25 | 1.3 | 2.7 | 96.0 | PASS | 0.29-3.82 | -7 | 1.9/13.8 |
| Smart x Chairman | **5** | **7.7** | 16.0 | 76.3 | **FAIL** | 0.65-2.48 | -5 | 3.0/12.6 |
| Smart x Chairman | 10 | 5.7 | 10.7 | 83.7 | FAIL | 0.51-2.64 | -5 | 2.7/12.7 |
| Smart x Chairman | 15 | 2.7 | 4.7 | 92.7 | INCONCLUSIVE | 0.45-3.35 | -6 | 2.3/12.9 |
| Smart x Chairman | 20 | 1.0 | 6.3 | 92.7 | INCONCLUSIVE | 0.42-3.43 | -6 | 2.3/12.9 |
| Smart x Chairman | 25 | 1.0 | 3.7 | 95.3 | PASS | 0.33-3.86 | -6 | 1.9/13.6 |

**The predeclared +5 candidate fails.** It moves Ordinary from 10.7% to 10.0%
wins, inside the noise band, and leaves both primary cells failing.

**No candidate both passes the rail and stays a teaching match.** The blowout
guard the spec wrote moves in lockstep with the win rate: at +20 and +25 — the
only sizes that statistically pass — goals conceded rise from 2.17 to about 3.8,
the fifth-percentile goal difference falls from -4 to -7, and the user's shots
per match nearly halve from 3.6 to 1.9. That is the spec's own rejection
criterion: satisfying W/D/L "by creating an implausible blowout" with "no
visible chance for the user's training to matter".

The two requirements are in genuine conflict, which is a product decision rather
than a measurement one. The options, in the owner's hands:

1. **Accept a softer contract.** +10 lands Ordinary at 4.7% wins and 87.3%
   losses with the tail barely moved (-5) and shots still at 2.8. It misses the
   90% loss floor and its win interval crosses 5%, but it is the best point on
   the curve before the match stops being winnable-looking.
2. **Author the result.** If the opener must be lost in every career, no
   probabilistic buff delivers that, and the spec already says to stop fitting
   statistics and write the tutorial outcome.
3. **Cut preparation instead of buffing the opponent.** The club banks 78 TP
   with no coach and 102 with one, across two idle weeks before kickoff.
   Lowering the launch grant or moving the fixture earlier scales every path
   down at once without touching a squad, and leaves the heavy-loss tail alone.
   Unmeasured; it is the one lever this work has not swept.

Nothing was shipped from this experiment. `opponentRoleBuff` exists only as a
harness option, defaulting to zero, and no roster or content value changed.

## The preparation-budget lever, and the best candidate found

The third lever, and the one that makes the opener reachable without a rout. A
career launches with 30 TP and banks two weekly settlements before the Week 3
fixture. Lowering the launch grant scales every drill path down at once and
cannot widen the heavy-loss tail, because it never touches the opponent.

Crossed with small opponent buffs, 300 paired seeds, offset 0:

| Cell | Launch TP | Buff | Taps | W% | L% | Verdict | Tail | Shots |
|---|---:|---:|---:|---:|---:|---|---:|---|
| Ordinary x Cozy | 30 | 0 | 9.0 | 10.7 | 71.7 | FAIL | -4 | 3.6/12.2 |
| Ordinary x Cozy | 30 | 10 | 9.0 | 4.7 | 87.3 | INCONCLUSIVE | -5 | 2.8/13.0 |
| Ordinary x Cozy | 15 | 10 | 7.0 | 3.3 | 89.0 | INCONCLUSIVE | -6 | 2.7/13.1 |
| Ordinary x Cozy | 0 | 5 | 6.0 | 4.0 | 85.7 | FAIL | -5 | 2.7/13.2 |
| **Ordinary x Cozy** | **0** | **10** | 6.0 | **1.7** | **92.3** | INCONCLUSIVE | **-6** | 2.4/13.3 |
| Smart x Chairman | 30 | 0 | 10.0 | 9.7 | 74.0 | FAIL | -4 | 3.5/12.5 |
| Smart x Chairman | 15 | 10 | 8.0 | 6.3 | 86.0 | INCONCLUSIVE | -6 | 2.5/13.2 |
| **Smart x Chairman** | **0** | **10** | 7.0 | **3.0** | **91.3** | INCONCLUSIVE | **-6** | 2.2/13.3 |

The two levers are not substitutes, and crossing them is strictly better than
either alone:

| Route | W% | L% | Goals against | Tail | Shots |
|---|---:|---:|---:|---:|---|
| Buff +20 alone | 1.3 | 93.7 | 3.75 | -7 | 2.4 |
| Launch 0 + buff +10 | 1.7 | 92.3 | 3.24 | -6 | 2.4 |

Same outcome distribution, a shallower tail and half a goal less conceded. A
buff lowers the win rate by making the opponent better, which necessarily widens
the tail; a smaller preparation budget lowers it by making the user weaker,
which cannot.

### Confirmation on a disjoint cohort

`launch 0 + buff 10` was selected by reading the table above, which makes that
table development data. Re-run on 800 seeds at offset 5000, a window with no
overlap:

| Cell | W% | D% | L% | Verdict | Tail | Shots |
|---|---:|---:|---:|---|---:|---|
| Ordinary x Cozy | 2.3 | 6.5 | 91.3 | INCONCLUSIVE | -6 | 2.4/13.3 |
| Smart x Chairman | 1.8 | 5.4 | 92.9 | **PASS** | -6 | 2.2/13.2 |

Smart x Chairman clears the contract. Ordinary x Cozy holds its win cap
comfortably but its loss interval still grazes the 90% floor at 800 seeds. The
candidate is close to right and not yet proven on both primary cells.

### Not shipped, and why

Neither the launch grant nor the buff was changed. Both are product decisions
rather than defect fixes, and the leading candidate carries a real cost this
harness cannot price: a launch grant of zero means a player cannot run a single
drill in their first week. That is the opening session's first interactive
moment, and trading it for four points of win rate is a call for the owner.

The keeper ladder was different — a measured balance defect with a fix that
passes every rail and costs the player nothing — which is why that one shipped
and these do not.

Recommended, in order:

1. **Launch grant 15 with buff +10.** Ordinary 3.3% / 89.0%, Smart 6.3% / 86.0%.
   Misses the contract but keeps a Week 1 drill available. If the contract can
   bend, this is the humane point on the curve.
2. **Launch grant 0 with buff +10**, confirmed above, if the contract cannot bend
   and losing the Week 1 drill is acceptable.
3. **Author the opener** if it must be lost in every career. No probabilistic
   combination measured here reaches certainty, and the spec already says so.

## Appendix — the fixed aim constant, measured at full scale

The originally planned fix was to replace the opposing keeper's REF with a fixed
constant in `shotSpreadAt` and `positionThreat`, so REF would decide saves only.
It was implemented literally at both call sites and measured on the same cohorts
the plan specified, on top of the shipped Keeper Drills ladder.

Path leverage, 250 paired seeds:

| Path | GD lift / 100 TP | W% | L% |
|---|---:|---:|---:|
| keeper-drills, with constant | 1.990 | 14.4 | 70.0 |
| keeper-drills, shipped ladder only | 2.230 | 8.4 | 67.2 |
| finishing, with constant | 0.310 | 5.2 | 86.8 |
| finishing, shipped ladder only | 0.410 | 4.4 | 89.2 |

Opener, 500 paired seeds:

| Cell | With constant | Shipped ladder only |
|---|---|---|
| Ordinary x Cozy | 12.8% W, 66.4% L — FAIL | 10.2% W, 71.8% L — FAIL |
| Smart x Chairman | 12.4% W, 66.8% L — FAIL | 10.8% W, 71.2% L — FAIL |

The constant is worse on every measure that matters. The keeper/striker leverage
ratio rises from 5.44 to 6.42, a keeper-only opening's win rate nearly doubles
from 8.4% to 14.4%, and both primary cells lose about five points of loss rate.

The reason is that the aim channel is symmetric. Removing the keeper from it
removed the *opposing* keeper from the user's own aim as well, and since the
user's squad is the weaker of the two, the change handed more back to the
stronger side. A fixed reference also stops scaling with the division, which is
the property `ratingD64` exists to preserve — at D1 a striker on SHO 442 would
saturate the term and collapse shot spread to its floor.

**Step 5's gate therefore does not open**, and now on measurement rather than
inference: step 4 fails with the constant in place, and fails harder than
without it. `ENGINE_VERSION` stays `m2.0`, the golden replay is untouched, and
`src/sim/` is byte-identical to its pre-experiment state.

## The passing candidate, and why it was not shipped

Grid search, 500 paired seeds at offset 9000, on top of the shipped keeper
ladder:

| Cell | Launch TP | Buff | W% | L% | Verdict | Tail | Shots |
|---|---:|---:|---:|---:|---|---:|---|
| Ordinary x Cozy | 10 | 10 | 3.0 | 89.0 | INCONCLUSIVE | -6 | 2.8/13.1 |
| Ordinary x Cozy | 15 | 10 | 3.0 | 89.0 | INCONCLUSIVE | -6 | 2.8/13.1 |
| **Ordinary x Cozy** | **15** | **15** | **1.0** | **93.8** | **PASS** | -7 | 2.3/13.5 |
| Ordinary x Cozy | 20 | 15 | 2.4 | 92.6 | PASS | -6 | 2.5/13.5 |
| Smart x Chairman | 15 | 10 | 3.4 | 87.6 | INCONCLUSIVE | -6 | 2.5/13.2 |
| **Smart x Chairman** | **15** | **15** | **1.2** | **93.6** | **PASS** | -6 | 2.3/13.4 |
| Smart x Chairman | 20 | 15 | 2.2 | 92.2 | INCONCLUSIVE | -6 | 2.3/13.2 |

`launch 15 + buff 15` is the only combination that passes both primary cells,
and grant 15 still funds one Tier I drill in Week 1, so the opening session
keeps an interactive moment.

**It was not shipped, because the measured change and the shippable change are
not the same thing.** The harness applies the buff to a fixture-local clone —
the spec's sole stated exception to the no-direct-stat rule — so it affects the
opening match only. Shipping it would require either:

1. raising the opponent's ratings in `content/clubs.json`, which strengthens
   them across all eighteen league fixtures rather than one, a permanent roster
   rebalance the spec lists among its V1 non-goals and **not the change these
   numbers measure**; or
2. a production mechanism for an opening-fixture-specific opponent, which does
   not exist.

Quoting this table in support of option 1 would claim evidence for an experiment
that was never run. The launch-grant half does not stand alone either: at grant
15 with no buff the opener sits at 8.0% wins, about two points of improvement
bought by cutting Week 1 from three drills to one.

## Terminal state of this work

The opener contract is reachable and the route is measured. Closing it needs a
product decision and a small piece of production work that are both outside what
measurement can settle:

- decide whether the opening opponent may be strengthened for its own fixture
  only, and build that mechanism; or accept a permanent roster change and
  re-measure it as shipped; or author the tutorial result
- decide whether the Week 1 training budget may be cut from three drills to one

`ENGINE_VERSION` stays `m2.0` under every option above. None of these levers
live in `src/sim/`, so `runMatch` returns identical output for identical inputs
and the golden replay is unaffected. A bump would invalidate every saved replay
to record a change the simulation never saw.

---

# Shipped

One content change. `content/training.json`, Keeper Drills priced by exposure:

| Tier | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| Every other path | 5 | 8 | 12 | 17 | 23 |
| **Keeper Drills** | **2** | **3** | **5** | **7** | **9** |

TP costs unchanged at 10/15/21/28/36. `src/content/schemas.ts` still pins every
drill's gain exactly; the pin is now per path rather than global, so content
cannot drift and the exception is explicit rather than a hole.

| Metric | Before | After |
|---|---:|---:|
| Keeper leverage, exposure-normalised | ~14x raw | **1.46x** (max 1.5) |
| Keeper-only opener loss rate | 31.7% | **68.3%** |
| Keeper path GD lift per 100 TP | 3.790 | 2.230 |
| Keeper path opener W/D/L | 21.6 / 47.6 / 30.8 | 8.4 / 24.4 / 67.2 |
| Ordinary x Cozy opener wins | 23.4% | **10.2%** |
| Smart x Chairman opener wins | 23.8% | **10.8%** |
| REF gained per Ordinary career | +25.4 | +10.5 |

Every other path is unchanged — finishing 0.410, duels 0.310, sprints 0.030 —
confirming the change was surgical.

## Why nothing else shipped

The launch-grant cut and the opponent buff both reach a lower win rate, and both
were measured in full. Neither shipped, for reasons the win-rate table does not
show:

- **A launch grant of 15 kills chain-tapping in Week 1.** Fifteen funds exactly
  one Tier I drill and leaves 5, so the second tap that keeps the drill popup
  live and re-sequences it cannot happen. Twenty preserves it, but only buys
  about two points of win rate on its own.
- **A harder opening delays the player's first win.** The old week-7 authored event's
  `hasFollowUp` was true because the club had banked `milestone:first-win` by its
  week 7-12 window. Cutting the opener harder removes it, so the first-win
  celebration lands later in the season.
- **The measured buff and a shippable buff are different changes.** The harness
  clones the opponent for the opening fixture only. Shipping it means editing
  `content/clubs.json`, which strengthens that club across all eighteen of its
  league fixtures — a permanent roster rebalance the spec lists among its V1
  non-goals, and not the change those numbers measure.

At a 10% target the keeper ladder is sufficient on its own, and it is the only
one of the three that is a measured defect fix rather than a product trade-off.

## ENGINE_VERSION

Unchanged at `m2.0`, and correctly so. `git diff HEAD -- src/sim/` is empty, the
golden replay passes untouched, and `runMatch` returns identical output for
identical inputs. A drill's gain changes what goes into a match, never how a
match resolves. Bumping would invalidate every saved replay to record a change
the simulation never saw.

---

# Correction, 2026-07-31 — two findings were instrument error

Re-measured with a peer-versus-peer control that should have been run first.

## The D3 draw-lock does not exist

Reported as the most serious defect in the game: a promoted club drawing 20 of
its first 25 D3 matches at an 87-point deficit, blamed on the contest curve
flattening at high ratings.

It was a bug in `division-entry-probe`. Cup ties resolve outside
`state.fixtures`, so reading them back from there missed, fell through to a
`score === undefined ? 0` default, and recorded 0-0 — which the probe counted as
a league draw. The `0W-5D-0L` rows were cup rounds, not stalemates.

`division-decisiveness-probe` now measures every division peer-versus-peer on
production-generated clubs, and football gets *more* decisive as the pyramid
climbs, not less:

| Division | Goals/match | Draw% | 0-0% |
|---|---:|---:|---:|
| D5 peer | 2.40 | 25.8 | 7.1 |
| D4 peer | 4.30 | 16.3 | 1.3 |
| D3 peer | 4.78 | 16.7 | 0.8 |
| D2 peer | 4.57 | 20.4 | 0.4 |
| D1 peer | 5.20 | 15.4 | 0.0 |

The probe now throws on an unreadable league result and excludes cup ties from
division form, which is what it should have done from the start. A silent
numeric default inside a measurement is the one place it cannot be tolerated.

## "D5 is too easy" contradicts the documented target

`division-ramp-probe` states the intent plainly: *"D5 in 1 season if you are
good, 2 at most if you are not."* Four of four careers promoting in season one
is the design working, not failing.

## "D4 is a wall" was half instrument too

The probe built a Training Pitch and then never visited the drill shop again,
modelling a manager permanently on Tier I drills at 5 points a tap while the
shop opens Tier II in D4, III in D3, IV in D2 and V in D1 at 8/12/17/23. That is
the largest lever a climbing club has, and
`promotion-progression.ts` says so directly: *"the climb is what funds the drill
shop, which is the point of charging for it."*

With purchases enabled, D4's first-five record moved from 43W/7D/50L to
55W/4D/41L and one career won the division in season five.

## What survived: the ladder steepened as it climbed

| Step | Old ratio |
|---|---:|
| D5 → D4 | 2.13x |
| D4 → D3 | 1.49x |
| D3 → D2 | 1.33x |
| D2 → D1 | 1.24x |

The first promotion was by far the steepest, at the point in a career with the
fewest tools to answer it, and the entry deficit compounded: -1.1 at D5, -29.5
at D4, -88.7 at D3.

# Shipped — the even ladder

`DIVISION_STRENGTH_BANDS` rebased so all four steps are an equal 1.51x. The span
is unchanged; D5 still opens around 45 and D1 still tops out at 235.

| Division | Old band | New band |
|---|---|---|
| D1 | [223, 248] | [223, 248] |
| D2 | [178, 203] | **[143, 169]** |
| D3 | [135, 151] | **[93, 113]** |
| D4 | [90, 102] | **[62, 74]** |
| D5 | [40, 50] | [40, 50] |

`DIVISION_SUPPORT_STRENGTHS`, `DIVISION_STAR_FOCUS_RATINGS`,
`DIVISION_GOALKEEPER_REF_RATINGS` and `DIVISION_TYPICAL_PACE` are rescaled by the
same per-division factor, so each division stays internally consistent — support
strengths price wages in `market.ts`, and the star, keeper and pace tables shape
the squads generated inside the bands.

## Measured effect

Four careers, seven-season budget, drill purchases enabled:

| Entering | Before | After |
|---|---|---|
| D5 | gap -1.1, 17W/4D/9L, 6 entries | gap -3.0, 12W/4D/9L, 5 entries |
| D4 | gap -29.5, 55W/4D/41L, 20 entries | gap -6.0, 48W/3D/19L, 14 entries |
| D3 | gap -88.7, 0W/2D/8L, 2 entries | gap -44.6, **14W/9D/17L, 8 entries** |
| D2 | never reached | gap -97.1, 0W/3D/2L, 1 entry |

D3 went from unreachable — two entries and a single point across twenty-eight
career-seasons — to a division careers actually reach and compete in. One career
reached D2 for the first time.

Peer football inside each division is unchanged: the regenerated
`division-goalkeeper-gate` sample stays inside its locked rails at every level
(goals per match 4.17 to 4.60 against a 2 to 5 rail, save rate 0.54 to 0.60
against 0.50 to 0.75).

## Still open

D2 entry now sits at -97.1 from a single observation, which is where D3 used to
be. Whether that is the next cliff or an artifact of one career arriving early
needs more seeds before it is worth acting on.

## ENGINE_VERSION

Unchanged at `m2.0`. `src/sim/` is untouched and the golden replay passes. The
bands decide which squads exist, never how a match between them resolves.
