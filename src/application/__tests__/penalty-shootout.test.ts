import type { PlayerDef, TeamDef } from '../../sim/types';
import type { PenaltyShootout } from '../../game/penalties';
import {
  penaltyShootoutViewModel,
  type PenaltyShootoutArgs,
} from '../penalty-shootout';

function player(id: string, role: 'GK' | 'FWD'): PlayerDef {
  return {
    id,
    name: id,
    role,
    attrs: { pac: 60, sho: 60, pas: 60, def: 60, tec: 60, sta: 60, ref: 60 },
  };
}
const club: TeamDef = {
  id: 'club',
  name: 'Club',
  players: [
    player('club-keeper', 'GK'),
    player('club-1', 'FWD'),
    player('club-2', 'FWD'),
  ],
  bench: [player('club-sub', 'FWD')],
};
const opponent: TeamDef = {
  id: 'opponent',
  name: 'Opponent',
  players: [
    player('opponent-keeper', 'GK'),
    player('opponent-1', 'FWD'),
    player('opponent-2', 'FWD'),
    player('opponent-3', 'FWD'),
  ],
  bench: [player('opponent-new-keeper', 'GK')],
};
const penalties: PenaltyShootout = {
  homeGoals: 3,
  awayGoals: 0,
  kicks: [1, 2, 3].flatMap((n) => [
    {
      side: 'away' as const,
      takerId: `opponent-${n}`,
      keeperId: 'club-keeper',
      scored: false,
    },
    {
      side: 'home' as const,
      takerId: n === 3 ? 'club-sub' : `club-${n}`,
      keeperId: 'opponent-new-keeper',
      scored: true,
    },
  ]),
};
function args(
  overrides: Partial<PenaltyShootoutArgs> = {},
): PenaltyShootoutArgs {
  return {
    fixtureId: 'cup-1',
    clubIsHome: true,
    clubTeam: club,
    opponentTeam: opponent,
    penalties,
    ...overrides,
  };
}

describe('saved penalty presentation', () => {
  it('reads the saved sequence and tally exactly, including an away-first start', () => {
    const before = JSON.stringify(penalties);
    const view = penaltyShootoutViewModel(args())!;
    expect(view.kicks.map((kick) => kick.shootingSide)).toEqual([
      'opponent',
      'club',
      'opponent',
      'club',
      'opponent',
      'club',
    ]);
    expect(
      view.kicks.map((kick) => [kick.clubScore, kick.opponentScore]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 0],
      [2, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(view).toMatchObject({
      finalClubScore: 3,
      finalOpponentScore: 0,
      winner: 'club',
    });
    expect(penaltyShootoutViewModel(args())).toEqual(view);
    expect(JSON.stringify(penalties)).toBe(before);
  });

  it('shows full-time substitute takers and keepers from the bench metadata', () => {
    const view = penaltyShootoutViewModel(args())!;
    expect(view.kicks.at(-1)).toMatchObject({
      shooter: { playerId: 'club-sub' },
      goalkeeper: { playerId: 'opponent-new-keeper' },
    });
  });

  it('maps a manager playing away without changing any saved outcome', () => {
    const view = penaltyShootoutViewModel(
      args({ clubIsHome: false, clubTeam: opponent, opponentTeam: club }),
    )!;
    expect(view).toMatchObject({
      finalClubScore: 0,
      finalOpponentScore: 3,
      winner: 'opponent',
    });
    expect(view.kicks[0]).toMatchObject({
      shootingSide: 'club',
      shooter: { playerId: 'opponent-1' },
    });
  });

  it('does not invent a shootout for historical fixtures without saved kicks', () => {
    expect(penaltyShootoutViewModel(args({ penalties: undefined }))).toBeNull();
    expect(
      penaltyShootoutViewModel(args({ clubTeam: { ...club, bench: [] } })),
    ).toBeNull();
    expect(
      penaltyShootoutViewModel(
        args({ penalties: { ...penalties, homeGoals: 4 } }),
      ),
    ).toBeNull();
  });
});
