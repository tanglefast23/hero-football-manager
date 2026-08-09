/** Banner subjects whose newer message replaces the older one instead of
 * stacking beside it. A coaching tap shows its banner immediately, then the sim
 * confirms the same change a tick later; without replacement the player sees the
 * identical tile twice. */
export type MatchBannerSubject = 'formation' | 'mentality' | 'energy';

export interface SubjectedBanner {
  readonly subject?: MatchBannerSubject;
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
