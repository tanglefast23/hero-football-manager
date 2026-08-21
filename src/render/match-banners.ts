import type { MatchSpeed } from './match-speed';
import { tickerDurationMs } from './match-ticker';

/** Banner subjects whose newer message replaces the older one instead of
 * stacking beside it. A coaching tap shows its banner immediately, then the sim
 * confirms the same change a tick later; without replacement the player sees the
 * identical tile twice. */
export type MatchBannerSubject =
  | 'formation'
  | 'mentality'
  | 'energy'
  /**
   * A hero's charge lost for nothing. Kept as an identity for priority and
   * clearing, but repeated events never replace each other.
   */
  | 'power-wasted';

export interface SubjectedBanner {
  readonly subject?: MatchBannerSubject;
}

interface TickerLaneBanner extends SubjectedBanner {
  readonly lane: number;
  readonly size?: 'small' | 'big';
}

/**
 * Returns the two-lane slot for the next wasted-power line.
 *
 * A goal, half-time or full-time line has priority. Repeated wasted-power
 * lines also cross one at a time, in queue order.
 */
export function wastedPowerTickerLane(
  banners: readonly TickerLaneBanner[],
): number | null {
  if (
    banners.some(
      (banner) => banner.size === 'big' || banner.subject === 'power-wasted',
    )
  )
    return null;
  const occupied = banners.flatMap((banner) =>
    Array.from(
      { length: banner.size === 'big' ? 2 : 1 },
      (_unused, step) => banner.lane + step,
    ),
  );
  for (let lane = 0; lane <= 2; lane += 1) {
    if (!occupied.includes(lane) && !occupied.includes(lane + 1)) return lane;
  }
  return null;
}

/** Playing lines expire on sim ticks, so pauses and speed changes cannot eat them. */
export function wastedPowerBannerTiming(
  lifeTicks: number,
  speed: MatchSpeed,
  now: number,
  fulltime: boolean,
): { durationMs?: number; expiresAtMs?: number } {
  if (!fulltime) return {};
  const durationMs = tickerDurationMs(lifeTicks, speed);
  return { durationMs, expiresAtMs: now + durationMs };
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
    banner.subject === undefined || banner.subject === 'power-wasted'
      ? banners
      : banners.filter((existing) => existing.subject !== banner.subject);
  return [...kept, banner].slice(-4);
}
