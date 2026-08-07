import {
  CUP_SETTLEMENT_WEEKS,
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
  leagueStandings,
  startNextSeason,
} from '../career';
import { matchdayVarianceRoll } from '../finance-variance';
import { BASE_WEEKLY_TRAINING_POINTS } from '../facilities';
import { SEASON_WEEKS } from '../types';
import type {
  CareerPlayer,
  CareerSetup,
  FixtureResult,
  GameState,
  LeagueFixture,
} from '../types';
import { createLaunchCareerSetup } from '../../application/launch';
import { earnedCareerMilestoneFlags, recordCareerMilestones } from '../career-events';
import { FIRST_D4_PROMOTION_RECRUITMENT_FUND } from '../promotion-progression';
import { generateSeasonFixtures } from '../schedule';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { weeklySettlementAwardKeys } from '../weekly-settlement-awards';

/** The shape a career club's starting eleven must be able to field. */
const SQUAD_ROLES: readonly CareerPlayer['role'][] = [
  'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD',
];

/**
 * A synthetic ten-club division with a complete starting XI per club — the
 * minimum a career needs. Club `weeklyWages` is what settlement reads, so it
 * stays authoritative and the per-player wage is only there to be a legal
 * contract figure.
 */
function makeSetup(): CareerSetup {
  const clubIds = Array.from({ length: 10 }, (_, index) => `club-${String(index).padStart(2, '0')}`);
  return {
    seed: 123456789,
    userClubId: 'club-00',
    startingTrainingPoints: 7,
    clubs: clubIds.map((id, index) => ({
      id,
      name: `Club ${index}`,
      cash: index === 0 ? 25000 : 10000,
      fans: 500,
      ticketPrice: 4,
      sponsorMonthlyFee: 2000,
      weeklyWages: 3200,
    })),
    players: clubIds.flatMap(clubId => SQUAD_ROLES.map((role, playerIndex) => ({
      id: `${clubId}-p${String(playerIndex).padStart(2, '0')}`,
      clubId,
      name: `${clubId} Player ${playerIndex}`,
      role,
      attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: role === 'GK' ? 55 : 20 },
      licensed: false,
      weeklyWage: 200,
      onHeroWage: false,
      contractSeasonsRemaining: 3,
      morale: 50,
      injuryWeeks: 0,
      age: 24,
      condition: 100,
    }))),
    lineups: clubIds.map(clubId => ({
      clubId,
      playerIds: SQUAD_ROLES.map((_role, playerIndex) => (
        `${clubId}-p${String(playerIndex).padStart(2, '0')}`
      )),
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

/** Draws every fixture, league or Hero Cup, to the season-end boundary. */
function finishSeason(initialState: GameState): GameState {
  let state = initialState;

  while (state.phase !== 'season-end') {
    if (state.phase === 'manage') {
      state = advanceWeek(state);
      continue;
    }
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined) throw new Error('career test lost its active matchday');
    state = completeMatchday(state, matchday.fixtures.map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: 0,
      awayGoals: 0,
    })));
  }

  return state;
}

function finishPromotedFullSeason(initialState: GameState): GameState {
  let state = initialState;

  while (state.phase !== 'season-end') {
    if (state.phase === 'manage') {
      state = advanceWeek(state);
      continue;
    }
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined) throw new Error('full-career test lost its active matchday');
    const userIsHome = matchday.fixture.homeClubId === state.userClubId;
    state = completeMatchday(state, matchday.fixtures.map(fixture => {
      if (fixture.id !== matchday.fixture.id) {
        return { fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 };
      }
      if (matchday.kind === 'national-cup') {
        return {
          fixtureId: fixture.id,
          homeGoals: userIsHome ? 0 : 1,
          awayGoals: userIsHome ? 1 : 0,
        };
      }
      return {
        fixtureId: fixture.id,
        homeGoals: userIsHome ? 3 : 0,
        awayGoals: userIsHome ? 0 : 3,
      };
    }));
  }

  return state;
}

