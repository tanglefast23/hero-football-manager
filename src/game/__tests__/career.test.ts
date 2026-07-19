import {
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
  leagueStandings,
  startNextSeason,
} from '../career';
import type {
  CareerSetup,
  FixtureResult,
  GameState,
  LeagueFixture,
} from '../types';
import { createLaunchCareerSetup } from '../../application/launch';

function makeSetup(): CareerSetup {
  return {
    seed: 123456789,
    userClubId: 'club-00',
    startingTrainingPoints: 7,
    clubs: Array.from({ length: 10 }, (_, index) => ({
      id: `club-${String(index).padStart(2, '0')}`,
      name: `Club ${index}`,
      cash: index === 0 ? 25000 : 10000,
      fans: 500,
      ticketPrice: 4,
      sponsorMonthlyFee: 2000,
      weeklyWages: 3200,
    })),
  };
}

function allDraws(state: GameState): FixtureResult[] {
  return fixturesForCurrentWeek(state).map(fixture => ({
    fixtureId: fixture.id,
    homeGoals: 0,
    awayGoals: 0,
  }));
}

function finishSeason(initialState: GameState): GameState {
  let state = initialState;

  while (state.phase !== 'season-end' && state.phase !== 'complete') {
    state = advanceWeek(state);
    if (state.phase === 'matchday') {
      state = completeMatchday(state, allDraws(state));
    }
  }

  return state;
}

describe('career season workflow', () => {
  it('adds supplied scorer identities to the persistent season goal ledger', () => {
    let state = createCareer(createLaunchCareerSetup(909));
    while (state.phase !== 'matchday') state = advanceWeek(state);

    const fixtures = fixturesForCurrentWeek(state);
    const userFixture = fixtures.find(fixture =>
      fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId,
    )!;
    const scorerId = state.lineups.find(lineup => lineup.clubId === state.userClubId)!.playerIds[1];
    const userIsHome = userFixture.homeClubId === state.userClubId;
    const results = fixtures.map(fixture => fixture.id === userFixture.id
      ? {
          fixtureId: fixture.id,
          homeGoals: userIsHome ? 2 : 0,
          awayGoals: userIsHome ? 0 : 2,
          scorerPlayerIds: [scorerId, scorerId],
        }
      : { fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 });

    const settled = completeMatchday(state, results);

    expect(settled.seasonGoalTallies).toContainEqual({
      season: 1,
      playerId: scorerId,
      goals: 2,
    });
  });

  it('pauses a scheduled week at matchday, accepts every result, and settles it', () => {
    let state = createCareer(makeSetup());

    for (let week = 1; week <= 4; week += 1) {
      state = advanceWeek(state);
    }

    expect(state.week).toBe(5);
    expect(state.phase).toBe('manage');
    expect(state.ledgers).toHaveLength(4);
    expect(state.ledgers[3].lines.map(line => line.kind)).toEqual([
      'sponsor',
      'wages',
      'subsidy',
    ]);

    const beforeMatchday = state;
    state = advanceWeek(state);
    expect(state.week).toBe(5);
    expect(state.phase).toBe('matchday');
    expect(state.ledgers).toHaveLength(4);
    expect(() => advanceWeek(state)).toThrow('manage phase');

    const fixtures = fixturesForCurrentWeek(state);
    expect(fixtures).toHaveLength(5);
    const userFixture = fixtures.find(
      fixture => fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId,
    );
    expect(userFixture).toBeDefined();
    const results = fixtures.map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: fixture.id === userFixture?.id ? 2 : 0,
      awayGoals: 0,
    }));

    const frozenInput = JSON.stringify(state);
    const settled = completeMatchday(state, results);

    expect(JSON.stringify(state)).toBe(frozenInput);
    expect(settled.phase).toBe('manage');
    expect(settled.week).toBe(6);
    expect(settled.fixtures.filter(fixture => fixture.status === 'played')).toHaveLength(5);
    expect(settled.trainingPoints).toBe(41);
    expect(settled.ledgers.at(-1)?.lines).toEqual([
      { kind: 'tickets', label: 'Home match tickets', amount: 1200 },
      { kind: 'wages', label: 'Weekly wages', amount: -3200 },
      { kind: 'subsidy', label: 'Season 1 wage subsidy', amount: 1600 },
    ]);
    expect(settled.clubs.find(club => club.id === state.userClubId)?.cash).toBe(20200);
    expect(beforeMatchday.week).toBe(5);
  });

  it('rejects incomplete, duplicate, unknown, or invalid matchday results', () => {
    let state = createCareer(makeSetup());
    while (state.week < 5) state = advanceWeek(state);
    state = advanceWeek(state);

    const valid = allDraws(state);
    expect(() => completeMatchday(state, valid.slice(1))).toThrow('exactly 5');
    expect(() =>
      completeMatchday(state, [valid[0], valid[0], ...valid.slice(2)]),
    ).toThrow('more than one result');
    expect(() =>
      completeMatchday(state, [{ ...valid[0], fixtureId: 'not-this-week' }, ...valid.slice(1)]),
    ).toThrow('not scheduled');
    expect(() =>
      completeMatchday(state, [{ ...valid[0], homeGoals: -1 }, ...valid.slice(1)]),
    ).toThrow('nonnegative integer');
    expect(() => completeMatchday({ ...state, phase: 'manage' }, valid)).toThrow('matchday phase');
  });
});

