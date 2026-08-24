import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  buildCareerFacility,
  buildCareerTeamDef,
  buildTrainingGround,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
  CREATED_PLAYER_ROOKIE_WAGE,
  createCareer,
  releaseCareerPlayer,
  renewCareerPlayer,
  resolvePostMatchAwakening,
  startNextSeason,
  trainPlayerInstantly,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { seasonEndViewModel } from '../view-models';

describe('default two-season career journey', () => {
  it('reaches Season 2 after the shipped facility/training path and either contract choice', () => {
    const content = loadLaunchContent();
    const sprint = content.training.focusDrills.find(
      (drill) => drill.id === 'sprints',
    )!;
    let state = beginStoryOnboarding(
      createCareer(createLaunchCareerSetup(24680)),
    );
    state = addCreatedPlayer(state, {
      name: 'Jo Rook',
      ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
    });
    state = buildTrainingGround(state);
    state = playToSeasonBoundary(state, sprint.id);

    const userClub = state.clubs.find((club) => club.id === state.userClubId)!;
    const expired = state.players.filter(
      (player) =>
        player.clubId === state.userClubId &&
        player.contractSeasonsRemaining === 0,
    );
    expect(state.phase).toBe('season-end');
    expect(userClub.cash).toBeGreaterThanOrEqual(0);
    expect(expired.map((player) => player.id)).toEqual([
      'bramble-rovers-created-player',
    ]);
    expect(seasonEndViewModel(state, content, 1).canContinue).toBe(false);

    const renewed = renewCareerPlayer(state, expired[0].id, 4, 1);
    expect(
      renewed.clubs.find((club) => club.id === state.userClubId)?.cash,
    ).toBe(userClub.cash);
    expect(
      renewed.players.find((player) => player.id === expired[0].id)?.weeklyWage,
    ).toBe(CREATED_PLAYER_ROOKIE_WAGE * 4);
    expect(seasonEndViewModel(renewed, content, 1).canContinue).toBe(true);
    const seasonTwo = startNextSeason(renewed);
    expect(seasonTwo).toMatchObject({ season: 2, week: 1, phase: 'manage' });
    expect(playToSeasonBoundary(seasonTwo)).toMatchObject({
      season: 2,
      phase: 'season-end',
    });

    const released = releaseCareerPlayer(state, expired[0].id);
    expect(released.players.some((player) => player.id === expired[0].id)).toBe(
      false,
    );
    expect(() =>
      buildCareerTeamDef(released, released.userClubId),
    ).not.toThrow();
    expect(seasonEndViewModel(released, content, 1).canContinue).toBe(true);
    expect(startNextSeason(released)).toMatchObject({
      season: 2,
      week: 1,
      phase: 'manage',
    });
  });

  it('keeps the shipped weekly training plan deterministic for all 60 weeks', () => {
    const first = runTwoSeasonTrainingJourney();
    const second = runTwoSeasonTrainingJourney();

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.ledgers).toHaveLength(60);
    // Ledger `kind: 'training'` lines only ever recorded a per-trainee training
    // MONEY charge, which is always 0 now — the ledger line can never fire, so
    // the old "at least one training-charge week across the season" and "never
    // more than one per week" assertions no longer measure anything real.
    // With Tier 1 at +3 for 7 TP, this deterministic 60-week plan ends at PAC
    // 287. Sprints affects only PAC, so STA stays at the creation value. The
    // figure was 304 until the pre-Green Bull drill exploit was closed, which
    // removed the extra sessions that ran before the trip.
    expect(
      first.players.find(
        (player) => player.id === 'bramble-rovers-created-player',
      )?.attrs,
    ).toMatchObject({ pac: 304, sta: 50 });
  });

  it('spends cash and TP safely through Season 2 Week 12', () => {
    const builds = [
      ['shooting-range', { x: 2, y: 0 }],
      ['dorm', { x: 3, y: 0 }],
      ['fan-shop', { x: 4, y: 0 }],
      ['stadium-stand', { x: 5, y: 0 }],
      ['gym', { x: 3, y: 1 }],
    ] as const;
    let state = beginStoryOnboarding(
      createCareer(createLaunchCareerSetup(314159)),
    );
    state = addCreatedPlayer(state, {
      name: 'Jo Rook',
      ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
    });
    state = buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;
    let nextBuild = 0;
    let drillsRun = 0;

    while (state.season < 2 || state.week <= 12) {
      if (state.phase === 'season-end') {
        const expired = state.players.find(
          (player) =>
            player.clubId === state.userClubId &&
            player.contractSeasonsRemaining === 0,
        );
        if (expired === undefined)
          throw new Error('expected the created player renewal');
        state = startNextSeason(renewCareerPlayer(state, expired.id, 4, 1));
        continue;
      }

      if (
        state.facilities.grid?.construction === undefined &&
        nextBuild < builds.length
      ) {
        const [type, position] = builds[nextBuild];
        state = buildCareerFacility(state, type, position).state;
        nextBuild += 1;
      }
      const hero = state.players.find(
        (player) => player.id === 'bramble-rovers-created-player',
      );
      if (
        hero !== undefined &&
        hero.injuryWeeks === 0 &&
        (hero.awayWeeks ?? 0) === 0 &&
        state.trainingPoints >= 7
      ) {
        const pathId = drillsRun % 2 === 0 ? 'finishing' : 'sprints';
        state = trainPlayerInstantly(state, hero.id, pathId).state;
        drillsRun += 1;
      }
      state = playJourneyWeek(state);
    }

    const hero = state.players.find(
      (player) => player.id === 'bramble-rovers-created-player',
    );
    expect(state).toMatchObject({ season: 2, week: 13, phase: 'manage' });
    expect(state.ledgers).toHaveLength(42);
    expect(state.facilities.grid).toMatchObject({
      construction: undefined,
      buildings: expect.arrayContaining([
        expect.objectContaining({ type: 'training-pitch' }),
        ...builds.map(([type]) => expect.objectContaining({ type })),
      ]),
    });
    expect(
      state.cashTransactions
        ?.filter((transaction) => transaction.kind === 'facility-build')
        .reduce((total, transaction) => total + transaction.amount, 0),
    ).toBe(-43_500);
    expect(drillsRun).toBeGreaterThan(0);
    expect(hero?.attrs).toMatchObject({
      pac: expect.any(Number),
      sho: expect.any(Number),
    });
    expect(hero!.attrs.pac).toBeGreaterThan(50);
    expect(hero!.attrs.sho).toBeGreaterThan(50);
    expect(state.trainingPoints).toBeGreaterThanOrEqual(0);
  });
});

