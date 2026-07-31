# Division Scaling — Findings

**Date:** 2026-07-31
**Continues:** `docs/superpowers/reports/2026-07-30-real-player-balance-findings.md`
**Status:** Task 1 measured and closed with no code change. Task 2 shipped one
change — the ladder's curve reversed — and is not finished; see Result 3.

The 07-30 work shipped the Keeper Drills gain ladder and left two open questions:
whether matches go quiet in higher divisions, and whether the D5 → D4 ramp is
backwards. This report answers the first and corrects the measurement that
raised it.

`src/sim/` is untouched. `ENGINE_VERSION` stays `m2.0`.

## Result 1 — matches do not go quiet in higher divisions. They get louder.

The hypothesis under test: `DIVISION_STRENGTH_BANDS` roughly doubles per
division, and scaling both sides together was thought to push every duel into
the flat region of the contest curve, so attacks stop converting.

`src/audit/__tests__/division-decisiveness-probe.test.ts` plays production
clubs against their own division's peers — 80 seeds each way per pairing, 1,600
matches. The only thing changing between rows is the band the clubs were
generated at.

```bash
DIVISION_DECISIVENESS_PROBE=1 DECISIVENESS_MATCHES=80 \
  npm run test:probe -- src/audit/__tests__/division-decisiveness-probe.test.ts
```

| div | pairing | squad means | goals/match | draw% | 0-0% | strongerWin% | shots/match |
|---|---|---|---:|---:|---:|---:|---:|
| D5 | peer | 40.7 v 39.8 | 2.45 | 25.0% | 7.5% | 49.4% | 16.0 |
| D5 | mismatch | 44.2 v 34.6 | 3.14 | 4.4% | 2.5% | **95.0%** | 14.9 |
| D4 | peer | 97.9 v 95.4 | 4.33 | 16.9% | 0.6% | 42.5% | 22.0 |
| D4 | mismatch | 103.1 v 90.9 | 4.42 | 12.5% | 0.6% | 69.4% | 22.1 |
| D3 | peer | 144.8 v 143.6 | 4.88 | 15.0% | 0.6% | 48.1% | 23.6 |
| D3 | mismatch | 152.6 v 135.8 | 4.71 | 16.3% | 0.6% | **60.0%** | 23.5 |
| D2 | peer | 194.0 v 190.8 | 4.53 | 21.9% | 0.6% | 38.1% | 23.0 |
| D2 | mismatch | 206.1 v 179.7 | 4.92 | 13.1% | 1.3% | 65.6% | 26.0 |
| D1 | peer | 239.9 v 236.6 | 5.14 | 16.3% | 0.0% | 38.8% | 25.7 |
| D1 | mismatch | 250.8 v 225.5 | 4.96 | 12.5% | 0.0% | 72.5% | 25.3 |

Every trend runs opposite to the hypothesis. Climbing D5 → D1, goals per match
rise 2.45 → 5.14, draws fall 25.0% → 16.3%, goalless draws fall 7.5% → 0.0%,
and shots rise 16.0 → 25.7. **The quiet division is D5, not D3.**

**The bands were never a candidate, and the arithmetic says so.** `ratingD64` is
a logarithm table and `contestProbability` consumes a *difference* of logs, so a
peer match is a zero-difference contest at every level — the steepest point on
the curve, not the flat region. Scaling both sides is a no-op by construction;
that scale invariance is the property `ratingD64` exists to provide. Doubling a
band cannot flatten a peer duel, so no compression was attempted.

**No change made.** `DIVISION_STRENGTH_BANDS` is untouched.

### The one real asymmetry the probe did find

The mismatch rows are not consistent: a D5 best-versus-worst is decided 95.0% of
the time, a D3 one only 60.0%. That is not a curve effect either. It is the
band's *relative* width, which is what a ratio contest reads:

| band | span | top ÷ bottom |
|---|---|---:|
| D5 | [40, 50] | **1.250** |
| D4 | [90, 102] | 1.133 |
| D3 | [135, 151] | 1.119 |
| D2 | [178, 203] | 1.140 |
| D1 | [223, 248] | 1.112 |

D5's table is twice as spread out, in ratio terms, as any division above it.
The strongest D5 club is a different proposition from the weakest in a way the
strongest D1 club is not.