describe('career validation and determinism', () => {
  it('deep-copies setup and produces byte-identical serializable state', () => {
    const setup = makeSetup();
    const first = createCareer(setup);
    const second = createCareer(JSON.parse(JSON.stringify(setup)) as CareerSetup);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);

    setup.clubs[0].cash = 1;
    setup.clubs[0].name = 'Changed after creation';
    setup.clubs.push({ ...setup.clubs[0], id: 'late-club' });

    expect(first.clubs).toHaveLength(10);
    expect(first.clubs[0].cash).toBe(25000);
    expect(first.clubs[0].name).toBe('Club 0');
  });

  it.each([
    ['negative seed', (setup: CareerSetup) => { setup.seed = -1; }],
    ['fractional seed', (setup: CareerSetup) => { setup.seed = 1.5; }],
    ['seed above uint32', (setup: CareerSetup) => { setup.seed = 4294967296; }],
    ['nine clubs', (setup: CareerSetup) => { setup.clubs.pop(); }],
    ['duplicate club ID', (setup: CareerSetup) => { setup.clubs[1].id = setup.clubs[0].id; }],
    ['unknown user club', (setup: CareerSetup) => { setup.userClubId = 'missing'; }],
    ['negative cash', (setup: CareerSetup) => { setup.clubs[0].cash = -1; }],
    ['fractional fans', (setup: CareerSetup) => { setup.clubs[0].fans = 1.5; }],
    ['negative ticket price', (setup: CareerSetup) => { setup.clubs[0].ticketPrice = -1; }],
    ['negative sponsor fee', (setup: CareerSetup) => { setup.clubs[0].sponsorMonthlyFee = -1; }],
    ['negative weekly wages', (setup: CareerSetup) => { setup.clubs[0].weeklyWages = -1; }],
    ['negative starting TP', (setup: CareerSetup) => { setup.startingTrainingPoints = -1; }],
  ])('rejects %s', (_label, mutate) => {
    const setup = makeSetup();
    mutate(setup);
    expect(() => createCareer(setup)).toThrow();
  });
});

