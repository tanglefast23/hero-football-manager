/**
 * The Vietnamese mark set, as design-grid cells.
 *
 * Every table here was drawn for the §6.7 mockup gate and signed off at
 * 21 px/em in both cuts by a Vietnamese reader (the project owner) — see
 * `docs/superpowers/specs/2026-08-06-vietnamese-pixel-diacritics.md` §2.1b. They
 * are transcribed, not re-derived: changing a shape here changes a letter the
 * reader has already accepted, and `ắ` versus `ấ` are different words.
 *
 * Cells are absolute glyph columns (column 0 is the left sidebearing; ink starts
 * at column 1 in every Silkscreen glyph of both cuts) and design rows, where row
 * `r` spans y = 125r .. 125(r+1). Row 6 and row 7 are the two mark rows the face
 * already uses; row 5 is the gap; row −1 is where a dot below sits.
 *
 * Keyed by cut AND by ink width because the two cuts are not the same font at a
 * different weight: Regular `a` is 4 columns of ink and Bold `a` is 5, which
 * moves every mark.
 */

/** Full-grid marks — row 7 is the upper half, row 6 the lower. */
export const FULL = {
  '400Regular': {
    4: {
      // a o u d, and their capitals
      acute: { 7: [3], 6: [2] },
      grave: { 7: [2], 6: [3] },
      tilde: { 7: [2, 4], 6: [1, 3] },
      hook: { 7: [1, 2, 3], 6: [3] },
      circ: { 7: [2, 3], 6: [1, 4] },
      breve: { 7: [1, 4], 6: [2, 3] },
    },
    3: {
      // e E
      acute: { 7: [3], 6: [2] },
      grave: { 7: [1], 6: [2] },
      tilde: { 7: [1, 3], 6: [2] },
      hook: { 7: [1, 2, 3], 6: [3] },
      circ: { 7: [2], 6: [1, 3] },
      breve: { 7: [1, 3], 6: [2] },
    },
    1: {
      // i I
      acute: { 7: [2], 6: [1] },
      grave: { 7: [0], 6: [1] },
      tilde: { 7: [0, 2], 6: [1] },
      hook: { 7: [1, 2], 6: [2] },
      circ: { 7: [1], 6: [0, 2] },
      breve: { 7: [0, 2], 6: [1] },
    },
  },
  '700Bold': {
    5: {
      // a o u d
      acute: { 7: [3, 4], 6: [2, 3] },
      grave: { 7: [2, 3], 6: [3, 4] },
      tilde: { 7: [2, 3, 4, 5], 6: [1, 2, 3, 4] },
      hook: { 7: [1, 2, 3, 4], 6: [3, 4] },
      circ: { 7: [2, 3, 4], 6: [1, 2, 4, 5] },
      breve: { 7: [1, 2, 4, 5], 6: [2, 3, 4] },
    },
    4: {
      // e E
      acute: { 7: [3, 4], 6: [2, 3] },
      grave: { 7: [1, 2], 6: [2, 3] },
      tilde: { 7: [2, 3, 4], 6: [1, 2, 3] },
      hook: { 7: [1, 2, 3], 6: [3, 4] },
      circ: { 7: [2, 3], 6: [1, 2, 3, 4] },
      breve: { 7: [1, 2, 3, 4], 6: [2, 3] },
    },
    2: {
      // i I
      acute: { 7: [2, 3], 6: [1, 2] },
      grave: { 7: [0, 1], 6: [1, 2] },
      tilde: { 7: [1, 2, 3], 6: [0, 1, 2] },
      hook: { 7: [0, 1, 2], 6: [2, 3] },
      circ: { 7: [1, 2], 6: [0, 1, 2, 3] },
      breve: { 7: [0, 1, 2, 3], 6: [1, 2] },
    },
  },
};

/**
 * `y` is one column wider than `a` in both cuts, and Silkscreen's own `ý`
 * resolves that by drawing `á`'s accent one column further right — measured, in
 * both cuts. Its other tones follow the same shift, so a tone reads identically
 * over `y` and over `a`, which is the only thing a tone mark has to do.
 */
export const Y_SHIFT_FROM = { '400Regular': 4, '700Bold': 5 };
export const Y_WIDTH = { '400Regular': 5, '700Bold': 6 };

/** Dot below, in row −2. Matched to each cut's comma width. */
export const DOT_BELOW = {
  '400Regular': { 4: [2, 3], 3: [2], 1: [1] },
  '700Bold': { 5: [2, 3, 4], 4: [2, 3], 2: [1, 2] },
};

/**
 * Scheme A's integer sub-rows (spec §2). A stacked glyph cannot put two marks on
 * the full grid — `hhea.ascender` sits 30 units above the existing acute — so
 * the tone takes 875–1000 in two sub-rows and the base mark takes 688–813, with
 * gaps at 813–875 and 625–688 keeping them from reading as one blob.
 *
 * The mapping is mechanical: a mark's row-7 cells become its upper sub-row and
 * its row-6 cells its lower one, so a compressed circumflex is the same shape at
 * half the height.
 */
export const BANDS = {
  FULL_HI: [875, 1000],
  FULL_LO: [750, 875],
  TONE_HI: [938, 1000],
  TONE_LO: [875, 938],
  GAP_HI: [813, 875],
  BASE_HI: [750, 813],
  BASE_LO: [688, 750],
  GAP_LO: [625, 688],
  /**
   * Row −2, not row −1.
   *
   * At [-125, 0] the dot touches the baseline, so it merges with the letter
   * body: measured, 18 of 24 dot-below glyphs in Regular and 24 of 24 in Bold.
   * For round letters (`ạ ẹ ọ ụ`) the bowl still reads, but `ị` is fatal — `i`
   * is a bare vertical bar, so `ị` became the same bar one pixel taller and
   * `bị` was indistinguishable from `bi`. Different words, and `ị` is very
   * common: Việt, bị, chị.
   *
   * Dropping to [-250, -125] leaves row −1 as a gap, exactly the way every mark
   * above the letter gets one. It costs nothing: `Ç ç` already reach −250 and
   * `usWinDescent` is 250, so the envelope is unchanged.
   */
  BELOW: [-250, -125],
};

/** The horn sits in the existing right sidebearing, so the advance is unchanged. */
export const HORN_ROWS = [3, 4];

export const CELL = 125;

export function shiftColumns(table, by) {
  return Object.fromEntries(
    Object.entries(table).map(([mark, rows]) => [
      mark,
      Object.fromEntries(
        Object.entries(rows).map(([row, columns]) => [
          row,
          columns.map((c) => c + by),
        ]),
      ),
    ]),
  );
}

/** Cells -> rectangles, in font units. */
export function cellRects(columns, [y0, y1]) {
  return columns.map((column) => [column * CELL, y0, (column + 1) * CELL, y1]);
}