describe('full-career retirement boundary', () => {
  it('does not ask a player who completed their announced final season to renew', () => {
    const content = loadLaunchContent();
    const initial = createCareer(
      createLaunchCareerSetup(24_681, undefined, content),
    );
    const retiringPlayerId = initial.players.find(
      (player) => player.clubId === initial.userClubId,
    )!.id;
    const seasonEnd: GameState = {
      ...initial,
      phase: 'season-end',
      players: initial.players.map((player) =>
        player.id === retiringPlayerId
          ? {
              ...player,
              contractSeasonsRemaining: 0,
              retirementAnnounced: true,
            }
          : player,
      ),
    };

    const viewModel = seasonEndViewModel(seasonEnd, content, 1);
    expect(viewModel.canContinue).toBe(true);
    expect(viewModel.expiredContract).toBeUndefined();
  });
});

describe('season review story', () => {
  it.each([
    [
      'unbeaten double',
      { finalPosition: 1, won: 16, drawn: 2, lost: 0, cup: true },
      'Unbeaten league and Cup double',
    ],
    [
      'double',
      { finalPosition: 1, won: 14, drawn: 1, lost: 3, cup: true },
      'League and Cup double',
    ],
    [
      'perfect title',
      { finalPosition: 1, won: 18, drawn: 0, lost: 0, cup: false },
      'Perfect league season',
    ],
    [
      'unbeaten title',
      { finalPosition: 1, won: 15, drawn: 3, lost: 0, cup: false },
      'Unbeaten league champions',
    ],
    [
      'league title',
      { finalPosition: 1, won: 13, drawn: 2, lost: 3, cup: false },
      'League champions',
    ],
    [
      'Cup before promotion',
      { finalPosition: 2, won: 12, drawn: 3, lost: 3, cup: true },
      'Cup winners',
    ],
    [
      'promotion',
      { finalPosition: 2, won: 12, drawn: 3, lost: 3, cup: false },
      'The climb continues.',
    ],
  ])('ranks %s above a routine authored event', (_name, result, expected) => {
    const content = loadLaunchContent();
    const initial = createCareer(
      createLaunchCareerSetup(24_685, undefined, content),
    );
    const state: GameState = {
      ...initial,
      phase: 'season-end',
      seasonRecaps: [
        {
          season: initial.season,
          division: 5,
          finalPosition: result.finalPosition,
          played: 18,
          won: result.won,
          drawn: result.drawn,
          lost: result.lost,
          goalsFor: 42,
          goalsAgainst: 16,
          cashChange: 0,
          closingCash: 100_000,
          trainingCapsReached: 0,
          cupResult: result.cup ? 'Winners' : 'Round 1',
          ...(result.cup ? { cupResultKey: 'recap.cupWinners' } : {}),
          memorableEventId: content.events.events[0]!.id,
        },
      ],
    };

    expect(
      seasonEndViewModel(state, content, 1).recap?.memorableEventTitle,
    ).toBe(expected);
  });

  it('recognizes the authored English Cup fallback only when the old key is absent', () => {
    const content = loadLaunchContent();
    const initial = createCareer(
      createLaunchCareerSetup(24_686, undefined, content),
    );
    const state: GameState = {
      ...initial,
      phase: 'season-end',
      seasonRecaps: [
        {
          season: initial.season,
          division: 1,
          finalPosition: 3,
          played: 18,
          won: 10,
          drawn: 4,
          lost: 4,
          goalsFor: 32,
          goalsAgainst: 22,
          cashChange: 0,
          closingCash: 100_000,
          trainingCapsReached: 0,
          cupResult: 'Winners',
        },
      ],
    };

    expect(
      seasonEndViewModel(state, content, 1).recap?.memorableEventTitle,
    ).toBe('Cup winners');
  });

  it('calls out a perfect league season when no event story exists', () => {
    const content = loadLaunchContent();
    const initial = createCareer(
      createLaunchCareerSetup(24_683, undefined, content),
    );
    const state: GameState = {
      ...initial,
      phase: 'season-end',
      seasonRecaps: [
        {
          season: initial.season,
          division: 5,
          finalPosition: 1,
          played: 18,
          won: 18,
          drawn: 0,
          lost: 0,
          goalsFor: 54,
          goalsAgainst: 0,
          cashChange: 0,
          closingCash: 100_000,
          trainingCapsReached: 0,
          cupResult: 'Champions',
        },
      ],
    };

    expect(
      seasonEndViewModel(state, content, 1).recap?.memorableEventTitle,
    ).toBe('Perfect league season');
  });

  it('calls out a league title even when the champion lost a match', () => {
    const content = loadLaunchContent();
    const initial = createCareer(
      createLaunchCareerSetup(24_684, undefined, content),
    );
    const state: GameState = {
      ...initial,
      phase: 'season-end',
      seasonRecaps: [
        {
          season: initial.season,
          division: 5,
          finalPosition: 1,
          played: 18,
          won: 14,
          drawn: 1,
          lost: 3,
          goalsFor: 42,
          goalsAgainst: 16,
          cashChange: 0,
          closingCash: 100_000,
          trainingCapsReached: 0,
          cupResult: 'Round 1',
        },
      ],
    };

    expect(
      seasonEndViewModel(state, content, 1).recap?.memorableEventTitle,
    ).toBe('League champions');
  });
});

