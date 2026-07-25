export type MatchSpeed = 1 | 2 | 3;

/**
 * Every selectable speed, in cycle order. The phone scorebar cycles through
 * them with nextMatchSpeed(); the desktop rail offers the same set as chips.
 */
export const MATCH_SPEEDS: readonly MatchSpeed[] = [1, 2, 3];

export function nextMatchSpeed(current: MatchSpeed): MatchSpeed {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return 1;
}

/**
 * Slowest wall-clock playback rate the frame clock will honour. Below this the
 * Reanimated interpolation window (TICK_MS / rate) grows past a second and the
 * sprites read as frozen rather than slowed; it also keeps the division safe.
 */
export const MIN_MATCH_PLAYBACK_RATE = 0.1;

/**
 * How fast the match plays in wall-clock terms: the player's chosen speed
 * multiplied by a presentation-only time dilation (1 = normal, <1 = slow-mo).
 *
 * This is purely a pacing number. The engine is a fixed-step 10Hz integer-tick
 * machine and tick() takes no delta, so the renderer's accumulator only decides
 * *when* each tick happens — never what it computes. A dilated rate therefore
 * produces a byte-identical tick sequence and identical RNG draws, which is why
 * slow-mo needs no ENGINE_VERSION bump.
 */
export function matchPlaybackRate(speed: MatchSpeed, timeDilation: number): number {
  return Math.max(MIN_MATCH_PLAYBACK_RATE, speed * timeDilation);
}
