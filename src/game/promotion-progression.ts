import { MAX_FACILITY_LEVEL, type FacilityLevel } from './facilities';
import { currentUserDivision, type M2CareerState } from './m2-career';
import {
  DIVISION_NAMES,
  DIVISION_NAME_KEYS,
  divisionTierLabel,
  type DivisionLevel,
} from './pyramid';
import type { GameState } from './types';

/**
 * Raw values for a key's placeholders, mirroring `LedgerLine.labelParams`.
 *
 * Never pre-formatted text: `{ cost: 3000 }`, not `{ cost: '$3,000' }`. This
 * ring cannot know the player's language, so grouping separators are the UI's
 * job — baking one in here would freeze English digit grouping into every
 * translation.
 */
type RewardParams = Readonly<Record<string, string | number>>;

interface PromotionReward {
  /**
   * English, still written on every reward.
   *
   * The catalog keys below are what a translated screen renders; this stays as
   * the fallback if a key is ever dropped, and it is what the callers that have
   * not adopted the keys yet still read.
   */
  readonly title: string;
  readonly detail: string;
  /** Catalog keys for `title` and `detail`, so the screen can render either. */
  readonly titleKey: string;
  readonly detailKey: string;
  /** Raw values for the two keys' placeholders. */
  readonly params?: RewardParams;
}

export const FIRST_D4_PROMOTION_RECRUITMENT_FUND = 15_000;

export type TrainingDrillTier = 1 | 2 | 3 | 4 | 5;

export const MAX_TRAINING_DRILL_TIER: TrainingDrillTier = 5;

/** Fielded Hero License cap associated with one reached division tier. */
export function heroLicenseLimitForDivision(
  division: DivisionLevel,
): 2 | 3 | 4 {
  if (division === 1) return 4;
  if (division <= 3) return 3;
  return 2;
}

const TRAINING_DRILL_TIER_SUFFIX: Readonly<Record<TrainingDrillTier, string>> =
  {
    1: '',
    2: '-ii',
    3: '-iii',
    4: '-iv',
    5: '-v',
  };

/**
 * What the club pays, per path, to own the next tier. Reaching the division
 * only puts the upgrade on the shelf; buying it, seven paths over, is the
 * decision. Each price is roughly the previous one doubled, so no club ever
 * owns the whole board at once.
 */
const TRAINING_DRILL_UPGRADE_COST: Readonly<
  Record<Exclude<TrainingDrillTier, 1>, number>
> = {
  2: 3_000,
  3: 8_000,
  4: 18_000,
  5: 40_000,
};

/**
 * `<key>.title` and `<key>.detail`, so a reward names one catalog entry.
 *
 * @i18n-fallback — the English arrives here as arguments and is kept beside the
 * keys as the fallback. `src/game` may not import `src/i18n`, so the UI resolves
 * `titleKey`/`detailKey` and only falls back to these words if a key is missing.
 */
function reward(key: string, title: string, detail: string): PromotionReward {
  return {
    title,
    detail,
    titleKey: `${key}.title`,
    detailKey: `${key}.detail`,
  };
}

function drillTierReward(tier: Exclude<TrainingDrillTier, 1>): PromotionReward {
  const cost = TRAINING_DRILL_UPGRADE_COST[tier];
  return {
    ...reward(
      'promotion.drillTier',
      `Tier ${tier} drills · $${cost.toLocaleString('en-US')} each`,
      'On sale in the squad room, one training path at a time. Reaching the division puts them on the shelf; the club still has to buy them.',
    ),
    params: { tier, cost },
  };
}

const PROMOTION_REWARDS: Readonly<
  Record<1 | 2 | 3 | 4, readonly PromotionReward[]>