describe('promotion reward presentation', () => {
  it('shows newly earned permanent systems once on the season review', () => {
    const content = loadLaunchContent();
    const initial = createCareer(
      createLaunchCareerSetup(24_682, undefined, content),
    );
    const promoted: GameState = {
      ...initial,
      phase: 'season-end',
      fixtures: initial.fixtures.map((fixture) => ({
        ...fixture,
        status: 'played' as const,
        score:
          fixture.homeClubId === initial.userClubId
            ? { homeGoals: 3, awayGoals: 0 }
            : fixture.awayClubId === initial.userClubId
              ? { homeGoals: 0, awayGoals: 3 }
              : { homeGoals: 0, awayGoals: 0 },
      })),
    };

    expect(
      seasonEndViewModel(promoted, content, 1).promotionRewards,
    ).toMatchObject({
      divisionLabel: 'D4 · County League',
      items: [
        {
          title: 'Recruitment fund · $15,000',
          detail:
            'The board added $15,000 to club funds. Use it to recruit a player who can help the club survive the County League.',
        },
        // Promotion puts the next drill tier on sale, one path at a time. It
        // does not hand it over, so this line names a price.
        { title: 'Tier 2 drills · $5,000 each' },
        // No 'Level 2 facilities': it is available from D5, so promoting to D4
        // must not present it as newly earned.
        { title: 'International scouting' },
        { title: 'Level 2 coaches' },
      ],
    });

    const previouslyEarned = {
      ...promoted,
      m2: { ...promoted.m2!, highestDivisionReached: 4 as const },
    };
    expect(
      seasonEndViewModel(previouslyEarned, content, 1).promotionRewards,
    ).toBeUndefined();
  });
});

