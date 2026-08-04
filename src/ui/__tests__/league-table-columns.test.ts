import {
  CELL_MAX_FONT_MULTIPLIER,
  HEADER_MAX_FONT_MULTIPLIER,
  LEAGUE_CELL_ADVANCE_EM,
  LEAGUE_CELL_FONT_SIZE,
  LEAGUE_COLUMN_WIDTH,
  LEAGUE_HEADER_ADVANCE_EM,
  LEAGUE_HEADER_FONT_SIZE,
  leagueCellWidthDemand,
  leagueHeaderWidthDemand,
} from '../league-table-columns';

/**
 * The league table's fixed columns, checked by re-running the arithmetic that
 * chose them rather than by trusting the numbers.
 *
 * Every one of these four was too narrow before, and two were visibly wrapping
 * on a phone: "PTS" broke to "PT" over a lone "S", and Thunder Borough's "+10"
 * broke to "+1" over "0". The cause is the same rem trap the register hit —
 * `w-9` is 31.5pt on native, not 36 — compounded by the reader's text size,
 * which the values are deliberately allowed to follow.
 */
describe('league table column widths', () => {
  it('holds every header at the size cap a fixed column can afford', () => {
    for (const [label, width] of [
      ['#', LEAGUE_COLUMN_WIDTH.position],
      ['P', LEAGUE_COLUMN_WIDTH.played],
      ['GD', LEAGUE_COLUMN_WIDTH.goalDifference],
      ['PTS', LEAGUE_COLUMN_WIDTH.points],
    ] as const) {
      expect(leagueHeaderWidthDemand(label)).toBeLessThanOrEqual(width);
    }
  });

  it('holds the widest value each column can ever show, at full text scale', () => {
    // The values are not capped: a number the manager is reading is exactly
    // what a larger text size is for. So the column carries the growth instead.
    for (const [value, size, width] of [
      ['10', 'position', LEAGUE_COLUMN_WIDTH.position],
      ['30', 'played', LEAGUE_COLUMN_WIDTH.played],
      ['+40', 'goalDifference', LEAGUE_COLUMN_WIDTH.goalDifference],
      ['54', 'points', LEAGUE_COLUMN_WIDTH.points],
    ] as const) {
      expect(leagueCellWidthDemand(value, size)).toBeLessThanOrEqual(width);
    }
  });

  it('shows why the old columns fitted in the code and not on the phone', () => {
    // `w-9` is 2.25rem, and a rem is React Native's 14pt — 31.5, not 36.
    const w9 = 2.25 * 14;
    expect(w9).toBeCloseTo(31.5);

    // At ordinary text size both of the wrapping cells DO fit, which is why
    // this looked correct in review and broke in the hand. The reader's text
    // size is the missing term: xxLarge scales every font by 1.235.
    const xxLarge = 1.235;
    const goalDifference = LEAGUE_CELL_ADVANCE_EM['+10'] * LEAGUE_CELL_FONT_SIZE.goalDifference;
    const pointsHeader = LEAGUE_HEADER_ADVANCE_EM.PTS * LEAGUE_HEADER_FONT_SIZE;

    expect(goalDifference).toBeLessThan(w9);
    expect(pointsHeader).toBeLessThan(w9);
    expect(goalDifference * xxLarge).toBeGreaterThan(w9);
    expect(pointsHeader * xxLarge).toBeGreaterThan(w9);

    // And both clear their new columns at the full 1.6 the app allows.
    expect(goalDifference * CELL_MAX_FONT_MULTIPLIER)
      .toBeLessThanOrEqual(LEAGUE_COLUMN_WIDTH.goalDifference);
    expect(pointsHeader * HEADER_MAX_FONT_MULTIPLIER)
      .toBeLessThanOrEqual(LEAGUE_COLUMN_WIDTH.points);
  });

  it('caps headers tighter than cells, and both below the app maximum', () => {
    // An abbreviation labelling a fixed column cannot grow without shoving its
    // neighbour off the row; the sentence it stands for is on the InfoTip.
    expect(HEADER_MAX_FONT_MULTIPLIER).toBeLessThan(CELL_MAX_FONT_MULTIPLIER);
    expect(CELL_MAX_FONT_MULTIPLIER).toBeLessThanOrEqual(1.6);
    // Above the xxLarge multiplier (1.235), so ordinary large text is unaffected.
    expect(HEADER_MAX_FONT_MULTIPLIER).toBeGreaterThan(1.235);
  });
});
