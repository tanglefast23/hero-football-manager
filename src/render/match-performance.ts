import type { MatchPerformanceLimit } from '../persistence';

export const FRAME_PACING_SAMPLE_COUNT = 300;
export const PERFORMANCE_LIMIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface FramePacingWindow {
  displayIntervalMs: number;
  p95GapMs: number;
  framesOverTwoIntervals: number;
  bad: boolean;
}

export interface FramePacingMonitor {
  gaps: number[];
}

export type PerformanceAdaptationAction =
  | 'none'
  | 'reduce-effects'
  | 'limit-to-2x';

export interface PerformanceAdaptationDecision {
  consecutiveBadWindows: number;
  action: PerformanceAdaptationAction;
}

export function createFramePacingMonitor(): FramePacingMonitor {
  return { gaps: [] };
}

export function resetFramePacingMonitor(monitor: FramePacingMonitor): void {
  monitor.gaps.length = 0;
}

/** Two confirmed windows are required at each stage. */
export function performanceAdaptationDecision(
  consecutiveBadWindows: number,
  reducedEffects: boolean,
  badWindow: boolean,
): PerformanceAdaptationDecision {
  if (!badWindow) return { consecutiveBadWindows: 0, action: 'none' };
  const next = consecutiveBadWindows + 1;
  if (next < 2) return { consecutiveBadWindows: next, action: 'none' };
  return {
    consecutiveBadWindows: 0,
    action: reducedEffects ? 'limit-to-2x' : 'reduce-effects',
  };
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
}

function inferredDisplayInterval(rawIntervalMs: number): number {
  // A loaded 60Hz phone can deliver every second callback at about 33ms. Do
  // not mistake that missed-frame cadence for a native 30Hz panel. The common
  // mobile refresh bands give the monitor a conservative display interval;
  // the absolute thresholds below still avoid punishing a 120Hz panel that is
  // delivering a steady, playable 60fps.
  if (rawIntervalMs >= 14) return 1000 / 60;
  if (rawIntervalMs >= 9.5) return 1000 / 90;
  if (rawIntervalMs >= 7.5) return 1000 / 120;
  return rawIntervalMs;
}

/**
 * Returns one completed window. Very large gaps are lifecycle or debugger
 * stalls, not evidence that 3x is too expensive, so callers reset them.
 */
export function recordFrameGap(
  monitor: FramePacingMonitor,
  gapMs: number,
): FramePacingWindow | null {
  if (!Number.isFinite(gapMs) || gapMs < 4 || gapMs > 250) {
    resetFramePacingMonitor(monitor);
    return null;
  }
  monitor.gaps.push(gapMs);
  if (monitor.gaps.length < FRAME_PACING_SAMPLE_COUNT) return null;

  const sorted = [...monitor.gaps].sort((a, b) => a - b);
  monitor.gaps.length = 0;
  // The fastest fifth estimates the panel cadence without letting missed
  // frames teach the monitor that a 30fps device has a 30fps display.
  const cadenceSamples = sorted.slice(
    0,
    Math.max(20, Math.ceil(sorted.length * 0.2)),
  );
  const displayIntervalMs = inferredDisplayInterval(
    percentile(cadenceSamples, 0.5),
  );
  const p95GapMs = percentile(sorted, 0.95);
  const p95LimitMs = Math.max(displayIntervalMs * 1.25, 24);
  const twoIntervalLimitMs = Math.max(displayIntervalMs * 2, 34);
  const framesOverTwoIntervals = sorted.filter(
    (gap) => gap > twoIntervalLimitMs,
  ).length;

  return {
    displayIntervalMs,
    p95GapMs,
    framesOverTwoIntervals,
    bad:
      p95GapMs > p95LimitMs ||
      framesOverTwoIntervals / sorted.length > 0.01,
  };
}

export function createMatchPerformanceLimit(
  now: number,
): MatchPerformanceLimit {
  return {
    maxMatchSpeed: 2,
    reason: 'frame-pacing',
    setAt: now,
    expiresAt: now + PERFORMANCE_LIMIT_TTL_MS,
  };
}

export function isMatchPerformanceLimitActive(
  limit: MatchPerformanceLimit | null | undefined,
  now = Date.now(),
): boolean {
  return limit !== null && limit !== undefined && limit.expiresAt > now;
}