> = {
  4: [
    {
      ...reward(
        'promotion.recruitmentFund',
        `Recruitment fund · $${FIRST_D4_PROMOTION_RECRUITMENT_FUND.toLocaleString('en-US')}`,
        `The board added $${FIRST_D4_PROMOTION_RECRUITMENT_FUND.toLocaleString('en-US')} to club funds. Use it to recruit a player who can help the club survive the County League.`,
      ),
      params: { amount: FIRST_D4_PROMOTION_RECRUITMENT_FUND },
    },
    drillTierReward(2),
    // No "Level 2 facilities" line: level 2 is now available from D5, so
    // advertising it here would promise a reward the club already has.
    reward(
      'promotion.internationalScouting',
      'International scouting',
      'A second overseas brief is added to each scouting shortlist.',
    ),
    reward(
      'promotion.levelTwoCoaches',
      'Level 2 coaches',
      'County-level coaches will take the call once the club has enough Fame.',
    ),
  ],
  3: [
    drillTierReward(3),
    reward(
      'promotion.rumoredHeroScouting',
      'Rumored Hero scouting',
      'The scout can follow expensive leads for players who may already have powers.',
    ),
    reward(
      'promotion.thirdHeroLicense',
      'Third Hero License',
      'Up to three licensed heroes may now start together.',
    ),
    reward(
      'promotion.levelThreeCoaches',
      'Level 3 coaches',
      'Regional-level coaches will consider the club once its Fame is high enough.',
    ),
  ],
  2: [
    drillTierReward(4),
    reward(
      'promotion.levelThreeFacilities',
      'Level 3 facilities',
      'The final upgrade tier is now available across the club grounds.',
    ),
    reward(
      'promotion.eliteProspectScouting',
      'Elite Prospect scouting',
      'A new brief targets young players with four- or five-star potential.',
    ),
    reward(
      'promotion.levelFourCoaches',
      'Level 4 coaches',
      'National-level coaches will consider the club once its Fame is high enough.',
    ),
  ],
  1: [
    drillTierReward(5),
    reward(
      'promotion.fourthHeroLicense',
      'Fourth Hero License',
      'Up to four licensed heroes may now start together.',
    ),
    reward(
      'promotion.levelFiveCoaches',
      'Level 5 coaches',
      'The best coaches in the game will consider the club once its Fame is high enough.',
    ),
  ],
};

/**
 * Promotion rewards are permanent. A relegated club keeps the best tier it has
 * earned instead of losing facilities, staff access, or Hero Licenses.
 */
export function highestDivisionReached(state: GameState): DivisionLevel {
  if (state.m2 === undefined) return 5;
  const current = currentUserDivision(state.m2);
  return Math.min(
    current,
    state.m2.highestDivisionReached ?? current,
  ) as DivisionLevel;
}