This is deliberate and should stay. The user starts bottom of D5 and the Week 3
opener is the division's strongest club — that fixture *is* the 44.2 v 34.6 row,
and its 95% stronger-win rate is the ~90%-loss opener the 07-30 contract asks
for. Narrowing D5 would soften the opener as a side effect.

## The measurement that raised the question was wrong

The 07-30 report's Result 3 recorded a promoted club drawing 20 of its first 25
D3 matches, and one career finishing a D3 season 0W-5D-0L with goal difference
exactly 0. Those rows are artifacts of `division-entry-probe.test.ts`, not
results the engine produced.

`activeCareerMatchday` returns National Cup weeks as well as league weeks, but
cup scores are stored in `state.m2.nationalCups`, not `state.fixtures`. The
probe looked every result up in `state.fixtures`:

```ts
const settled = played.fixtures.find(fixture => fixture.id === userFixture.id);
const score = settled?.score;
const goalsFor    = score === undefined ? 0 : ...;
const goalsAgainst = score === undefined ? 0 : ...;
const outcome = goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';
```

A cup week never matched, so the fallback scored it 0-0 and the ternary called
it a draw. Goal difference of exactly 0 across five "draws" was the tell: real
draws at mixed scorelines also sum to 0, but so does a run of fabricated
goalless ones.

**Fixed.** Cup ties are now resolved but never sampled — a tie is played against
another division, so it says nothing about the gap to *this* division's field —
and a league fixture that comes back without a score throws instead of
defaulting. The same silent default does not appear anywhere else in
`src/audit/`; `promotion-survival-probe` and `opening-matches-probe` already
branch on `matchday.kind`.

Every "first-5 W-D-L" figure in the 07-30 report's Result 3 is affected and
should not be quoted. The entry-gap columns in that table are unaffected —
they are read from squad attributes before kickoff, not from results.

## Result 2 — the ladder's steps ran backwards, and raw ratings hid it

Two measures of the same pyramid disagree, and only one of them decides matches.
`roleOverall` — which sets `squadStrength` and drives band tuning — reads raw
attributes. The match reads `matchAttribute`, which compresses everything above
99 (`99 + 50(raw-99)/(raw+101)`, asymptotic at 149). Above about 100 raw, extra
rating buys progressively less real strength.

Effective step per promotion, same generated pyramid, best XI of each club:

| | D5→D4 | D4→D3 | D3→D2 | D2→D1 |
|---|---:|---:|---:|---:|
| before | **1.869** | 1.183 | **1.059** | **1.039** |
| after | 1.242 | 1.326 | 1.322 | 1.117 |

The old pyramid was not merely front-loaded. Above D4 the divisions were nearly
**interchangeable** — 1.06x and 1.04x — while their raw ratings almost doubled
each time. A club "87 rating points behind" its D3 field was not 87 points
behind in any sense the engine could act on, which is why those fixtures looked
competitive rather than like routs.

### The change

`DIVISION_STRENGTH_BANDS` and its four companion tables, D4/D3/D2 only. D5 and
D1 are fixed endpoints, so the total climb, the opening tutorial balance, and
D1's rating scale are untouched.

| | D5 | D4 | D3 | D2 | D1 |
|---|---:|---:|---:|---:|---:|
| band | [40,50] | [90,102] → **[55,63]** | [135,151] → **[80,90]** | [178,203] → **[127,143]** | [223,248] |
| support | 40 | 88 → **54** | 130 → **77** | 175 → **123** | 214 |
| star focus | 94 | 180 → **111** | 268 → **159** | 356 → **252** | 442 |
| keeper REF | 80 | 153 → **94** | 228 → **135** | 303 → **214** | 376 |
| typical pace | 72 | 90 → **83** | 132 → **102** | 176 → **140** | 216 |

Pace had to move with the bands: PAC is part of `roleOverall`, and
`tuneGeneratedSquadToStrength` protects it while pushing every other stat to hit
the target. Leaving D3 at pace 132 against a band of 85 squeezes its remaining
five stats below D4's, inverting the pyramid in everything except speed. The
old comment claiming D1 must sit at 216 so `PAC` 999 stays inside a 2x speed
rail is not a constraint: the pace table is nearly flat, and that ratio only
reaches 2x at pac **1** — at pac 88 it is 1.28.

