import { countUpValue } from '../count-up';
import { shouldStartDevelopmentAnimation } from '../weekly-review-animation';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('countUpValue', () => {
  it('clamps progress and reaches positive and negative targets exactly', () => {
    expect(countUpValue(1_250, -1)).toBe(0);
    expect(countUpValue(1_250, 1)).toBe(1_250);
    expect(countUpValue(-450, 1)).toBe(-450);
    expect(countUpValue(1_250, Number.NaN)).toBe(0);
  });

  it('advances monotonically through the easing curve', () => {
    const frames = [0, 0.25, 0.5, 0.75, 1].map(progress => countUpValue(1_000, progress));
    expect(frames).toEqual([...frames].sort((left, right) => left - right));
    expect(frames[2]).toBeGreaterThan(500);
  });

  it('keeps weekly money, TP, and stat feedback animated until it lands or is skipped', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const review = readFileSync(join(process.cwd(), 'src/ui/screens/WeeklyReviewScreen.tsx'), 'utf8');
    const development = readFileSync(join(process.cwd(), 'src/ui/components/PlayerDevelopmentSpotlight.tsx'), 'utf8');

    expect(app).toContain('animationsReady={trainingTransition === null}');
    expect(review).toContain('AnimatedBalanceAmount');
    expect(review).toContain('useCelebratoryNumber');
    expect(review).toContain('animationsReady');
    expect(review).toContain('onScrollBeginDrag');
    expect(review).toContain('onStatAreaLayout');
    expect(review).toContain('countUpValue(to - from, progress)');
    expect(review).not.toContain('onTouchStart={finishAnimations}');
    expect(development).toContain('function CountedStat');
    expect(development).toContain('animationsStarted');
    expect(development).toContain('toValue: 1.18');
  });

  it('starts player development only after a manual scroll exposes the stat area', () => {
    expect(shouldStartDevelopmentAnimation({
      hasManuallyScrolled: false,
      scrollY: 700,
      viewportHeight: 700,
      statAreaY: 1_200,
    })).toBe(false);
    expect(shouldStartDevelopmentAnimation({
      hasManuallyScrolled: true,
      scrollY: 400,
      viewportHeight: 700,
      statAreaY: 1_200,
    })).toBe(false);
    expect(shouldStartDevelopmentAnimation({
      hasManuallyScrolled: true,
      scrollY: 548,
      viewportHeight: 700,
      statAreaY: 1_200,
    })).toBe(true);
  });
});
