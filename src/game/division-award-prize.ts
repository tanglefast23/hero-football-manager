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
 * Training Pitch): 50.1 TP/week, 1,504 across the thirty-week season. One board
 * is 8.0% of that — about two and a half weeks, or a dozen focus drills at 6-15
 * TP each — and one board is the case this number is tuned for.
 *
 * Re-run the measurement with
 * `src/audit/__tests__/division-award-prize-probe.test.ts` rather than trusting
 * the figures below; a comment rots, the probe does not.
 */
export const DIVISION_AWARD_PRIZE_AT_D5 = 120;

/**
 * Added per tier climbed, so the prize is sized by what the club is about to
 * face. D5 120, D4 140, D3 160, D2 180, D1 200.
 */
export const DIVISION_AWARD_PRIZE_PER_TIER = 20;

/**
 * Share of the division rate paid for the 1st, 2nd, 3rd and 4th board won.
 *
 * Flat pay per board put a sweep at 31.9% of a measured season's TP income —
 * above the quarter-of-a-season ceiling — while one board sat comfortably at
 * 8.0%. The taper fixes the case that was actually broken instead of cutting the
 * rate, which would have weakened the ordinary single-board win to solve a
 * problem that only exists at four.
 *
 * It also corrects the direction of the reward. The prize exists to help a club
 * beat the division it lost or survive the one it is promoted into. A club whose
 * forward, midfielder, defender AND keeper each top their board is the club
 * least in need of that help, so paying it four full rates would have paid the
 * most to whoever needed it least.
 *
 * Measured cumulative totals against that 1,504 TP season, at D5: one board 120
 * (8.0%), two 210 (14.0%), three 270 (18.0%), a sweep 300 (19.9%).
 *
 * Higher tiers read above a quarter against that same denominator — a D1 sweep
 * is 500 TP, or 33.2% — but the denominator is the wrong one for those rows. A
 * club still in D5 is the club on a Level-1 pitch; one that has climbed to D1
 * has built further, and against a Level-2 season (2,400 TP) a D1 sweep is
 * 20.8%. Every tier sits under a quarter of the income a club at that tier
 * plausibly earns, which is the rail. Re-derive all of it with the probe.
 *
 * Order does not matter: the multipliers are applied descending against the
 * COUNT of boards won, never against which boards they were. Winning goals and
 * saves pays exactly what winning tackles and passes pays.
 */
export const DIVISION_AWARD_PRIZE_TAPER_PERCENT: readonly number[] = Object.freeze(
  [100, 75, 50, 25],
);

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
 * The tapered total for winning `boardsWon` boards in one season.
 *
 * ROUNDING: each board's share is rounded to a whole TP on its own — half up,
 * via `Math.round` — and the rounded shares are then summed. Rounding per board
 * rather than once at the end is what lets a screen show the breakdown
 * (120 + 90 + 60 + 30) and have it add up to the total the club was paid. At the
 * shipped rates nothing rounds at all: every rate is a multiple of 20 and every
 * multiplier is a quarter. The rule is stated because a future retune to, say,
 * 130 would start exercising it.
 */
export function divisionAwardPrizeTotal(targetDivision: number, boardsWon: number): number {
  const perCategory = divisionAwardPrizePerCategory(targetDivision);
  if (!Number.isInteger(boardsWon) || boardsWon < 0) {
    throw new Error(`cannot pay for ${boardsWon} boards`);
  }
  if (boardsWon > DIVISION_AWARD_PRIZE_TAPER_PERCENT.length) {
    // A fifth board would need a fifth multiplier, which is a balance decision
    // and not something to extrapolate silently from a four-entry curve.
    throw new Error(`the taper prices at most ${DIVISION_AWARD_PRIZE_TAPER_PERCENT.length} boards`);
  }
  return DIVISION_AWARD_PRIZE_TAPER_PERCENT
    .slice(0, boardsWon)
    .reduce((total, percent) => total + Math.round(perCategory * percent / 100), 0);
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
 *
 * `categoriesWon` is reported in catalog order so the ceremony has something
 * stable to render, but the total reads only its LENGTH — which boards were won
 * cannot change what they are worth.
 */
export function divisionAwardPrize(query: DivisionAwardPrizeQuery): DivisionAwardPrize {
  const awards = query.recap.divisionAwards;
  // Absent on saves written before the boards shipped. Those careers simply
  // have nothing to pay for; there is no history to reconstruct a podium from.
  // `?? []` covers a record present but missing a category. The save codec
  // requires all four and `buildSeasonRecap` always writes all four, so this
  // should be unreachable — but the ceremony's view model already defends the
  // same state, and this is the caller that cannot afford not to. The display
  // blanks a board; the transition throws, and a throw here surfaces as an error
  // banner on every "start next season" tap, which is the permanently stranded
  // career the whole design exists to prevent.
  const categoriesWon = awards === undefined
    ? []
    : (Object.keys(AWARD_CATEGORIES) as AwardCategoryId[])
      .filter(category => (awards[category] ?? [])[0]?.clubId === query.userClubId);
  return {
    trainingPoints: divisionAwardPrizeTotal(query.targetDivision, categoriesWon.length),
    categoriesWon,
  };
}
