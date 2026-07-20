import { MAX_FACILITY_LEVEL, type FacilityLevel } from './facilities';
import { currentUserDivision, type M2CareerState } from './m2-career';
import { divisionTierLabel, type DivisionLevel } from './pyramid';
import type { GameState } from './types';

export interface PromotionReward {
  readonly title: string;
  readonly detail: string;
}

const PROMOTION_REWARDS: Readonly<Record<1 | 2 | 3 | 4, readonly PromotionReward[]>> = {
  4: [
    {
      title: 'Level 2 facilities',
      detail: 'Every existing facility can now be upgraded to Level 2.',
    },
    {
      title: 'International scouting',
      detail: 'A second overseas brief is added to each scouting shortlist.',
    },
    {
      title: 'Level 2 coaches',
      detail: 'County-level coaches will take the call once the club has enough Fame.',
    },
  ],
  3: [
    {
      title: 'Rumored Hero scouting',
      detail: 'The scout can follow expensive leads for players who may already have powers.',
    },
    {
      title: 'Third Hero License',
      detail: 'Up to three licensed heroes may now start together.',
    },
    {
      title: 'Level 3 coaches',
      detail: 'Regional-level coaches will consider the club once its Fame is high enough.',
    },
  ],
  2: [
    {
      title: 'Level 3 facilities',
      detail: 'The final upgrade tier is now available across the club grounds.',
    },
    {
      title: 'Elite Prospect scouting',
      detail: 'A new brief targets young players with four- or five-star potential.',
    },
    {
      title: 'Level 4 coaches',
      detail: 'National-level coaches will consider the club once its Fame is high enough.',
    },
  ],
  1: [
    {
      title: 'Fourth Hero License',
      detail: 'Up to four licensed heroes may now start together.',
    },
    {
      title: 'Level 5 coaches',
      detail: 'The best coaches in the game will consider the club once its Fame is high enough.',
    },
  ],
};

/**
 * Promotion rewards are permanent. A relegated club keeps the best tier it has
 * earned instead of losing facilities, staff access, or Hero Licenses.
 */
export function highestDivisionReached(state: GameState): DivisionLevel {
  if (state.careerMode !== 'full' || state.m2 === undefined) return 5;
  const current = currentUserDivision(state.m2);
  return Math.min(current, state.m2.highestDivisionReached ?? current) as DivisionLevel;
}

export function recordHighestDivisionReached(state: M2CareerState): M2CareerState {
  const current = currentUserDivision(state);
  const highest = Math.min(current, state.highestDivisionReached ?? current) as DivisionLevel;
  return state.highestDivisionReached === highest
    ? state
    : { ...state, highestDivisionReached: highest };
}

export function maxCareerFacilityLevel(state: GameState): FacilityLevel {
  if (state.careerMode !== 'full' || state.m2 === undefined) return MAX_FACILITY_LEVEL;
  const highest = highestDivisionReached(state);
  if (highest <= 2) return 3;
  if (highest <= 4) return 2;
  return 1;
}

export function facilityLevelUnlockDivision(level: FacilityLevel): DivisionLevel {
  if (level === 1) return 5;
  return level === 2 ? 4 : 2;
}

export function facilityUpgradeBlockedReason(
  state: GameState,
  targetLevel: FacilityLevel,
): string | undefined {
  if (targetLevel <= maxCareerFacilityLevel(state)) return undefined;
  return `Level ${targetLevel} facilities unlock in ${divisionTierLabel(facilityLevelUnlockDivision(targetLevel))}.`;
}

export function promotionRewardsForDivision(
  division: DivisionLevel,
): readonly PromotionReward[] {
  return division === 5 ? [] : PROMOTION_REWARDS[division];
}
