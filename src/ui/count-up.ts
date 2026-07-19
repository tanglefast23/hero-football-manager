/** Ease a signed whole-number amount from zero to its final value. */
export function countUpValue(target: number, progress: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const eased = 1 - (1 - clamped) ** 3;
  return Math.round(target * eased);
}
