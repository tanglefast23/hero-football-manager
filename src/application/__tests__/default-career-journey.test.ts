import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  advanceWeek,
  applyCareerTraining,
  beginStoryOnboarding,
  buildCareerTeamDef,
  buildTrainingGround,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
  createCareer,
  fixturesForCurrentWeek,
  releaseCareerPlayer,
  renewCareerPlayer,
  resolvePostMatchAwakening,
  startNextSeason,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { seasonEndViewModel } from '../view-models';

describe('default two-season career journey', () => {
  it('reaches Season 2 after the shipped facility/training path and either contract choice', () => {
    const content = loadLaunchContent();
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    let state = beginStoryOnboarding(createCareer(createLaunchCareerSetup(24680)));
    state = addCreatedPlayer(state, {
      name: 'Jo Rook',
      ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
    });
    state = buildTrainingGround(state);
    state = applyCareerTraining(state, ['bramble-rovers-created-player'], [sprint]);
    state = playToSeasonBoundary(state);

    const userClub = state.clubs.find(club => club.id === state.userClubId)!;
    const expired = state.players.filter(player =>
      player.clubId === state.userClubId && player.contractSeasonsRemaining === 0,
    );
    expect(state.phase).toBe('season-end');
    expect(userClub.cash).toBeGreaterThanOrEqual(0);
    expect(expired.map(player => player.id)).toEqual(['bramble-rovers-created-player']);
    expect(seasonEndViewModel(state, content, 1).canContinue).toBe(false);

    const renewed = renewCareerPlayer(state, expired[0].id, 4, 1);
    expect(renewed.clubs.find(club => club.id === state.userClubId)?.cash).toBe(userClub.cash);
    expect(renewed.players.find(player => player.id === expired[0].id)?.weeklyWage).toBe(720);
    expect(seasonEndViewModel(renewed, content, 1).canContinue).toBe(true);
    const seasonTwo = startNextSeason(renewed);
    expect(seasonTwo).toMatchObject({ season: 2, week: 1, phase: 'manage' });
    expect(playToSeasonBoundary(seasonTwo)).toMatchObject({ season: 2, phase: 'complete' });

    const released = releaseCareerPlayer(state, expired[0].id);
    expect(released.players.some(player => player.id === expired[0].id)).toBe(false);
    expect(() => buildCareerTeamDef(released, released.userClubId)).not.toThrow();
    expect(seasonEndViewModel(released, content, 1).canContinue).toBe(true);
    expect(startNextSeason(released)).toMatchObject({ season: 2, week: 1, phase: 'manage' });
  });

  it('keeps the shipped weekly training plan deterministic for all 60 weeks', () => {
    const first = runTwoSeasonTrainingJourney();
    const second = runTwoSeasonTrainingJourney();

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.ledgers).toHaveLength(60);
    expect(first.trainingPlan).toMatchObject({
      assignedPlayerIds: ['bramble-rovers-created-player'],
      drills: [{ id: 'sprints' }],
    });
    expect(first.ledgers.every(ledger =>
      ledger.lines.filter(line => line.kind === 'training').length <= 1,
    )).toBe(true);
    expect(first.ledgers.filter(ledger =>
      ledger.lines.some(line => line.kind === 'training'),
    ).length).toBeGreaterThan(0);
    expect(first.players.find(player => player.id === 'bramble-rovers-created-player')?.attrs)
      .toMatchObject({ pac: 99, sta: 99 });
  });
});

describe('full-career retirement boundary', () => {
  it('does not ask a player who completed their announced final season to renew', () => {
    const content = loadLaunchContent();
    const initial = createCareer(createLaunchCareerSetup(24_681, undefined, content, 'full'));
    const retiringPlayerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const seasonEnd: GameState = {
      ...initial,
      phase: 'season-end',
      players: initial.players.map(player => player.id === retiringPlayerId
        ? {
            ...player,
            contractSeasonsRemaining: 0,
            retirementAnnounced: true,
          }
        : player),
    };

    const viewModel = seasonEndViewModel(seasonEnd, content, 1);
    expect(viewModel.canContinue).toBe(true);
    expect(viewModel.expiredContract).toBeUndefined();
  });
});

describe('promotion reward presentation', () => {
  it('shows newly earned permanent systems once on the season review', () => {
    const content = loadLaunchContent();
    const initial = createCareer(createLaunchCareerSetup(24_682, undefined, content, 'full'));
    const promoted: GameState = {
      ...initial,
      phase: 'season-end',
      fixtures: initial.fixtures.map(fixture => ({
        ...fixture,
        status: 'played' as const,
        score: fixture.homeClubId === initial.userClubId
          ? { homeGoals: 3, awayGoals: 0 }
          : fixture.awayClubId === initial.userClubId
            ? { homeGoals: 0, awayGoals: 3 }
            : { homeGoals: 0, awayGoals: 0 },
      })),
    };

    expect(seasonEndViewModel(promoted, content, 1).promotionRewards).toMatchObject({
      divisionLabel: 'D4 · County League',
      items: [
        { title: 'Level 2 facilities' },
        { title: 'International scouting' },
        { title: 'Level 2 coaches' },
      ],
    });

    const previouslyEarned = {
      ...promoted,
      m2: { ...promoted.m2!, highestDivisionReached: 4 as const },
    };
    expect(seasonEndViewModel(previouslyEarned, content, 1).promotionRewards).toBeUndefined();
  });
});

function runTwoSeasonTrainingJourney(): GameState {
  const content = loadLaunchContent();
  const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
  let state = beginStoryOnboarding(createCareer(createLaunchCareerSetup(314159)));
  state = addCreatedPlayer(state, {
    name: 'Jo Rook',
    ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
  });
  state = buildTrainingGround(state);
  state = applyCareerTraining(state, ['bramble-rovers-created-player'], [sprint]);
  state = playToSeasonBoundary(state);
  const expired = state.players.find(player =>
    player.clubId === state.userClubId && player.contractSeasonsRemaining === 0,
  );
  if (expired === undefined) throw new Error('expected the created player renewal');
  state = startNextSeason(renewCareerPlayer(state, expired.id, 4, 1));
  return playToSeasonBoundary(state);
}

function playToSeasonBoundary(initial: GameState): GameState {
  let state = initial;
  while (state.phase !== 'season-end' && state.phase !== 'complete') {
    state = advanceWeek(state);
    if (state.phase !== 'matchday') continue;
    const fixtures = fixturesForCurrentWeek(state);
    const firstFixtureId = state.onboarding?.firstFixtureId;
    state = completeMatchday(state, fixtures.map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: 1,
      awayGoals: 1,
    })));
    if (state.onboarding?.stage === 'first-match' && firstFixtureId !== undefined) {
      state = completeFirstOnboardingMatch(state, firstFixtureId);
      const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
      state = completePostMatchAwakening(resolvePostMatchAwakening(
        state,
        firstFixtureId,
        lineup.playerIds,
        ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'],
        ['glowing-caterpillar'],
        { chancePercent: 10, minimumMatchesBetween: 3 },
      ).state);
    }
  }
  return state;
}
