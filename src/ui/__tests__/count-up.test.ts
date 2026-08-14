import { countUpValue } from '../count-up';
import {
  DRILL_PRESENTATION_SPEED,
  drillPresentationMs,
} from '../../render/drill-presentation-timing';
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
    const frames = [0, 0.25, 0.5, 0.75, 1].map((progress) =>
      countUpValue(1_000, progress),
    );
    expect(frames).toEqual([...frames].sort((left, right) => left - right));
    expect(frames[2]).toBeGreaterThan(500);
  });

  it('runs non-player drill presentation beats 25% faster', () => {
    expect(DRILL_PRESENTATION_SPEED).toBe(1.25);
    expect(drillPresentationMs(2_200)).toBe(1_760);
    expect(drillPresentationMs(1_400)).toBe(1_120);
    expect(drillPresentationMs(3_400)).toBe(2_720);
  });

  it('keeps weekly money/TP animated, and drills counting up in the drill scene', () => {
    const review = readFileSync(
      join(process.cwd(), 'src/ui/screens/WeeklyReviewScreen.tsx'),
      'utf8',
    );
    const popup = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );
    const scene = readFileSync(
      join(process.cwd(), 'src/render/DrillSceneOverlay.tsx'),
      'utf8',
    );
    const gainReveal = readFileSync(
      join(process.cwd(), 'src/ui/components/DrillGainReveal.tsx'),
      'utf8',
    );
    const superCelebration = readFileSync(
      join(process.cwd(), 'src/ui/components/SuperTrainingCelebration.tsx'),
      'utf8',
    );

    expect(review).toContain('countUpValue(to - from, progress)');
    expect(review.match(/playLedgerSpin\(\)/g) ?? []).toHaveLength(1);
    expect(review).toContain(
      'setTimeout(stopLedgerSpin, WEEKLY_MONEY_COUNT_MS)',
    );
    expect(review.match(/WEEKLY_MONEY_COUNT_MS,/g) ?? []).toHaveLength(3);
    expect(review).not.toMatch(
      /useCelebratoryNumber\([\s\S]{0,100}?,\s*(850|900),/,
    );
    expect(review).toContain('viewModel.cashBefore === viewModel.cashAfter');
    expect(review).toContain('stopLedgerSpin();');
    // Development left the weekly review: gains animate in the drill scene now.
    expect(review).not.toContain('PlayerDevelopmentSpotlight');
    // The popup delegates the result beat to the sprite scene, then the SUPER
    // fireworks, then the injury card.
    expect(popup).toContain('DrillSceneOverlay');
    expect(popup).toContain('SuperTrainingCelebration');
    expect(scene).toContain('DRILL_SCENE_MS');
    expect(scene).toContain('setCountedValue');
    // Once the count lands, the scene keeps only the final stat value. The gain
    // itself appears once, in the following full-screen result takeover.
    expect(scene).not.toContain('gainDelta');
    expect(scene).not.toContain('+{after - before} {shortCode}');
    // The count, scene, and both result takeovers share the 1.25x presentation
    // clock. The stage keeps its own unscaled real-time player movement.
    expect(scene).toContain('DRILL_SCENE_MS = drillPresentationMs(2_200)');
    expect(scene).toContain('COUNT_UP_MS = drillPresentationMs(1_400)');
    expect(scene).toContain(
      'setInterval(() => setSpriteFrame((frame) => frame + 1), 130)',
    );
    expect(scene).toContain(
      'elapsed.value = (info.timestamp - startedAt.value) / 1000',
    );
    expect(gainReveal).toContain(
      'DRILL_GAIN_REVEAL_MS = drillPresentationMs(1_400)',
    );
    expect(superCelebration).toContain(
      'SUPER_CELEBRATION_MS = drillPresentationMs(3_400)',
    );
    expect(popup).toContain(
      'PRESENTATION_SETTLE_MS = drillPresentationMs(350)',
    );
  });
});
