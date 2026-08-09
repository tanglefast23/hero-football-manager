import {
  BOOTSTRAP_RESAMPLES,
  BOOTSTRAP_SEED,
  bootstrapMeanCI95,
  cachedHomeGoals,
} from './helpers/gates';

// M0 acceptance suite (Task 13), split from the original parity.test.ts so jest
// workers can run these files in parallel (test-infra task, audit loop). GATE-1
// and GATE-3 are kept together deliberately: both need the same 400-seed
// "contextual auto" home-goals series, and cachedHomeGoals's module-level memo
// (helpers/gates.ts) is only shared within one jest worker's module instance —
// co-locating them here keeps GATE-3 finding GATE-1's cache already warm. If a
// gate fails, that is a design problem (tune contexts/effects) — never a test
// to weaken.

describe('M0 acceptance suite (Task 13)', () => {
  // Historical name was "attention floor" — that described the manual-tap era.
  // Since the 2026-07-25 tap removal this gate measures firing-vs-never-firing:
  // powers must be worth having at all, independent of anyone's attention.
  describe('GATE-1: powers-matter floor', () => {
    it('firing beats never-firing — home goals with all-FIRE_WHEN_READY vs SAVE_FOR_TAP never tapped (400 seeds, bootstrap CI lower bound > 0)', () => {
      const N = 400;
      const diffs: number[] = new Array(N);
      for (let seed = 1; seed <= N; seed++) {
        const firing = cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY' });
        const neverFiring = cachedHomeGoals(seed, {
          homePolicy: 'SAVE_FOR_TAP',
        }); // test instrumentation: never fires, no taps queued anywhere
        diffs[seed - 1] = firing - neverFiring;
      }
      const { mean, lower, upper } = bootstrapMeanCI95(
        diffs,
        BOOTSTRAP_RESAMPLES,
        BOOTSTRAP_SEED,
      );
      console.log(
        `GATE-1 powers-matter floor: mean diff ${mean.toFixed(4)}, 95% CI [${lower.toFixed(4)}, ${upper.toFixed(4)}] over ${N} seeds`,
      );
      expect(lower).toBeGreaterThan(0);
    }, 60000);
  });

  describe('GATE-3: auto sanity', () => {
    it('contextual auto BEATS blind auto — home goals contextual-auto > blind-auto (400 seeds), paired 95% CI logged', () => {
      const N = 400;
      const diffs: number[] = new Array(N);
      let contextual = 0,
        blind = 0;
      for (let seed = 1; seed <= N; seed++) {
        const c = cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY' });
        const b = cachedHomeGoals(seed, {
          homePolicy: 'FIRE_WHEN_READY',
          blindAutoHome: true,
        });
        contextual += c;
        blind += b;
        diffs[seed - 1] = c - b;
      }
      const { mean, lower, upper } = bootstrapMeanCI95(
        diffs,
        BOOTSTRAP_RESAMPLES,
        BOOTSTRAP_SEED,
      );
      console.log(
        `GATE-3 auto sanity: contextual=${contextual} blind=${blind} ratio=${(contextual / blind).toFixed(4)}; paired mean diff ${mean.toFixed(4)}, 95% CI [${lower.toFixed(4)}, ${upper.toFixed(4)}] over ${N} seeds`,
      );
      // Stronger than the retired `>= blind * 0.95` bar, which tolerated a 5% regression:
      // contextual auto must add positive value, not merely stay within 5% of blind.
      // (The paired CI is logged for regression tracking, but its lower bound sits near 0 —
      // per-seed variance swamps the ~0.13 mean effect — so a CI-floor gate would be flaky;
      // the directional aggregate is the honest strong check. Per-power isolation stays the
      // logged GATE-2 tightening backlog item, not a GATE-3 concern.)
      expect(contextual).toBeGreaterThan(blind);
    }, 60000);
  });
});
