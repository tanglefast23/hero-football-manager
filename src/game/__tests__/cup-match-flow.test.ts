import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
} from '../career';
import type { FixtureResult, GameState } from '../types';

function fullCareerAtPlayIn(seed = 2): GameState {
  const career = createCareer(createLaunchCareerSetup(seed, undefined, undefined, 'full'));
  return { ...career, week: 5, phase: 'matchday' };
}

function leagueDraws(state: GameState): FixtureResult[] {
  return fixturesForCurrentWeek(state).map(fixture => ({
    fixtureId: fixture.id,
    homeGoals: 1,
    awayGoals: 1,
  }));
}

function cupReadyCareer(userIsHome: boolean, leagueUserIsHome?: boolean): GameState {
  for (let seed = 1; seed <= 100; seed += 1) {
    const initial = fullCareerAtPlayIn(seed);
    const afterLeague = completeMatchday(initial, leagueDraws(initial));
    const cupMatchday = activeCareerMatchday(afterLeague);
    const leagueFixture = afterLeague.fixtures.find(fixture => (
      fixture.season === afterLeague.season
      && fixture.week === afterLeague.week
      && (fixture.homeClubId === afterLeague.userClubId || fixture.awayClubId === afterLeague.userClubId)
    ));
    if (
      cupMatchday?.kind === 'national-cup'
      && (cupMatchday.fixture.homeClubId === afterLeague.userClubId) === userIsHome
      && (leagueUserIsHome === undefined
        || (leagueFixture?.homeClubId === afterLeague.userClubId) === leagueUserIsHome)
    ) {
      return afterLeague;
    }
  }
  throw new Error(`could not find a ${userIsHome ? 'home' : 'away'} Cup fixture`);
}

describe('player-controlled National Cup match flow', () => {
  test('pauses a double-header week for the user tie, then settles after that tie', () => {
    const initial = fullCareerAtPlayIn();
    const afterLeague = completeMatchday(initial, leagueDraws(initial));
    const cupMatchday = activeCareerMatchday(afterLeague);

    expect(afterLeague).toMatchObject({ week: 5, phase: 'matchday', ledgers: [] });
    expect(cupMatchday).toMatchObject({
      kind: 'national-cup',
      cupRoundLabel: 'Play-in',
    });
    const cupFixture = cupMatchday!.fixture;
    const starterId = afterLeague.lineups
      .find(lineup => lineup.clubId === afterLeague.userClubId)!.playerIds[0];
    const fameBeforeCup = afterLeague.players.find(player => player.id === starterId)!.fame ?? 0;
    const userIsHome = cupFixture.homeClubId === afterLeague.userClubId;
    const userWin: FixtureResult = {
      fixtureId: cupFixture.id,
      homeGoals: userIsHome ? 2 : 0,
      awayGoals: userIsHome ? 0 : 2,
      scorerPlayerIds: [starterId, starterId],
    };

    const settled = completeMatchday(afterLeague, [userWin]);
    const resolvedRound = settled.m2!.nationalCups[0].rounds[0];

    expect(settled).toMatchObject({ week: 6, phase: 'manage' });
    expect(resolvedRound.fixtures.every(fixture => fixture.status === 'played')).toBe(true);
    expect(resolvedRound.fixtures.find(fixture => fixture.id === cupFixture.id)).toMatchObject({
      winnerClubId: settled.userClubId,
      score: { homeGoals: userWin.homeGoals, awayGoals: userWin.awayGoals },
    });
    expect(settled.ledgers).toHaveLength(1);
    expect(settled.ledgers[0].lines).toContainEqual({
      kind: 'prize',
      label: 'National Cup Play-in win',
      amount: 2_000,
    });
    expect(settled.players.find(player => player.id === starterId)?.fame).toBe(fameBeforeCup + 7);
    expect(settled.players.find(player => player.id === starterId)?.morale).toBe(58);
    expect(settled.seasonGoalTallies).toContainEqual({
      season: settled.season,
      playerId: starterId,
      goals: 2,
    });
  });

  test('uses a stable penalty winner when the production match finishes level', () => {
    const afterLeague = completeMatchday(fullCareerAtPlayIn(), leagueDraws(fullCareerAtPlayIn()));
    const fixture = activeCareerMatchday(afterLeague)!.fixture;
    const result = [{ fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 }];

    expect(JSON.stringify(completeMatchday(afterLeague, result))).toBe(
      JSON.stringify(completeMatchday(afterLeague, result)),
    );
  });

  test('adds a separately labelled gate receipt for a home Cup tie', () => {
    const afterLeague = cupReadyCareer(true, true);
    const fixture = activeCareerMatchday(afterLeague)!.fixture;
    const userClub = afterLeague.clubs.find(club => club.id === afterLeague.userClubId)!;
    const expectedGate = Math.floor(userClub.fans * 0.6) * userClub.ticketPrice;
    const userWin: FixtureResult = {
      fixtureId: fixture.id,
      homeGoals: 2,
      awayGoals: 0,
    };

    const settled = completeMatchday(afterLeague, [userWin]);

    const ledger = settled.ledgers.at(-1)!;
    expect(ledger.lines.filter(line => line.kind === 'tickets')).toEqual([
      { kind: 'tickets', label: 'League home gate', amount: expectedGate },
      { kind: 'tickets', label: 'National Cup Play-in home gate', amount: expectedGate },
    ]);
    expect(ledger.balanceAfter).toBe(
      userClub.cash + ledger.lines.reduce((total, line) => total + line.amount, 0),
    );
  });

  test('does not award a Cup gate receipt for an away tie', () => {
    const afterLeague = cupReadyCareer(false);
    const fixture = activeCareerMatchday(afterLeague)!.fixture;
    const userWin: FixtureResult = {
      fixtureId: fixture.id,
      homeGoals: 0,
      awayGoals: 2,
    };

    const settled = completeMatchday(afterLeague, [userWin]);

    expect(settled.ledgers.at(-1)?.lines.some(line => (
      line.kind === 'tickets' && line.label.startsWith('National Cup')
    ))).toBe(false);
  });
});
