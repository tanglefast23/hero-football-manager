import { ROVERS, UNITED } from '../../sim/teams';
import { resolveMatchday } from '../matchday';
import type { LeagueFixture } from '../types';

const FIXTURE: LeagueFixture = {
  id: 'f1',
  season: 1,
  round: 1,
  week: 1,
  homeClubId: 'home',
  awayClubId: 'away',
  status: 'scheduled',
  matchSeed: 4242,
};

const TEAMS = { home: ROVERS, away: UNITED };

describe('matchday contributions', () => {
  it('attaches contributions whose goals match the scoreline', () => {
    const [result] = resolveMatchday([FIXTURE], TEAMS);
    const goals = (result.contributions ?? []).reduce((sum, row) => sum + row.goals, 0);
    expect(result.contributions).toBeDefined();
    expect(result.homeGoals + result.awayGoals).toBeGreaterThan(0);
    expect(goals).toBe(result.homeGoals + result.awayGoals);
  });

  it('agrees with scorerPlayerIds about who scored', () => {
    const [result] = resolveMatchday([FIXTURE], TEAMS);
    const fromContributions = new Map<string, number>();
    for (const row of result.contributions ?? []) {
      if (row.goals > 0) fromContributions.set(row.playerId, row.goals);
    }
    const fromScorers = new Map<string, number>();
    for (const id of result.scorerPlayerIds ?? []) {
      fromScorers.set(id, (fromScorers.get(id) ?? 0) + 1);
    }
    expect(fromContributions).toEqual(fromScorers);
  });
});
