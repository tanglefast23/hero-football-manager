import { BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED, bootstrapMeanCI95, cachedHomeGoals } from './helpers/gates';

// M0 acceptance suite (Task 13), split from the original parity.test.ts so jest
// workers can run these files in parallel (test-infra task, audit loop). GATE-1
// and GATE-3 are kept together deliberately: both need the same 400-seed
// "contextual auto" home-goals series, and cachedHomeGoals's module-level memo
// (helpers/gates.ts) is only shared within one jest worker's module instance —
// co-locating them here keeps GATE-3 finding GATE-1's cache already warm. If a
// gate fails, that is a design problem (tune contexts/effects) — never a test
// to weaken.

describe('M0 acceptance suite (Task 13)', () => {
  describe('GATE-1: attention floor', () => {
    it('firing beats never-firing — home goals with all-FIRE_WHEN_READY vs SAVE_FOR_TAP never tapped (400 seeds, bootstrap CI lower bound > 0)', () => {
      const N = 400;
      const diffs: number[] = new Array(N);
      for (let seed = 1; seed <= N; seed++) {
        const firing = cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY' });
        const neverFiring = cachedHomeGoals(seed, {}); // default SAVE_FOR_TAP, no taps queued anywhere
        diffs[seed - 1] = firing - neverFiring;
      }
      const { mean, lower, upper } = bootstrapMeanCI95(diffs, BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED);
      console.log(`GATE-1 attention floor: mean diff ${mean.toFixed(4)}, 95% CI [${lower.toFixed(4)}, ${upper.toFixed(4)}] over ${N} seeds`);
      expect(lower).toBeGreaterThan(0);
    }, 60000);
  });

  describe('GATE-3: auto sanity', () => {
    it('contextual auto does not embarrass blind auto — home goals contextual-auto >= blind-auto * 0.95 (400 seeds)', () => {
      const N = 400;
      let contextual = 0, blind = 0;
      for (let seed = 1; seed <= N; seed++) {
        contextual += cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY' });
        blind += cachedHomeGoals(seed, { homePolicy: 'FIRE_WHEN_READY', blindAutoHome: true });
      }
      console.log(`GATE-3 auto sanity: contextual=${contextual} blind=${blind} ratio=${(contextual / blind).toFixed(4)} over ${N} seeds`);
      expect(contextual).toBeGreaterThanOrEqual(blind * 0.95);
    }, 60000);
  });
});
