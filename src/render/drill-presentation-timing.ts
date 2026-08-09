/**
 * Training result presentation runs 25% faster than its authored baseline.
 * Dividing durations by 1.25 preserves the timing ratios while finishing each
 * non-player beat in 80% of its previous time.
 */
export const DRILL_PRESENTATION_SPEED = 1.25;

export function drillPresentationMs(baselineMs: number): number {
  return Math.round(baselineMs / DRILL_PRESENTATION_SPEED);
}
