import { AWARD_CATEGORIES } from './division-leaders';
import type { AwardCategoryId, DivisionAwardPrize, SeasonRecap } from './types';

/**
 * What one division award is worth to a club entering the bottom tier.
 *
 * Paid in Training Points rather than cash, because docs/06-economy.md gives
 * each currency exactly one job: money is capacity, TP is improvement. The award
 * exists to help close a strength gap, which is improvement. Cash would also
 * make this the only reward in the game that quietly relieves the board
 * ultimatum, and a reward for individual brilliance should not be able to pay
 * off the chairman.
 *
 * Measured against the mini balance harness (200 seeds, season 1, Level-1
 * Training Pitch): 50.1 TP/week, 1,504 across the thirty-week season. So one
 * board is 8% of a season's income — about two and a half weeks, or a dozen
 * focus drills at 6-15 TP each — which is the case this number is tuned for.
 *
 * A four-board SWEEP is 480 TP, or 31.9% of that season, and the ratio only
 * climbs with the tier step: 53.2% at D1 measured against the same Level-1
 * baseline, 33.3% against the Level-2 pitch a club that has reached D1 would
 * realistically own. That is above the quarter-of-a-season ceiling the reward
 * was sized to respect, and it is recorded here rather than quietly smoothed
 * over: a sweep needs the club's forward, midfielder, defender AND keeper to
 * each top their board, so it is a rare season, but a rare season is exactly
 * where an outsized payout would land.
 */
export const DIVISION_AWARD_PRIZE_AT_D5 = 120;

/**
 * Added per tier climbed, so the prize is sized by what the club is about to
 * face. D5 120, D4 140, D3 160, D2 180, D1 200.
 */
export const DIVISION_AWARD_PRIZE_PER_TIER = 20;

const LOWEST_DIVISION = 5;

export interface DivisionAwardPrizeQuery {
  /** The completed season's recap, which carries the podiums this reads. */
  readonly recap: SeasonRecap;
  readonly userClubId: string;
  /**
   * The division the club is about to ENTER, not the one it just played.
   *
   * The prize is meant to help survive what comes next, so a champion's reward
   * is sized by the division above. Named rather than positional precisely
   * because the transition has both numbers in scope at the call site and they
   * are both small integers.
   */
  readonly targetDivision: number;
}

export function divisionAwardPrizePerCategory(targetDivision: number): number {
  if (!Number.isInteger(targetDivision)
    || targetDivision < 1
    || targetDivision > LOWEST_DIVISION) {
    throw new Error(`division ${targetDivision} is outside the five-tier pyramid`);
  }
  return DIVISION_AWARD_PRIZE_AT_D5
    + (LOWEST_DIVISION - targetDivision) * DIVISION_AWARD_PRIZE_PER_TIER;
}

/**
 * What the season's four division boards paid the user's club.
 *
 * Pure, and called twice: once by the awards ceremony to show a projection, and
 * once by the season transition to actually grant it. The transition is the only
 * caller that moves anything — see `startNextFullCareerSeason`.
 *
 * A category is won by whoever tops its podium. Ties share a rank on the board
 * itself, but the podium is already ordered by the leaderboard's player-ID
 * tiebreak, and that order decides who walks on as winner at the ceremony.
 * Paying anyone else would crown one player and pay another.
 */
export function divisionAwardPrize(query: DivisionAwardPrizeQuery): DivisionAwardPrize {
  const perCategory = divisionAwardPrizePerCategory(query.targetDivision);
  const awards = query.recap.divisionAwards;
  // Absent on saves written before the boards shipped. Those careers simply
  // have nothing to pay for; there is no history to reconstruct a podium from.
  const categoriesWon = awards === undefined
    ? []
    : (Object.keys(AWARD_CATEGORIES) as AwardCategoryId[])
      .filter(category => awards[category][0]?.clubId === query.userClubId);
  return { trainingPoints: categoriesWon.length * perCategory, categoriesWon };
}
