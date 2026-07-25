# Handoff: make Division 5 winnable (the TP wall)

**Status: RESOLVED 2026-07-26.** Two constants changed, six suites triaged, full
suite green. A career that trains and builds now promotes out of D5 in season 2;
one that does neither never does. See §9 for what shipped and §10 for what is
still open.

**Owner's target:** D5 completed in **1 season by a good player, 2 at most** by
someone who doesn't know what they're doing. Promotion is top 2 of 10. The
opening is **deliberately rigged against the player** (owner, 2026-07-26) — the
climb is meant to take one or two seasons of building facilities and training,
not a fair fight on day one.

---

## 1. The cause (measured, not inferred)

Training Points income is **zero per week, indefinitely**.

- `startingTrainingPoints: 30` — `src/application/launch.ts:52`
- Weekly income is `trainingPitchLevel * TRAINING_PITCH_TP_PER_LEVEL + coachPoints`
  — `weeklyAmbientTrainingPoints` in `src/game/career.ts` (~line 973)
- `TRAINING_PITCH_TP_PER_LEVEL = 10` — `src/game/facilities.ts:4`
- **No Training Pitch exists at career start** (`createFacilityGrid()` returns
  `buildings: []`), so `trainingPitchLevel` is 0 and income is 0.
- A Training Pitch costs **8,000** with max level 2 and weekly upkeep
  `[100, 160, 240]` — `src/game/facilities.ts:44`. D5 wages run **350–420% of
  income**, so the club cannot buy it.

Measured with the ramp probe (whole TP bank spent every week, every eligible
player):

| season | drills | TP spent | TP left |
|---|---|---|---|
| 1 | 3 | 30 | 0 |
| 2 | 0 | 0 | 0 |

**It is a lock, not a slope:** no TP → no development → the squad decays while
the league improves → no promotion → never enough money for the pitch that would
generate TP.

Consequent trajectory, which is the actual symptom:

| season | user squad | D5 field |
|---|---|---|
| 1 | 36.0 | 40.4 |
| 2 | 35.5 | 42.1 |
| 3 | 32.4 | 41.4 |

`0 of 6 careers` escaped D5 in three seasons, finishing 8th–10th of 10 on 0–18
points of 54.

---

## 2. The fix I made, and what it achieved

Two edits. Add to `src/game/facilities.ts`, next to `TRAINING_PITCH_TP_PER_LEVEL`:

```ts
/** Training Points earned every week with no Training Pitch built at all. */
export const BASE_WEEKLY_TRAINING_POINTS = 24;
```

Then in `weeklyAmbientTrainingPoints` (`src/game/career.ts`), import it and
replace the return with:

```ts
  // The baseline is unconditional: a club can run drills on whatever field it
  // has. Without it a career with no Training Pitch earned nothing, forever.
  return checkedAdd(
    checkedAdd(BASE_WEEKLY_TRAINING_POINTS, facilityPoints, 'baseline training points'),
    coachPoints,
    'ambient training points',
  );
```

Measured results (2 seeds x 2 seasons, real engine, all 90 fixtures a season):

| base TP/week | drills/season | squad season 1 → 2 | field | points | finish |
|---|---|---|---|---|---|
| 0 (today) | 3 **per season** | 36.0 → 32.4 | 40.4 → 41.4 | 5–17 | 8th–10th |
| **24** | 72 | 39.7 → 42.0 | 40.4 → 42.1 | 11 → 17 | 7th–9th |
| 60 | 177 | 45.9 → 54.1 | 40.4 → 42.1 | 17 → 28 | 4th–5th |

**The decay is cured at 24.** Nobody promotes at either value, so TP starvation
was necessary but not sufficient.

**Prefer 24 over 60 on design grounds:** the Training Pitch adds +10/level to a
max of +20. Against a base of 24 that is a meaningful 42–83% uplift; against 60
it is 17–33% and the facility stops mattering, which undoes the earlier "make all
12 facilities matter" work. Do not raise the base without re-checking that the
Pitch is still worth buying.

Drill economics, for sizing: tier 1 costs 6 TP for +3 to one stat, tier 2 costs
10 for +5, tier 3 costs 15 for +8 (`content/training.json`). Tier 2 unlocks at
D5. Gains are bounded by `playerAttributeCaps`, so TP cannot be spent infinitely.

---

## 3. ~~Do this FIRST — the probe's comparison is invalid~~ — WRONG, disproved

This section claimed `squadMeanFor` compared the user's best eleven against
rivals' full sixteen, because rival clubs route through the pyramid path of
`buildCareerMatchTeamDef`. **They do not.** All ten Division 5 clubs are seeded
into `state.clubs` by launch content, so every one of them takes the
`buildCareerTeamDef` branch, and `buildTeamDef` returns `players` = exactly the
eleven in the lineup for both sides. Measured: all ten clubs report
`players=11`, `squad=16`. The comparison was always like-for-like.

