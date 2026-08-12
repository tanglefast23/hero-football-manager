import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { enableFullCareer } from '../full-career';
import {
  highestDivisionReached,
  leaguePrizeMoney,
  maxCareerFacilityLevel,
  promotionRewardsForDivision,
} from '../promotion-progression';
import type { DivisionLevel } from '../pyramid';
import { careerHeroLimit } from '../squad';
import { resolveTrainingDrillForPath } from '../training-paths';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';

describe('permanent promotion progression', () => {
  test('starts at D5 and raises facility and Hero License ceilings from the best tier reached', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720));
    const reachedD4 = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 4 as const },
    };
    const reachedD3ThenRelegated = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 3 as const },
    };
    const reachedD2ThenRelegated = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 2 as const },
    };
    const reachedD1ThenRelegated = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 1 as const },
    };

    expect(highestDivisionReached(initial)).toBe(5);
    // Level 2 is reachable from the D5 start: it is the club's main training
    // accelerator, and gating it behind D4 gated it behind its own purpose.
    expect(maxCareerFacilityLevel(initial)).toBe(2);
    expect(maxCareerFacilityLevel(reachedD4)).toBe(2);
    expect(careerHeroLimit(reachedD4)).toBe(2);
    expect(highestDivisionReached(reachedD3ThenRelegated)).toBe(3);
    expect(careerHeroLimit(reachedD3ThenRelegated)).toBe(3);
    expect(maxCareerFacilityLevel(reachedD2ThenRelegated)).toBe(3);
    expect(careerHeroLimit(reachedD1ThenRelegated)).toBe(4);
  });

  test('defines one compact reward bundle for every promotion', () => {
    expect(promotionRewardsForDivision(5)).toEqual([]);
    // No 'Level 2 facilities' here: level 2 is available from D5, so the D4
    // promotion screen must not promise a reward the club already has.
    expect(
      promotionRewardsForDivision(4).map((reward) => reward.title),
    ).toEqual([
      'Recruitment fund · $15,000',
      'Tier 2 drills · $3,000 each',
      'International scouting',
      'Level 2 coaches',
    ]);
    expect(
      promotionRewardsForDivision(3).map((reward) => reward.title),
    ).toContain('Third Hero License');
    expect(
      promotionRewardsForDivision(2).map((reward) => reward.title),
    ).toContain('Elite Prospect scouting');
    expect(
      promotionRewardsForDivision(1).map((reward) => reward.title),
    ).toContain('Fourth Hero License');
    // Each promotion puts exactly one drill tier up for sale, never grants it.
    expect(
      promotionRewardsForDivision(3).map((reward) => reward.title),
    ).toContain('Tier 3 drills · $8,000 each');
    expect(
      promotionRewardsForDivision(2).map((reward) => reward.title),
    ).toContain('Tier 4 drills · $18,000 each');
    expect(
      promotionRewardsForDivision(1).map((reward) => reward.title),
    ).toContain('Tier 5 drills · $40,000 each');
  });

  test('pays a smaller season-end purse to every league position', () => {
    const expectedByDivision: Readonly<
      Record<DivisionLevel, readonly number[]>
    > = {
      5: [20_000, 10_000, 6_000, 5_000, 4_000, 3_000, 2_000, 1_500, 1_000, 500],
      4: [
        30_000, 15_000, 9_000, 7_000, 5_500, 4_500, 3_500, 2_500, 1_500, 1_000,
      ],
      3: [
        40_000, 20_000, 12_000, 10_000, 7_500, 6_000, 4_500, 3_000, 2_000,
        1_000,
      ],
      2: [
        50_000, 25_000, 15_000, 12_000, 9_500, 7_500, 5_500, 4_000, 2_500,
        1_500,
      ],
      1: [
        60_000, 30_000, 18_000, 14_500, 11_500, 9_000, 6_500, 5_000, 3_000,
        2_000,
      ],
    };

    for (const division of [5, 4, 3, 2, 1] as const) {
      expect(
        Array.from({ length: 10 }, (_, index) =>
          leaguePrizeMoney(division, index + 1),
        ),
      ).toEqual(expectedByDivision[division]);
    }
    expect(leaguePrizeMoney(5, 0)).toBe(0);
    expect(leaguePrizeMoney(1, 11)).toBe(0);
    expect(leaguePrizeMoney(3, 1.5)).toBe(0);
  });

  test('migrates old full-career saves and persists the earned tier', () => {
    const initial = createCareer(createLaunchCareerSetup(20260721));
    const { highestDivisionReached: _legacyMissing, ...legacyM2 } = initial.m2!;
    const reconciled = enableFullCareer({ ...initial, m2: legacyM2 });
    const earned = {
      ...reconciled,
      m2: { ...reconciled.m2!, highestDivisionReached: 3 as const },
    };

    expect(reconciled.m2?.highestDivisionReached).toBe(5);
    expect(
      parseStoredGameState(serializeGameState(earned)).m2
        ?.highestDivisionReached,
    ).toBe(3);
  });

  test('round-trips bought drill tiers and defaults a save that has none', () => {
    const initial = createCareer(createLaunchCareerSetup(20260724));
    const bought = { ...initial, ownedTrainingTiers: { sprints: 3, duels: 2 } };

    expect(
      parseStoredGameState(serializeGameState(bought)).ownedTrainingTiers,
    ).toEqual({ sprints: 3, duels: 2 });
    // Saves written before the purchase existed carry no record at all, and
    // load with every path back at the tier the career starts on.
    expect(
      parseStoredGameState(serializeGameState(initial)).ownedTrainingTiers,
    ).toBeUndefined();
    expect(
      resolveTrainingDrillForPath(
        parseStoredGameState(serializeGameState(initial)),
        'sprints',
      ).id,
    ).toBe('sprints');
  });
});
