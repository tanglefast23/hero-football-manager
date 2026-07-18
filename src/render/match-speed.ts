export type MatchSpeed = 1 | 2 | 3;

export function nextMatchSpeed(current: MatchSpeed): MatchSpeed {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return 1;
}
