import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  buildCareerTeamDef,
  buildTrainingGround,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
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
    const sprint = content.training.focusDrills.find(drill => drill.id === 'sprints')!;
    let state = beginStoryOnboarding(createCareer(createLaunchCareerSetup(24680)));
    state = addCreatedPlayer(state, {
      name: 'Jo Rook',
      ratings: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50 },
    });
    state = buildTrainingGround(state);
    state = playToSeasonBoundary(state, sprint.id);

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
    expect(playToSeasonBoundary(seasonTwo)).toMatchObject({ season: 2, phase: 'season-end' });

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
    // Ledger `kind: 'training'` lines only ever recorded a per-trainee training
    // MONEY charge, which is always 0 now — the ledger line can never fire, so
    // the old "at least one training-charge week across the season" and "never
    // more than one per week" assertions no longer measure anything real.
    // D5 opens tier 1 (Sprints 1, +5 PAC) and the first promotion opens tier 2
    // (+8), scaled by age and the Gym/Training Pitch level, more on a SUPER
    // session. This lifted from 655 when the second rung moved from D2 to D4:
    // this journey promotes, so most of season two now trains on +8 instead of
    // +5. That is the point of the change — promotion should feel like a tier
    // change — and the economy rails and ramp probes still pass around it.
    // Cap-free training keeps raising the raw PAC value; Sprints trains only
    // PAC, so STA stays at the creation value.
    expect(first.players.find(player => player.id === 'bramble-rovers-created-player')?.attrs)
      .toMatchObject({ pac: 812, sta: 50 });
  });
});

describe('full-career retirement boundary', () => {
  it('does not ask a player who completed their announced final season to renew', () => {
    const content = loadLaunchContent();
    const initial = createCareer(createLaunchCareerSetup(24_681, undefined, content));
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
    const initial = createCareer(createLaunchCareerSetup(24_682, undefined, content));
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
        {
          title: 'Recruitment fund · $15,000',
          detail: 'The board added $15,000 to club funds. Use it to recruit a player who can help the club survive the County League.',
        },
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
  state = playToSeasonBoundary(state, sprint.id);
  const expired = state.players.find(player =>
    player.clubId === state.userClubId && player.contractSeasonsRemaining === 0,
  );
  if (expired === undefined) throw new Error('expected the created player renewal');
  state = startNextSeason(renewCareerPlayer(state, expired.id, 4, 1));
  return playToSeasonBoundary(state, sprint.id);
}

function playToSeasonBoundary(initial: GameState, weeklyDrillPathId?: string): GameState {
  let state = initial;
  while (state.phase !== 'season-end') {
    // The shipped journey taps the created player's drill once per manage
    // week, the instant-training equivalent of the old repeating plan.
    if (weeklyDrillPathId !== undefined && state.phase === 'manage') {
      const hero = state.players.find(player => player.id === 'bramble-rovers-created-player');
      if (hero !== undefined && hero.injuryWeeks === 0 && state.trainingPoints >= 15) {
        state = trainPlayerInstantly(state, hero.id, weeklyDrillPathId).state;
      }
    }
    state = advanceWeek(state);
    if (state.phase !== 'matchday') continue;
    const firstFixtureId = state.onboarding?.firstFixtureId;
    // A cup week presents a second matchday after the league fixture.
    while (state.phase === 'matchday') {
      const matchday = activeCareerMatchday(state);
      if (matchday === undefined) throw new Error('journey lost its active matchday');
      state = completeMatchday(state, matchday.fixtures.map(fixture => ({
        fixtureId: fixture.id,
        homeGoals: 1,
        awayGoals: 1,
      })));
    }
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
