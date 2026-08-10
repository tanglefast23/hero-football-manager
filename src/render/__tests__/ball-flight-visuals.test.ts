import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BALL_AIRBORNE_THRESHOLD_CM,
  ballFlightWhooshStarted,
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

  it('starts one whoosh when a flight crosses into the visible-shadow state', () => {
    expect(ballFlightWhooshStarted(0, 1)).toBe(false);
    expect(ballFlightWhooshStarted(0, BALL_AIRBORNE_THRESHOLD_CM)).toBe(true);
    expect(ballFlightWhooshStarted(2, 80)).toBe(false);
    expect(ballFlightWhooshStarted(80, 2)).toBe(false);
    expect(ballFlightWhooshStarted(2, 0)).toBe(false);

    const screen = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    expect(screen.match(/playBallFlightWhoosh\(\)/g)).toHaveLength(1);
    expect(screen).toContainSource(
      'ballFlightWhooshStarted(\n            prevRef.current!.ballHeight,\n            nextRef.current!.ballHeight,\n          )',
    );
  });
});
