/** Wraps in both directions so ‹ from the first option lands on the last. */
export function stepChoice(current: number, delta: -1 | 1, count: number): number {
  return (current + delta + count) % count;
}
