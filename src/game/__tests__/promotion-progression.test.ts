import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { enableFullCareer } from '../full-career';
import {
  highestDivisionReached,
  maxCareerFacilityLevel,
  promotionRewardsForDivision,
} from '../promotion-progression';
import { careerHeroLimit } from '../squad';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';

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
    expect(promotionRewardsForDivision(4).map(reward => reward.title)).toEqual([
      'Recruitment fund · $15,000',
      'International scouting',
      'Level 2 coaches',
    ]);
    expect(promotionRewardsForDivision(3).map(reward => reward.title)).toContain('Third Hero License');
    expect(promotionRewardsForDivision(2).map(reward => reward.title)).toContain('Elite Prospect scouting');
    expect(promotionRewardsForDivision(1).map(reward => reward.title)).toContain('Fourth Hero License');
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
    expect(parseStoredGameState(serializeGameState(earned)).m2?.highestDivisionReached).toBe(3);
  });
});
