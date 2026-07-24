/**
 * Career attributes are open-ended. Match calculations use this bounded,
 * diminishing conversion so probabilities, movement and authored power
 * thresholds stay stable as raw ratings grow into the hundreds.
 *
 * Ratings from 1–99 are unchanged. Above 99, each extra raw point contributes
 * less match strength and the effective value approaches 149.
 */
export const MAX_PLAYER_ATTRIBUTE = 999;
export const BASE_MOVEMENT_SPEED = 40;

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
 * PAC uses a flatter post-99 curve than invisible contest stats. A normally
 * developed division star stays around 25% faster than typical opposition.
 * The ordinary long-career band stays near a 38% soft target, then the rare
 * final stretch to 999 can reach the 60% hard endpoint versus typical D1 pace.
 */
export function matchPaceAttribute(rawPace: number): number {
  assertPlayerAttribute(rawPace);
  if (rawPace <= 99) return rawPace;
  const anchors = [
    [99, 99],
    [120, 102],
    [200, 108],
    [300, 113],
    [450, 120],
    [600, 126],
    [750, 132],
    [930, 138],
    [MAX_PLAYER_ATTRIBUTE, 168],
  ] as const;
  for (let index = 1; index < anchors.length; index += 1) {
    const [rightRaw, rightEffective] = anchors[index];
    if (rawPace > rightRaw) continue;
    const [leftRaw, leftEffective] = anchors[index - 1];
    return leftEffective + Math.round(
      (rawPace - leftRaw) * (rightEffective - leftEffective) / (rightRaw - leftRaw),
    );
  }
  return 168;
}

/** Full-condition movement speed before powers, tactics, or ball-carrying slowdowns. */
export function fullConditionMovementSpeed(rawPace: number): number {
  return BASE_MOVEMENT_SPEED + matchPaceAttribute(rawPace);
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
  const effectiveStamina = matchAttribute(rawStamina);
  if (effectiveStamina <= 99) return 1.6 - effectiveStamina * 0.006;
  return Math.max(0.65, 1.006 - (effectiveStamina - 99) * 0.008);
}

export function slideStaminaDrainScale(rawStamina: number): number {
  const effectiveStamina = matchAttribute(rawStamina);
  if (effectiveStamina <= 99) {
    return 1 + 0.6 * (100 - effectiveStamina) / 100;
  }
  return Math.max(0.65, 1.006 - (effectiveStamina - 99) * 0.009);
}

function assertPlayerAttribute(rawAttribute: number): void {
  if (!Number.isSafeInteger(rawAttribute)
    || rawAttribute < 1
    || rawAttribute > MAX_PLAYER_ATTRIBUTE) {
    throw new Error(`player attribute must be an integer from 1 to ${MAX_PLAYER_ATTRIBUTE}`);
  }
}
