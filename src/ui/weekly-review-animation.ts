export interface DevelopmentAnimationVisibility {
  hasManuallyScrolled: boolean;
  scrollY: number;
  viewportHeight: number;
  statAreaY: number | null;
}

const MINIMUM_VISIBLE_STAT_HEIGHT = 48;

export function shouldStartDevelopmentAnimation({
  hasManuallyScrolled,
  scrollY,
  viewportHeight,
  statAreaY,
}: DevelopmentAnimationVisibility): boolean {
  if (!hasManuallyScrolled || viewportHeight <= 0 || statAreaY === null) return false;
  return scrollY + viewportHeight >= statAreaY + MINIMUM_VISIBLE_STAT_HEIGHT;
}
