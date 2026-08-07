import {
  forgetLeagueRowPositions,
  leagueRowShifts,
  takeLeagueRowShifts,
} from '../league-table-motion';

const week1 = [
  { clubId: 'a', position: 1 },
  { clubId: 'b', position: 2 },
  { clubId: 'c', position: 3 },
];

describe('league table motion', () => {
  beforeEach(forgetLeagueRowPositions);

  it('reports no movement the first time a division is seen', () => {
    expect(takeLeagueRowShifts('d5', week1).size).toBe(0);
  });

  it('reports how far each club moved, signed so down the table is positive', () => {
    takeLeagueRowShifts('d5', week1);
    const shifts = takeLeagueRowShifts('d5', [
      { clubId: 'c', position: 1 },
      { clubId: 'a', position: 2 },
      { clubId: 'b', position: 3 },
    ]);
    expect(shifts.get('c')).toBe(-2); // climbed two places
    expect(shifts.get('a')).toBe(1);
    expect(shifts.get('b')).toBe(1);
  });

  it('reports nothing for a table the player has already seen', () => {
    takeLeagueRowShifts('d5', week1);
    expect(takeLeagueRowShifts('d5', week1).size).toBe(0);
  });

  it('keeps divisions apart', () => {
    takeLeagueRowShifts('d5', week1);
    expect(takeLeagueRowShifts('d4', week1).size).toBe(0);
  });

  it('treats a club with no previous position as arriving, not moving', () => {
    const shifts = leagueRowShifts(new Map([['a', 1]]), [
      { clubId: 'a', position: 2 },
      { clubId: 'newcomer', position: 1 },
    ]);
    expect(shifts.get('newcomer')).toBeUndefined();
    expect(shifts.get('a')).toBe(1);
  });
});
