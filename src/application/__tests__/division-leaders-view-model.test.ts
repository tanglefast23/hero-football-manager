import { CUP_SETTLEMENT_WEEKS } from '../../game/career';
import {
  initializeM2Career,
  startM2NationalCup,
  type M2CareerState,
} from '../../game/m2-career';
import type {
  AwardCompetition,
  CareerPlayer,
  LeagueStanding,
  PlayerSeasonStatLine,
} from '../../game/types';
import type { Role } from '../../sim/types';
import { divisionLeadersViewModel } from '../division-leaders-view-model';
import { m2LeagueViewModel } from '../m2-league-view-model';

const USER_CLUB = { id: 'user-club', name: 'Caped Ball FC', squadStrength: 47 };

const CLUB_NAMES = new Map([
  ['me', 'Brambleroad'],
  ['them', 'Quartz FC'],
]);

const PLAYERS: CareerPlayer[] = [
  player('mine', 'FWD', 'me', 'Gem Arrow'),
  player('theirs', 'FWD', 'them', 'Flint Vale'),
  player('mid', 'MID', 'me', 'Wren Sable'),
  player('def', 'DEF', 'them', 'Cobble Hart'),
  player('keeper', 'GK', 'me', 'Dune Halloway'),
];

const LINES: PlayerSeasonStatLine[] = [
  line('mine', 'me', { goals: 6 }),
  line('theirs', 'them', { goals: 9 }),
  line('mid', 'me', { assists: 4 }),
  line('def', 'them', { tacklesWon: 22 }),
  line('keeper', 'me', { saves: 31 }),
];

function leaders(
  overrides: Partial<Parameters<typeof divisionLeadersViewModel>[0]> = {},
): ReturnType<typeof divisionLeadersViewModel> {
  return divisionLeadersViewModel({
    season: 1,
    players: PLAYERS,
    statLines: LINES,
    userClubId: 'me',
    clubNames: CLUB_NAMES,
    ...overrides,
  });
}

