import { nextSquadSort, sortSquadPlayers, type SquadSort } from '../squad-sort';

const players = [
  { id: '1', name: 'Sam Mitts', role: 'GK' as const, overall: 43, potentialGrade: 'E' as const, condition: 100 },
  { id: '2', name: 'Ed Stone', role: 'DEF' as const, overall: 45, potentialGrade: 'C+' as const, condition: 75 },
  { id: '3', name: 'Bo Hedges', role: 'DEF' as const, overall: 45, potentialGrade: 'C+' as const, condition: 100 },
  { id: '4', name: 'Gio Marsh', role: 'MID' as const, overall: 50, potentialGrade: 'B' as const, condition: 60 },
];

describe('squad table sorting', () => {
  it('cycles a rating column best-first, then worst-first, then default', () => {
    const descending = nextSquadSort(null, 'overall');
    expect(descending).toEqual({ key: 'overall', direction: 'descending' });
    const ascending = nextSquadSort(descending, 'overall');
    expect(ascending).toEqual({ key: 'overall', direction: 'ascending' });
    expect(nextSquadSort(ascending, 'overall')).toBeNull();
    expect(nextSquadSort(ascending, 'player')).toEqual({ key: 'player', direction: 'ascending' });
  });

  it('opens the text columns alphabetically, then reverses, then clears', () => {
    for (const key of ['player', 'role'] as const) {
      const ascending = nextSquadSort(null, key);
      expect(ascending).toEqual({ key, direction: 'ascending' });
      const descending = nextSquadSort(ascending, key);
      expect(descending).toEqual({ key, direction: 'descending' });
      expect(nextSquadSort(descending, key)).toBeNull();
    }
  });

  it.each<[SquadSort, string[]]>([
    [{ key: 'overall', direction: 'descending' }, ['Gio Marsh', 'Ed Stone', 'Bo Hedges', 'Sam Mitts']],
    [{ key: 'potential', direction: 'descending' }, ['Gio Marsh', 'Ed Stone', 'Bo Hedges', 'Sam Mitts']],
    [{ key: 'condition', direction: 'ascending' }, ['Gio Marsh', 'Ed Stone', 'Sam Mitts', 'Bo Hedges']],
    [{ key: 'player', direction: 'ascending' }, ['Bo Hedges', 'Ed Stone', 'Gio Marsh', 'Sam Mitts']],
    [{ key: 'role', direction: 'ascending' }, ['Ed Stone', 'Bo Hedges', 'Sam Mitts', 'Gio Marsh']],
  ])('sorts $key $direction with default order as the tie-breaker', (sort, expected) => {
    expect(sortSquadPlayers(players, sort).map(player => player.name)).toEqual(expected);
  });

  it('restores the exact default order when sorting is cleared', () => {
    expect(sortSquadPlayers(players, null).map(player => player.name)).toEqual(players.map(player => player.name));
  });

  /**
   * The POT column sorts by the letter it prints. It used to key on the SUPER
   * chance, which stayed on raw potential when the printed grade moved to
   * growth speed — so a squad sorted by POT came back B, B-, C-, E, D+, and
   * read as though the header did nothing.
   */
  it('orders the potential column by the grade it shows', () => {
    const register = [
      { id: '1', name: 'Jobo', role: 'FWD' as const, overall: 55, potentialGrade: 'B' as const, condition: 88 },
      { id: '2', name: 'Zip Vela', role: 'FWD' as const, overall: 41, potentialGrade: 'E' as const, condition: 100 },
      { id: '3', name: 'Ty Brooks', role: 'DEF' as const, overall: 38, potentialGrade: 'C-' as const, condition: 100 },
      { id: '4', name: 'Gio Marsh', role: 'MID' as const, overall: 45, potentialGrade: 'D+' as const, condition: 100 },
      { id: '5', name: 'Mae Thorn', role: 'DEF' as const, overall: 36, potentialGrade: 'B-' as const, condition: 100 },
    ];

    expect(sortSquadPlayers(register, { key: 'potential', direction: 'descending' }).map(p => p.name))
      .toEqual(['Jobo', 'Mae Thorn', 'Ty Brooks', 'Gio Marsh', 'Zip Vela']);
    expect(sortSquadPlayers(register, { key: 'potential', direction: 'ascending' }).map(p => p.name))
      .toEqual(['Zip Vela', 'Gio Marsh', 'Ty Brooks', 'Mae Thorn', 'Jobo']);
  });
});
