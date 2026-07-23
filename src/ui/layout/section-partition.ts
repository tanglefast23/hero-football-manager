/**
 * Splits an ordered list of section weights into two columns that read in
 * order (column 1 top-to-bottom, then column 2) while keeping the column
 * totals as close as possible. Returns the index of the first section that
 * belongs to column 2 (0 when there are no sections).
 *
 * Sections are atomic — only whole sections move — so a perfectly even
 * split is not always possible. Ties prefer the taller first column.
 */
export function balancedSplitIndex(weights: readonly number[]): number {
  if (weights.length === 0) return 0;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let bestSplit = 1;
  let bestImbalance = Infinity;
  let leftSum = 0;
  for (let split = 1; split <= weights.length; split += 1) {
    leftSum += weights[split - 1];
    const imbalance = Math.abs(leftSum - (total - leftSum));
    // <= so equal-imbalance ties land on the later split: taller left column.
    if (imbalance <= bestImbalance) {
      bestImbalance = imbalance;
      bestSplit = split;
    }
  }
  return bestSplit;
}
