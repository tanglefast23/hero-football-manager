# Handoff: make Division 5 winnable (the TP wall)

**Status:** cause measured and confirmed. A 4-line fix cures the root cause but is
**not sufficient on its own**, and it reddens six test suites. Reverted rather
than shipped. This is the single open item from the July 2026 audit; everything
else is merged to `main`.

**Owner's target:** D5 completed in **1 season by a good player, 2 at most** by
someone who doesn't know what they're doing. Promotion is top 2 of 10.

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

## 3. Do this FIRST — the probe's comparison is invalid

**Until this is fixed you cannot tell whether any TP rate produces promotion.**

In `src/audit/__tests__/division-ramp-probe.test.ts`, `squadMeanFor` calls
`buildCareerMatchTeams`. For the **user** club that routes to
`buildCareerTeamDef` (`src/game/squad.ts:36`), which builds from
`lineup.playerIds` — the best **eleven**. For **rival** clubs it routes to the
pyramid path, which averages the whole **sixteen**-man squad including reserves.

The two numbers are not comparable. An apparent "+12 stronger than the field" at
base 60 was an artifact of comparing a best XI against a full squad, not a
finding. Fix the field side to a best-eleven (or compare whole-squad on both
sides) before trusting any gap number or concluding anything about a second cause.

---

## 4. Hypotheses already tested and FALSE — do not re-test

1. **Overtraining / condition collapse is not the cap.** With the whole bank
   spent weekly, mean condition at season end is **100** and injuries are **0**.
   A `TRAIN_CONDITION_FLOOR=70` run produces **byte-identical** results. The
   probe already reports mean condition and injury count per season.
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

- A career that trains actively promotes out of D5 in **1–2 seasons**, shown by
  the ramp probe across several seeds, with the field comparison fixed per §3.
- A career that never trains does **not** promote quickly (the difficulty still
  means something).
- The Training Pitch is still clearly worth buying.
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
