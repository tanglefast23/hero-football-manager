import { displayedValue } from '../game/training';
import { keeperDisplayLadderMultiplier } from '../game/training-paths';
import type { CareerPlayer, GameState } from '../game/types';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { Attrs } from '../sim/types';

/**
 * The single place a player's *displayed* attribute differs from the stored one.
 *
 * Keeper Drills award less than the outfield ladder at every tier for the same
 * TP — deliberately, because Reflexes is contested on every shot faced — so a
 * keeper's card looks short-changed when the truth is the opposite.
 * `refDisplayBonus` banks the shortfall so the card reads as though both paths
 * used the outfield ladder.
 *
 * Everything on screen that prints a Reflexes value or a Keeper Drills gain goes
 * through this module, for two reasons: there is one place to audit that the
 * bonus never reaches the sim, and one file to delete when the axis is rescaled
 * for real. See docs/superpowers/plans/2026-08-04-keeper-drill-display-parity.md.
 *
 * Nothing here is read by `src/sim/`, `lineup.ts`, `squad.ts` or `market.ts`.
 * The match engine, the scout, the wage and the transfer fee all see `attrs`.
 */

/**
 * What the card shows for one attribute, bonus included and ceiling applied.
 *
 * Delegates rather than reimplements: the confirm-card preview needs the same
 * rule and lives in `src/game/`, which cannot import this layer. One rule, two
 * doors.
 */
export function displayedAttributeValue(
  player: CareerPlayer,
  attribute: keyof Attrs,
): number {
  return displayedValue(player, attribute);
}

/**
 * The display stalls at the shared ceiling while the true stat keeps climbing.
 *
 * Deliberate (plan Q3): every other attribute stops at 999, letting this one
 * print above would break the range they are all validated on, and dropping the
 * bonus to reveal the truth would make a keeper's Reflexes visibly fall
 * mid-career with no in-game cause.
 */
export function displayedAttributeCeiling(value: number): number {
  return Math.min(MAX_PLAYER_ATTRIBUTE, value);
}

/**
 * What a drill row advertises, which for the keeper ladder is the outfield
 * number. Takes the authored gain so the caller keeps whatever it already read.
 */
export function displayedDrillGain(
  state: GameState,
  drillId: string,
  gain: number,
): number {
  return Math.round(gain * keeperDisplayLadderMultiplier(state, drillId));
}