describe('career season workflow', () => {
  it('pays and persists the County League recruitment fund only on the first D5 promotion', () => {
    const initial = createCareer(createLaunchCareerSetup(
      20260723,
      undefined,
      undefined,
    ));
    const withCash = {
      ...initial,
      clubs: initial.clubs.map(club => club.id === initial.userClubId
        ? { ...club, cash: 1_000_000 }
        : club),
      seasonOpeningCash: 1_000_000,
    };
    const firstPromotion = finishPromotedFullSeason(withCash);
    const repeatPromotion = finishPromotedFullSeason({
      ...withCash,
      m2: { ...withCash.m2!, highestDivisionReached: 4 as const },
    });
    const fundLine = {
      kind: 'subsidy',
      label: 'County League recruitment fund',
      amount: FIRST_D4_PROMOTION_RECRUITMENT_FUND,
      idempotencyKey: weeklySettlementAwardKeys.recruitmentFund(firstPromotion.userClubId),
    };
    // `objectContaining`, because the line also carries the catalog key it
    // renders through. This assertion is about the money and the idempotency
    // key, not about the line having exactly four fields forever.
    const fundLineMatch = expect.objectContaining(fundLine);

    expect(firstPromotion.ledgers.at(-1)?.lines).toContainEqual(fundLineMatch);
    expect(firstPromotion.ledgers.flatMap(ledger => ledger.lines)
      .filter(line => line.label === fundLine.label)).toEqual([fundLineMatch]);
    expect(repeatPromotion.ledgers.flatMap(ledger => ledger.lines)
      .filter(line => line.label === fundLine.label)).toEqual([]);
    const firstCash = firstPromotion.clubs.find(club => club.id === firstPromotion.userClubId)!.cash;
    const repeatCash = repeatPromotion.clubs.find(club => club.id === repeatPromotion.userClubId)!.cash;
    expect(firstCash - repeatCash).toBe(FIRST_D4_PROMOTION_RECRUITMENT_FUND);

    const restored = parseStoredGameState(serializeGameState(firstPromotion));
    expect(restored.clubs.find(club => club.id === restored.userClubId)?.cash).toBe(firstCash);
    expect(restored.ledgers.at(-1)?.lines).toContainEqual(fundLineMatch);
  });

  it('adds supplied contributions to the persistent season stat lines', () => {
    let state = createCareer(createLaunchCareerSetup(909));
    while (state.phase !== 'matchday') state = advanceWeek(state);

    const fixtures = fixturesForCurrentWeek(state);
    const userFixture = fixtures.find(fixture =>
      fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId,
    )!;
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const scorerId = lineup.playerIds[1];
    const keeperId = lineup.playerIds[0];
    const userIsHome = userFixture.homeClubId === state.userClubId;
    const results = fixtures.map(fixture => fixture.id === userFixture.id
      ? {
          fixtureId: fixture.id,
          homeGoals: userIsHome ? 2 : 0,
          awayGoals: userIsHome ? 0 : 2,
          scorerPlayerIds: [scorerId, scorerId],
          contributions: [
            { playerId: scorerId, goals: 2, assists: 0, tacklesWon: 1, saves: 0, passesCompleted: 12 },
            { playerId: keeperId, goals: 0, assists: 0, tacklesWon: 0, saves: 4, passesCompleted: 6 },
          ],
        }
      : { fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 });

    const settled = completeMatchday(state, results);

    expect(settled.seasonStatLines).toContainEqual({
      season: 1,
      playerId: scorerId,
      clubId: state.userClubId,
      competition: 'league',
      goals: 2,
      assists: 0,
      tacklesWon: 1,
      saves: 0,
      passesCompleted: 12,
    });
    expect(settled.seasonStatLines).toContainEqual(
      expect.objectContaining({ playerId: keeperId, saves: 4 }),
    );
  });

  it('pauses a scheduled week at matchday, accepts every result, and settles it', () => {
    let state = createCareer(makeSetup());

    for (let week = 1; week <= 2; week += 1) {
      state = advanceWeek(state);
    }

    expect(state.week).toBe(3);
    expect(state.phase).toBe('manage');
    expect(state.ledgers).toHaveLength(2);
    expect(state.ledgers[1].lines.map(line => line.kind)).toEqual([
      'wages',
      'subsidy',
    ]);

    const beforeMatchday = state;
    state = advanceWeek(state);
    expect(state.week).toBe(3);
    expect(state.phase).toBe('matchday');
    expect(state.ledgers).toHaveLength(2);
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
    expect(settled.week).toBe(4);
    expect(settled.fixtures.filter(fixture => fixture.status === 'played')).toHaveLength(5);
    // Three weeks have settled by now, each banking the flat baseline.
    expect(settled.trainingPoints).toBe(7 + BASE_WEEKLY_TRAINING_POINTS * 3);
    // The $1,200 raw gate (500 fans x 60% x $4) takes week 3's seeded roll.
    const gateRoll = matchdayVarianceRoll(settled.careerSeed, 1, 3, 'league-gate');
    const gateAmount = Math.round(1200 * (100 + gateRoll.percent) / 100);
    expect(settled.ledgers.at(-1)?.lines).toEqual([
      expect.objectContaining({
        kind: 'tickets',
        label: 'League home gate',
        amount: gateAmount,
        reveal: {
          source: 'league-gate',
          base: gateAmount,
          variancePercent: gateRoll.percent,
          surge: gateRoll.surge,
          multiplierPercent: 100,
          facilityCount: 0,
        },
      }),
      expect.objectContaining({ kind: 'wages', label: 'Weekly wages', amount: -3200 }),
      expect.objectContaining({ kind: 'subsidy', label: 'Season 1 wage subsidy', amount: 1600 }),
    ]);
    expect(settled.clubs.find(club => club.id === state.userClubId)?.cash).toBe(20200 + gateAmount);
    expect(beforeMatchday.week).toBe(3);
  });

  it('rejects incomplete, duplicate, unknown, or invalid matchday results', () => {
    let state = createCareer(makeSetup());
    while (state.phase !== 'matchday') state = advanceWeek(state);

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
      expect.objectContaining({ kind: 'wages', label: 'Weekly wages', amount: -3200 }),
      expect.objectContaining({ kind: 'subsidy', label: 'Season 1 wage subsidy', amount: 1600 }),
    ]);

    // The season transition re-derives the wage bill from the post-aging
    // squad, so Season 2 is asserted on line composition: wages, no subsidy.
    const seasonOneEnd = finishSeason(createCareer(makeSetup()));
    const seasonTwoStart = startNextSeason(seasonOneEnd);
    const seasonTwoWeekTwo = advanceWeek(seasonTwoStart);
    expect(seasonTwoWeekTwo.ledgers.at(-1)?.lines.map(line => line.kind)).toEqual(['wages']);
  });

  it('rounds an odd Season 1 wage subsidy down to whole money', () => {
    const setup = makeSetup();
    setup.clubs[0].weeklyWages = 3201;

    const state = advanceWeek(createCareer(setup));
    const ledger = state.ledgers[0];
    const userCash = state.clubs.find(club => club.id === state.userClubId)?.cash;

    expect(ledger.lines).toEqual([
      expect.objectContaining({ kind: 'wages', label: 'Weekly wages', amount: -3201 }),
      expect.objectContaining({ kind: 'subsidy', label: 'Season 1 wage subsidy', amount: 1600 }),
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

    expect(() => advanceWeek({ ...initial, week: 4, fixtures: [] })).toThrow(
      'club cash balance exceeds the safe integer range',
    );
  });

  it('rejects ambient training points that exceed the safe integer range', () => {
    const setup = makeSetup();
    setup.startingTrainingPoints = Number.MAX_SAFE_INTEGER;
    const state = {
      ...createCareer(setup),
      facilities: { trainingGroundBuilt: true },
    };

    expect(() => advanceWeek(state)).toThrow(
      'weekly ambient training point balance exceeds the safe integer range',
    );
  });

  it('does not award training points for wins, draws, losses, or goals', () => {
    const matchday = advanceWeek({ ...createCareer(makeSetup()), week: 5 });
    const userFixture = fixturesForCurrentWeek(matchday).find(
      fixture =>
        fixture.homeClubId === matchday.userClubId || fixture.awayClubId === matchday.userClubId,
    );
    expect(userFixture).toBeDefined();
    if (userFixture === undefined) throw new Error('expected a user fixture');
    const results = allDraws(matchday).map(result => result.fixtureId === userFixture.id
      ? {
          ...result,
          homeGoals: userFixture.homeClubId === matchday.userClubId ? 8 : 0,
          awayGoals: userFixture.awayClubId === matchday.userClubId ? 8 : 0,
        }
      : result);

    // An 8-0 win banks the same flat weekly baseline a 0-0 would. The result
    // itself is worth no TP, which is what this test guards.
    expect(completeMatchday(matchday, results).trainingPoints)
      .toBe(matchday.trainingPoints + BASE_WEEKLY_TRAINING_POINTS);
  });

  it('rolls Season 1 into a deterministic Season 2', () => {
    const seasonOneEnd = finishSeason(createCareer(makeSetup()));

    expect(seasonOneEnd.season).toBe(1);
    expect(seasonOneEnd.week).toBe(30);
    expect(seasonOneEnd.phase).toBe('season-end');
    expect(seasonOneEnd.fixtures).toHaveLength(90);
    expect(seasonOneEnd.ledgers.at(-1)?.lines.map(line => line.kind)).toEqual([
      'prize',
      'subsidy',
      'wages',
      'subsidy',
    ]);

    const seasonTwo = startNextSeason(seasonOneEnd);
    const sameSeasonTwo = startNextSeason(finishSeason(createCareer(makeSetup())));
    expect(seasonTwo.season).toBe(2);
    expect(seasonTwo.week).toBe(1);
    expect(seasonTwo.phase).toBe('manage');
    // The transition replaces the fixture list with the new division's season
    // rather than appending to Season 1's.
    expect(seasonTwo.fixtures).toHaveLength(90);
    expect(JSON.stringify(seasonTwo.fixtures)).toBe(JSON.stringify(sameSeasonTwo.fixtures));

    const seasonTwoEnd = finishSeason(seasonTwo);
    expect(seasonTwoEnd.season).toBe(2);
    expect(seasonTwoEnd.week).toBe(30);
    expect(seasonTwoEnd.phase).toBe('season-end');
    expect(seasonTwoEnd.ledgers).toHaveLength(60);
  });

  it('only starts a new season from the season-end boundary', () => {
    expect(() => startNextSeason(createCareer(makeSetup()))).toThrow('season-end phase');
  });
});

