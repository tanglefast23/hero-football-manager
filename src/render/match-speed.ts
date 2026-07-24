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
