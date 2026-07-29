import paceTable from './pace-table.json';
import staminaTables from './stamina-tables.json';

/**
 * Legacy bounded execution scale retained for the STA tables and the
 * non-PAC movement fallback. Ratio contests do not use this conversion:
 * contest, decision, and shot execution domains consume raw 1–999 ratings
 * through their fixed-point logarithm, while PAC owns its separate table.
 *
 * Ratings from 1–99 are unchanged. Above 99, each extra raw point contributes
 * less bounded execution strength and the effective value approaches 149.
 */
export const MAX_PLAYER_ATTRIBUTE = 999;
export const BASE_MOVEMENT_SPEED = 40;
export const PACE_SPEED_SCALE = paceTable.scale;
export const STAMINA_SCALE = staminaTables.scale;

export function matchAttribute(rawAttribute: number): number {
  if (!Number.isSafeInteger(rawAttribute)
    || rawAttribute < 1
    || rawAttribute > MAX_PLAYER_ATTRIBUTE) {
    throw new Error(`player attribute must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`);
  }
  if (rawAttribute <= 99) return rawAttribute;
  return 99 + Math.round(50 * (rawAttribute - 99) / (rawAttribute + 101));
}

/**
 * PAC uses its own fixed-point geometry curve. A normally
 * developed division star stays around 25% faster than typical opposition.
 * The ordinary long-career band stays near a 38% soft target, then the rare
 * final stretch to 999 can reach the 60% hard endpoint versus typical D1 pace.
 */
export function matchPaceAttribute(rawPace: number): number {
  assertPlayerAttribute(rawPace);
  return Math.max(1, Math.round(paceSpeed128(rawPace) / PACE_SPEED_SCALE) - BASE_MOVEMENT_SPEED);
}

/** Full-condition ordinary movement speed in 1/128 pitch units. */
export function paceSpeed128(rawPace: number): number {
  assertPlayerAttribute(rawPace);
  return paceTable.values[rawPace - 1];
}

/** Full-condition movement speed before powers, tactics, or ball-carrying slowdowns. */
export function fullConditionMovementSpeed(rawPace: number): number {
  return paceSpeed128(rawPace) / PACE_SPEED_SCALE;
}

export function paceAdvantagePercent(rawPace: number, comparisonRawPace: number): number {
  return Math.round(
    (fullConditionMovementSpeed(rawPace) / fullConditionMovementSpeed(comparisonRawPace) - 1)
    * 100,
  );
}

/**
 * Preserves the established 1–99 fatigue curve, then gives exceptional STA a
 * stronger but still bounded endurance benefit. Even STA 999 pays at least 65%
 * of ordinary movement cost, keeping substitutions and energy use relevant.
 */
export function staminaEnduranceScale(rawStamina: number): number {
  assertPlayerAttribute(rawStamina);
  return staminaTables.endurance[rawStamina - 1] / STAMINA_SCALE;
}

export function slideStaminaDrainScale(rawStamina: number): number {
  assertPlayerAttribute(rawStamina);
  return staminaTables.slide[rawStamina - 1] / STAMINA_SCALE;
}

function assertPlayerAttribute(rawAttribute: number): void {
  if (!Number.isSafeInteger(rawAttribute)
    || rawAttribute < 1
    || rawAttribute > MAX_PLAYER_ATTRIBUTE) {
    throw new Error(`player attribute must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`);
  }
}