describe('Hero Cup settlement calendar', () => {
  const career = createCareer(createLaunchCareerSetup(77));

  /** The weeks the production schedule fills with league fixtures in a season. */
  function leagueWeeks(season: number): Set<number> {
    return new Set(generateSeasonFixtures(
      career.clubs.map(club => club.id),
      season,
      career.careerSeed,
    ).map(fixture => fixture.week));
  }

  it('settles every round in a week the opening season leaves empty', () => {
    const opening = leagueWeeks(1);

    expect(CUP_SETTLEMENT_WEEKS.filter(week => opening.has(week))).toEqual([]);
  });

  it('keeps six ordered rounds clear of the opening weeks and the season-end week', () => {
    const weeks = [...CUP_SETTLEMENT_WEEKS];

    expect(weeks).toHaveLength(6);
    expect(new Set(weeks).size).toBe(6);
    expect(weeks).toEqual([...weeks].sort((left, right) => left - right));
    // Never before the league has kicked off, and the final stays late enough to
    // read as a final without colliding with the league finale in Week 30.
    expect(weeks[0]).toBeGreaterThan(2);
    expect(weeks[5]).toBe(SEASON_WEEKS - 1);
  });

  it('doubles up on only the two league weeks no six-week set can avoid', () => {
    const opening = leagueWeeks(1);
    const standard = leagueWeeks(2);
    const freeInEverySeason = Array.from({ length: SEASON_WEEKS }, (_week, index) => index + 1)
      .filter(week => !opening.has(week) && !standard.has(week));

    // Season 2 onward opens a fortnight later than season 1, so only these weeks
    // are empty in both calendars: six rounds cannot all avoid a league week
    // everywhere. The two that do share a week are the documented minimum.
    // Week 30 is not among them — it holds the league finale in every season.
    expect(freeInEverySeason).toEqual([1, 2, 12, 24, 27, 28, 29]);
    expect(CUP_SETTLEMENT_WEEKS.filter(week => standard.has(week))).toEqual([6, 18]);
  });
});

