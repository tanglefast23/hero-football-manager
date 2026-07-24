import { nextSquadSort, sortSquadPlayers, type SquadSort } from '../squad-sort';

const players = [
  { id: '1', name: 'Sam Mitts', role: 'GK' as const, overall: 43, superChancePercent: 1, condition: 100 },
  { id: '2', name: 'Ed Stone', role: 'DEF' as const, overall: 45, superChancePercent: 10, condition: 75 },
  { id: '3', name: 'Bo Hedges', role: 'DEF' as const, overall: 45, superChancePercent: 10, condition: 100 },
  { id: '4', name: 'Gio Marsh', role: 'MID' as const, overall: 50, superChancePercent: 14, condition: 60 },
];

describe('squad table sorting', () => {
  it('cycles descending, ascending, then default for the active column', () => {
    const descending = nextSquadSort(null, 'overall');
    expect(descending).toEqual({ key: 'overall', direction: 'descending' });
    const ascending = nextSquadSort(descending, 'overall');
    expect(ascending).toEqual({ key: 'overall', direction: 'ascending' });
    expect(nextSquadSort(ascending, 'overall')).toBeNull();
    expect(nextSquadSort(ascending, 'player')).toEqual({ key: 'player', direction: 'descending' });
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
});
