import { createLaunchCareerSetup } from '../../application/launch';
import {
  CUP_SETTLEMENT_WEEKS,
  activeCareerMatchday,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
} from '../career';
import { matchdayVarianceRoll } from '../finance-variance';
import { weeklySettlementAwardKeys } from '../weekly-settlement-awards';
import type { ProductionFixtureResult } from '../matchday';
import type { FixtureResult, GameState } from '../types';

const PLAY_IN_WEEK = CUP_SETTLEMENT_WEEKS[0];

/**
 * A career parked on the play-in week with the next league round pulled onto the
 * same week. The cup calendar settles in weeks the season-1 league leaves empty,
 * so a double-header only happens naturally from season 2 on (weeks 6 and 18);
 * moving the round keeps that shared-week path covered without playing out a
 * whole season first.
 */
function fullCareerAtPlayIn(seed = 2): GameState {
  const career = createCareer(createLaunchCareerSetup(seed));
  const doubleHeaderRound = Math.min(
    ...career.fixtures
      .filter(
        (fixture) =>
          fixture.season === career.season && fixture.week > PLAY_IN_WEEK,
      )
      .map((fixture) => fixture.round),
  );
  return {
    ...career,
    week: PLAY_IN_WEEK,
    phase: 'matchday',
    fixtures: career.fixtures.map((fixture) =>
      fixture.season === career.season && fixture.round === doubleHeaderRound
        ? { ...fixture, week: PLAY_IN_WEEK }
        : fixture,
    ),
  };
}

function leagueDraws(state: GameState): FixtureResult[] {
  return fixturesForCurrentWeek(state).map((fixture) => ({
    fixtureId: fixture.id,
    homeGoals: 1,
    awayGoals: 1,
  }));
}

/**
 * Since the season-1 schedule moved league round openers to week 3, the user
 * is always the away league side in the play-in week, so the hosting
 * combinations these ledger tests need are arranged directly on the state
 * instead of scanning seeds for a natural draw.
 */
function cupReadyCareer(
  userIsHome: boolean,
  leagueUserIsHome?: boolean,
): GameState {
  const initial = fullCareerAtPlayIn();
  const userClubId = initial.userClubId;
  const swapIfNeeded = <T extends { homeClubId: string; awayClubId: string }>(
    fixture: T,
    wantUserHome: boolean,
  ): T => {
    if (fixture.homeClubId !== userClubId && fixture.awayClubId !== userClubId)
      return fixture;
    if ((fixture.homeClubId === userClubId) === wantUserHome) return fixture;
    return {
      ...fixture,
      homeClubId: fixture.awayClubId,
      awayClubId: fixture.homeClubId,
    };
  };
  const arranged: GameState = {
    ...initial,
    fixtures:
      leagueUserIsHome === undefined
        ? initial.fixtures
        : initial.fixtures.map((fixture) =>
            fixture.season === initial.season && fixture.week === initial.week
              ? swapIfNeeded(fixture, leagueUserIsHome)
              : fixture,
          ),
    m2: {
      ...initial.m2!,
      nationalCups: initial.m2!.nationalCups.map((cup) =>
        cup.championClubId === undefined && cup.season === initial.season
          ? {
              ...cup,
              rounds: cup.rounds.map((round, index) =>
                index === cup.rounds.length - 1
                  ? {
                      ...round,
                      fixtures: round.fixtures.map((fixture) =>
                        swapIfNeeded(fixture, userIsHome),
                      ),
                    }
                  : round,
              ),
            }
          : cup,
      ),
    },
  };
  const afterLeague = completeMatchday(arranged, leagueDraws(arranged));
  const cupMatchday = activeCareerMatchday(afterLeague);
  if (
    cupMatchday?.kind !== 'national-cup' ||
    (cupMatchday.fixture.homeClubId === userClubId) !== userIsHome
  ) {
    throw new Error(
      `could not arrange a ${userIsHome ? 'home' : 'away'} Cup fixture`,
    );
  }
  return afterLeague;
}