The reasoning error was reading the function a call *might* route to instead of
the routing condition. Check `state.clubs.some(...)` first.

The real measurement flaw was different and worse: the ramp probe reported the
**season-end** squad mean next to a **whole season** of results. At base 60 the
squad finished on 54.1 but played most of its fixtures far below that, so the
"+12 and still 4th–5th" contradiction was comparing an end-state against results
earned on the way there. Squad means quoted against a table must be sampled
across the season, not at its end.

---

## 4. Hypotheses already tested and FALSE — do not re-test

1. **Overtraining / condition collapse is not the cap.** With the whole bank
   spent weekly, mean condition at season end is **100** and injuries are **0**.
   A `TRAIN_CONDITION_FLOOR=70` run produces **byte-identical** results. The
   probe already reports mean condition and injury count per season.
   **Re-confirmed 2026-07-26 at 124 drills a season** (the original measurement
   was taken at 3): condition sampled on match days averages 98, minimum 97,
   zero injuries, and floors of 0/70/85 give byte-identical tables. Training
   volume does not cost condition in any amount that matters.
2. **`DIVISION_SUPPORT_STRENGTHS[5]` is the wrong lever.** Lowering it 40 → 35
   (and the D5 band 40–50 → 35–45) did **not move the field mean off 40.4**. The
   opening D5 field is **authored launch content**, not the procedural pyramid —
   which is also why the opening gap is byte-identical on every seed. That change
   was reverted.

If a second lever is still needed after the TP fix lands, the authored D5 clubs
are the place to look, not `pyramid.ts`.

---

## 5. The six suites that go red, and why

Each pins a TP amount or a weekly-review line, so they are *probably* legitimate
expectation updates — but triage them **one at a time** and confirm each is an
expectation shift and not a real regression. Do not blanket-edit.

- `src/application/__tests__/default-career-journey.test.ts`
- `src/application/__tests__/weekly-review.test.ts`
- `src/game/__tests__/career.test.ts`
- `src/game/__tests__/squad.test.ts`
- `src/game/__tests__/facility-weekly-integration.test.ts`
- `src/game/__tests__/balance.test.ts`

Where a test hardcodes a TP number, prefer deriving it from
`BASE_WEEKLY_TRAINING_POINTS` / `TRAINING_PITCH_TP_PER_LEVEL` so it cannot drift
again — the same approach used for the Chairman sponsor assertion in
`m4-difficulty-recap.test.ts`.

---

## 6. How to measure

```bash
DIVISION_RAMP_PROBE=1 npm run test:probe -- src/audit/__tests__/division-ramp-probe.test.ts
```

~8 minutes at 2 seeds x 2 seasons. Prints per season: division, position, points,
GF, GA, squad mean, field mean, drills, mean condition, injuries. Optional
`TRAIN_CONDITION_FLOOR=70` to skip training tired players.

```bash
OPENING_GAP_PROBE=1 npm run test:probe -- src/audit/__tests__/opening-gap-probe.test.ts
```

Fast. Sizes the opening deficit per club and per attribute.

Probes are excluded from the normal run by `testPathIgnorePatterns`, which is why
they need `npm run test:probe`.

**Do not use `runHeadlessFullCareer` for balance** — it scores every fixture from
the fixture seed alone and ignores squad strength entirely. **Do not trust
`active-manager-balance`** for this either — it assumes a 3-0 win every week and
measures only the economy underneath that assumption.

---

## 7. Definition of done

- ✅ A career that trains **and builds** promotes out of D5 in season 2. Training
  alone does not, which is the intended shape: the facility is the lever.
- ✅ A career that never trains does **not** promote (8 of 8 measured seasons
  finished 6th–10th).
- ✅ The Training Pitch is not merely worth buying, it is now decisive — the
  same manager finishes 1st having built it and 10th having not.
- `npx tsc --noEmit` clean and the **full** suite green (was 207 suites / 1626
  tests at handoff). No `ENGINE_VERSION` bump is needed — this touches
  `src/game`, not `src/sim`, so `parity-replay` and `runtime-golden` must pass
  **unchanged**; if either moves, something reached the engine and should not
  have.
- Record the measured numbers in the constant's doc comment, as the GK anchor and
  press standoff constants do. A tuning value with no measurement beside it is
  the thing this audit kept having to undo.

---

## 8. Environment traps

- Several sessions share this repo. `main` is often dirty in the primary
  worktree, so land work via PR rather than a local merge to `main`.
- A worktree may have **no `node_modules`** — symlink it
  (`ln -s ../../../node_modules node_modules`) and remove it when done. Note it
  shows as untracked, so **never `git add -A`**.
- Do not `git stash` in a tree where another agent is working. It silently
  removes their files from disk.
- `src/application/__tests__/store.test.ts` takes ~250s and two of its tests
  carry explicit 120s timeouts. **A timeout is inconclusive, never a failure** —
  re-run the single test in isolation before believing it.
