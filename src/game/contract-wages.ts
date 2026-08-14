import type { CareerPlayer } from './types';

export const PROMOTION_WAGE_CLAUSE_PERCENT = 25;

export function applyPromotionWageClause(
  player: CareerPlayer,
  completedSeason: number,
): CareerPlayer {
  if (!Number.isSafeInteger(completedSeason) || completedSeason < 1)
    throw new Error('completed season must be a positive safe integer');
  const percent = player.promotionWagePercent;
  if (percent === undefined) return player;
  if (!Number.isSafeInteger(percent) || percent < 1 || percent > 100)
    throw new Error('promotion wage percent must be from 1 to 100');
  const startsAfter = player.promotionWageStartsAfterSeason;
  if (startsAfter !== undefined) {
    if (!Number.isSafeInteger(startsAfter) || startsAfter < 1)
      throw new Error('promotion wage start season must be positive');
    if (completedSeason <= startsAfter) return player;
  }
  const weeklyWage = Math.round((player.weeklyWage * (100 + percent)) / 100);
  if (!Number.isSafeInteger(weeklyWage))
    throw new Error('promotion wage exceeds the safe integer range');
  return { ...player, weeklyWage };
}
