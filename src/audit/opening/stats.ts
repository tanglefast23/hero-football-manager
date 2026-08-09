/**
 * Deterministic bootstrap intervals for the opening artifacts.
 *
 * Resampling uses the injected seeded PRNG rather than `Math.random`, so a
 * published interval is reproducible from the artifact alone — a probe whose
 * confidence bounds move between runs cannot support a balance decision.
 */
import { mulberry32 } from '../../sim/rng';

export interface ProportionInterval {
  readonly count: number;
  readonly total: number;
  readonly rate: number;
  readonly lower95: number;
  readonly upper95: number;
}

export const BOOTSTRAP_RESAMPLES = 10_000;
export const BOOTSTRAP_SEED = 20_260_730;

/**
 * Percentile bootstrap for a binary outcome rate. The 2.5% and 97.5%
 * percentiles of the resampled rate become the reported bounds.
 */
export function bootstrapProportion(
  outcomes: readonly boolean[],
  resamples = BOOTSTRAP_RESAMPLES,
  seed = BOOTSTRAP_SEED,
): ProportionInterval {
  const total = outcomes.length;
  if (total === 0)
    throw new Error('a bootstrap interval needs at least one observation');
  const count = outcomes.filter(Boolean).length;
  const random = mulberry32(seed);
  const rates = new Float64Array(resamples);
  for (let resample = 0; resample < resamples; resample += 1) {
    let hits = 0;
    for (let draw = 0; draw < total; draw += 1) {
      if (outcomes[Math.floor(random() * total)]) hits += 1;
    }
    rates[resample] = hits / total;
  }
  rates.sort();
  return {
    count,
    total,
    rate: count / total,
    lower95: rates[Math.floor(resamples * 0.025)],
    upper95: rates[Math.min(resamples - 1, Math.ceil(resamples * 0.975))],
  };
}

export type RailVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

/**
 * The opener contract: wins must sit at or below the cap and losses at or above
 * the floor, judged on the interval rather than the point estimate. Anything
 * that neither clearly clears nor clearly breaches a threshold is inconclusive
 * — a state the artifact must be able to report rather than round away.
 */
export function openerRailVerdict(
  wins: ProportionInterval,
  losses: ProportionInterval,
  maximumWinRate = 0.05,
  minimumLossRate = 0.9,
): RailVerdict {
  const winPasses = wins.upper95 <= maximumWinRate;
  const lossPasses = losses.lower95 >= minimumLossRate;
  if (winPasses && lossPasses) return 'PASS';
  if (wins.lower95 > maximumWinRate || losses.upper95 < minimumLossRate)
    return 'FAIL';
  return 'INCONCLUSIVE';
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor(sorted.length * fraction)),
    )
  ];
}
