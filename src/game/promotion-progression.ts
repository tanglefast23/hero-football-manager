import { MAX_FACILITY_LEVEL, type FacilityLevel } from './facilities';
import { currentUserDivision, type M2CareerState } from './m2-career';
import { divisionTierLabel, type DivisionLevel } from './pyramid';
import type { GameState } from './types';

export interface PromotionReward {
  readonly title: string;
  readonly detail: string;
}

export const FIRST_D4_PROMOTION_RECRUITMENT_FUND = 15_000;

const PROMOTION_REWARDS: Readonly<Record<1 | 2 | 3 | 4, readonly PromotionReward[]>> = {
  4: [
    {
      title: 'Recruitment fund · $15,000',
      detail: 'The board added $15,000 to club funds. Use it to recruit a player who can help the club survive the County League.',
    },
    // No "Level 2 facilities" line: level 2 is now available from D5, so
    // advertising it here would promise a reward the club already has.
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
  if (state.m2 === undefined) return 5;
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
  if (state.m2 === undefined) return MAX_FACILITY_LEVEL;
  // Level 2 is available from D5. Gating it behind D4 locked the club's main
  // training accelerator behind the very promotion it was needed to achieve:
  // measured, 0 promotions across 6 careers x 10 seasons. Level 3 still waits
  // for D2 so the upgrade ladder keeps a promotion payoff at the top.
  const highest = highestDivisionReached(state);
  return highest <= 2 ? 3 : 2;
}

export function facilityLevelUnlockDivision(level: FacilityLevel): DivisionLevel {
  return level <= 2 ? 5 : 2;
}

export function facilityUpgradeBlockedReason(
  state: GameState,
  targetLevel: FacilityLevel,
): string | undefined {
  if (targetLevel <= maxCareerFacilityLevel(state)) return undefined;
  return `Level ${targetLevel} facilities unlock in ${divisionTierLabel(facilityLevelUnlockDivision(targetLevel))}.`;
}

export type TrainingDrillTier = 1 | 2 | 3;

export function trainingDrillTier(drillId: string): TrainingDrillTier {
  if (drillId.endsWith('-iii')) return 3;
  if (drillId.endsWith('-ii')) return 2;
  return 1;
}

export function trainingDrillUnlockDivision(tier: TrainingDrillTier): DivisionLevel {
  // Tier 2 drills open at D5 for the same reason level-2 facilities do.
  return tier <= 2 ? 5 : 2;
}

/** Drill unlocks are permanent once their division has been reached. */
export function trainingDrillBlockedReason(
  state: GameState,
  drillId: string,
): string | undefined {
  if (state.m2 === undefined) return undefined;
  const tier = trainingDrillTier(drillId);
  const requiredDivision = trainingDrillUnlockDivision(tier);
  if (highestDivisionReached(state) <= requiredDivision) return undefined;
  return `Tier ${tier} drills unlock in ${divisionTierLabel(requiredDivision)}.`;
}

export function promotionRewardsForDivision(
  division: DivisionLevel,
): readonly PromotionReward[] {
  return division === 5 ? [] : PROMOTION_REWARDS[division];
}
