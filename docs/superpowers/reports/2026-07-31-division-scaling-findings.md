# Division Scaling — Findings

**Date:** 2026-07-31
**Continues:** `docs/superpowers/reports/2026-07-30-real-player-balance-findings.md`
**Status:** Task 1 measured and closed with no code change. Task 2 in progress.

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
