import { mulberry32 } from '../sim/rng';

/**
 * How much a player wants to stay, 0 to 100.
 *
 * Deliberately not morale. Morale is fast — it moves on results, recovers on
 * wins, and scales match attributes by ±10%. Loyalty is slow: nothing but the
 * manager's own decisions move it, it never recovers on its own, and its only
 * job is the price of the next contract. One sting you feel on Saturday, one
 * scar you meet at the negotiating table.
 *
 * "Only job" is a constraint, not a description. In particular loyalty must not
 * reach `isUnderpaidPlayer` in `player-wellbeing.ts`, which also prices a
 * renewal ask: feeding it there would make every refusal quietly raise the fair
 * wage line, adding a weekly morale drain that no button ever mentioned.
 */
export const INITIAL_LOYALTY_MIN = 60;
export const INITIAL_LOYALTY_MAX = 75;

/** Below this a player will not re-sign at any price; they run the deal down. */
export const LOYALTY_NO_RENEWAL_THRESHOLD = 30;

/** At or below this, loyalty reads in warning red on the player card. */
export const LOYALTY_WARNING_THRESHOLD = 40;

/**
 * Derived rather than stored at construction.
 *
 * Players are built in six separate places across the career, market, youth,
 * legacy, squad and onboarding modules. Initialising a field in all six is a
 * standing invitation to miss one, and a missed one surfaces as a player whose
 * loyalty reads as undefined at the negotiating table. Deriving it from the
 * career seed and the player's stable id gives every player a value from the
 * moment they exist — including everyone in every save written before this
 * feature — and nothing has to remember to do it.
 */
export function initialLoyalty(careerSeed: number, playerId: string): number {
  if (!Number.isInteger(careerSeed) || careerSeed < 0 || careerSeed > 4294967295) {
    throw new Error('loyalty career seed must be a uint32');
  }
  if (typeof playerId !== 'string' || playerId.trim().length === 0) {
    throw new Error('loyalty player ID must be a non-empty string');
  }
  const seed = (careerSeed ^ Math.imul(hashString(playerId), 0x9e3779b1)) >>> 0;
  const span = INITIAL_LOYALTY_MAX - INITIAL_LOYALTY_MIN + 1;
  return INITIAL_LOYALTY_MIN + Math.floor(mulberry32(seed)() * span);
}

/** The persisted value if the player has one, otherwise their derived value. */
export function playerLoyalty(
  player: { readonly id: string; readonly loyalty?: number },
  careerSeed: number,
): number {
  return player.loyalty ?? initialLoyalty(careerSeed, player.id);
}

export function adjustLoyalty(loyalty: number, delta: number): number {
  validateLoyalty(loyalty);
  if (!Number.isInteger(delta)) throw new Error('loyalty delta must be an integer');
  return Math.max(0, Math.min(100, loyalty + delta));
}

/**
 * Signed percentage points applied to the renewal ask, matching the shape of
 * the `growthSinceSigningPercent` and `famePercent` factors beside it. Loyalty
 * 100 asks for 20% less; loyalty 0 asks for 20% more.
 */
export function loyaltyRenewalPercent(loyalty: number): number {
  validateLoyalty(loyalty);
  return Math.round((50 - loyalty) * 0.4);
}

export function willRenegotiate(loyalty: number): boolean {
  validateLoyalty(loyalty);
  return loyalty >= LOYALTY_NO_RENEWAL_THRESHOLD;
}

function validateLoyalty(loyalty: number): void {
  if (!Number.isInteger(loyalty) || loyalty < 0 || loyalty > 100) {
    throw new Error('player loyalty must be an integer from 0 to 100');
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