No `src/sim/` change and no `ENGINE_VERSION` decision. Content and generation
only.

## Result 3 — careers climb now, but they yo-yo between D3 and D4

12-season budget, 4 careers, every fixture through the real engine. Division by
season:

```
4000000  5 4 4 3 3 2 2 3 2 3 2 2
4007919  5 5 4 3 3 2 3 4 3 3 3 4
4015838  5 4 4 4 4 3 3 4 3 4 3 4
4023757  5 4 4 3 4 3 4 3 4 3 3 2
```

| Entering | Mean gap | First-5 record | Entries |
|---|---:|---|---:|
| D5 | −2.7 | 13W / 4D / 8L | 5 |
| D4 | **+3.5** | 63W / 8D / 14L | 17 |
| D3 | −27.6 | 46W / 14D / 35L | 19 |
| D2 | −90.0 | 10W / 13D / 12L | 7 |

Against the pre-change baseline this is a large improvement: two of four careers
never left D4 at all, parked at 8th on exactly 12 points for six seasons. Every
career now reaches D3, and three reach D2.

It is also not finished:

- **D4 is now too easy.** Entry gap is **positive** (+3.5) and first fives run
  63W/14L. A club relegated from D3 re-enters D4 carrying a D3 squad — seed
  4015838 arrives at +24.8 — and wins the division at a canter.
- **D3 is a bounce, not a barrier.** Promoted clubs are relegated, dominate D4,
  and promote again. Three of four careers oscillate for the whole budget.
- **D1 is unreached** in twelve seasons on every seed.

The mechanism is arithmetic. A squad grows about 1.10x a season, so any step
larger than roughly 1.2x cannot be consolidated in the season that promotion
buys. D4→D3 is 1.44x raw (1.33x effective), comfortably over that line, so a
club that just won D4 is under-strength for D3 by construction. The oscillation
is stable rather than transitional.

Closing it means bringing D4→D3 and D3→D2 down toward 1.2x, which — with D1
anchored at [223,248] — necessarily pushes the remaining climb into the top two
divisions. That is a pacing decision rather than a measurement, and it is where
this work stops.

### The D4 relegation pack is now doing harm

`DIVISION_FOUR_RELEGATION_PACK_STRENGTHS` retunes two D4 clubs to 39 and 40. It
was installed as a survival aid against a 1.87x cliff that no longer exists, and
against a [55,63] band it is two free wins that drag the field mean down about
four points. It was deliberately left alone this pass so the band measurement
stayed readable; it is the first thing to pull next.

## Probe fixes made along the way

Both were policy defects in `division-entry-probe.test.ts`, not game defects.