function runTwoSeasonTrainingJourney(): GameState {
  const content = loadLaunchContent();
  const sprint = content.training.focusDrills.find(
    (drill) => drill.id === 'sprints',
  )!;
  let state = beginStoryOnboarding(
    createCareer(createLaunchCareerSetup(314159)),
  );
  state = addCreatedPlayer(state, {
    name: 'Jo Rook',
    ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
  });
  state = buildTrainingGround(state);
  state = playToSeasonBoundary(state, sprint.id);
  const expired = state.players.find(
    (player) =>
      player.clubId === state.userClubId &&
      player.contractSeasonsRemaining === 0,
  );
  if (expired === undefined)
    throw new Error('expected the created player renewal');
  state = startNextSeason(renewCareerPlayer(state, expired.id, 4, 1));
  return playToSeasonBoundary(state, sprint.id);
}

function playToSeasonBoundary(
  initial: GameState,
  weeklyDrillPathId?: string,
): GameState {
  let state = initial;
  while (state.phase !== 'season-end') {
    // The shipped journey taps the created player's drill once per manage
    // week, the instant-training equivalent of the old repeating plan.
    if (weeklyDrillPathId !== undefined && state.phase === 'manage') {
      const hero = state.players.find(
        (player) => player.id === 'bramble-rovers-created-player',
      );
      if (
        hero !== undefined &&
        hero.injuryWeeks === 0 &&
        state.trainingPoints >= 15
      ) {
        state = trainPlayerInstantly(state, hero.id, weeklyDrillPathId).state;
      }
    }
    state = playJourneyWeek(state);
  }
  return state;
}

function playJourneyWeek(initial: GameState): GameState {
  let state = advanceWeek(initial);
  if (state.phase !== 'matchday') return state;
  const firstFixtureId = state.onboarding?.firstFixtureId;
  // A legacy save can still present a second matchday after a league fixture.
  while (state.phase === 'matchday') {
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined)
      throw new Error('journey lost its active matchday');
    state = completeMatchday(
      state,
      matchday.fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        homeGoals: 1,
        awayGoals: 1,
      })),
    );
  }
  if (
    state.onboarding?.stage === 'first-match' &&
    firstFixtureId !== undefined
  ) {
    state = completeFirstOnboardingMatch(state, firstFixtureId);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    state = completePostMatchAwakening(
      resolvePostMatchAwakening(
        state,
        firstFixtureId,
        lineup.playerIds,
        ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'],
        ['glowing-caterpillar'],
        {
          weeklyChanceStepPercent: 5,
          maxPerSeason: 1,
          minimumMatchesBetween: 3,
        },
      ).state,
    );
  }
  return state;
}