describe('finances and two-season boundary', () => {
  it('pays the Season 1 wage subsidy but removes it in Season 2', () => {
    const seasonOneWeekTwo = advanceWeek(createCareer(makeSetup()));
    expect(seasonOneWeekTwo.ledgers[0].lines).toEqual([
      { kind: 'wages', label: 'Weekly wages', amount: -3200 },
      { kind: 'subsidy', label: 'Season 1 wage subsidy', amount: 1600 },
    ]);

    const seasonOneEnd = finishSeason(createCareer(makeSetup()));
    const seasonTwoStart = startNextSeason(seasonOneEnd);
    const seasonTwoWeekTwo = advanceWeek(seasonTwoStart);
    expect(seasonTwoWeekTwo.ledgers.at(-1)?.lines).toEqual([
      { kind: 'wages', label: 'Weekly wages', amount: -3200 },
    ]);
  });

  it('rounds an odd Season 1 wage subsidy down to whole money', () => {
    const setup = makeSetup();
    setup.clubs[0].weeklyWages = 3201;

    const state = advanceWeek(createCareer(setup));
    const ledger = state.ledgers[0];
    const userCash = state.clubs.find(club => club.id === state.userClubId)?.cash;

    expect(ledger.lines).toEqual([
      { kind: 'wages', label: 'Weekly wages', amount: -3201 },
      { kind: 'subsidy', label: 'Season 1 wage subsidy', amount: 1600 },
    ]);
    expect(Number.isInteger(ledger.balanceAfter)).toBe(true);
    expect(Number.isInteger(userCash)).toBe(true);
    expect(userCash).toBe(23399);
  });

  it('allows a safe negative cash balance', () => {
    const initial = createCareer(makeSetup());
    const clubs = initial.clubs.map(club =>
      club.id === initial.userClubId ? { ...club, cash: -100 } : club,
    );

    const state = advanceWeek({ ...initial, clubs });

    expect(state.clubs.find(club => club.id === state.userClubId)?.cash).toBe(-1700);
    expect(state.ledgers[0].balanceAfter).toBe(-1700);
  });

  it('rejects ticket revenue that exceeds the safe integer range', () => {
    const setup = makeSetup();
    setup.clubs[0].fans = Number.MAX_SAFE_INTEGER;
    setup.clubs[0].ticketPrice = 2;
    const weekFive = { ...createCareer(setup), week: 5 };
    const matchday = advanceWeek(weekFive);

    expect(() => completeMatchday(matchday, allDraws(matchday))).toThrow(
      'ticket revenue exceeds the safe integer range',
    );
  });

  it('rejects a weekly ledger net that exceeds the safe integer range', () => {
    const setup = makeSetup();
    setup.clubs[0].cash = 0;
    setup.clubs[0].fans = 2;
    setup.clubs[0].ticketPrice = 1;
    setup.clubs[0].sponsorMonthlyFee = Number.MAX_SAFE_INTEGER;
    setup.clubs[0].weeklyWages = 0;
    const initial = createCareer(setup);
    const playedHomeFixture = playedFixture('overflow-home', 'club-00', 'club-01', 0, 0);

    expect(() =>
      advanceWeek({ ...initial, week: 4, fixtures: [{ ...playedHomeFixture, week: 4 }] }),
    ).toThrow('weekly ledger net exceeds the safe integer range');
  });

  it('rejects a cash balance that exceeds the safe integer range', () => {
    const setup = makeSetup();
    setup.clubs[0].cash = Number.MAX_SAFE_INTEGER;
    setup.clubs[0].sponsorMonthlyFee = 1;
    setup.clubs[0].weeklyWages = 0;
    const initial = createCareer(setup);

    expect(() => advanceWeek({ ...initial, week: 4 })).toThrow(
      'club cash balance exceeds the safe integer range',
    );
  });

  it('rejects a training point balance that exceeds the safe integer range', () => {
    const setup = makeSetup();
    setup.startingTrainingPoints = Number.MAX_SAFE_INTEGER;
    const matchday = advanceWeek({ ...createCareer(setup), week: 5 });

    expect(() => completeMatchday(matchday, allDraws(matchday))).toThrow(
      'training point balance exceeds the safe integer range',
    );
  });

  it('rejects an earned training point goal bonus that exceeds the safe integer range', () => {
    const matchday = advanceWeek({ ...createCareer(makeSetup()), week: 5 });
    const results = allDraws(matchday);
    const userFixture = fixturesForCurrentWeek(matchday).find(
      fixture =>
        fixture.homeClubId === matchday.userClubId || fixture.awayClubId === matchday.userClubId,
    );
    expect(userFixture).toBeDefined();
    if (userFixture === undefined) throw new Error('expected a user fixture');
    const extremeResults = results.map(result =>
      result.fixtureId === userFixture.id
        ? {
            ...result,
            homeGoals:
              userFixture.homeClubId === matchday.userClubId
                ? Number.MAX_SAFE_INTEGER
                : result.homeGoals,
            awayGoals:
              userFixture.awayClubId === matchday.userClubId
                ? Number.MAX_SAFE_INTEGER
                : result.awayGoals,
          }
        : result,
    );

    expect(() => completeMatchday(matchday, extremeResults)).toThrow(
      'match training point goal bonus exceeds the safe integer range',
    );
  });

  it('rolls Season 1 into a deterministic Season 2 and completes the M1 slice', () => {
    const seasonOneEnd = finishSeason(createCareer(makeSetup()));

    expect(seasonOneEnd.season).toBe(1);
    expect(seasonOneEnd.week).toBe(30);
    expect(seasonOneEnd.phase).toBe('season-end');
    expect(seasonOneEnd.fixtures).toHaveLength(90);
    expect(seasonOneEnd.ledgers.at(-1)?.lines.map(line => line.kind)).toEqual([
      'prize',
      'wages',
      'subsidy',
    ]);

    const seasonTwo = startNextSeason(seasonOneEnd);
    const sameSeasonTwo = startNextSeason(finishSeason(createCareer(makeSetup())));
    expect(seasonTwo.season).toBe(2);
    expect(seasonTwo.week).toBe(1);
    expect(seasonTwo.phase).toBe('manage');
    expect(seasonTwo.fixtures).toHaveLength(180);
    expect(JSON.stringify(seasonTwo.fixtures.slice(90))).toBe(
      JSON.stringify(sameSeasonTwo.fixtures.slice(90)),
    );

    const completed = finishSeason(seasonTwo);
    expect(completed.season).toBe(2);
    expect(completed.week).toBe(30);
    expect(completed.phase).toBe('complete');
    expect(completed.ledgers).toHaveLength(60);
    expect(completed.ledgers.at(-1)?.lines.map(line => line.kind)).toEqual([
      'prize',
      'wages',
    ]);
    expect(() => startNextSeason(completed)).toThrow('season-end phase');
  });

  it('only starts a new season from the season-end boundary', () => {
    expect(() => startNextSeason(createCareer(makeSetup()))).toThrow('season-end phase');
  });
});

