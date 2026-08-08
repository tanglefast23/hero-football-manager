import {
  careerContractPromiseHeroLimit,
  contractPromiseHeroLimitForDivision,
  currentUserDivision,
  leagueStandings,
  type GameState,
} from '../game';
import type { DivisionLevel } from '../game/pyramid';

/**
 * Hero License cap that season-end promises may use.
 *
 * Promotion is only applied when the next season begins, but renewals happen on
 * the review screen that has already announced the reward. Use the division the
 * final table is sending the club into, while preserving any larger permanent
 * cap earned before a later relegation.
 */
export function projectedSeasonEndContractPromiseHeroLimit(
  state: GameState,
): number {
  const liveLimit = careerContractPromiseHeroLimit(state);
  if (state.m2 === undefined) return liveLimit;
  const division = currentUserDivision(state.m2);
  const position = leagueStandings(state).find(
    (row) => row.clubId === state.userClubId,
  )?.position;
  if (position === undefined)
    throw new Error('the user club has no final standing');
  const nextDivision =
    position <= 2 && division > 1
      ? ((division - 1) as DivisionLevel)
      : division;
  return Math.max(liveLimit, contractPromiseHeroLimitForDivision(nextDivision));
}
