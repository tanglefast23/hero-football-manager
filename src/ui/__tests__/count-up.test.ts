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

  it('keeps weekly money/TP animated, and drills counting up in the drill scene', () => {
    const review = readFileSync(join(process.cwd(), 'src/ui/screens/WeeklyReviewScreen.tsx'), 'utf8');
    const popup = readFileSync(join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'), 'utf8');
    const scene = readFileSync(join(process.cwd(), 'src/render/DrillSceneOverlay.tsx'), 'utf8');

    expect(review).toContain('countUpValue(to - from, progress)');
    // Development left the weekly review: gains animate in the drill scene now.
    expect(review).not.toContain('PlayerDevelopmentSpotlight');
    // The popup delegates the result beat to the sprite scene, then the SUPER
    // fireworks, then the injury card.
    expect(popup).toContain('DrillSceneOverlay');
    expect(popup).toContain('SuperTrainingCelebration');
    expect(scene).toContain('DRILL_SCENE_MS');
    expect(scene).toContain('setCountedValue');
  });
});
