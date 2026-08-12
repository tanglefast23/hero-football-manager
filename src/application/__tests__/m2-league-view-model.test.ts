import { CUP_SETTLEMENT_WEEKS } from '../../game/career';
import {
  advanceM2NationalCup,
  initializeM2Career,
  startM2NationalCup,
  type M2CareerState,
} from '../../game/m2-career';
import type { NationalCupResult } from '../../game/pyramid';
import type { LeagueFixture, LeagueStanding } from '../../game/types';
import { m2LeagueViewModel } from '../m2-league-view-model';

const USER_CLUB = { id: 'user-club', name: 'Caped Ball FC', squadStrength: 47 };

function standings(state: M2CareerState, userPosition = 3): LeagueStanding[] {
  const division = state.pyramid.divisions.find((candidate) =>
    candidate.clubs.some((club) => club.id === state.userClubId),
  )!;
  const ordered = [
    ...division.clubs.filter((club) => club.id !== state.userClubId),
  ];
  ordered.splice(
    userPosition - 1,
    0,
    division.clubs.find((club) => club.id === state.userClubId)!,
  );
  return ordered.map((club, index) => ({
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

function homeWins(state: M2CareerState): NationalCupResult[] {
  return state.nationalCups
    .at(-1)!
    .rounds.at(-1)!
    .fixtures.map((fixture) => ({
      fixtureId: fixture.id,
      homeGoals: 1,
      awayGoals: 0,
      winnerClubId: fixture.homeClubId,
    }));
}

function userLeagueFixtures(state: M2CareerState, season = 2): LeagueFixture[] {
  const opponent = state.pyramid.divisions
    .flatMap((division) => division.clubs)
    .find((club) => club.id !== state.userClubId)!;
  return [
    {
      id: `s${season}-r1-user`,
      season,
      round: 1,
      week: 2,
      homeClubId: state.userClubId,
      awayClubId: opponent.id,
      matchSeed: 77,
      status: 'played',
      score: { homeGoals: 3, awayGoals: 1 },
    },
    {
      id: `s${season}-r2-user`,
      season,
      round: 2,
      week: 6,
      homeClubId: opponent.id,
      awayClubId: state.userClubId,
      matchSeed: 78,
      status: 'scheduled',
    },
    {
      id: `s${season - 1}-old-user`,
      season: season - 1,
      round: 18,
      week: 29,
      homeClubId: state.userClubId,
      awayClubId: opponent.id,
      matchSeed: 76,
      status: 'played',
      score: { homeGoals: 0, awayGoals: 1 },
    },
  ];
}

describe('m2LeagueViewModel', () => {
  it('maps the five-division ladder and truthful active table without mutating inputs', () => {
    const career = initializeM2Career({ careerSeed: 551, userClub: USER_CLUB });
    const activeStandings = standings(career, 3);
    const frozen = JSON.stringify({ career, activeStandings });
    const view = m2LeagueViewModel({
      career,
      season: 2,
      week: 6,
      activeStandings,
      selectedDivision: 2,
      leagueFixtures: userLeagueFixtures(career),
    });

    expect(view).toMatchObject({
      seasonLabel: 'Season 2',
      userDivisionBadge: 'D5 · #3',
      selectedDivision: 2,
      selectedDivisionSummary: {
        label: 'D2 · National League',
        selected: true,
        userDivision: false,
      },
      activeTable: {
        divisionLabel: 'D5 · District League',
        rulesLabel: 'Top 2 promoted',
        matchesPlayed: 8,
      },
    });
    expect(view.divisions.map((division) => division.level)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(
      view.divisions.map((division) => division.averageStrength)[0],
    ).toBeGreaterThan(
      view.divisions.map((division) => division.averageStrength)[4],
    );
    expect(view.selectedDivisionSummary).toMatchObject({
      userSquadStrength: 47,
      comparisonTone: 'below',
    });
    expect(view.selectedDivisionSummary.comparisonLabel).toMatch(
      /^\d+ below range$/,
    );
    expect(view.activeTable.rows).toHaveLength(10);
    expect(view.activeTable.rows[2]).toMatchObject({
      clubId: USER_CLUB.id,
      clubName: USER_CLUB.name,
      isUserClub: true,
      movement: 'NONE',
    });
    expect(
      view.activeTable.rows
        .slice(0, 2)
        .every((row) => row.movement === 'PROMOTION'),
    ).toBe(true);
    expect(view.leagueFixtures).toEqual([
      expect.objectContaining({
        weekLabel: 'Week 2',
        venue: 'HOME',
        scoreLabel: '3-1',
        result: 'WIN',
        currentWeek: false,
      }),
      expect.objectContaining({
        weekLabel: 'Week 6',
        venue: 'AWAY',
        scoreLabel: 'VS',
        status: 'SCHEDULED',
        currentWeek: true,
      }),
    ]);
    expect(JSON.stringify({ career, activeStandings })).toBe(frozen);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it('uses the live squad rating when comparing the club with a division', () => {
    const career = initializeM2Career({ careerSeed: 551, userClub: USER_CLUB });
    const district = career.pyramid.divisions.find(
      (division) => division.level === 5,
    )!;
    const minimum = Math.min(
      ...district.clubs.map((club) => club.squadStrength),
    );
    const view = m2LeagueViewModel({
      career,
      season: 2,
      activeStandings: standings(career),
      selectedDivision: 5,
      userSquadStrength: minimum,
    });

    expect(view.selectedDivisionSummary).toMatchObject({
      userSquadStrength: minimum,
      comparisonLabel: 'Within range',
      comparisonTone: 'competitive',
    });
  });

  it('shows the current cup draw, completed round history, and resolved club names', () => {
    let career = startM2NationalCup(
      initializeM2Career({ careerSeed: 82, userClub: USER_CLUB }),
      3,
    );
    career = advanceM2NationalCup(career, homeWins(career));
    const view = m2LeagueViewModel({
      career,
      season: 3,
      activeStandings: standings(career),
    });

    expect(view.cup).toMatchObject({
      available: true,
      seasonLabel: 'Season 3',
      statusLabel: 'Cup live',
      currentRoundLabel: 'Round of 32',
    });
    expect(view.cup.currentRoundFixtures).toHaveLength(16);
    expect(view.cup.currentRoundFixtures[0].homeClubName).not.toMatch(
      /^d\d-club/,
    );
    const cup = career.nationalCups[0];
    const firstFixture = cup.rounds.at(-1)!.fixtures[0];
    expect(view.cup.currentRoundFixtures[0]).toMatchObject({
      homeDivision: cup.seedDivisionByClubId![firstFixture.homeClubId],
      awayDivision: cup.seedDivisionByClubId![firstFixture.awayClubId],
    });
    expect(view.cup.history[0]).toMatchObject({
      label: 'Play-in',
      matchCount: 18,
      completedCount: 18,
      statusLabel: 'Complete',
    });
    expect(view.cup.history[1]).toMatchObject({
      label: 'Round of 32',
      matchCount: 16,
      completedCount: 0,
      statusLabel: 'Live',
    });
    expect(view.cup.rounds).toHaveLength(6);
    expect(view.cup.rounds[0]).toMatchObject({
      label: 'Play-in',
      active: false,
      fixtures: expect.arrayContaining([
        expect.objectContaining({
          status: 'PLAYED',
          winnerName: expect.any(String),
        }),
      ]),
      byes: expect.arrayContaining([
        expect.objectContaining({ clubName: expect.any(String) }),
      ]),
    });
    expect(view.cup.rounds[1]).toMatchObject({
      label: 'Round of 32',
      drawn: true,
      active: true,
      fixtures: expect.arrayContaining([
        expect.objectContaining({ status: 'SCHEDULED', scoreLabel: 'VS' }),
      ]),
    });
    expect(view.cup.rounds[2]).toMatchObject({
      label: 'Round of 16',
      drawn: false,
      matchCount: 8,
      statusLabel: 'Awaiting draw',
      fixtures: [],
    });
  });

  it('enables only the user tie on its active cup matchday', () => {
    let career: M2CareerState | undefined;
    for (let seed = 1; seed <= 50 && career === undefined; seed += 1) {
      const candidate = startM2NationalCup(
        initializeM2Career({ careerSeed: seed, userClub: USER_CLUB }),
        1,
      );
      if (
        candidate.nationalCups[0].rounds[0].fixtures.some(
          (fixture) =>
            fixture.homeClubId === USER_CLUB.id ||
            fixture.awayClubId === USER_CLUB.id,
        )
      )
        career = candidate;
    }
    if (career === undefined)
      throw new Error('expected a deterministic user play-in tie');

    const view = m2LeagueViewModel({
      career,
      season: 1,
      // Read from the engine's calendar, never a literal: a parallel literal in
      // the view model once drifted out of overlap with it, so this test passed
      // while every cup tie was unplayable in the real game.
      week: CUP_SETTLEMENT_WEEKS[0],
      phase: 'matchday',
      activeStandings: standings(career),
    });
    const userFixture = view.cup.currentRoundFixtures.find(
      (fixture) => fixture.involvesUserClub,
    );

    expect(userFixture).toMatchObject({
      status: 'SCHEDULED',
      playableNow: true,
    });
    expect(view.cup.nextMatch).toMatchObject({
      week: CUP_SETTLEMENT_WEEKS[0],
      weekLabel: `Week ${CUP_SETTLEMENT_WEEKS[0]}`,
      roundLabel: 'Play-in',
      opponentName:
        userFixture?.userSide === 'home'
          ? userFixture.awayClubName
          : userFixture?.homeClubName,
      venue: userFixture?.userSide === 'home' ? 'HOME' : 'AWAY',
    });
    expect(
      view.cup.currentRoundFixtures.filter((fixture) => fixture.playableNow),
    ).toHaveLength(1);

    // The cup draws from all five tiers, so the tie is unreadable without where
    // the opponent sits. Written out, and a real position in a real division.
    const standing = view.cup.nextMatch?.opponentStandingLabel;
    const parsed = /^Division ([1-5]) Rank ([1-9]|10)$/.exec(standing ?? '');
    expect(parsed).not.toBeNull();
    const opponentId = career.pyramid.divisions
      .flatMap((division) => division.clubs)
      .find((club) => club.name === view.cup.nextMatch?.opponentName)!;
    expect(Number(parsed![1])).toBe(opponentId.division);
  });

  it('shows the next round week after the user wins while the draw is pending', () => {
    let career: M2CareerState | undefined;
    for (let seed = 1; seed <= 50 && career === undefined; seed += 1) {
      const candidate = startM2NationalCup(
        initializeM2Career({ careerSeed: seed, userClub: USER_CLUB }),
        1,
      );
      const userFixture = candidate.nationalCups[0].rounds[0].fixtures.find(
        (fixture) =>
          fixture.homeClubId === USER_CLUB.id ||
          fixture.awayClubId === USER_CLUB.id,
      );
      if (userFixture !== undefined) {
        career = {
          ...candidate,
          nationalCups: candidate.nationalCups.map((cup) => ({
            ...cup,
            rounds: cup.rounds.map((round) => ({
              ...round,
              fixtures: round.fixtures.map((fixture) =>
                fixture.id !== userFixture.id
                  ? fixture
                  : {
                      ...fixture,
                      status: 'played' as const,
                      score:
                        userFixture.homeClubId === USER_CLUB.id
                          ? { homeGoals: 1, awayGoals: 0 }
                          : { homeGoals: 0, awayGoals: 1 },
                      winnerClubId: USER_CLUB.id,
                    },
              ),
            })),
          })),
        };
      }
    }
    if (career === undefined)
      throw new Error('expected a deterministic user play-in tie');

    const view = m2LeagueViewModel({
      career,
      season: 1,
      week: 3,
      phase: 'manage',
      activeStandings: standings(career),
    });

    expect(view.cup.nextMatch).toEqual({
      week: CUP_SETTLEMENT_WEEKS[1],
      weekLabel: `Week ${CUP_SETTLEMENT_WEEKS[1]}`,
      roundLabel: 'Round of 32',
    });
  });

  it('shows a champion and preserves completed cup seasons in the selector', () => {
    let career = startM2NationalCup(
      initializeM2Career({ careerSeed: 900, userClub: USER_CLUB }),
      1,
    );
    while (career.nationalCups[0].championClubId === undefined) {
      career = advanceM2NationalCup(career, homeWins(career));
    }
    career = startM2NationalCup(career, 2);
    const live = m2LeagueViewModel({
      career,
      season: 2,
      activeStandings: standings(career),
    });
    const archive = m2LeagueViewModel({
      career,
      season: 2,
      activeStandings: standings(career),
      selectedCupSeason: 1,
    });

    expect(live.cup.seasonOptions).toHaveLength(2);
    expect(live.cup.seasonLabel).toBe('Season 2');
    expect(archive.cup).toMatchObject({
      seasonLabel: 'Season 1',
      statusLabel: 'Cup complete',
      currentRoundLabel: 'Final result',
      championName: expect.any(String),
    });
    expect(archive.cup.seasonOptions[0]).toMatchObject({
      selected: true,
      complete: true,
      championName: expect.any(String),
    });
    expect(archive.cup.currentRoundFixtures).toHaveLength(1);
    expect(archive.cup.rounds.map((round) => round.label)).toEqual([
      'Play-in',
      'Round of 32',
      'Round of 16',
      'Quarter-final',
      'Semi-final',
      'Final',
    ]);
    expect(archive.cup.rounds.flatMap((round) => round.fixtures)).toHaveLength(
      49,
    );
  });

  it('shows a useful empty cup state and rejects standings from the wrong division', () => {
    const career = initializeM2Career({ careerSeed: 17, userClub: USER_CLUB });
    const empty = m2LeagueViewModel({
      career,
      season: 1,
      activeStandings: standings(career),
    });
    expect(empty.cup).toMatchObject({
      available: false,
      statusLabel: 'Draw pending',
      currentRoundLabel: 'Hero Cup not drawn',
    });

    const malformed = standings(career);
    malformed[0] = {
      ...malformed[0],
      clubId: career.pyramid.divisions[0].clubs[0].id,
    };
    expect(() =>
      m2LeagueViewModel({ career, season: 1, activeStandings: malformed }),
    ).toThrow('does not belong');
  });
});
