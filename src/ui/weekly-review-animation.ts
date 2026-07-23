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
  if (viewportHeight <= 0 || statAreaY === null) return false;
  const statAreaVisible = scrollY + viewportHeight >= statAreaY + MINIMUM_VISIBLE_STAT_HEIGHT;
  if (!statAreaVisible) return false;
  // Start once the stats are on screen — either the player scrolled to them, or
  // they were already fully visible without any scroll (light weeks, tablets).
  // Without this second case the count-up stays stuck on the pre-training values.
  const visibleWithoutScrolling = statAreaY + MINIMUM_VISIBLE_STAT_HEIGHT <= viewportHeight;
  return hasManuallyScrolled || visibleWithoutScrolling;
}
