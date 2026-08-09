export type MatchSpeed = 1 | 2 | 3;

/**
 * Every selectable speed, in cycle order. The phone scorebar cycles through
 * them with nextMatchSpeed(); the desktop rail offers the same set as chips.
 */
export const MATCH_SPEEDS: readonly MatchSpeed[] = [1, 2, 3];

export function availableMatchSpeeds(
  maximum: MatchSpeed,
): readonly MatchSpeed[] {
  return MATCH_SPEEDS.filter((speed) => speed <= maximum);
}

export function nextMatchSpeed(
  current: MatchSpeed,
  maximum: MatchSpeed = 3,
): MatchSpeed {
  if (current === 1) return 2;
  if (current === 2) return maximum >= 3 ? 3 : 1;
  return 1;
}

/**
 * Slowest wall-clock playback rate the frame clock will honour. Below this the
 * Reanimated interpolation window (TICK_MS / rate) grows past a second and the
 * sprites read as frozen rather than slowed; it also keeps the division safe.
 */
export const MIN_MATCH_PLAYBACK_RATE = 0.1;

/** The player's chosen wall-clock match speed. */
export function matchPlaybackRate(speed: MatchSpeed): number {
  return speed;
}
