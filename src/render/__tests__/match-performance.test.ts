import {
  FRAME_PACING_SAMPLE_COUNT,
  PERFORMANCE_LIMIT_TTL_MS,
  createFramePacingMonitor,
  createMatchPerformanceLimit,
  isMatchPerformanceLimitActive,
  performanceAdaptationDecision,
  recordFrameGap,
} from '../match-performance';

function recordWindow(gaps: readonly number[]) {
  const monitor = createFramePacingMonitor();
  let result = null;
  for (const gap of gaps) result = recordFrameGap(monitor, gap) ?? result;
  return result;
}

describe('adaptive match performance', () => {
  it('accepts a full smooth 60Hz window', () => {
    const result = recordWindow(
      Array.from({ length: FRAME_PACING_SAMPLE_COUNT }, () => 1000 / 60),
    );
    expect(result).toMatchObject({ bad: false, framesOverTwoIntervals: 0 });
  });

  it('rejects a stable 30fps result instead of treating it as a 30Hz display', () => {
    const result = recordWindow(
      Array.from({ length: FRAME_PACING_SAMPLE_COUNT }, () => 1000 / 30),
    );
    expect(result).toMatchObject({ bad: true });
  });

  it('rejects a window when more than one percent of frames miss two intervals', () => {
    const gaps = Array.from(
      { length: FRAME_PACING_SAMPLE_COUNT },
      (_, index) => (index < 4 ? 50 : 1000 / 60),
    );
    const result = recordWindow(gaps);
    expect(result).toMatchObject({ bad: true, framesOverTwoIntervals: 4 });
  });

  it('resets a partial window after a lifecycle-sized gap', () => {
    const monitor = createFramePacingMonitor();
    for (let index = 0; index < 200; index += 1) recordFrameGap(monitor, 16.7);
    recordFrameGap(monitor, 1000);
    expect(monitor.gaps).toEqual([]);
  });

  it('creates a time-limited cap that can expire and be retried', () => {
    const limit = createMatchPerformanceLimit(1000);
    expect(limit.expiresAt).toBe(1000 + PERFORMANCE_LIMIT_TTL_MS);
    expect(isMatchPerformanceLimitActive(limit, limit.expiresAt - 1)).toBe(
      true,
    );
    expect(isMatchPerformanceLimitActive(limit, limit.expiresAt)).toBe(false);
    expect(isMatchPerformanceLimitActive(null, 1000)).toBe(false);
  });

  it('requires two bad windows for reduced effects and two more for a 2x cap', () => {
    let decision = performanceAdaptationDecision(0, false, true);
    expect(decision.action).toBe('none');
    decision = performanceAdaptationDecision(
      decision.consecutiveBadWindows,
      false,
      true,
    );
    expect(decision).toEqual({
      consecutiveBadWindows: 0,
      action: 'reduce-effects',
    });

    decision = performanceAdaptationDecision(0, true, true);
    expect(decision.action).toBe('none');
    decision = performanceAdaptationDecision(
      decision.consecutiveBadWindows,
      true,
      true,
    );
    expect(decision.action).toBe('limit-to-2x');
    expect(performanceAdaptationDecision(1, true, false).action).toBe('none');
  });
});
