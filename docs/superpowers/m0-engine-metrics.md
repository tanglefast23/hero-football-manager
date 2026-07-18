# M0 Engine Metrics — recorded values

Jest 30's default reporter swallows `console.log` from passing suites, so the
gate/rail diagnostics never appear in a green run. This file is the durable
record (audit finding 12 / T9). Update it whenever the engine version bumps and
the gate/rail assertions are re-measured. The **assertions** in the test files
are the enforcement; these are the measured values behind them.

## Rigid-sheet defect metric (off-ball y-velocity correlation, seeds 1–40)

| Engine | Correlation | Note |
|---|---|---|
| m0.4 (pre-movement) | 0.46059936294381776 | baseline, commit 092bd91 |
| m0.5 (positional tables) | 0.4135364714434378 | −10.3%, post-R1 |
| m0.7 (attacking decisions) | 0.4384725547598064 | sustained forward carries; support response retuned |

Assertion: `< m0.4 baseline − 0.02` (`movement-rework.test.ts`). Lower = less
"rigid sheet." If it creeps up, retune the generator, never the bound.

## Acceptance gates (400 paired seeds, mulberry32 bootstrap, 1000 resamples)

| Gate | Measure | m0.5 value | m0.7 value | Bar |
|---|---|---|---|---|
| GATE-1 attention floor | firing − never-firing home goals, 95% CI | mean 0.1750, CI [0.0350, 0.3075] | mean 0.1475, CI [0.0350, 0.2625] | CI lower > 0 |
| GATE-2 SUPER_SPEED | attacking-half − own-half shots, 95% CI | [0.0200, 0.2550] | mean 0.3800, CI [0.2700, 0.4800] | CI lower > 0 |
| GATE-3 auto sanity | contextual-auto ÷ blind-auto home goals | 0.9899 | 1.0097 (417 ÷ 413) | ≥ 0.95 |

Gates are design problems, never tests to weaken (AGENTS.md). GATE-2 currently
measures positional value of the tap window, not power value in isolation —
tightening it to a 2×2 tap×position interaction is a logged T10 backlog item.

m0.7 also recorded 4 contextual SUPER_STRENGTH fires across seeds 1–40; all
were locked at the intended 0.85 strength.

## Balance rails (200 seeds, ROVERS vs UNITED)

| Rail | m0.5 | m0.6 (GK narrowing) | m0.7 (attacking decisions) | Bounds |
|---|---|---|---|---|
| goals/match | 2.670 | 2.720 | 1.940 | 1.5–4.0 |
| shots/match | 8.860 | 9.075 | 11.920 | 8–40 |
| save rate | 0.6985 | 0.6913 | 0.6608 | 0.55–0.90 |
| blowout (+20 team goals/match) | 7.415 | 7.480 | 9.740 | < 10 |

GK angle-narrowing (m0.6) shifts play through pickup/interception/tackle
geometry, not the stat-based save roll — hence the small second-order deltas.
Retune the GK depth/clamp constants if a rail moves, never the assertions.

## Attacking-decision mix (100 seeds, ROVERS vs UNITED)

| Measure | m0.7 |
|---|---|
| goals/match | 2.010 |
| shots/match | 11.690 |
| passes/match | 116.010 |
| pass completion | 0.867 |
| Zone entries/match | 7.340 |

This is the dedicated forward-play guard added with m0.7. It also asserts that
unpressured attacking-third backpasses remain exceptional, while pressured
release passes remain legal.
