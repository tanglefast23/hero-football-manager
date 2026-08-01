import type { Role } from '../../sim/types';
import {
  AWARD_CATEGORIES,
  PODIUM_SIZE,
  divisionLeaderBoard,
  divisionPodium,
} from '../division-leaders';
import type {
  AwardCategoryId,
  AwardCompetition,
  CareerPlayer,
  PlayerSeasonStatLine,
} from '../types';

describe('division leader boards', () => {
  it('gives every position line exactly one award it can win', () => {
    const ids = Object.keys(AWARD_CATEGORIES) as AwardCategoryId[];
    expect(ids.map(id => AWARD_CATEGORIES[id].id)).toEqual(ids);
    expect(ids.map(id => AWARD_CATEGORIES[id].role).sort())
      .toEqual(['DEF', 'FWD', 'GK', 'MID']);
    expect(AWARD_CATEGORIES.goals.boardLabel).toBe('Strikers');
    expect(AWARD_CATEGORIES.assists.metricLabel).toBe('Assists');
  });

  /**
   * A midfielder who outscores every striker wins no Golden Boot, deliberately:
   * one board per position line means one award each line can actually win, and
   * the only board he is eligible for is his own.
   */
  it('admits a player to his own board only, whatever else he recorded', () => {
    const players = [
      player('p_mid', 'MID', 'club_a'),
      player('p_fwd', 'FWD', 'club_b'),
    ];
    const statLines = [
      line('p_mid', 'club_a', { goals: 30, assists: 4, tacklesWon: 9, saves: 2 }),
      line('p_fwd', 'club_b', { goals: 3 }),
    ];
    const boardIds = (category: AwardCategoryId): string[] => divisionLeaderBoard(
      { category, season: 1, players, statLines },
    ).map(entry => entry.playerId);

    expect(boardIds('goals')).toEqual(['p_fwd']);
    expect(boardIds('tacklesWon')).toEqual([]);
    expect(boardIds('saves')).toEqual([]);
    expect(boardIds('assists')).toEqual(['p_mid']);
  });

  it('counts league rows only, so cup goals never inflate a division board', () => {
    const players = [player('p_a', 'FWD', 'club_a'), player('p_b', 'FWD', 'club_b')];
    const statLines = [
      line('p_a', 'club_a', { goals: 4 }),
      line('p_a', 'club_a', { goals: 9 }, 'cup'),
      line('p_b', 'club_b', { goals: 6 }),
    ];

    const board = divisionLeaderBoard({ category: 'goals', season: 1, players, statLines });

    expect(board).toEqual([
      { position: 1, playerId: 'p_b', playerName: 'p_b name', clubId: 'club_b', value: 6 },
      { position: 2, playerId: 'p_a', playerName: 'p_a name', clubId: 'club_a', value: 4 },
    ]);
  });

  it('ignores rows from other seasons', () => {
    const players = [player('p_a', 'GK', 'club_a')];
    const statLines = [
      { ...line('p_a', 'club_a', { saves: 40 }), season: 1 },
      { ...line('p_a', 'club_a', { saves: 7 }), season: 2 },
    ];

    const board = divisionLeaderBoard({ category: 'saves', season: 2, players, statLines });

    expect(board).toEqual([
      { position: 1, playerId: 'p_a', playerName: 'p_a name', clubId: 'club_a', value: 7 },
    ]);
  });

  /**
   * A mid-season transfer inside the division writes one row per club. Without
   * summing them the board shows the same player twice, and neither number is
   * the tally he actually finished the season on.
   */
  it('sums a transferred player into one placing under his current club', () => {
    const players = [player('p_mover', 'DEF', 'club_new'), player('p_rival', 'DEF', 'club_c')];
    const statLines = [
      line('p_mover', 'club_old', { tacklesWon: 20 }),
      line('p_mover', 'club_new', { tacklesWon: 15 }),
      line('p_rival', 'club_c', { tacklesWon: 30 }),
    ];

    const board = divisionLeaderBoard({ category: 'tacklesWon', season: 1, players, statLines });

    expect(board).toEqual([
      { position: 1, playerId: 'p_mover', playerName: 'p_mover name', clubId: 'club_new', value: 35 },
      { position: 2, playerId: 'p_rival', playerName: 'p_rival name', clubId: 'club_c', value: 30 },
    ]);
  });

  it('shares a position across a tie and resumes at the next natural rank', () => {
    const players = [
      player('p_a', 'FWD', 'club_a'),
      player('p_b', 'FWD', 'club_b'),
      player('p_c', 'FWD', 'club_c'),
      player('p_d', 'FWD', 'club_d'),
    ];
    const statLines = [
      line('p_a', 'club_a', { goals: 14 }),
      line('p_b', 'club_b', { goals: 11 }),
      line('p_c', 'club_c', { goals: 11 }),
      line('p_d', 'club_d', { goals: 8 }),
    ];

    const board = divisionLeaderBoard({ category: 'goals', season: 1, players, statLines });

    expect(board.map(entry => [entry.playerId, entry.position])).toEqual([
      ['p_a', 1],
      ['p_b', 2],
      ['p_c', 2],
      ['p_d', 4],
    ]);
  });

  /** Roster order is an implementation detail; the board must not inherit it. */
  it('breaks a tie by player ID whatever order the roster arrives in', () => {
    const statLines = [
      line('p_bravo', 'club_b', { assists: 12 }),
      line('p_alpha', 'club_a', { assists: 12 }),
      line('p_charlie', 'club_c', { assists: 12 }),
    ];
    const roster = [
      player('p_charlie', 'MID', 'club_c'),
      player('p_bravo', 'MID', 'club_b'),
      player('p_alpha', 'MID', 'club_a'),
    ];

    const board = divisionLeaderBoard({ category: 'assists', season: 1, players: roster, statLines });
    const reversed = divisionLeaderBoard({
      category: 'assists',
      season: 1,
      players: roster.slice().reverse(),
      statLines: statLines.slice().reverse(),
    });

    expect(board.map(entry => entry.playerId)).toEqual(['p_alpha', 'p_bravo', 'p_charlie']);
    expect(reversed).toEqual(board);
  });

  it('omits a player who scored nothing in the category', () => {
    const players = [player('p_a', 'GK', 'club_a'), player('p_b', 'GK', 'club_b')];
    const statLines = [
      line('p_a', 'club_a', { saves: 0, tacklesWon: 5 }),
      line('p_b', 'club_b', { saves: 2 }),
    ];

    const board = divisionLeaderBoard({ category: 'saves', season: 1, players, statLines });

    expect(board.map(entry => entry.playerId)).toEqual(['p_b']);
  });

  it('honours an explicit limit', () => {
    const players = ['p_a', 'p_b', 'p_c'].map(id => player(id, 'FWD', `club_${id}`));
    const statLines = [
      line('p_a', 'club_p_a', { goals: 9 }),
      line('p_b', 'club_p_b', { goals: 6 }),
      line('p_c', 'club_p_c', { goals: 3 }),
    ];

    const board = divisionLeaderBoard({ category: 'goals', season: 1, players, statLines, limit: 2 });

    expect(board.map(entry => entry.playerId)).toEqual(['p_a', 'p_b']);
  });

  /**
   * The shared-rank rule says what a tie looks like, not what to do at the cut
   * line. A fourth "third place" is worse than a stable arbitrary cut.
   */
  it('caps the podium at three even when four players tie for third', () => {
    const ids = ['p_a', 'p_b', 'p_c', 'p_d', 'p_e', 'p_f'];
    const players = ids.map(id => player(id, 'FWD', `club_${id}`));
    const statLines = [
      line('p_a', 'club_p_a', { goals: 20 }),
      line('p_b', 'club_p_b', { goals: 15 }),
      line('p_c', 'club_p_c', { goals: 7 }),
      line('p_d', 'club_p_d', { goals: 7 }),
      line('p_e', 'club_p_e', { goals: 7 }),
      line('p_f', 'club_p_f', { goals: 7 }),
    ];

    const podium = divisionPodium({ category: 'goals', season: 1, players, statLines });

    expect(podium).toHaveLength(PODIUM_SIZE);
    expect(podium.map(placing => placing.playerId)).toEqual(['p_a', 'p_b', 'p_c']);
    expect(podium[2]).toEqual({
      playerId: 'p_c',
      playerName: 'p_c name',
      clubId: 'club_p_c',
      value: 7,
    });
  });

  it('returns an empty podium when nobody in the role recorded anything', () => {
    expect(divisionPodium({
      category: 'saves',
      season: 1,
      players: [player('p_a', 'FWD', 'club_a')],
      statLines: [line('p_a', 'club_a', { goals: 12 })],
    })).toEqual([]);
  });
});

function player(id: string, role: Role, clubId: string): CareerPlayer {
  return {
    id,
    clubId,
    name: `${id} name`,
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
