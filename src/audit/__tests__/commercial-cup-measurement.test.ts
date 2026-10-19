import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  buildCareerMatchTeamDef,
  buildCareerTeamDef,
  createCareer,
  greenBullTrainingOffer,
  midseasonTrainingCost,
  midseasonTrainingStatus,
  type ProductionFixtureResult,
} from '../../game';
import {
  CLUB_BUSINESS_LONG_CAREER_POLICY,
  longCareerMatchdayProduction,
  longCareerQuickPreferences,
  readPurchasingPower,
  readWeek19TripCharge,
} from '../club-business-long-career-harness';
import {
  manufactureExactGap,
  meanXiRating,
  measureCupGap,
  mirroredCupOpponent,
  scaleTeamAttributes,
} from '../cup-catchup-study';
import type { Role, TeamDef } from '../../sim/types';
import {
  productionArms,
  summarizeCommercialArm,
} from '../commercial-income-study';

function flatTeam(id: string, value: number): TeamDef {
  const roles: Role[] = [
    'GK',
    'DEF',
    'DEF',
    'DEF',
    'DEF',
    'MID',
    'MID',
    'MID',
    'MID',
    'FWD',
    'FWD',
  ];
  const attrs = {
    pac: value,
    sho: value,
    pas: value,
    def: value,
    tec: value,
    sta: value,
    ref: value,
  };
  return {
    id,
    name: id,
    players: roles.map((role, index) => ({
      id: `${id}-${index}`,
      name: `${id} ${index}`,
      role,
      attrs: { ...attrs },
    })),
  };
}

describe('commercial and Cup measurement policy', () => {
  test('refuses a result labelled with a different career seed', () => {
    const arm = productionArms(1)[0]!;
    const mismatched = {
      seed: arm.seed + 1,
      difficulty: arm.difficulty,
    } as Parameters<typeof summarizeCommercialArm>[0];
    expect(() => summarizeCommercialArm(mismatched, arm, 1)).toThrow(
      'does not match its seed and difficulty',
    );
  });

  const content = loadLaunchContent();
  const state = createCareer(
    createLaunchCareerSetup(20261019, undefined, content, 'COZY'),
  );

  test('the locked policy stays 4-4-2 with auto subs off', () => {
    expect(CLUB_BUSINESS_LONG_CAREER_POLICY.formation).toBe('4-4-2');
    expect(CLUB_BUSINESS_LONG_CAREER_POLICY.autoSubs).toBe(false);
    expect(longCareerQuickPreferences(state)).toEqual({
      initialFormation: '4-4-2',
      autoSubs: false,
    });
  });

  test('production Quick uses the saved formation, auto subs, and the Cup round', () => {
    const cupWeek = { ...state, week: 10 };
    const preferences = longCareerQuickPreferences(cupWeek, 'PRODUCTION_QUICK');
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    );
    expect(preferences.autoSubs).toBe(true);
    expect(preferences.initialFormation).toBe(lineup?.formation ?? '4-4-2');
    expect(preferences.cupRoundLabel).toBe('Play-in');
    expect(longCareerQuickPreferences(cupWeek).cupRoundLabel).toBeUndefined();
  });

  test('a locked Cup drops shootout squads and production Quick keeps them', () => {
    const production = {
      fixtureResult: { fixtureId: 'cup-1', homeGoals: 1, awayGoals: 1 },
      goals: [],
      participantPlayerIds: ['p1'],
      powerFiredPlayerIds: [],
      penaltyFullTime: {
        home: { takers: [], keeperId: 'home-keeper' },
        away: { takers: [], keeperId: 'away-keeper' },
      },
    } as ProductionFixtureResult;
    const locked = longCareerMatchdayProduction(
      'national-cup',
      'HARNESS_LOCKED',
      production,
    );
    expect(locked).not.toHaveProperty('penaltyFullTime');
    expect(locked.fixtureResult).toBe(production.fixtureResult);
    expect(locked.participantPlayerIds).toEqual(['p1']);
    expect(
      longCareerMatchdayProduction(
        'national-cup',
        'PRODUCTION_QUICK',
        production,
      ),
    ).toBe(production);
    expect(
      longCareerMatchdayProduction('league', 'HARNESS_LOCKED', production),
    ).toBe(production);
  });

  test('the catch-up mirror matches the match builder on a real Cup opponent', () => {
    const fixture = state
      .m2!.nationalCups.flatMap((cup) => cup.rounds)
      .flatMap((round) => round.fixtures)
      .find(
        (candidate) =>
          candidate.homeClubId === state.userClubId ||
          candidate.awayClubId === state.userClubId,
      );
    expect(fixture).toBeDefined();
    const opponentId =
      fixture!.homeClubId === state.userClubId
        ? fixture!.awayClubId
        : fixture!.homeClubId;
    const lineupIds = new Set(
      state.lineups.find((lineup) => lineup.clubId === state.userClubId)
        ?.playerIds,
    );
    const strong = {
      ...state,
      players: state.players.map((player) =>
        lineupIds.has(player.id)
          ? {
              ...player,
              attrs: {
                pac: 420,
                sho: 420,
                pas: 420,
                def: 420,
                tec: 420,
                sta: 420,
                ref: 420,
              },
            }
          : player,
      ),
    };
    const user = buildCareerTeamDef(strong, strong.userClubId);
    const opponent = buildCareerMatchTeamDef(strong, opponentId);
    expect(measureCupGap(user, opponent).attrGap).toBeGreaterThanOrEqual(10);
    expect(mirroredCupOpponent(user, opponent, 'Semi-final')).toEqual(
      buildCareerMatchTeamDef(strong, opponentId, 'Semi-final'),
    );
    expect(mirroredCupOpponent(user, opponent, 'Final')).toEqual(
      buildCareerMatchTeamDef(strong, opponentId, 'Final'),
    );
  });

  test('an exact gap search scales the opponent before the user', () => {
    const user = flatTeam('user', 80);
    const opponent = flatTeam('opponent', 80);
    expect(scaleTeamAttributes(user, 100)).toBe(user);
    const made = manufactureExactGap(user, opponent, 10);
    expect(made?.scale.side).toBe('opponent');
    expect(meanXiRating(made!.user) - meanXiRating(made!.opponent)).toBe(10);
  });

  test('Week 19 records the one-week cap and leaves the whole bank uncharged', () => {
    const week19 = { ...state, week: 19, trainingPoints: 200 };
    expect(midseasonTrainingStatus(week19)).toBe('prompt');
    expect(greenBullTrainingOffer(week19)).toBeUndefined();
    const charge = readWeek19TripCharge(week19);
    expect(charge.bankBefore).toBe(200);
    expect(charge.originalWholeBankCost).toBe(200);
    expect(charge.approvedCost).toBe(midseasonTrainingCost(week19));
    expect(charge.approvedCost).toBe(Math.min(200, charge.weeklyAmbient));
    expect(charge.preservedTrainingPoints).toBe(200 - charge.approvedCost);
    expect(week19.trainingPoints).toBe(200);
  });

  test('purchasing power starts at the Training Pitch build', () => {
    const power = readPurchasingPower(state, 5, 'BALANCED');
    expect(power.nextFacilityLabel).toBe('training-pitch build');
    expect(power.nextFacilityCost).toBe(8_000);
    expect(power.standCount).toBe(0);
    expect(power.shopCount).toBe(0);
    expect(power.constructionInProgress).toBe(false);
    expect(power.valuedStarters).toBeGreaterThan(0);
  });
});