1. **Cup weeks were scored as 0-0 draws** (Result 1's correction).
2. **Unlicensed heroes were left in the starting eleven.** Past season seven a
   career awakens more heroes than the Hero License caps, and the probe licensed
   up to the cap without benching the surplus. `buildTeamDef` then correctly
   refused the eleven and the run died. Confirmed pre-existing by reproducing it
   on the old bands. The probe now swaps an unlicensed powered starter for a
   same-role unpowered substitute through `setCareerLineup`.

## Test rails updated, and one loosened

- `m2-career.test.ts` pinned D4's opponents at literals 90/100/155. Now derived
  from `DIVISION_STRENGTH_BANDS[4]`.
- `full-career.test.ts` asserted the minnow-to-established gap was at least 35.
  That rail *was* D4's bimodality — two clubs at 39/40 and a wall fifty points
  above with nothing between, which is what produced the 12-point seasons. Now
  derived from the pack strength and the band floor.
- `full-career.test.ts` also asserted the strongest D4 eleven sits within +1 of
  the band top. **This one is genuinely looser now**, pinned at 1.2x instead.
  The old tightness was an artifact: D4's old top of 102 sat inside
  `matchAttribute`'s squeeze, which hid the best-eleven-of-sixteen premium.
  Below 99 there is no compression and the premium shows undisguised at +17%.
- `division-goalkeeper-gate.json` regenerated through its own documented probe.
  All five divisions stay inside the locked rails (goals/match 2–5, save rate
  0.50–0.75); D1 and D5 are byte-identical.

## Verification

- `npx tsc --noEmit` — clean, exit status checked directly
- `npm test` — 249 suites, 2065 tests passed, 1 skipped
- `ENGINE_VERSION` remains `m2.0`; `src/sim/` untouched

## Result 4 — the finished ladder

Two more iterations after Result 3, both driven by the same arithmetic: a squad
grows about 1.10x a season, so a promotion that buys one season before the next
relegation vote cannot consolidate a step much above 1.2x.

**Iteration 2** brought D4 -> D3 and D3 -> D2 to 1.20x and deleted the D4
relegation pack. It fixed the D3/D4 oscillation and every career reached D1 by
season six — but holding D1 at [223, 248] made the last step 2.77x, and that was
not a long climb but a divergent one. Opponent growth compounds at 3% a season
on a field already far above D2, so one career's four D1 visits met fields of
259, 275, 292 and 310 while its own squad oscillated around 110. Every D1 season
finished 9th and relegated: the D3/D4 yo-yo had simply moved to the top.

**Iteration 3** brought D1 down to 1.33x above D2 — three seasons of growth.
Lowering its raw ratings costs nothing real. The contest reads ratios, and
`matchAttribute` was compressing most of the old headroom away before it reached
the pitch; the goalkeeper gate confirms D1 peer matches merely moved from 4.60
to 3.98 goals a match and 0.588 to 0.619 save rate, both inside the locked rails.

### Final ladder

| | D5 | D4 | D3 | D2 | D1 |
|---|---:|---:|---:|---:|---:|
| band | [40,50] | [55,63] | [67,75] | [80,90] | [107,120] |
| step | — | 1.31x | 1.20x | 1.20x | 1.33x |
| seasons of growth | — | 2.8 | 1.9 | 1.9 | 3.0 |
| support | 40 | 54 | 65 | 77 | 103 |
| star focus | 94 | 111 | 133 | 159 | 212 |
| keeper REF | 80 | 94 | 113 | 135 | 180 |
| typical pace | 72 | 83 | 92 | 102 | 112 |

### Measured, 12-season budget, 4 careers

Division by season:

```
4000000  5 4 3 2 2 1 1 1 1 1 1 1
4007919  5 5 4 3 2 1 2 1 1 1 1 1
4015838  5 4 3 2 2 1 1 1 1 1 1 1
4023757  5 4 4 3 3 3 2 2 3 2 2 1
```

| Entering | Mean gap | First-5 record | Entries |
|---|---:|---|---:|
| D5 | −2.7 | 13W / 4D / 8L | 5 |
| D4 | −9.6 | 16W / 7D / 2L | 5 |
| D3 | −13.6 | 23W / 7D / 5L | 7 |
| D2 | −12.7 | 34W / 11D / 5L | 10 |
| D1 | −25.1 | 59W / 40D / 6L | 21 |

Every career reaches D1 and stays there. Across all four, exactly one relegation
from D1 occurs (seed 4007919, season 6, arriving at a −48 gap), and that career
returns the following season and wins the division twice. Seed 4023757 is the
slow path — relegated from D3 and from D2, reaching D1 only in season 12 — which
is the variance the ramp is supposed to have.

The entry gap now grows monotonically with the division, −2.7 to −25.1, so each
promotion is a visibly larger step than the last without any of them being a
wall. That is the "slowly harder every division" shape the owner asked for.

### Two caveats on these numbers

- **The gap column understates the user.** Heroes are invisible to `squadMean`
  because a power is not an attribute, and a licensed D1 hero at power tier 3 is
  worth far more than the four league points one was measured at in D5. Careers
  winning a division at a negative measured gap are doing it on powers.
- **D1's first-five record is flattered by its own success.** Once a club stays
  up, every subsequent season counts as another "entry", so those 21 rows are
  mostly established seasons rather than arrivals. Read the four genuine first
  entries instead: 4th, 9th (relegated), 1st, 1st.

## Verification

- `npx tsc --noEmit` — clean, exit status checked directly
- `npm test` — 249 suites, 2064 tests passed, 1 skipped (one fewer than before:
  the D4 relegation-pack test was deleted with the feature)
- `ENGINE_VERSION` remains `m2.0`; `src/sim/` untouched throughout
