/**
 * The one dial that scales every recurring weekly Training Point source.
 *
 * Weekly TP income is three terms — the unconditional baseline, the Training
 * Pitch's per-level rate, and each employed coach's contribution — and they were
 * each measured separately, at different times, against different probes. A
 * flat "the week gives too much" verdict therefore has to move all three
 * together or it just changes which source dominates.
 *
 * Keeping the pre-cut rates as the literals at each site and applying this
 * percentage on top means the measurement comments still describe the numbers
 * printed next to them, and re-tuning the overall generosity is one edit here
 * rather than three roundings to re-derive.
 *
 * 80 since 2026-08-07 (owner decision: every source 20% lower than it was).
 */
export const TRAINING_POINT_SCALE_PERCENT = 80;

/**
 * Applies the weekly scale to one source's full rate.
 *
 * Rounds up, so no source that produced TP before the cut can be scaled down to
 * nothing, and a week's credit stays a whole number the ledger and the finances
 * breakdown can both show without a fraction anywhere.
 */
export function scaledTrainingPoints(fullRate: number): number {
  if (!Number.isSafeInteger(fullRate) || fullRate < 0) {
    throw new Error('weekly training point rate must be a non-negative safe integer');
  }
  return Math.ceil((fullRate * TRAINING_POINT_SCALE_PERCENT) / 100);
}