describe('league standings', () => {
  it('uses 3/1/0 points and sorts by points, goal difference, goals for, then ASCII ID', () => {
    const state = createCareer(makeSetup());
    const fixtures: LeagueFixture[] = [
      playedFixture('one', 'club-00', 'club-01', 2, 0),
      playedFixture('two', 'club-02', 'club-03', 3, 1),
      playedFixture('three', 'club-04', 'club-05', 2, 0),
      playedFixture('four', 'club-06', 'club-07', 1, 1),
    ];

    const standings = leagueStandings({ ...state, fixtures });

    expect(standings.slice(0, 3).map(row => row.clubId)).toEqual([
      'club-02',
      'club-00',
      'club-04',
    ]);
    expect(standings.slice(0, 3).map(row => row.position)).toEqual([1, 2, 3]);
    expect(standings.find(row => row.clubId === 'club-02')).toEqual({
      clubId: 'club-02',
      position: 1,
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 3,
      goalsAgainst: 1,
      goalDifference: 2,
      points: 3,
    });
    expect(standings.find(row => row.clubId === 'club-06')?.points).toBe(1);
    expect(standings.find(row => row.clubId === 'club-07')?.drawn).toBe(1);
  });

  it('rejects cumulative standing totals that exceed the safe integer range', () => {
    const state = createCareer(makeSetup());
    const fixtures: LeagueFixture[] = [
      playedFixture('one', 'club-00', 'club-01', Number.MAX_SAFE_INTEGER, 0),
      playedFixture('two', 'club-00', 'club-02', 1, 0),
    ];

    expect(() => leagueStandings({ ...state, fixtures })).toThrow(
      'club-00 goals for exceeds the safe integer range',
    );
  });
});

function playedFixture(
  id: string,
  homeClubId: string,
  awayClubId: string,
  homeGoals: number,
  awayGoals: number,
): LeagueFixture {
  return {
    id,
    season: 1,
    round: 1,
    week: 5,
    homeClubId,
    awayClubId,
    matchSeed: 1,
    status: 'played',
    score: { homeGoals, awayGoals },
  };
}
