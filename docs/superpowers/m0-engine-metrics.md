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

Assertion: `< m0.4 baseline − 0.02` (`movement-rework.test.ts`). Lower = less
"rigid sheet." If it creeps up, retune the generator, never the bound.

## Acceptance gates (400 paired seeds, mulberry32 bootstrap, 1000 resamples)

| Gate | Measure | m0.5 value | m0.7 value | Bar |
|---|---|---|---|---|
| GATE-1 attention floor | firing − never-firing home goals, 95% CI | mean 0.1750, CI [0.0350, 0.3075] | mean 0.2125, CI [0.0775, 0.3525] | CI lower > 0 |
| GATE-2 SUPER_SPEED | attacking-half − own-half shots, 95% CI | [0.0200, 0.2550] | mean 0.1300, CI [0.0100, 0.2650] | CI lower > 0 |
| GATE-3 auto sanity | contextual vs blind home goals (paired) | ratio 0.9899 (contextual *below* blind) | 659 vs 607, ratio 1.0857; paired mean 0.1300, CI [−0.005, 0.270] | **contextual > blind** |

Gates are design problems, never tests to weaken (AGENTS.md). GATE-2 currently
measures positional value of the tap window, not power value in isolation —
tightening it to a 2×2 tap×position interaction is a logged T10 backlog item.

**GATE-3 rebar (m0.7, audit finding 4).** The retired `≥ blind × 0.95` bar
tolerated a 5% regression — and at m0.5 it *masked* one: contextual auto scored
0.9899× blind (i.e. worse than firing blindly), yet the gate passed. The bar is
now `contextual > blind`: contextual auto must add positive value. The paired
95% CI is logged for regression tracking but not gated — its lower bound sits at
≈0 (per-seed variance swamps the ~0.13 mean), so a CI-floor here would be flaky.

## Balance rails (200 seeds, ROVERS vs UNITED)

| Rail | m0.5 | m0.6 (GK narrowing) | m0.7 (Zone pause/resume) | Bounds |
|---|---|---|---|---|
| goals/match | 2.670 | 2.720 | 3.155 | 1.5–4.0 |
| shots/match | 8.860 | 9.075 | 9.260 | 8–40 |
| save rate | 0.6985 | 0.6913 | 0.6593 | 0.55–0.90 |
| blowout (+20 team goals/match) | 7.415 | 7.480 | 7.420 | < 10 |

GK angle-narrowing (m0.6) shifts play through pickup/interception/tackle
geometry, not the stat-based save roll — hence the small second-order deltas.
Retune the GK depth/clamp constants if a rail moves, never the assertions.

**m0.7 goals/match shift (2.720 → 3.155).** The "a knocked-down hero stays hot"
change (docs/04 canon: the Zone now pauses on knockout and resumes on recovery,
instead of expiring) means power windows survive knockdowns and fire on recovery
— more hero fires, more goals, both teams. Well inside the ≤ 4.0 rail, but a real
lift; retune power durations (powers.ts `DUR`) if a tighter scoreline is wanted.