describe('divisionLeadersViewModel', () => {
  /**
   * Goals first is the point of the order: the board is scanned, so the
   * most-read category has to lead. The ceremony reveals goals last for the
   * opposite reason, and the two orders are not meant to converge.
   */
  it('produces one board per category with goals leading', () => {
    expect(leaders().boards.map(board => board.categoryId))
      .toEqual(['goals', 'assists', 'tacklesWon', 'saves']);
  });

  it('labels every board by the position line that can win it', () => {
    expect(leaders().boards.map(board => [board.boardLabel, board.metricLabel])).toEqual([
      ['Strikers', 'Goals'],
      ['Midfielders', 'Assists'],
      ['Defenders', 'Tackles won'],
      ['Keepers', 'Saves'],
    ]);
  });

  it('ranks a rival above the club own player and resolves both club names', () => {
    const [leader, runnerUp] = leaders().boards[0].entries;

    expect(leader).toEqual({
      position: 1,
      playerId: 'theirs',
      playerName: 'Flint Vale',
      clubName: 'Quartz FC',
      value: 9,
      isUserPlayer: false,
    });
    expect(runnerUp).toEqual({
      position: 2,
      playerId: 'mine',
      playerName: 'Gem Arrow',
      clubName: 'Brambleroad',
      value: 6,
      isUserPlayer: true,
    });
  });

  /** A regenerated rival club can outlive its pyramid entry; a blank row would
   * be worse than the raw identifier. */
  it('falls back to the club ID when the pyramid has no name for it', () => {
    const view = leaders({ clubNames: new Map([['me', 'Brambleroad']]) });

    expect(view.boards[0].entries[0].clubName).toBe('them');
  });

  it('shows only the top five of a deeper board', () => {
    const scorers = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const view = leaders({
      players: scorers.map((id, index) => player(id, 'FWD', 'them', `Striker ${index}`)),
      statLines: scorers.map((id, index) => line(id, 'them', { goals: 20 - index })),
    });

    expect(view.boards[0].entries.map(entry => entry.playerId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('renders an empty board with copy instead of throwing', () => {
    const view = leaders({ statLines: [] });

    expect(view.boards.every(board => board.entries.length === 0)).toBe(true);
    expect(view.boards.every(board => board.emptyLabel.length > 0)).toBe(true);
  });
});

describe('League sub-tab availability', () => {
  it('offers only the league table before any cup is drawn', () => {
    const career = initializeM2Career({ careerSeed: 551, userClub: USER_CLUB });

    expect(subTabs(career, 20)).toEqual(['league']);
  });

  it('adds the cup as soon as one exists, before its first match is played', () => {
    const career = startM2NationalCup(
      initializeM2Career({ careerSeed: 551, userClub: USER_CLUB }),
      1,
    );

    expect(subTabs(career, 1)).toEqual(['league', 'cup']);
  });

  it('unlocks the leaders board three weeks after the first cup match', () => {
    const career = startM2NationalCup(
      initializeM2Career({ careerSeed: 551, userClub: USER_CLUB }),
      1,
    );
    const firstCupWeek = CUP_SETTLEMENT_WEEKS[0];

    expect(subTabs(career, firstCupWeek + 2)).toEqual(['league', 'cup']);
    expect(subTabs(career, firstCupWeek + 3)).toEqual(['league', 'cup', 'leaders']);
  });

  it('carries the boards through the league view model', () => {
    const career = startM2NationalCup(
      initializeM2Career({ careerSeed: 551, userClub: USER_CLUB }),
      1,
    );
    const scorer = player('striker', 'FWD', USER_CLUB.id, 'Gem Arrow');
    const view = m2LeagueViewModel({
      career,
      season: 1,
      week: CUP_SETTLEMENT_WEEKS[0] + 3,
      activeStandings: standings(career),
      players: [scorer],
      statLines: [line('striker', USER_CLUB.id, { goals: 11 })],
    });

    expect(view.leaders.boards[0].entries).toEqual([{
      position: 1,
      playerId: 'striker',
      playerName: 'Gem Arrow',
      clubName: USER_CLUB.name,
      value: 11,
      isUserPlayer: true,
    }]);
  });
});

function subTabs(career: M2CareerState, week: number): readonly string[] {
  return m2LeagueViewModel({
    career,
    season: 1,
    week,
    activeStandings: standings(career),
  }).availableTabs;
}

function standings(state: M2CareerState): LeagueStanding[] {
  const division = state.pyramid.divisions.find(candidate =>
    candidate.clubs.some(club => club.id === state.userClubId),
  )!;
  return division.clubs.map((club, index) => ({
    position: index + 1,
    clubId: club.id,
    played: 8,
    won: Math.max(0, 7 - index),
    drawn: index % 2,
    lost: Math.max(0, index - 2),
    goalsFor: 20 - index,
    goalsAgainst: 5 + index,
    goalDifference: 15 - index * 2,
    points: Math.max(0, 22 - index * 2),
  }));
}

function player(id: string, role: Role, clubId: string, name: string): CareerPlayer {
  return {
    id,
    clubId,
    name,
    role,
    attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
    licensed: false,
    weeklyWage: 100,
    onHeroWage: false,
    contractSeasonsRemaining: 2,
    morale: 70,
    injuryWeeks: 0,
  };
}

function line(
  playerId: string,
  clubId: string,
  counts: Partial<Pick<PlayerSeasonStatLine, 'goals' | 'assists' | 'tacklesWon' | 'saves'>>,
  competition: AwardCompetition = 'league',
): PlayerSeasonStatLine {
  return {
    season: 1,
    playerId,
    clubId,
    competition,
    goals: 0,
    assists: 0,
    tacklesWon: 0,
    saves: 0,
    ...counts,
  };
}
