/**
 * How wide each fixed column of the league table has to be, in points.
 *
 * Same derivation, and the same two traps, as `squad-register-columns.ts`:
 *
 * 1. NativeWind resolves `1rem` to React Native's 14pt, so `w-9` is 31.5pt and
 *    `w-7` is 24.5 — not the 36 and 28 the class names imply. All four columns
 *    were sized by those names and all four were too narrow.
 * 2. Text grows with the reader's iOS text size, up to 1.6 by default.
 *
 * Measured on Joe's phone at ordinary text size, two were already wrapping:
 * "PTS" broke to "PT" over a lone "S" (needs 29.8pt of a 31.5pt column, and
 * loses the margin to any rounding), and a "+10" goal difference broke to "+1"
 * over "0" (needs exactly 31.5 of 31.5). The club name is the only flexible
 * column and pays for the fix; it has room to spare.
 *
 * `league-table-columns.test.ts` re-runs the arithmetic below, so a width
 * cannot quietly stop fitting again.
 */

/**
 * Silkscreen Regular advances in em, read out of the shipped TTF's `hmtx`
 * table. Digits are 0.75em, "+"/"-" 0.75em, and uppercase varies — so these
 * are per-string totals for exactly the strings the table draws.
 */
export const LEAGUE_HEADER_ADVANCE_EM: Readonly<Record<string, number>> = {
  '#': 0.875,
  P: 0.75,
  GD: 1.5,
  PTS: 2.125,
};

/** The widest value each column can ever be asked to draw. */
export const LEAGUE_CELL_ADVANCE_EM: Readonly<Record<string, number>> = {
  // Ten clubs to a division, so a two-digit position is the ceiling.
  '10': 1.5,
  // Eighteen league matches in a season; "30" leaves room for a longer format.
  '30': 1.5,
  // Goal difference is the only signed column, and the one that was wrapping.
  '+10': 2.25,
  '+40': 2.25,
  // Eighteen wins is 54 points, so two digits with headroom for three.
  '54': 1.375,
};

/** `text-sm`, which NativeWind resolves to 0.875rem = 12.25pt. */
export const LEAGUE_HEADER_FONT_SIZE = 12.25;

/**
 * Cell sizes by column. Position and points are `text-base` (1rem = 14pt)
 * because they are the two numbers a manager scans for; played and goal
 * difference are `text-sm`.
 */
export const LEAGUE_CELL_FONT_SIZE = {
  position: 14,
  played: 12.25,
  goalDifference: 12.25,
  points: 14,
} as const;

/**
 * How far a header may grow with the reader's text size.
 *
 * Tighter than the cells for the reason the register gives: an abbreviation
 * labelling a fixed column cannot grow without pushing its neighbour off the
 * row, and what it stands for is on its InfoTip at any size. 1.25 clears the
 * xxLarge multiplier (1.235), so ordinary large text renders unchanged.
 */
export const HEADER_MAX_FONT_MULTIPLIER = 1.25;

/**
 * The values are allowed the app's full range. A number the manager is reading
 * is exactly what a larger text size is for, so the column carries the growth
 * rather than the reader losing the number.
 */
export const CELL_MAX_FONT_MULTIPLIER = 1.6;

/** Clear space between a column and the one beside it, at the size cap. */
export const COLUMN_MIN_GUTTER = 4;

/**
 * Fixed column widths, each the larger of its header demand and its widest
 * value demand, rounded up onto the four-point grid.
 */
export const LEAGUE_COLUMN_WIDTH = {
  // "10" at full text scale wants 37.6.
  position: 40,
  // "30" wants 33.4.
  played: 36,
  // "+40" wants 48.1 — the column that was visibly breaking.
  goalDifference: 52,
  // Header-bound, not value-bound: "PTS" at the 1.25 cap wants 36.5 against
  // "54"'s 34.8. The only column here whose label is wider than its numbers.
  points: 40,
} as const;

export type LeagueColumn = keyof typeof LEAGUE_COLUMN_WIDTH;

/** Width a header needs at its size cap, plus the gutter to its neighbour. */
export function leagueHeaderWidthDemand(label: string): number {
  const advanceEm = LEAGUE_HEADER_ADVANCE_EM[label];
  if (advanceEm === undefined) {
    throw new Error(`No measured Silkscreen advance for the header "${label}"`);
  }
  return advanceEm * LEAGUE_HEADER_FONT_SIZE * HEADER_MAX_FONT_MULTIPLIER + COLUMN_MIN_GUTTER;
}

/** Width a value needs at the reader's largest text size, plus the gutter. */
export function leagueCellWidthDemand(value: string, column: LeagueColumn): number {
  const advanceEm = LEAGUE_CELL_ADVANCE_EM[value];
  if (advanceEm === undefined) {
    throw new Error(`No measured Silkscreen advance for the value "${value}"`);
  }
  return advanceEm * LEAGUE_CELL_FONT_SIZE[column] * CELL_MAX_FONT_MULTIPLIER + COLUMN_MIN_GUTTER;
}