- There is no lint script, by design. Don't add one.
- Don't start a web preview: the build auto-plays looping audio and outlives the
  turn. Verify with typecheck and tests.

---

## 9. What shipped (2026-07-26)

Two constants, both in `src/game/facilities.ts`, both carrying their measured
numbers in the doc comment:

| constant | was | now | why |
|---|---|---|---|
| `BASE_WEEKLY_TRAINING_POINTS` | did not exist (0) | **24** | ends the zero-income lock; smallest value that turns squad decay into growth |
| `TRAINING_PITCH_TP_PER_LEVEL` | 10 | **28** | makes the Pitch, not the baseline, the thing that earns promotion |

`weeklyAmbientTrainingPoints` in `src/game/career.ts` now adds the baseline
unconditionally. Nothing in `src/sim/` was touched, so `ENGINE_VERSION` is
unchanged and both replay guards pass untouched.

Measured over three D5 seasons, seed 4000000, all 90 fixtures a season, whole TP
bank spent weekly, heroes awakened and licensed through the production path:

| manager | season 1 | season 2 | season 3 | cash, season 3 |
|---|---|---|---|---|
| trains **and builds** | 8th, squad 35.7 → 48.8 | **1st, PROMOTED** | 1st in D4 | +926 |
| trains, never builds | 8th, squad 35.7 → 39.7 | 10th | 10th | −107,557 |
| never trains | 6th | 10th | 10th | −121,940 |

Supporting calibration, squad strength held flat for a whole season so the
result is not confounded by in-season growth. Promotion needs a **sustained +5**
over the field, and the opening is deliberately **−5**:

| strength vs field | finish | points |
|---|---|---|
| −5 (the opening) | 8th | 17 |
| 0 | 8th | 19 |
| +5 | 2nd | 34 |
| +10 | 1st | 52 |

Two facts worth keeping: **heroes are invisible to `squadMean`** (a power is not
an attribute), and they are worth roughly **+4 points a season** in D5 at an
identical squad mean — so never read a hero career's strength off that column.
And the D5 field is **power-free on both sides**; no authored launch club has a
`powerId`.

---

## 10. The D5 wage-to-income ratio — CLOSED 2026-07-26

Not a TP problem, and not fixed here. Measured ledger, three D5 seasons, no
promotion:

| season | wages | tickets + sponsor + prize | subsidy / loan | net | cash after |
|---|---|---|---|---|---|
| 1 | −92,220 | 28,000 | +46,110 subsidy | −18,110 | 34,890 |
| 2 | −96,720 | 24,800 | +20,000 loan | −51,920 | −17,030 |
| 3 | −94,610 | 23,572 | −22,000 repayment, +8,885 board sale | −84,153 | −101,183 |

Wages run **~380% of income**. A one-off Season 1 wage subsidy hides this for
exactly one season; after that the club falls off a cliff and the fail-soft
mechanisms (one loan, one forced sale worth 8,885) are far too small against a
~70k/season structural deficit.

Promotion repairs it on its own — the career that goes up runs −1,312 then +926
instead of −107k — so this only bites a club that stalls. But a stalled club
reached −121,940 with **no floor at all**, which is not "fail-soft, never game
over": it is an unbounded number with no route back and no signal.

**Owner's decision (2026-07-26): "a little of 1 and all of 3."** Ease the money
pressure slightly, and make the safety net genuinely hold.

**Lever 1 — authored wages cut 20%** (`content/clubs.json`, all ten clubs, so the
division stays internally consistent). The starting club's bill goes 3,136 →
2,509 a week, 94,080 → 75,270 a season. Deliberately partial: D5 is still meant
to be tight, so this narrows the gap rather than closing it.

**Lever 3 — a hard cash floor, `cashFloor` in `src/game/difficulty.ts`.** When a
week would settle below the floor, the board tops the balance back up to it and
records a visible `board-rescue` ledger line. COZY floors at −15,000, CHAIRMAN at
−30,000 — allowed to sink twice as deep, so the danger zone lasts longer.

The floor is applied **last**, after the existing escalation, so the parts with
teeth still fire first and in order: warnings → one emergency loan → board
ultimatum → board-enforced sale. The rescue only catches what those cannot.

Measured, stalled club (never trains, never builds), four seasons:

| | COZY | CHAIRMAN |
|---|---|---|
| worst cash ever | **−15,000** | **−30,000** |
| was | −101,183 and falling | — |
| season 1 | subsidy 37,410 | no subsidy (correct for the mode) |
| season 2 | emergency loan 20,000 | loan 10,000, already at the floor |
| seasons 3–4 | rescue 46,243 then 52,590 | rescue 66,907 |
| forced sales still firing | 5,921 / 2,552 | 7,183 / 2,257 |

**Probe trap found while measuring this:** difficulty is chosen at *player
creation*, and `addCreatedPlayer` overwrites whatever `createLaunchCareerSetup`
carried. Passing `difficulty` only to the setup silently runs COZY — both modes
returned byte-identical ledgers until the draft carried it too.
