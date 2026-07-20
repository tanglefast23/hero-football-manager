import {
  BALL_AIRBORNE_THRESHOLD_CM,
  ballHeightScale,
  ballShadowOpacity,
  ballShadowRadius,
  ballVisualOffset,
} from '../ball-flight-visuals';

describe('airborne ball presentation', () => {
  it('separates a typical lifted ball clearly from its ground shadow on a phone pitch', () => {
    const phonePitchScale = 390 / 6800;
    expect(ballVisualOffset(200, phonePitchScale)).toBeGreaterThan(35);
    expect(ballVisualOffset(200, phonePitchScale)).toBeLessThan(48);
    expect(ballShadowRadius(20)).toBeGreaterThan(ballShadowRadius(200));
    expect(ballShadowRadius(200)).toBeGreaterThanOrEqual(5.5);
    expect(ballShadowOpacity(200)).toBeGreaterThanOrEqual(0.38);
    expect(ballShadowOpacity(200)).toBeLessThanOrEqual(0.55);
    expect(ballHeightScale(0)).toBe(1);
    expect(ballHeightScale(200)).toBeCloseTo(1.1);
    expect(ballHeightScale(400)).toBeCloseTo(1.1);
  });

  it('keeps grounded balls shadow-free while making even a low lift eligible', () => {
    expect(0).toBeLessThan(BALL_AIRBORNE_THRESHOLD_CM);
    expect(10).toBeGreaterThan(BALL_AIRBORNE_THRESHOLD_CM);
    expect(ballVisualOffset(0, 0.05)).toBe(0);
  });
});
