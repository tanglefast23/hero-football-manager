/** Wraps in both directions so ‹ from the first option lands on the last. */
export function stepChoice(current: number, delta: -1 | 1, count: number): number {
  return (current + delta + count) % count;
}

/**
 * One-based "which of how many" for a stepper cell. Unspaced on purpose:
 * Silkscreen is a fixed 0.7em per glyph, so the spaced "10 / 10" overran the
 * 64px value column and shipped ellipsised as "3 / …".
 */
export function formatChoiceValue(current: number, count: number): string {
  return `${current + 1}/${count}`;
}
