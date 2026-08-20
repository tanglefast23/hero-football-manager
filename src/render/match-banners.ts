/** Banner subjects whose newer message replaces the older one instead of
 * stacking beside it. A coaching tap shows its banner immediately, then the sim
 * confirms the same change a tick later; without replacement the player sees the
 * identical tile twice. */
export type MatchBannerSubject =
  | 'formation'
  | 'mentality'
  | 'energy'
  /**
   * A hero's charge lost for nothing. Subjected so a second loss REPLACES the
   * first rather than stacking two double-height lines over the pitch.
   */
  | 'power-wasted';

export interface SubjectedBanner {
  readonly subject?: MatchBannerSubject;
}

export function goalBannerPresentation(
  powered: boolean,
  scoringTeam: 0 | 1,
  controlledTeam: 0 | 1,
): { icon: '⚡' | '⚽'; tone: 'gold' | 'red' | 'blue' } {
  return {
    icon: powered ? '⚡' : '⚽',
    tone: scoringTeam !== controlledTeam ? 'red' : powered ? 'gold' : 'blue',
  };
}

/** Appends a banner, dropping any live banner that speaks about the same
 * control, and keeps only the newest four. Banners with no subject (goals,
 * half time, substitutions) always stack, because each one is its own event. */
export function appendBannerNewestFour<T extends SubjectedBanner>(
  banners: readonly T[],
  banner: T,
): T[] {
  const kept =
    banner.subject === undefined
      ? banners
      : banners.filter((existing) => existing.subject !== banner.subject);
  return [...kept, banner].slice(-4);
}
