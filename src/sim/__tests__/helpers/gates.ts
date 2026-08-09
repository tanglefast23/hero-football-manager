import { runMatch } from '../../match';
import { mulberry32 } from '../../rng';
import { ROVERS, UNITED } from '../../teams';
import type { MatchOpts, MatchResult } from '../../types';

// Shared helpers for the M0 acceptance suite's GATE-1/2/3 files (Task 13 suite,
// split across parity-replay/gates-auto/gates-moments/balance-rails.test.ts for
// parallel jest workers — see those files). Not itself a *.test.ts file, so
// jest's testMatch never picks it up as a suite.

export const BOOTSTRAP_SEED = 20260717; // arbitrary fixed seed — only determinism matters
export const BOOTSTRAP_RESAMPLES = 1000;

/**
 * Percentile bootstrap 95% CI of the mean of `sample`. The resampler is
 * mulberry32, never Math.random: this file lives under __tests__ so the
 * sim's determinism guard doesn't scan it, but a CI computation that isn't
 * itself reproducible would make a failing gate impossible to debug.
 */
export function bootstrapMeanCI95(
  sample: number[],
  resamples: number,
  seed: number,
): { mean: number; lower: number; upper: number } {
  const n = sample.length;
  const mean = sample.reduce((a, b) => a + b, 0) / n;
  const rng = mulberry32(seed);
  const resampleMeans: number[] = new Array(resamples);
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sample[Math.floor(rng() * n)];
    resampleMeans[r] = sum / n;
  }
  resampleMeans.sort((a, b) => a - b);
  const lower = resampleMeans[Math.floor(resamples * 0.025)];
  const upper =
    resampleMeans[Math.min(resamples - 1, Math.floor(resamples * 0.975))];
  return { mean, lower, upper };
}

/**
 * Memoized runMatch keyed by seed+opts. GATE-1 and GATE-3 both need the
 * "contextual auto" home-goals series over the same 400 seeds; computing it
 * once instead of twice halves the real wall-clock cost of the two gates
 * without changing what either one measures. Both gates live in gates-auto.test.ts
 * (one jest worker, one module instance of this file), so this module-level
 * memo is shared between them as long as GATE-1 and GATE-3 stay co-located —
 * declaration order runs GATE-1 first, so GATE-3 finds it already warm.
 */
const matchCache = new Map<string, MatchResult>();
export function cachedHomeGoals(seed: number, opts: MatchOpts): number {
  const key = `${seed}:${JSON.stringify(opts)}`;
  let r = matchCache.get(key);
  if (!r) {
    r = runMatch(seed, ROVERS, UNITED, [], opts);
    matchCache.set(key, r);
  }
  return r.score[0];
}