describe('career milestones recorded at settlement', () => {
  /** Wins the user's match 3-0 and draws the rest of the division. */
  function winUserMatch(state: GameState): GameState {
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined) throw new Error('milestone test lost its active matchday');
    const userIsHome = matchday.fixture.homeClubId === state.userClubId;
    const scorerId = state.lineups
      .find(lineup => lineup.clubId === state.userClubId)!.playerIds.at(-1)!;

    return completeMatchday(state, matchday.fixtures.map(fixture => (
      fixture.id === matchday.fixture.id
        ? {
            fixtureId: fixture.id,
            homeGoals: userIsHome ? 3 : 0,
            awayGoals: userIsHome ? 0 : 3,
            scorerPlayerIds: [scorerId, scorerId, scorerId],
          }
        : { fixtureId: fixture.id, homeGoals: 0, awayGoals: 0 }
    )));
  }

  it('banks the flags the settled week earned instead of waiting for a story', () => {
    let state = createCareer(createLaunchCareerSetup(4242));
    while (state.phase !== 'matchday') state = advanceWeek(state);

    expect(state.eventFlags).toEqual([]);

    const settled = winUserMatch(state);

    // The fixture is won 3-0 with all three scored by one player, so the only
    // milestone it earns is the hat-trick — banked here because the scorer list
    // does not survive the week.
    expect(settled.eventFlags).toEqual(['milestone:hat-trick']);
    expect(settled.pendingMilestones).toEqual([
      { eventId: 'milestone-hat-trick', selectedPlayerId: expect.any(String) },
    ]);
  });

  it('records each milestone exactly once over a run of weeks', () => {
    const fresh = createCareer(createLaunchCareerSetup(4242));
    let state = fresh;

    while (state.week <= 20 && state.phase !== 'season-end') {
      state = state.phase === 'manage' ? advanceWeek(state) : winUserMatch(state);
      if (state.phase === 'matchday') continue;
      // What the club has passed and what the save records never drift apart.
      // Only the milestone ledger: the save also carries engine facts with no
      // recognition story behind them, such as the first crowd it ever won.
      expect([...state.eventFlags].filter(flag => flag.startsWith('milestone:')).sort())
        .toEqual([...earnedCareerMilestoneFlags(state)].sort());
    }

    expect(state.eventFlags.length).toBeGreaterThanOrEqual(3);
    for (const flag of new Set(state.eventFlags)) {
      expect(state.eventFlags.filter(recorded => recorded === flag)).toEqual([flag]);
    }
    // Re-recording is a no-op, so a later settlement cannot award a second time.
    expect(recordCareerMilestones(state)).toBe(state);

    // The same seed started again has earned nothing: flags come from results.
    const restarted = createCareer(createLaunchCareerSetup(4242));
    expect(restarted.eventFlags).toEqual([]);
    expect(earnedCareerMilestoneFlags(restarted)).toEqual([]);
    expect(fresh.eventFlags).toEqual([]);
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
