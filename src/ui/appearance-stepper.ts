/** Wraps in both directions so ‹ from the first option lands on the last. */
export function stepChoice(current: number, delta: -1 | 1, count: number): number {
  return (current + delta + count) % count;
}

/**
 * One-based "which of how many" for a stepper cell. Unspaced on purpose:
 * Silkscreen is proportional, not the flat 0.7em per glyph this once assumed,
 * and it is widest in the Bold cut — a digit advances 0.875em there against
 * 0.75em in Regular. The value cell fits 4.571em (text-sm inside w-16), so the
 * spaced "10 / 10" never had a chance and shipped ellipsised as "3 / …".
 * SILKSCREEN_ADVANCE_EM carries the real metrics for the test that guards this.
 */
export function formatChoiceValue(current: number, count: number): string {
  return `${current + 1}/${count}`;
}

/**
 * Advance widths for the glyphs a stepper value can contain, read out of the
 * `hmtx` table of the shipped Silkscreen faces (unitsPerEm 1000). `data` is the
 * Regular cut behind `font-mono`, `display` the Bold cut behind `font-pixel`.
 * Both are proportional: '1' and '/' are one pixel column narrower than the
 * other digits, and every Bold glyph is one column wider than its Regular twin.
 */
export const SILKSCREEN_ADVANCE_EM = {
  data: { digit: 0.75, narrow: 0.625 },
  display: { digit: 0.875, narrow: 0.75 },
} as const;

/**
 * How wide the value may be, in multiples of its own font size: the cell is
 * w-16 (4rem) and the text is text-sm (0.875rem), so the ratio holds whatever
 * a platform sizes a rem at (NativeWind inlines 14px on native, 16px on web).
 */
export const STEPPER_VALUE_CELL_EM = 4 / 0.875;

/** Rendered width of a stepper value, in multiples of its font size. */
export function stepperValueWidthEm(
  value: string,
  voice: keyof typeof SILKSCREEN_ADVANCE_EM,
): number {
  const { digit, narrow } = SILKSCREEN_ADVANCE_EM[voice];
  return [...value].reduce((total, char) => total + (char === '1' || char === '/' ? narrow : digit), 0);
}