export function recordHighestDivisionReached(
  state: M2CareerState,
): M2CareerState {
  const current = currentUserDivision(state);
  const highest = Math.min(
    current,
    state.highestDivisionReached ?? current,
  ) as DivisionLevel;
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

function facilityLevelUnlockDivision(level: FacilityLevel): DivisionLevel {
  return level <= 2 ? 5 : 2;
}

/**
 * One refusal in both halves: the English this ring writes, and the catalog key
 * the screen renders instead.
 *
 * Structurally `RingCopy` in `src/application/copy-fallback.ts`, which resolves
 * it — the interface cannot live there, because `src/game` may not import
 * outward. The same dual write as `RenewalBlockedCopy` and `RetirementCopy`.
 */
export interface BlockedCopy {
  readonly text: string;
  readonly textKey: string;
  /** Raw values for the key's placeholders. Never pre-formatted text. */
  readonly textParams?: Readonly<Record<string, string | number>>;
}

/**
 * The division a sentence names, in both halves.
 *
 * `divisionTierLabel` composes `D3 · Regional League` in English, and the
 * translated half has to keep that shape — so the tier number and the name are
 * separate placeholders and the name carries its own key. `translatedParams`
 * pairs `<param>Key` with `<param>`, so `divisionNameKey` is what swaps the
 * English name out; without it a translated sentence still ends in "County
 * League", which is the exact defect that put `DIVISION_NAME_KEYS` beside
 * `DIVISION_NAMES`.
 */
function divisionParams(
  level: DivisionLevel,
): Readonly<Record<string, string | number>> {
  return {
    divisionLevel: level,
    divisionName: DIVISION_NAMES[level],
    divisionNameKey: DIVISION_NAME_KEYS[level],
  };
}

export function facilityUpgradeBlockedReason(
  state: GameState,
  targetLevel: FacilityLevel,
): BlockedCopy | undefined {
  if (targetLevel <= maxCareerFacilityLevel(state)) return undefined;
  const division = facilityLevelUnlockDivision(targetLevel);
  return {
    /** @i18n-fallback for `clubFinances.facilityLevelUnlocksIn`. */
    text: `Level ${targetLevel} facilities unlock in ${divisionTierLabel(division)}.`,
    textKey: 'clubFinances.facilityLevelUnlocksIn',
    textParams: { level: targetLevel, ...divisionParams(division) },
  };
}

export function trainingDrillTier(drillId: string): TrainingDrillTier {
  if (drillId.endsWith('-iii')) return 3;
  if (drillId.endsWith('-iv')) return 4;
  if (drillId.endsWith('-ii')) return 2;
  if (drillId.endsWith('-v')) return 5;
  return 1;
}

export function trainingDrillIdForTier(
  pathId: string,
  tier: TrainingDrillTier,
): string {
  return `${pathId}${TRAINING_DRILL_TIER_SUFFIX[tier]}`;
}

export function trainingDrillUpgradeCost(tier: TrainingDrillTier): number {
  if (tier === 1)
    throw new Error('tier 1 drills are owned from the first day of the career');
  return TRAINING_DRILL_UPGRADE_COST[tier];
}

/** One division per tier: D5 owns tier 1, D4 sells tier 2, and so on to D1. */
function trainingDrillUnlockDivision(tier: TrainingDrillTier): DivisionLevel {
  return (6 - tier) as DivisionLevel;
}

/**
 * Why this tier cannot be bought yet. Reaching the division is permanent, so a
 * relegated club keeps everything it has already been offered — and everything
 * it has already paid for.
 */
export function trainingDrillBlockedReason(
  state: GameState,
  drillId: string,
): BlockedCopy | undefined {
  if (state.m2 === undefined) return undefined;
  const tier = trainingDrillTier(drillId);
  const requiredDivision = trainingDrillUnlockDivision(tier);
  if (highestDivisionReached(state) <= requiredDivision) return undefined;
  return {
    /** @i18n-fallback for `squadTraining.drillTierUnlocksIn`. */
    text: `Tier ${tier} drills unlock in ${divisionTierLabel(requiredDivision)}.`,
    textKey: 'squadTraining.drillTierUnlocksIn',
    textParams: { tier, ...divisionParams(requiredDivision) },
  };
}

/**
 * Every league position receives a season-end purse. First and second keep the
 * promotion-scale prizes; the lower places taper quickly so survival money is
 * useful without competing with the promotion reward.
 */
const LEAGUE_PRIZES_BY_DIVISION: Readonly<
  Record<DivisionLevel, readonly number[]>
> = {
  5: [20_000, 10_000, 6_000, 5_000, 4_000, 3_000, 2_000, 1_500, 1_000, 500],
  4: [30_000, 15_000, 9_000, 7_000, 5_500, 4_500, 3_500, 2_500, 1_500, 1_000],
  3: [40_000, 20_000, 12_000, 10_000, 7_500, 6_000, 4_500, 3_000, 2_000, 1_000],
  2: [50_000, 25_000, 15_000, 12_000, 9_500, 7_500, 5_500, 4_000, 2_500, 1_500],
  1: [60_000, 30_000, 18_000, 14_500, 11_500, 9_000, 6_500, 5_000, 3_000, 2_000],
};

export function leaguePrizeMoney(
  division: DivisionLevel,
  position: number,
): number {
  if (!Number.isInteger(position) || position < 1 || position > 10) return 0;
  return LEAGUE_PRIZES_BY_DIVISION[division][position - 1] ?? 0;
}

export function promotionRewardsForDivision(
  division: DivisionLevel,
): readonly PromotionReward[] {
  return division === 5 ? [] : PROMOTION_REWARDS[division];
}
