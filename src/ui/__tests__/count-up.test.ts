import { countUpValue } from '../count-up';
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

  it('keeps weekly money and TP feedback animated, and drills counting up in the popup', () => {
    const review = readFileSync(join(process.cwd(), 'src/ui/screens/WeeklyReviewScreen.tsx'), 'utf8');
    const popup = readFileSync(join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'), 'utf8');

    expect(review).toContain('countUpValue(to - from, progress)');
    // Development left the weekly review: gains animate in the drill popup now.
    expect(review).not.toContain('PlayerDevelopmentSpotlight');
    expect(popup).toContain('COUNT_UP_MS');
    expect(popup).toContain('SuperTrainingCelebration');
  });
});