describe('player-controlled Hero Cup match flow', () => {
  test('pauses a double-header week for the user tie, then settles after that tie', () => {
    const initial = fullCareerAtPlayIn();
    const afterLeague = completeMatchday(initial, leagueDraws(initial));
    const cupMatchday = activeCareerMatchday(afterLeague);

    expect(afterLeague).toMatchObject({
      week: PLAY_IN_WEEK,
      phase: 'matchday',
      ledgers: [],
    });
    expect(cupMatchday).toMatchObject({
      kind: 'national-cup',
      cupRoundLabel: 'Play-in',
    });
    const cupFixture = cupMatchday!.fixture;
    const starterId = afterLeague.lineups.find(
      (lineup) => lineup.clubId === afterLeague.userClubId,
    )!.playerIds[0];
    const fameBeforeCup =
      afterLeague.players.find((player) => player.id === starterId)!.fame ?? 0;
    const userIsHome = cupFixture.homeClubId === afterLeague.userClubId;
    const userWin: FixtureResult = {
      fixtureId: cupFixture.id,
      homeGoals: userIsHome ? 2 : 0,
      awayGoals: userIsHome ? 0 : 2,
      scorerPlayerIds: [starterId, starterId],
      contributions: [
        {
          playerId: starterId,
          goals: 2,
          assists: 0,
          tacklesWon: 0,
          saves: 3,
          passesCompleted: 9,
        },
      ],
    };

    const settled = completeMatchday(afterLeague, [userWin]);
    const resolvedRound = settled.m2!.nationalCups[0].rounds[0];

    expect(settled).toMatchObject({ week: PLAY_IN_WEEK + 1, phase: 'manage' });
    expect(
      resolvedRound.fixtures.every((fixture) => fixture.status === 'played'),
    ).toBe(true);
    expect(
      resolvedRound.fixtures.find((fixture) => fixture.id === cupFixture.id),
    ).toMatchObject({
      winnerClubId: settled.userClubId,
      score: { homeGoals: userWin.homeGoals, awayGoals: userWin.awayGoals },
    });
    expect(settled.ledgers).toHaveLength(1);
    expect(settled.ledgers[0].lines).toContainEqual(
      expect.objectContaining({
        kind: 'prize',
        label: 'Hero Cup Play-in win',
        amount: 2_000,
        idempotencyKey: weeklySettlementAwardKeys.cupRound(
          settled.userClubId,
          settled.season,
          1,
        ),
      }),
    );
    expect(
      settled.clubs.find((club) => club.id === settled.userClubId)?.fans,
    ).toBe(
      afterLeague.clubs.find((club) => club.id === afterLeague.userClubId)!
        .fans + 6,
    );
    expect(
      settled.players.find((player) => player.id === starterId)?.fame,
    ).toBe(fameBeforeCup + 7);
    expect(
      settled.players.find((player) => player.id === starterId)?.morale,
    ).toBe(58);
    expect(settled.seasonStatLines).toContainEqual({
      season: settled.season,
      playerId: starterId,
      clubId: settled.userClubId,
      competition: 'cup',
      goals: 2,
      assists: 0,
      tacklesWon: 0,
      saves: 3,
      passesCompleted: 9,
    });
  });

  test('uses a stable penalty winner when the production match finishes level', () => {
    const afterLeague = completeMatchday(
      fullCareerAtPlayIn(),
      leagueDraws(fullCareerAtPlayIn()),
    );
    const fixture = activeCareerMatchday(afterLeague)!.fixture;
    const result = [{ fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 }];

    expect(JSON.stringify(completeMatchday(afterLeague, result))).toBe(
      JSON.stringify(completeMatchday(afterLeague, result)),
    );
  });

  test('applies one wellbeing result for one production Cup appearance', () => {
    const initial = createCareer(createLaunchCareerSetup(17));
    const cupOnly: GameState = {
      ...initial,
      week: PLAY_IN_WEEK,
      phase: 'matchday',
    };
    const fixture = activeCareerMatchday(cupOnly)!.fixture;
    const starterIds = cupOnly.lineups.find(
      (lineup) => lineup.clubId === cupOnly.userClubId,
    )!.playerIds;
    const prepared: GameState = {
      ...cupOnly,
      players: cupOnly.players.map((player) =>
        starterIds.includes(player.id) ? { ...player, morale: 50 } : player,
      ),
    };
    const userIsHome = fixture.homeClubId === prepared.userClubId;
    const fixtureResult: FixtureResult = {
      fixtureId: fixture.id,
      homeGoals: userIsHome ? 1 : 0,
      awayGoals: userIsHome ? 0 : 1,
    };
    const production: ProductionFixtureResult = {
      fixtureResult,
      goals: [],
      participantPlayerIds: starterIds,
      powerFiredPlayerIds: [],
    };

    const settled = completeMatchday(prepared, [fixtureResult], production);

    expect(
      settled.players.find((player) => player.id === starterIds[0])?.morale,
    ).toBe(55);
  });

  test('uses the penalty winner exactly once for production Cup Fame and wellbeing', () => {
    const initial = createCareer(createLaunchCareerSetup(17));
    const cupOnly: GameState = {
      ...initial,
      week: PLAY_IN_WEEK,
      phase: 'matchday',
    };
    const fixture = activeCareerMatchday(cupOnly)!.fixture;
    const starterIds = cupOnly.lineups.find(
      (lineup) => lineup.clubId === cupOnly.userClubId,
    )!.playerIds;
    const trackedPlayerId = starterIds[0];
    const fameBefore =
      cupOnly.players.find((player) => player.id === trackedPlayerId)!.fame ??
      0;
    const prepared: GameState = {
      ...cupOnly,
      players: cupOnly.players.map((player) =>
        starterIds.includes(player.id) ? { ...player, morale: 50 } : player,
      ),
    };
    const fixtureResult: FixtureResult = {
      fixtureId: fixture.id,
      homeGoals: 0,
      awayGoals: 0,
    };
    const production: ProductionFixtureResult = {
      fixtureResult,
      goals: [],
      participantPlayerIds: starterIds,
      powerFiredPlayerIds: [],
    };

    const settled = completeMatchday(prepared, [fixtureResult], production);
    const resolvedFixture = settled
      .m2!.nationalCups.flatMap((cup) => cup.rounds)
      .flatMap((round) => round.fixtures)
      .find((candidate) => candidate.id === fixture.id)!;
    const userWon = resolvedFixture.winnerClubId === settled.userClubId;

    expect(resolvedFixture).toMatchObject({
      score: { homeGoals: 0, awayGoals: 0 },
      winnerClubId: userWon
        ? settled.userClubId
        : fixture.homeClubId === settled.userClubId
          ? fixture.awayClubId
          : fixture.homeClubId,
    });
    // One real appearance is +1 Fame, with another +2 only for the actual
    // winner. One wellbeing result is +5 morale for a starting winner or -1
    // for a starting loser; a second application would miss these exact values.
    expect(
      settled.players.find((player) => player.id === trackedPlayerId)?.fame,
    ).toBe(fameBefore + (userWon ? 3 : 1));
    expect(
      settled.players.find((player) => player.id === trackedPlayerId)?.morale,
    ).toBe(userWon ? 55 : 49);
  });

  test('adds a separately labelled gate receipt for a home Cup tie', () => {
    const afterLeague = cupReadyCareer(true);
    const fixture = activeCareerMatchday(afterLeague)!.fixture;
    const userClub = afterLeague.clubs.find(
      (club) => club.id === afterLeague.userClubId,
    )!;
    // The raw gate takes this week's seeded cup-gate roll before banking.
    const rawGate = Math.floor(userClub.fans * 0.6) * userClub.ticketPrice;
    const roll = matchdayVarianceRoll(
      afterLeague.careerSeed,
      afterLeague.season,
      afterLeague.week,
      'cup-gate',
    );
    const expectedGate = Math.round((rawGate * (100 + roll.percent)) / 100);
    const userWin: FixtureResult = {
      fixtureId: fixture.id,
      homeGoals: 2,
      awayGoals: 0,
    };

    const settled = completeMatchday(afterLeague, [userWin]);

    const ledger = settled.ledgers.at(-1)!;
    expect(
      ledger.lines.filter((line) => line.kind === 'tickets'),
    ).toContainEqual({
      kind: 'tickets',
      label: 'Hero Cup Play-in home gate',
      labelKey: 'ledger.cupHomeGate',
      // Each English param is paired with its catalog key, so the app ring
      // swaps in the translated cup and round before interpolating.
      labelParams: {
        cup: 'Hero Cup',
        cupKey: 'm2League.heroCup',
        round: 'Play-in',
        roundKey: 'm2League.cupRound.playIn',
      },
      amount: expectedGate,
      reveal: {
        source: 'cup-gate',
        base: expectedGate,
        variancePercent: roll.percent,
        surge: roll.surge,
        multiplierPercent: 100,
        facilityCount: 0,
      },
    });
    expect(ledger.balanceAfter).toBe(
      userClub.cash +
        ledger.lines.reduce((total, line) => total + line.amount, 0),
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

    expect(
      settled.ledgers
        .at(-1)
        ?.lines.some(
          (line) =>
            line.kind === 'tickets' && line.label.startsWith('Hero Cup'),
        ),
    ).toBe(false);
  });

  test('counts the Cup prize before financial safety can add an unnecessary rescue', () => {
    const afterLeague = cupReadyCareer(false);
    const fixture = activeCareerMatchday(afterLeague)!.fixture;
    const userIsHome = fixture.homeClubId === afterLeague.userClubId;
    const atRisk: GameState = {
      ...afterLeague,
      clubs: afterLeague.clubs.map((club) =>
        club.id === afterLeague.userClubId ? { ...club, cash: -14_500 } : club,
      ),
    };
    const won = completeMatchday(atRisk, [
      {
        fixtureId: fixture.id,
        homeGoals: userIsHome ? 1 : 0,
        awayGoals: userIsHome ? 0 : 1,
      },
    ]);
    const lost = completeMatchday(atRisk, [
      {
        fixtureId: fixture.id,
        homeGoals: userIsHome ? 0 : 1,
        awayGoals: userIsHome ? 1 : 0,
      },
    ]);

    expect(
      lost.ledgers.at(-1)?.lines.some((line) => line.kind === 'board-rescue'),
    ).toBe(true);
    expect(
      won.ledgers.at(-1)?.lines.some((line) => line.kind === 'board-rescue'),
    ).toBe(false);
    expect(
      won.ledgers.at(-1)?.lines.filter((line) => line.kind === 'prize'),
    ).toHaveLength(1);
    expect(won.clubs.find((club) => club.id === won.userClubId)?.cash).toBe(
      won.ledgers.at(-1)?.balanceAfter,
    );
  });
});
